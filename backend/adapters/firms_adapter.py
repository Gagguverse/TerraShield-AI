"""NASA FIRMS data adapter for satellite hotspot ingestion.

Supports both official historical VIIRS sample CSV files and live NASA FIRMS API.
Normalizes columns, validates geographic coordinates, and preserves data provenance.
"""

import asyncio
import csv
import json
import logging
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import httpx

from backend.config import settings
from backend.models.detection import SatelliteDetection

logger = logging.getLogger("terrashield.firms")

TRANSIENT_STATUS_CODES = {502, 503, 504}
TRANSIENT_EXCEPTIONS = (
    httpx.TimeoutException,
    httpx.ConnectError,
    httpx.ConnectTimeout,
    httpx.ReadTimeout,
    httpx.RemoteProtocolError,
    httpx.NetworkError,
)
MAX_RETRIES = 3
INITIAL_BACKOFF_SECONDS = 0.8
HTTP_TIMEOUT = httpx.Timeout(connect=5.0, read=15.0, write=5.0, pool=5.0)


class FirmsAdapter:
    def __init__(self, sample_csv_path: Optional[Path] = None):
        self.sample_csv_path = sample_csv_path or settings.FIRMS_SAMPLE_CSV_PATH
        self._cache_dir: Path = settings.DATA_DIR / "cache"
        self._cache_file: Path = self._cache_dir / "firms_live_cache.json"
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._load_disk_cache()

    def _load_disk_cache(self) -> None:
        """Load persistent cache from disk if available."""
        try:
            if self._cache_file.exists():
                with open(self._cache_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, dict):
                        self._cache = data
                        logger.info(f"Loaded {len(self._cache)} cached FIRMS response(s) from disk.")
        except Exception as e:
            logger.warning(f"Could not load FIRMS disk cache: {e}")

    def _save_disk_cache(self) -> None:
        """Write current cache to disk."""
        try:
            self._cache_dir.mkdir(parents=True, exist_ok=True)
            with open(self._cache_file, "w", encoding="utf-8") as f:
                json.dump(self._cache, f, indent=2)
        except Exception as e:
            logger.warning(f"Could not persist FIRMS cache to disk: {e}")

    @staticmethod
    def _mask_sensitive(text: str) -> str:
        """Scrub secret API key from URLs, logs, and error messages."""
        if not text:
            return ""
        key = settings.FIRMS_MAP_KEY
        if key and len(key) >= 8 and key in text:
            return text.replace(key, "***REDACTED***")
        return text

    def get_cached_telemetry(
        self, area: str, source: str
    ) -> Tuple[List[SatelliteDetection], Optional[str]]:
        """Retrieve cached live telemetry tagged as CACHED with its retrieval timestamp."""
        area_coords = area
        if area in settings.MONITORING_REGIONS:
            area_coords = settings.MONITORING_REGIONS[area]["bbox"]

        cache_key = f"{source}_{area_coords}"
        entry = self._cache.get(cache_key) or self._cache.get(area_coords)

        # Fallback to any recent valid cache entry
        if not entry and self._cache:
            entry = next(iter(self._cache.values()))

        if not entry or "detections" not in entry or not entry["detections"]:
            return [], None

        detections: List[SatelliteDetection] = []
        for d_dict in entry["detections"]:
            try:
                d_copy = dict(d_dict)
                d_copy["data_mode"] = "CACHED"
                if "id" in d_copy and d_copy["id"].startswith("FIRMS-LIVE"):
                    d_copy["id"] = d_copy["id"].replace("FIRMS-LIVE", "FIRMS-CACH")
                detections.append(SatelliteDetection.model_validate(d_copy))
            except Exception:
                pass

        return detections, entry.get("timestamp")

    def save_cache_telemetry(
        self, area: str, source: str, day_range: int, detections: List[SatelliteDetection]
    ) -> None:
        """Cache a successful live response with current UTC timestamp."""
        if not detections:
            return
        area_coords = area
        if area in settings.MONITORING_REGIONS:
            area_coords = settings.MONITORING_REGIONS[area]["bbox"]

        cache_key = f"{source}_{area_coords}"
        ts = datetime.now(timezone.utc).isoformat()
        self._cache[cache_key] = {
            "timestamp": ts,
            "source": source,
            "area": area_coords,
            "day_range": day_range,
            "detections": [d.model_dump() for d in detections],
        }
        self._save_disk_cache()

    def normalize_confidence(self, raw_val: any) -> Tuple[str, float]:
        """Normalize VIIRS (l/n/h) and MODIS (0-100) confidence fields."""
        if raw_val is None:
            return "nominal", 0.70

        str_val = str(raw_val).strip().lower()

        if str_val in ("h", "high"):
            return "high", 0.95
        elif str_val in ("n", "nominal", "med", "medium"):
            return "nominal", 0.70
        elif str_val in ("l", "low"):
            return "low", 0.35

        try:
            num = float(str_val)
            if 0.0 <= num <= 100.0:
                score = num / 100.0
                if score >= 0.8:
                    return "high", score
                elif score >= 0.4:
                    return "nominal", score
                else:
                    return "low", score
        except ValueError:
            pass

        return "nominal", 0.70

    def parse_time(self, acq_date: str, acq_time_raw: any) -> Tuple[str, str]:
        """Convert acq_date and acq_time (e.g. 3, 1530) to formatted HH:MM and ISO8601."""
        time_str = str(acq_time_raw or "0").strip()
        # FIRMS acq_time is often integer like 3 (00:03) or 1435 (14:35)
        time_str = time_str.zfill(4)
        hh = time_str[:2]
        mm = time_str[2:4]
        formatted_time = f"{hh}:{mm}"

        try:
            dt = datetime.strptime(f"{acq_date} {formatted_time}", "%Y-%m-%d %H:%M").replace(
                tzinfo=timezone.utc
            )
            iso_time = dt.isoformat()
        except Exception:
            iso_time = f"{acq_date}T{formatted_time}:00Z"

        return formatted_time, iso_time

    def parse_row(
        self, row: Dict[str, str], row_idx: int, data_mode: str = "HISTORICAL_SAMPLE"
    ) -> Optional[SatelliteDetection]:
        """Parse, validate, and normalize a single FIRMS CSV row."""
        try:
            # Validate coordinates
            lat_raw = row.get("latitude")
            lon_raw = row.get("longitude")
            if not lat_raw or not lon_raw:
                return None

            lat = float(lat_raw)
            lon = float(lon_raw)

            if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
                logger.warning(f"Row {row_idx}: Coordinate out of bounds ({lat}, {lon})")
                return None

            acq_date = row.get("acq_date", "2023-07-12").strip()
            acq_time_raw = row.get("acq_time", "0")
            formatted_time, iso_timestamp = self.parse_time(acq_date, acq_time_raw)

            # Brightness temperature (VIIRS bright_ti4 or MODIS brightness)
            bright_ti4 = None
            if "bright_ti4" in row and row["bright_ti4"]:
                try:
                    bright_ti4 = float(row["bright_ti4"])
                except ValueError:
                    pass
            elif "brightness" in row and row["brightness"]:
                try:
                    bright_ti4 = float(row["brightness"])
                except ValueError:
                    pass

            bright_ti5 = None
            if "bright_ti5" in row and row["bright_ti5"]:
                try:
                    bright_ti5 = float(row["bright_ti5"])
                except ValueError:
                    pass

            frp = None
            if "frp" in row and row["frp"]:
                try:
                    frp = float(row["frp"])
                except ValueError:
                    pass

            scan = None
            if "scan" in row and row["scan"]:
                try:
                    scan = float(row["scan"])
                except ValueError:
                    pass

            track = None
            if "track" in row and row["track"]:
                try:
                    track = float(row["track"])
                except ValueError:
                    pass

            conf_label, conf_score = self.normalize_confidence(row.get("confidence"))
            satellite = row.get("satellite", "N").strip()
            instrument = row.get("instrument", "VIIRS").strip()
            daynight = row.get("daynight", "D").strip().upper()

            detection_id = f"FIRMS-{data_mode[:4]}-{row_idx}-{int(lat*100)}-{int(lon*100)}"

            return SatelliteDetection(
                id=detection_id,
                latitude=lat,
                longitude=lon,
                bright_ti4=bright_ti4,
                bright_ti5=bright_ti5,
                frp=frp,
                scan=scan,
                track=track,
                acq_date=acq_date,
                acq_time=formatted_time,
                timestamp=iso_timestamp,
                satellite=satellite,
                instrument=instrument,
                confidence=conf_label,
                confidence_score=conf_score,
                daynight=daynight,
                data_mode=data_mode,
            )
        except Exception as e:
            logger.debug(f"Failed to parse row {row_idx}: {e}")
            return None

    def load_sample_csv(
        self,
        limit: int = 1500,
        bbox: Optional[Tuple[float, float, float, float]] = None,
        min_confidence: Optional[str] = None,
    ) -> List[SatelliteDetection]:
        """Read historical FIRMS sample CSV with balanced geographic coverage."""
        if not self.sample_csv_path.exists():
            logger.error(f"Sample CSV file not found at {self.sample_csv_path}")
            return []

        results: List[SatelliteDetection] = []

        # Read rows, capturing both North American fires and global samples
        with open(self.sample_csv_path, mode="r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            # Sample evenly across the file: total ~74,600 rows
            # Stride through so we get diverse orbital passes (Americas, Europe, Africa, Asia, Australia)
            stride = 40 if limit <= 2000 else 10
            for idx, row in enumerate(reader):
                # Always check bounding box if specified
                lat_raw = row.get("latitude")
                lon_raw = row.get("longitude")
                if not lat_raw or not lon_raw:
                    continue

                try:
                    lat = float(lat_raw)
                    lon = float(lon_raw)
                except ValueError:
                    continue

                # Prioritize India monitoring region (lat 6.5-37.5, lon 68-97.5) and global clusters
                is_india_fire = (6.5 <= lat <= 37.5 and 68.0 <= lon <= 97.5)
                is_na_fire = (40.0 <= lat <= 65.0 and -135.0 <= lon <= -105.0)

                # Keep row if it's an Indian detection, or on the stride, or in the NA cluster zone
                if not is_india_fire and (idx % stride != 0) and not (is_na_fire and (idx % 8 == 0)):
                    continue

                detection = self.parse_row(row, idx, data_mode="HISTORICAL_SAMPLE")
                if not detection:
                    continue

                # Bounding box filter: (min_lon, min_lat, max_lon, max_lat)
                if bbox:
                    min_lon, min_lat, max_lon, max_lat = bbox
                    if not (min_lat <= detection.latitude <= max_lat and min_lon <= detection.longitude <= max_lon):
                        continue

                # Confidence filter
                if min_confidence:
                    if min_confidence == "high" and detection.confidence != "high":
                        continue
                    if min_confidence == "nominal" and detection.confidence == "low":
                        continue

                results.append(detection)
                if limit and len(results) >= limit * 2:
                    break

        # Trim to limit, ensuring high FRP and North American fires are preserved
        results.sort(key=lambda d: (d.frp or 0.0), reverse=True)
        final_results = results[:limit]
        logger.info(f"Loaded {len(final_results)} representative detections from FIRMS sample CSV.")
        return final_results

    def fetch_live_firms_sync(
        self,
        area: str = "INDIA_ALL",
        day_range: int = 1,
        source: str = "VIIRS_SNPP_NRT",
    ) -> Tuple[List[SatelliteDetection], Optional[str], str]:
        """Synchronously fetch live detections from NASA FIRMS API with retry and caching.

        Returns: (detections, message, status)
        where status is 'success' | 'cached' | 'empty' | 'credentials_missing' | 'rate_limited' | 'error'
        """
        if not settings.has_firms_key:
            return [], (
                "FIRMS_MAP_KEY is not configured in backend environment. "
                "Register for a free MAP_KEY at https://firms.modaps.eosdis.nasa.gov/api/map_key "
                "and set FIRMS_MAP_KEY in your .env file."
            ), "credentials_missing"

        # Resolve region name/id to bounding box if needed
        area_coords = area
        if area in settings.MONITORING_REGIONS:
            area_coords = settings.MONITORING_REGIONS[area]["bbox"]

        # Validate day range (NASA FIRMS supports 1 to 5 days on area endpoint)
        valid_day_range = max(1, min(5, int(day_range)))

        # Validate source
        valid_source = source if source in settings.SUPPORTED_FIRMS_SOURCES else "VIIRS_SNPP_NRT"

        url = f"{settings.FIRMS_API_BASE_URL}/area/csv/{settings.FIRMS_MAP_KEY}/{valid_source}/{area_coords}/{valid_day_range}"

        last_error = "Unknown error"

        for attempt in range(MAX_RETRIES):
            try:
                with httpx.Client(timeout=HTTP_TIMEOUT) as client:
                    resp = client.get(url)

                    # 1. Authentication / Client Errors (Do NOT retry)
                    if resp.status_code in (401, 403):
                        return (
                            [],
                            f"FIRMS API Authentication failed (HTTP {resp.status_code}): Invalid or expired FIRMS_MAP_KEY.",
                            "error",
                        )

                    if resp.status_code == 429:
                        return (
                            [],
                            "NASA FIRMS API rate limit reached (HTTP 429). Please reduce query frequency.",
                            "rate_limited",
                        )

                    if resp.status_code == 400:
                        clean_err = self._mask_sensitive(resp.text[:160])
                        return [], f"NASA FIRMS Bad Request (HTTP 400): {clean_err}", "error"

                    # 2. Transient Gateway Errors (502, 503, 504) -> Bounded Exponential Backoff
                    if resp.status_code in TRANSIENT_STATUS_CODES:
                        reason = resp.reason_phrase or "Bad Gateway"
                        last_error = f"HTTP {resp.status_code}: {reason}"
                        if attempt < MAX_RETRIES - 1:
                            backoff = INITIAL_BACKOFF_SECONDS * (2 ** attempt)
                            logger.warning(
                                f"NASA FIRMS returned {last_error}. Retrying in {backoff:.1f}s (attempt {attempt + 1}/{MAX_RETRIES})..."
                            )
                            time.sleep(backoff)
                            continue
                        else:
                            break

                    if resp.status_code != 200:
                        clean_err = self._mask_sensitive(resp.text[:160])
                        last_error = f"HTTP {resp.status_code}: {clean_err}"
                        if attempt < MAX_RETRIES - 1:
                            backoff = INITIAL_BACKOFF_SECONDS * (2 ** attempt)
                            time.sleep(backoff)
                            continue
                        else:
                            break

                    # 3. 200 OK: Inspect response body content
                    raw_text = resp.text.strip()
                    if "Invalid MAP_KEY" in raw_text or "invalid map_key" in raw_text.lower():
                        return (
                            [],
                            "NASA FIRMS reported: Invalid MAP_KEY. Please verify your FIRMS_MAP_KEY in .env.",
                            "error",
                        )

                    if "No data" in raw_text or not raw_text:
                        return (
                            [],
                            f"No active satellite detections found across selected monitoring region for {valid_source} ({valid_day_range}d lookback).",
                            "empty",
                        )

                    lines = raw_text.splitlines()
                    if len(lines) <= 1:
                        return (
                            [],
                            f"No active satellite detections found across selected monitoring region for {valid_source} ({valid_day_range}d lookback).",
                            "empty",
                        )

                    reader = csv.DictReader(lines)
                    detections: List[SatelliteDetection] = []
                    for idx, row in enumerate(reader):
                        det = self.parse_row(row, idx, data_mode="LIVE")
                        if det:
                            detections.append(det)

                    if not detections:
                        return [], "No valid geographic detections could be parsed from FIRMS response.", "empty"

                    # Cache successful live detections
                    self.save_cache_telemetry(
                        area=area, source=valid_source, day_range=valid_day_range, detections=detections
                    )
                    logger.info(
                        f"Retrieved {len(detections)} live detections from NASA FIRMS for {area_coords}"
                    )
                    return (
                        detections,
                        f"Successfully loaded {len(detections)} live satellite detections via NASA FIRMS ({valid_source}).",
                        "success",
                    )

            except TRANSIENT_EXCEPTIONS as e:
                last_error = f"{type(e).__name__}"
                if attempt < MAX_RETRIES - 1:
                    backoff = INITIAL_BACKOFF_SECONDS * (2 ** attempt)
                    logger.warning(
                        f"NASA FIRMS network error ({type(e).__name__}). Retrying in {backoff:.1f}s (attempt {attempt + 1}/{MAX_RETRIES})..."
                    )
                    time.sleep(backoff)
                    continue
                else:
                    break
            except Exception as e:
                clean_err = self._mask_sensitive(str(e))
                logger.error(f"Error fetching live FIRMS data: {clean_err}")
                last_error = clean_err
                break

        # If all retries failed, fall back to cached telemetry if available
        cached_dets, cached_ts = self.get_cached_telemetry(area=area, source=valid_source)
        if cached_dets and cached_ts:
            clean_err = self._mask_sensitive(last_error)
            logger.warning(
                f"NASA FIRMS query failed after retries ({clean_err}). Serving {len(cached_dets)} cached detections."
            )
            return (
                cached_dets,
                f"NASA FIRMS upstream error ({clean_err}). Serving {len(cached_dets)} cached detections from {cached_ts} (Stale).",
                "cached",
            )

        clean_err = self._mask_sensitive(last_error)
        return [], f"NASA FIRMS API request failed: {clean_err}. No cached data available.", "error"

    async def fetch_live_firms(
        self,
        area: str = "world",
        day_range: int = 1,
        source: str = "VIIRS_SNPP_NRT",
    ) -> Tuple[List[SatelliteDetection], Optional[str], str]:
        """Asynchronously fetch live detections from NASA FIRMS API with retry and caching.

        Returns: (detections, message, status)
        where status is 'success' | 'cached' | 'empty' | 'credentials_missing' | 'rate_limited' | 'error'
        """
        if not settings.has_firms_key:
            return [], (
                "FIRMS_MAP_KEY is not configured in backend environment. "
                "Register for a free MAP_KEY at https://firms.modaps.eosdis.nasa.gov/api/map_key "
                "and set FIRMS_MAP_KEY in your .env file."
            ), "credentials_missing"

        # Resolve region name/id to bounding box if needed
        area_coords = area
        if area in settings.MONITORING_REGIONS:
            area_coords = settings.MONITORING_REGIONS[area]["bbox"]

        # Validate day range (NASA FIRMS supports 1 to 5 days on area endpoint)
        valid_day_range = max(1, min(5, int(day_range)))

        # Validate source
        valid_source = source if source in settings.SUPPORTED_FIRMS_SOURCES else "VIIRS_SNPP_NRT"

        url = f"{settings.FIRMS_API_BASE_URL}/area/csv/{settings.FIRMS_MAP_KEY}/{valid_source}/{area_coords}/{valid_day_range}"

        last_error = "Unknown error"

        for attempt in range(MAX_RETRIES):
            try:
                async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
                    resp = await client.get(url)

                    # 1. Authentication / Client Errors (Do NOT retry)
                    if resp.status_code in (401, 403):
                        return (
                            [],
                            f"FIRMS API Authentication failed (HTTP {resp.status_code}): Invalid or expired FIRMS_MAP_KEY.",
                            "error",
                        )

                    if resp.status_code == 429:
                        return (
                            [],
                            "NASA FIRMS API rate limit reached (HTTP 429). Please reduce query frequency.",
                            "rate_limited",
                        )

                    if resp.status_code == 400:
                        clean_err = self._mask_sensitive(resp.text[:160])
                        return [], f"NASA FIRMS Bad Request (HTTP 400): {clean_err}", "error"

                    # 2. Transient Gateway Errors (502, 503, 504) -> Bounded Exponential Backoff
                    if resp.status_code in TRANSIENT_STATUS_CODES:
                        reason = resp.reason_phrase or "Bad Gateway"
                        last_error = f"HTTP {resp.status_code}: {reason}"
                        if attempt < MAX_RETRIES - 1:
                            backoff = INITIAL_BACKOFF_SECONDS * (2 ** attempt)
                            logger.warning(
                                f"NASA FIRMS returned {last_error}. Retrying in {backoff:.1f}s (attempt {attempt + 1}/{MAX_RETRIES})..."
                            )
                            await asyncio.sleep(backoff)
                            continue
                        else:
                            break

                    if resp.status_code != 200:
                        clean_err = self._mask_sensitive(resp.text[:160])
                        last_error = f"HTTP {resp.status_code}: {clean_err}"
                        if attempt < MAX_RETRIES - 1:
                            backoff = INITIAL_BACKOFF_SECONDS * (2 ** attempt)
                            await asyncio.sleep(backoff)
                            continue
                        else:
                            break

                    # 3. 200 OK: Inspect response body content
                    raw_text = resp.text.strip()
                    if "Invalid MAP_KEY" in raw_text or "invalid map_key" in raw_text.lower():
                        return (
                            [],
                            "NASA FIRMS reported: Invalid MAP_KEY. Please verify your FIRMS_MAP_KEY in .env.",
                            "error",
                        )

                    if "No data" in raw_text or not raw_text:
                        return (
                            [],
                            f"No active satellite detections found across selected monitoring region for {valid_source} ({valid_day_range}d lookback).",
                            "empty",
                        )

                    lines = raw_text.splitlines()
                    if len(lines) <= 1:
                        return (
                            [],
                            f"No active satellite detections found across selected monitoring region for {valid_source} ({valid_day_range}d lookback).",
                            "empty",
                        )

                    reader = csv.DictReader(lines)
                    detections: List[SatelliteDetection] = []
                    for idx, row in enumerate(reader):
                        det = self.parse_row(row, idx, data_mode="LIVE")
                        if det:
                            detections.append(det)

                    if not detections:
                        return [], "No valid geographic detections could be parsed from FIRMS response.", "empty"

                    # Cache successful live detections
                    self.save_cache_telemetry(
                        area=area, source=valid_source, day_range=valid_day_range, detections=detections
                    )
                    logger.info(
                        f"Retrieved {len(detections)} live detections from NASA FIRMS for {area_coords}"
                    )
                    return (
                        detections,
                        f"Successfully loaded {len(detections)} live satellite detections via NASA FIRMS ({valid_source}).",
                        "success",
                    )

            except TRANSIENT_EXCEPTIONS as e:
                last_error = f"{type(e).__name__}"
                if attempt < MAX_RETRIES - 1:
                    backoff = INITIAL_BACKOFF_SECONDS * (2 ** attempt)
                    logger.warning(
                        f"NASA FIRMS network error ({type(e).__name__}). Retrying in {backoff:.1f}s (attempt {attempt + 1}/{MAX_RETRIES})..."
                    )
                    await asyncio.sleep(backoff)
                    continue
                else:
                    break
            except Exception as e:
                clean_err = self._mask_sensitive(str(e))
                logger.error(f"Error fetching live FIRMS data: {clean_err}")
                last_error = clean_err
                break

        # If all retries failed, fall back to cached telemetry if available
        cached_dets, cached_ts = self.get_cached_telemetry(area=area, source=valid_source)
        if cached_dets and cached_ts:
            clean_err = self._mask_sensitive(last_error)
            logger.warning(
                f"NASA FIRMS query failed after retries ({clean_err}). Serving {len(cached_dets)} cached detections."
            )
            return (
                cached_dets,
                f"NASA FIRMS upstream error ({clean_err}). Serving {len(cached_dets)} cached detections from {cached_ts} (Stale).",
                "cached",
            )

        clean_err = self._mask_sensitive(last_error)
        return [], f"NASA FIRMS API request failed: {clean_err}. No cached data available.", "error"



firms_adapter = FirmsAdapter()
