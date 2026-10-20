"""REST API endpoints for TerraShield AI."""

import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from backend.adapters.firms_adapter import firms_adapter
from backend.adapters.flood_adapter import flood_adapter
from backend.adapters.groq_adapter import groq_adapter
from backend.adapters.tinyfish_adapter import tinyfish_adapter
from backend.config import settings
from backend.data.fixtures import get_demo_incidents
from backend.engine.clustering import cluster_detections_into_incidents
from backend.engine.verifier import verifier
from backend.models.analytics import AnalyticsSummary, DayDetectionCount
from backend.models.detection import SatelliteDetection
from backend.models.evidence import EvidenceRecord, EvidenceStatus, SourceType
from backend.models.incident import Incident, VerificationReport, VerificationStatus
from backend.ml.inference import thermal_model
from backend.ml.unet_inference import unet_segmenter
from backend.ml.yolo_inference import yolo_detector

logger = logging.getLogger("terrashield.api")
router = APIRouter(prefix="/api")


# In-memory application state
class AppState:
    def __init__(self):
        self.mode: str = settings.DATA_MODE
        self.last_refresh: str = datetime.now(timezone.utc).isoformat()
        self.detections: List[SatelliteDetection] = []
        self.incidents: Dict[str, Incident] = {}
        self.evidence: Dict[str, EvidenceRecord] = {}
        self.firms_last_sync: Optional[str] = None
        self.firms_last_region: Optional[str] = None
        self.firms_last_source: Optional[str] = None
        self.load_data(self.mode)

    def load_data(self, mode: str):
        self.mode = mode
        self.last_refresh = datetime.now(timezone.utc).isoformat()
        self.detections.clear()
        self.incidents.clear()
        self.evidence.clear()

        if mode == "DEMO":
            demo_incidents = get_demo_incidents()
            for inc in demo_incidents:
                self.incidents[inc.id] = inc
                if inc.primary_detection:
                    self.detections.append(inc.primary_detection)
                for det in inc.detections:
                    if det.id != (inc.primary_detection.id if inc.primary_detection else ""):
                        self.detections.append(det)
                for ev in inc.evidence:
                    self.evidence[ev.id] = ev
            logger.info("Loaded DEMO fixtures dataset.")

        elif mode == "HISTORICAL_SAMPLE":
            # Load real FIRMS sample CSV
            # Sample detections: take up to 2500 detections from the actual VIIRS sample CSV
            sample_dets = firms_adapter.load_sample_csv(limit=2500)
            self.detections = sample_dets

            # Cluster into representative incidents
            clustered = cluster_detections_into_incidents(
                sample_dets, cluster_radius_km=30.0, max_incidents=25, data_mode="HISTORICAL_SAMPLE"
            )

            # Assign sequential historical IDs to real sample clusters
            for idx, inc in enumerate(clustered):
                new_id = f"INC-HIST-{idx + 1:03d}"
                inc.id = new_id
                self.incidents[new_id] = inc
                for ev in inc.evidence:
                    self.evidence[ev.id] = ev

            logger.info(f"Loaded HISTORICAL_SAMPLE with {len(self.detections)} detections and {len(self.incidents)} incidents.")

        elif mode == "LIVE":
            if settings.has_firms_key:
                logger.info("FIRMS key found. Querying live NASA FIRMS API for India...")
                dets, msg, fetch_status = firms_adapter.fetch_live_firms_sync(
                    area="INDIA_ALL", day_range=1, source="VIIRS_SNPP_NRT"
                )
                if fetch_status in ("success", "cached") and dets:
                    self.mode = "LIVE" if fetch_status == "success" else "CACHED"
                    self.detections = dets
                    clustered = cluster_detections_into_incidents(
                        dets, cluster_radius_km=30.0, max_incidents=30, data_mode=self.mode
                    )
                    for inc in clustered:
                        self.incidents[inc.id] = inc
                    _, cached_ts = firms_adapter.get_cached_telemetry(area="INDIA_ALL", source="VIIRS_SNPP_NRT")
                    self.firms_last_sync = cached_ts if fetch_status == "cached" else datetime.now(timezone.utc).isoformat()
                    self.firms_last_region = "INDIA_ALL"
                    self.firms_last_source = "VIIRS_SNPP_NRT"
                    logger.info(f"Loaded {len(dets)} {self.mode} NASA FIRMS detections across {len(clustered)} incidents in India.")
                else:
                    logger.warning(f"Live FIRMS fetch on load returned: {fetch_status} - {msg}")
            else:
                logger.info("Live mode requested without keys; loading empty live container with alert.")


state = AppState()


# Request / Response Schemas
class ModeSwitchRequest(BaseModel):
    mode: str = Field(..., description="Target mode: HISTORICAL_SAMPLE, LIVE, DEMO")


class SearchEvidenceRequest(BaseModel):
    incident_id: Optional[str] = Field(None, description="Target incident ID to attach evidence to")
    query: Optional[str] = Field(None, description="Custom search query")
    location: Optional[str] = Field(None, description="Geographic area or town name")
    target_date: Optional[str] = Field(None, description="Target observation date")
    max_results: int = Field(5, description="Maximum evidence items to retrieve (1-10)")


class SearchEvidenceResponse(BaseModel):
    status: str
    query: str
    results_count: int
    evidence_records: List[EvidenceRecord]
    message: Optional[str] = None
    tinyfish_configured: bool


class FirmsRegion(BaseModel):
    id: str
    name: str
    country: Optional[str] = "India"
    bbox: str
    center: List[float]
    default_zoom: int


class FetchLiveFirmsRequest(BaseModel):
    region: str = Field("INDIA_ALL", description="Region ID or bounding box")
    source: str = Field("VIIRS_SNPP_NRT", description="Satellite sensor: VIIRS_SNPP_NRT, MODIS_NRT, etc.")
    day_range: int = Field(1, ge=1, le=5, description="Day lookback range (1 to 5)")


class FetchLiveFirmsResponse(BaseModel):
    status: str
    message: str
    detections_count: int
    incidents_count: int
    region: str
    source: str
    firms_configured: bool
    is_cached: bool = False
    cached_at: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    app_name: str
    version: str
    current_mode: str
    tinyfish_configured: bool
    firms_configured: bool
    carto_configured: bool = False
    carto_api_key: Optional[str] = None
    total_detections: int
    total_incidents: int
    last_refresh: str
    firms_last_sync: Optional[str] = None
    firms_last_region: Optional[str] = None
    firms_last_source: Optional[str] = None


@router.get("/health", response_model=HealthResponse)
def get_health():
    """Health check endpoint exposing system status, credentials existence, and mode."""
    return HealthResponse(
        status="healthy",
        app_name="TerraShield AI",
        version="1.0.0",
        current_mode=state.mode,
        tinyfish_configured=settings.has_tinyfish_key,
        firms_configured=settings.has_firms_key,
        carto_configured=settings.has_carto_key,
        carto_api_key=(settings.CARTO_API_KEY if settings.has_carto_key else None),
        total_detections=len(state.detections),
        total_incidents=len(state.incidents),
        last_refresh=state.last_refresh,
        firms_last_sync=state.firms_last_sync,
        firms_last_region=state.firms_last_region,
        firms_last_source=state.firms_last_source,
    )


@router.get("/firms/regions")
def get_firms_regions():
    """List supported monitoring regions and available satellite sensor products."""
    regions = [
        FirmsRegion(
            id=r["id"],
            name=r["name"],
            country=r.get("country", "India"),
            bbox=r["bbox"],
            center=r["center"],
            default_zoom=r["default_zoom"],
        )
        for r in settings.MONITORING_REGIONS.values()
    ]
    return {
        "regions": regions,
        "default_region": settings.DEFAULT_REGION,
        "supported_sources": settings.SUPPORTED_FIRMS_SOURCES,
        "firms_configured": settings.has_firms_key,
        "carto_configured": settings.has_carto_key,
    }


@router.post("/firms/fetch", response_model=FetchLiveFirmsResponse)
async def fetch_live_firms_data(req: FetchLiveFirmsRequest):
    """Fetch real-time satellite fire detections from NASA FIRMS API for selected monitoring region."""
    detections, msg, fetch_status = await firms_adapter.fetch_live_firms(
        area=req.region,
        day_range=req.day_range,
        source=req.source,
    )

    if fetch_status == "credentials_missing":
        return FetchLiveFirmsResponse(
            status="credentials_missing",
            message=msg or "FIRMS_MAP_KEY not configured.",
            detections_count=0,
            incidents_count=0,
            region=req.region,
            source=req.source,
            firms_configured=False,
        )

    if fetch_status == "rate_limited":
        return FetchLiveFirmsResponse(
            status="rate_limited",
            message=msg or "NASA FIRMS API rate limit reached.",
            detections_count=0,
            incidents_count=0,
            region=req.region,
            source=req.source,
            firms_configured=True,
        )

    if fetch_status == "error":
        return FetchLiveFirmsResponse(
            status="error",
            message=msg or "NASA FIRMS API query failed.",
            detections_count=0,
            incidents_count=0,
            region=req.region,
            source=req.source,
            firms_configured=True,
        )

    if fetch_status == "empty":
        return FetchLiveFirmsResponse(
            status="empty",
            message=msg or "No active detections found in selected region.",
            detections_count=0,
            incidents_count=0,
            region=req.region,
            source=req.source,
            firms_configured=True,
        )

    if fetch_status == "cached":
        # Cached fallback: update application state with cached data labeled clearly as cached
        state.mode = "CACHED"
        state.detections = detections
        state.incidents.clear()

        clustered = cluster_detections_into_incidents(
            detections, cluster_radius_km=30.0, max_incidents=30, data_mode="CACHED"
        )
        for inc in clustered:
            state.incidents[inc.id] = inc

        _, cached_ts = firms_adapter.get_cached_telemetry(req.region, req.source)
        state.last_refresh = datetime.now(timezone.utc).isoformat()
        state.firms_last_sync = cached_ts or state.last_refresh
        state.firms_last_region = req.region
        state.firms_last_source = req.source

        return FetchLiveFirmsResponse(
            status="cached",
            message=msg or f"Serving {len(detections)} cached NASA FIRMS detections (Stale).",
            detections_count=len(detections),
            incidents_count=len(clustered),
            region=req.region,
            source=req.source,
            firms_configured=True,
            is_cached=True,
            cached_at=state.firms_last_sync,
        )

    # Success: update live application state
    state.mode = "LIVE"
    state.detections = detections
    state.incidents.clear()

    clustered = cluster_detections_into_incidents(
        detections, cluster_radius_km=30.0, max_incidents=30, data_mode="LIVE"
    )
    for inc in clustered:
        state.incidents[inc.id] = inc

    state.last_refresh = datetime.now(timezone.utc).isoformat()
    state.firms_last_sync = state.last_refresh
    state.firms_last_region = req.region
    state.firms_last_source = req.source

    return FetchLiveFirmsResponse(
        status="success",
        message=f"Retrieved and clustered {len(detections)} live NASA FIRMS detections across {len(clustered)} candidate incidents.",
        detections_count=len(detections),
        incidents_count=len(clustered),
        region=req.region,
        source=req.source,
        firms_configured=True,
        is_cached=False,
        cached_at=state.firms_last_sync,
    )


@router.post("/mode")
def set_mode(req: ModeSwitchRequest):
    """Switch active data mode between HISTORICAL_SAMPLE, LIVE, DEMO, and CACHED."""
    target_mode = req.mode.upper().strip()
    if target_mode not in ("HISTORICAL_SAMPLE", "LIVE", "DEMO", "CACHED"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mode must be one of: HISTORICAL_SAMPLE, LIVE, DEMO, CACHED",
        )

    if target_mode == "LIVE" and not settings.has_firms_key:
        state.load_data(target_mode)
        return {
            "status": "warning",
            "mode": state.mode,
            "message": "Switched to LIVE mode. NASA_FIRMS_MAP_KEY is not configured in .env. Live external satellite stream is inactive. Please configure credentials or switch to HISTORICAL_SAMPLE or DEMO.",
            "last_refresh": state.last_refresh,
        }

    state.load_data(target_mode)
    return {
        "status": "success",
        "mode": state.mode,
        "message": f"Successfully activated {state.mode} data mode.",
        "last_refresh": state.last_refresh,
    }


@router.get("/detections", response_model=List[SatelliteDetection])
def get_detections(
    limit: int = Query(500, ge=1, le=5000),
    min_confidence: Optional[str] = Query(None, pattern="^(low|nominal|high)$"),
    daynight: Optional[str] = Query(None, pattern="^(D|N)$"),
):
    """Return loaded satellite detections with optional confidence/limit filters."""
    results = state.detections

    if min_confidence:
        if min_confidence == "high":
            results = [d for d in results if d.confidence == "high"]
        elif min_confidence == "nominal":
            results = [d for d in results if d.confidence in ("nominal", "high")]

    if daynight:
        results = [d for d in results if d.daynight == daynight]

    return results[:limit]


@router.get("/incidents", response_model=List[Incident])
def get_incidents(
    status_filter: Optional[str] = Query(None, pattern="^(CORROBORATED|NEEDS_REVIEW|INSUFFICIENT_EVIDENCE)$"),
    region: Optional[str] = None,
):
    """List clustered incidents with verification status and evidence associations."""
    incidents = list(state.incidents.values())

    if status_filter:
        incidents = [inc for inc in incidents if inc.verification.status.value == status_filter]

    if region:
        incidents = [inc for inc in incidents if region.lower() in inc.region.lower()]

    return incidents


def _resolve_incident_by_id(incident_id: str):
    """Find incident across active state, flood/historical archive, demo fixtures, and raw detections."""
    if incident_id in state.incidents:
        return state.incidents[incident_id], None
    hist = flood_adapter.get_historical_incident_by_id(incident_id)
    if hist:
        return None, hist
    from backend.data.fixtures import get_demo_incidents
    for demo_inc in get_demo_incidents():
        if demo_inc.id == incident_id:
            return demo_inc, None

    # Check if incident_id matches a raw satellite detection
    for det in state.detections:
        if det.id == incident_id:
            from backend.engine.clustering import get_region_name
            region = get_region_name(det.latitude, det.longitude)
            raw_inc = Incident(
                id=det.id,
                name=f"Thermal Anomaly {det.id} ({det.satellite} {det.instrument})",
                region=region,
                latitude=round(det.latitude, 5),
                longitude=round(det.longitude, 5),
                first_detected=det.timestamp,
                last_detected=det.timestamp,
                detection_count=1,
                max_frp=round(det.frp, 1) if det.frp is not None else None,
                max_brightness=round(det.bright_ti4 or det.bright_ti5, 1) if (det.bright_ti4 or det.bright_ti5) else None,
                primary_detection=det,
                detections=[det],
                evidence=[],
                verification=verifier.evaluate(
                    incident_lat=det.latitude,
                    incident_lon=det.longitude,
                    incident_time_str=det.timestamp,
                    evidence_list=[],
                    incident_region=region,
                    hazard_type="WILDFIRE",
                ),
                data_mode=det.data_mode or state.mode,
            )
            state.incidents[det.id] = raw_inc
            return raw_inc, None

    return None, None


@router.get("/incidents/{incident_id}")
def get_incident(incident_id: str):
    """Get single incident details including evidence trail and verification report."""
    target_incident, hist = _resolve_incident_by_id(incident_id)
    if target_incident:
        return target_incident
    if hist:
        return hist

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Incident with ID '{incident_id}' not found in active state or historical catalog.",
    )


@router.get("/incidents/{incident_id}/dossier")
async def get_incident_dossier(incident_id: str):
    """Retrieve full traceable incident intelligence dossier including timeline, impacts, and Groq synthesis."""
    target_incident, hist_incident = _resolve_incident_by_id(incident_id)

    if not target_incident and not hist_incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident with ID '{incident_id}' not found in active state or historical archive.",
        )

    if target_incident:
        inc_dict = {
            "id": target_incident.id,
            "name": target_incident.name,
            "hazard_type": "WILDFIRE",
            "region": target_incident.region,
            "latitude": target_incident.latitude,
            "longitude": target_incident.longitude,
            "first_detected": target_incident.first_detected,
            "last_detected": target_incident.last_detected,
            "detection_count": target_incident.detection_count,
            "max_frp": target_incident.max_frp,
            "max_brightness": target_incident.max_brightness,
            "data_mode": target_incident.data_mode,
            "verification": target_incident.verification.model_dump(),
        }
        evidence_list = target_incident.evidence
        timeline = []
        impact_summary = {}
        precomputed = None
    else:
        inc_dict = dict(hist_incident)
        evidence_list = hist_incident.get("evidence", [])
        timeline = hist_incident.get("timeline", [])
        impact_summary = hist_incident.get("impact_summary", {})
        precomputed = hist_incident.get("precomputed_report")

        if "verification" not in inc_dict or not inc_dict["verification"]:
            hist_ev_records = []
            for ev in evidence_list:
                if isinstance(ev, EvidenceRecord):
                    hist_ev_records.append(ev)
                elif isinstance(ev, dict):
                    try:
                        hist_ev_records.append(EvidenceRecord.model_validate(ev))
                    except Exception:
                        pass
            hist_verif = verifier.evaluate(
                incident_lat=inc_dict.get("latitude", 0.0),
                incident_lon=inc_dict.get("longitude", 0.0),
                incident_time_str=inc_dict.get("first_detected") or inc_dict.get("event_date") or "2024-01-01T00:00:00Z",
                evidence_list=hist_ev_records,
                incident_region=inc_dict.get("region"),
                hazard_type=inc_dict.get("hazard_type", "WILDFIRE"),
            )
            inc_dict["verification"] = hist_verif.model_dump()

    return {
        "status": "success",
        "incident": inc_dict,
        "hazard_type": inc_dict.get("hazard_type", "WILDFIRE"),
        "timeline": timeline,
        "impact_summary": impact_summary,
        "hydrologic_metrics": inc_dict.get("hydrologic_metrics"),
        "fire_metrics": inc_dict.get("fire_metrics"),
        "evidence": evidence_list,
        "research_audit": getattr(tinyfish_adapter, "last_audit", None),
        "groq_report": precomputed,
        "groq_configured": groq_adapter.is_configured,
        "model_id": groq_adapter.model,
    }


@router.post("/incidents/{incident_id}/dossier/generate")
async def generate_incident_dossier(incident_id: str):
    """Generate source-grounded incident report via Groq Cloud GPT-OSS inference."""
    target_incident, hist_incident = _resolve_incident_by_id(incident_id)

    if not target_incident and not hist_incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident with ID '{incident_id}' not found.",
        )

    if target_incident:
        inc_data = {
            "id": target_incident.id,
            "name": target_incident.name,
            "hazard_type": "WILDFIRE",
            "region": target_incident.region,
            "latitude": target_incident.latitude,
            "longitude": target_incident.longitude,
            "detection_count": target_incident.detection_count,
            "max_frp": target_incident.max_frp,
            "max_brightness": target_incident.max_brightness,
            "first_detected": target_incident.first_detected,
            "last_detected": target_incident.last_detected,
            "verification": target_incident.verification.model_dump(),
        }
        evidence_records = target_incident.evidence
    else:
        inc_data = hist_incident
        evidence_records = []
        for ev in hist_incident.get("evidence", []):
            if isinstance(ev, EvidenceRecord):
                evidence_records.append(ev)
            elif isinstance(ev, dict):
                evidence_records.append(
                    EvidenceRecord(
                        id=ev.get("id", "EV-HIST"),
                        source_name=ev.get("source_name", "Unknown"),
                        source_type=(
                            ev.get("source_type")
                            if ev.get("source_type") in [s.value for s in SourceType]
                            else SourceType.OFFICIAL_AGENCY
                        ),
                        title=ev.get("title", ""),
                        url=ev.get("url", ""),
                        snippet=ev.get("snippet", ""),
                        publication_date=ev.get("publication_date"),
                        fetched_at=ev.get("fetched_at", datetime.now(timezone.utc).isoformat()),
                        is_official=ev.get("is_official", False),
                        relevance_score=ev.get("relevance_score", 0.9),
                        relevance_explanation=ev.get("relevance_explanation", "Direct evidence"),
                        domain=ev.get("url", "").split("/")[2] if "//" in ev.get("url", "") else "",
                        fetch_status=EvidenceStatus.ACTIVE,
                    )
                )

    result = await groq_adapter.generate_incident_dossier(
        incident_data=inc_data,
        evidence_records=evidence_records,
    )
    return result


@router.post("/incidents/{incident_id}/investigate")
async def investigate_incident(incident_id: str):
    """Execute authentic end-to-end TinyFish evidence discovery + Groq Cloud report generation."""
    trace = []

    target_incident, hist_incident = _resolve_incident_by_id(incident_id)

    if not target_incident and not hist_incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident with ID '{incident_id}' not found.",
        )

    # Determine incident attributes and search context
    is_flood = False
    if target_incident:
        inc_name = target_incident.name
        inc_region = target_incident.region
        inc_date = target_incident.first_detected[:10]
        inc_lat = target_incident.latitude
        inc_lon = target_incident.longitude
        hazard_type = "WILDFIRE"
        evidence_records = list(target_incident.evidence)
        det_count = target_incident.detection_count
    else:
        inc_name = hist_incident.get("name", "Disaster")
        inc_region = hist_incident.get("region", "India")
        inc_date = hist_incident.get("event_date", "2024")
        inc_lat = hist_incident.get("latitude", 0.0)
        inc_lon = hist_incident.get("longitude", 0.0)
        hazard_type = hist_incident.get("hazard_type", "WILDFIRE")
        is_flood = hazard_type == "FLOOD"
        det_count = hist_incident.get("detection_count", 1)
        evidence_records = []
        for ev in hist_incident.get("evidence", []):
            if isinstance(ev, EvidenceRecord):
                evidence_records.append(ev)
            elif isinstance(ev, dict):
                evidence_records.append(
                    EvidenceRecord(
                        id=ev.get("id", "EV-HIST"),
                        source_name=ev.get("source_name", "Unknown"),
                        source_type=(
                            ev.get("source_type")
                            if ev.get("source_type") in [s.value for s in SourceType]
                            else SourceType.OFFICIAL_AGENCY
                        ),
                        title=ev.get("title", ""),
                        url=ev.get("url", ""),
                        snippet=ev.get("snippet", ""),
                        full_text=ev.get("full_text"),
                        publication_date=ev.get("publication_date"),
                        fetched_at=ev.get("fetched_at", datetime.now(timezone.utc).isoformat()),
                        is_official=ev.get("is_official", False),
                        relevance_score=ev.get("relevance_score", 0.9),
                        relevance_explanation=ev.get("relevance_explanation", "Direct evidence"),
                        relevance_label=ev.get("relevance_label", "Relevant"),
                        finding=ev.get("finding"),
                        supports_aspect=ev.get("supports_aspect"),
                        evidence_role=ev.get("evidence_role", "Directly reported facts"),
                        domain=ev.get("url", "").split("/")[2] if "//" in ev.get("url", "") else "",
                        fetch_status=EvidenceStatus.ACTIVE,
                        provenance_origin="HISTORICAL_ARCHIVE",
                    )
                )

    # Tag existing records with historical/saved provenance
    for ev in evidence_records:
        if not ev.provenance_origin:
            ev.provenance_origin = "HISTORICAL_ARCHIVE" if hist_incident else "PREVIOUSLY_SAVED"

    # Stage 1: Incident selected
    trace.append({
        "stage": 1,
        "step": "incident_selected",
        "title": "Incident Selected",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": "completed",
        "details": f"{inc_name} ({inc_lat:.4f}° N, {inc_lon:.4f}° E) • {hazard_type} • {det_count} sensor detections",
    })

    # Construct targeted query dynamically based strictly on incident metadata
    clean_name = inc_name.replace("DEMO — ", "").replace("HISTORICAL EVENT: ", "").strip()
    clean_region = inc_region.split("(")[0].strip() if inc_region else "Target Area"
    is_demo_or_hist = (
        (target_incident and target_incident.data_mode in ("DEMO", "HISTORICAL"))
        or bool(hist_incident)
    )

    if is_flood:
        if is_demo_or_hist:
            query_str = f"flood landslide situation report {clean_name} {clean_region} {inc_date}"
        else:
            query_str = f"flood landslide inundation warning {clean_region} {inc_date} official report"
    else:
        if is_demo_or_hist:
            query_str = f"{clean_name} {clean_region} forest fire wildfire official report {inc_date}"
        else:
            query_str = f"{clean_region} wildfire forest fire emergency incident {inc_date} official report"

    # Stage 2: Searching for relevant sources
    live_new_evidence: List[EvidenceRecord] = []
    research_audit = {
        "query": query_str,
        "queries_submitted": [query_str],
        "operations_completed": ["Incident Selection", "Query Formulation"],
        "sources_discovered": 0,
        "unique_urls": 0,
        "fetch_attempts": 0,
        "pages_fetched": 0,
        "failed_requests": [],
        "retrieval_timestamps": datetime.now(timezone.utc).isoformat(),
    }

    if tinyfish_adapter.is_configured:
        new_evidence, msg, fetch_status, audit = await tinyfish_adapter.search_and_fetch(
            query=query_str,
            target_location=inc_region,
            target_date=inc_date,
            hazard_type=hazard_type,
            max_results=6,
            do_fetch=True,
            return_audit=True,
        )
        research_audit = audit
        if fetch_status == "success" and new_evidence:
            live_new_evidence = new_evidence
            trace.append({
                "stage": 2,
                "step": "searching_sources",
                "title": "Searching for Relevant Sources",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "status": "completed",
                "query": query_str,
                "count": len(new_evidence),
                "details": f"Discovered {audit.get('sources_discovered', len(new_evidence))} potential sources via TinyFish Search API for query \"{query_str}\".",
            })
        else:
            trace.append({
                "stage": 2,
                "step": "searching_sources",
                "title": "Searching for Relevant Sources",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "status": fetch_status if fetch_status != "success" else "partial",
                "query": query_str,
                "count": 0,
                "details": msg or f"No web sources discovered matching query: '{query_str}'.",
            })
    else:
        trace.append({
            "stage": 2,
            "step": "searching_sources",
            "title": "Searching for Relevant Sources",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status": "completed",
            "query": query_str,
            "count": len(evidence_records),
            "details": f"Disaster archive mode active ({len(evidence_records)} pre-verified sources available).",
        })

    # Stage 3: Retrieving source content
    pages_fetched_count = research_audit.get("pages_fetched", 0)
    failed_requests_count = len(research_audit.get("failed_requests", []))
    fetch_status_stage = "completed" if pages_fetched_count > 0 or not live_new_evidence else ("partial" if failed_requests_count > 0 else "completed")

    trace.append({
        "stage": 3,
        "step": "retrieving_content",
        "title": "Retrieving Source Content",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": fetch_status_stage,
        "pages_fetched": pages_fetched_count,
        "failed_fetches": failed_requests_count,
        "details": f"Retrieved page extracts from {pages_fetched_count} sources. {failed_requests_count} request(s) failed or inaccessible.",
    })

    # Merge newly retrieved evidence avoiding duplicates and preventing stale evidence accumulation
    if live_new_evidence:
        if target_incident:
            evidence_records = live_new_evidence
            target_incident.evidence = evidence_records
        else:
            for ev in live_new_evidence:
                ev.provenance_origin = "CURRENT_SESSION"
                if not any(existing.url == ev.url for existing in evidence_records):
                    evidence_records.append(ev)
        for ev in live_new_evidence:
            state.evidence[ev.id] = ev

    # Stage 4: Checking relevance and evidence
    if target_incident:
        target_incident.verification = verifier.evaluate(
            incident_lat=inc_lat,
            incident_lon=inc_lon,
            incident_time_str=target_incident.first_detected,
            evidence_list=target_incident.evidence,
            incident_region=target_incident.region,
            hazard_type=hazard_type,
        )
        verif_status = target_incident.verification.status.value
        verif_rationale = target_incident.verification.rationale
    else:
        hist_verif = verifier.evaluate(
            incident_lat=inc_lat,
            incident_lon=inc_lon,
            incident_time_str=hist_incident.get("first_detected") or hist_incident.get("event_date") or "2024-01-01T00:00:00Z",
            evidence_list=evidence_records,
            incident_region=inc_region,
            hazard_type=hazard_type,
        )
        hist_incident["verification"] = hist_verif.model_dump()
        verif_status = hist_verif.status.value
        verif_rationale = hist_verif.rationale

    trace.append({
        "stage": 4,
        "step": "checking_relevance",
        "title": "Checking Relevance & Evidence",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": "completed",
        "verification_status": verif_status,
        "details": f"Status: {verif_status}. {verif_rationale}",
    })

    # Stage 5: Preparing the AI explanation
    if target_incident:
        incident_payload = {
            "id": target_incident.id,
            "name": target_incident.name,
            "hazard_type": hazard_type,
            "region": target_incident.region,
            "latitude": target_incident.latitude,
            "longitude": target_incident.longitude,
            "detection_count": target_incident.detection_count,
            "max_frp": target_incident.max_frp,
            "max_brightness": target_incident.max_brightness,
            "first_detected": target_incident.first_detected,
            "last_detected": target_incident.last_detected,
            "verification": target_incident.verification.model_dump(),
        }
    else:
        incident_payload = hist_incident

    groq_res = await groq_adapter.generate_incident_dossier(
        incident_data=incident_payload,
        evidence_records=evidence_records,
        research_audit=research_audit,
    )

    groq_status = groq_res.get("status")
    trace.append({
        "stage": 5,
        "step": "preparing_explanation",
        "title": "Preparing the AI Explanation",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": "completed" if groq_status == "success" else (groq_status or "failed"),
        "model": groq_res.get("model_id") or groq_adapter.model,
        "details": groq_res.get("message") or f"Synthesized with {groq_adapter.model}",
    })

    report_content = groq_res.get("report")
    if not report_content and hist_incident:
        report_content = hist_incident.get("precomputed_report")

    # Determine visible report state
    if groq_res.get("status") == "success" and report_content:
        report_state = "Report Ready"
    elif report_content:
        report_state = "Historical Report" if hist_incident else "Report Generated — Evidence Incomplete"
    else:
        report_state = "Investigation Failed"

    # Stage 6: Report ready
    trace.append({
        "stage": 6,
        "step": "report_ready",
        "title": "Report Ready",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": "completed" if report_content else "failed",
        "report_state": report_state,
        "details": f"Generated plain-English summary, 'Why this conclusion?' evidence links, and {len(evidence_records)} citations.",
    })

    return {
        "status": "success" if report_content else "error",
        "report_state": report_state,
        "incident_id": incident_id,
        "hazard_type": hazard_type,
        "report": report_content,
        "evidence": evidence_records,
        "workflow_trace": trace,
        "research_audit": research_audit,
        "groq_status": groq_res.get("status"),
        "groq_message": groq_res.get("message"),
        "model_id": groq_res.get("model_id") or groq_adapter.model,
        "investigated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/thermal/capabilities")
def get_thermal_capabilities():
    """Transparently report operational thermal capabilities across Levels 1, 2, and 3."""
    return {
        "level_1_radiometry": {
            "status": "operational",
            "title": "Satellite Thermal Radiometry Attributes",
            "sensors": ["VIIRS 375m (S-NPP, NOAA-20, NOAA-21)", "MODIS 1km (Terra, Aqua)"],
            "attributes": ["bright_ti4 (Kelvin)", "bright_ti5 (Kelvin)", "frp (MW)", "confidence", "daynight"],
            "spatial_resolution": "375 meters (VIIRS I-Bands)",
            "limitations": "Measures orbital thermal radiation within 375m footprint; not a handheld thermal-camera photograph.",
        },
        "level_2_imagery": {
            "status": "operational",
            "title": "Satellite Infrared / Thermal Imagery Viewer",
            "products": [
                {
                    "id": "VIIRS_SNPP_CorrectedReflectance_BandsM11-I2-I1",
                    "name": "NASA EOSDIS GIBS VIIRS False Color / Thermal SWIR",
                    "provider": "NASA EOSDIS GIBS (EPSG:3857 Best)",
                    "description": "Shortwave Infrared composite (Bands M11-I2-I1) highlighting active fire thermal emissions in bright red/orange and burn scars in dark reddish-brown.",
                },
                {
                    "id": "VIIRS_SNPP_CorrectedReflectance_TrueColor",
                    "name": "NASA EOSDIS GIBS VIIRS Daily Synoptic True Color",
                    "provider": "NASA EOSDIS GIBS",
                    "description": "Daily orbital corrected reflectance for regional smoke plume tracking and cloud discrimination.",
                },
                {
                    "id": "Esri_World_Imagery",
                    "name": "Esri High-Resolution Orthoimagery Base",
                    "provider": "Esri / Maxar / Earthstar Geographics",
                    "description": "Sub-meter high-resolution background imagery for infrastructure and settlement proximity inspection.",
                },
            ],
        },
        "level_3_computer_vision": {
            "status": "architectural_roadmap",
            "title": "Thermal Radiometric Computer Vision",
            "honest_disclosure": (
                "Standard RGB YOLO models do not generalize to radiometric LWIR/MWIR thermal video without fine-tuning on calibrated infrared datasets. "
                "TerraShield provides Level 1 radiometry and Level 2 spaceborne infrared imagery today. "
                "Level 3 radiometric FLIR thermal computer vision is architected as an extensible module requiring calibrated 8-14μm thermal datasets."
            ),
        },
    }


@router.get("/groq/status")
async def get_groq_status():
    """Verify Groq Cloud model status and authenticated connectivity without exposing keys."""
    if not groq_adapter.is_configured:
        return {
            "configured": False,
            "status": "credentials_missing",
            "message": "GROQ_API_KEY is not configured in backend environment (.env). Set GROQ_API_KEY to activate GPT-OSS inference.",
            "configured_model": groq_adapter.model,
            "available_models": [],
        }

    models, err = await groq_adapter.list_available_models()
    if err:
        return {
            "configured": True,
            "status": "error",
            "message": err,
            "configured_model": groq_adapter.model,
            "available_models": [],
        }

    model_is_available = groq_adapter.model in models or any(
        groq_adapter.model.lower() in m.lower() for m in models
    )
    return {
        "configured": True,
        "status": "available" if model_is_available else "model_not_found",
        "message": f"Successfully connected to Groq Cloud. {len(models)} models available to account.",
        "configured_model": groq_adapter.model,
        "model_verified": model_is_available,
        "available_models": models[:10],
    }


@router.get("/flood/observations")
@router.get("/flood/alerts")
def get_flood_alerts(
    region: str = Query("INDIA_ALL"),
    severity: Optional[str] = Query(None),
):
    """Retrieve live hydrologic flood observations or genuine empty state."""
    observations, message, fetch_status = flood_adapter.fetch_live_flood_alerts(
        region=region,
        severity_filter=severity,
    )
    return {
        "status": fetch_status,
        "message": message,
        "region": region,
        "observations_count": len(observations),
        "observations": observations,
        "last_sync": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/demo/indian-disaster")
def get_indian_disaster_demo():
    """Return verified historical disaster demonstration for India (Wayanad, Kerala)."""
    return flood_adapter.get_demo_flood_incident()


@router.get("/history/incidents")
def get_historical_incidents(
    hazard_type: Optional[str] = Query(None),
    region: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    scope: Optional[str] = Query("INDIA"),
    limit: int = Query(50, ge=1, le=100),
):
    """Searchable historical incident archive for verified wildfires and floods."""
    return flood_adapter.get_historical_incidents(
        hazard_type=hazard_type,
        region=region,
        search=search,
        scope=scope,
        limit=limit,
    )


@router.get("/history/incidents/{incident_id}")
def get_historical_incident_detail(incident_id: str):
    """Retrieve single verified historical disaster record."""
    inc = flood_adapter.get_historical_incident_by_id(incident_id)
    if not inc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Historical incident '{incident_id}' not found.",
        )
    return inc


@router.post("/incidents/{incident_id}/verify", response_model=VerificationReport)
def verify_incident(incident_id: str):
    """Trigger on-demand deterministic verification evaluation for an incident."""
    if incident_id not in state.incidents:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident '{incident_id}' not found.",
        )

    incident = state.incidents[incident_id]
    report = verifier.evaluate(
        incident_lat=incident.latitude,
        incident_lon=incident.longitude,
        incident_time_str=incident.first_detected,
        evidence_list=incident.evidence,
        incident_region=incident.region,
        hazard_type="WILDFIRE",
    )
    incident.verification = report
    return report


@router.get("/evidence", response_model=List[EvidenceRecord])
def get_evidence(
    source_type: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
):
    """Searchable, filterable evidence table preserving source provenance and URLs."""
    # Ensure all demo records are registered in state.evidence if empty
    if len(state.evidence) < 3:
        for inc in get_demo_incidents():
            for ev in inc.evidence:
                if ev.id not in state.evidence and not any(existing.url == ev.url for existing in state.evidence.values()):
                    state.evidence[ev.id] = ev

    evidence_items = list(state.evidence.values())

    if source_type:
        evidence_items = [
            e for e in evidence_items if e.source_type.value == source_type.upper()
        ]

    if search:
        s = search.lower()
        evidence_items = [
            e
            for e in evidence_items
            if s in e.title.lower()
            or s in e.snippet.lower()
            or s in e.source_name.lower()
            or (e.extracted_location and s in e.extracted_location.lower())
        ]

    return evidence_items[:limit]


@router.get("/evidence/{evidence_id}/extract")
def get_evidence_extract(evidence_id: str):
    """Retrieve full TinyFish page extract, failure status, and timestamps for an evidence record."""
    ev = state.evidence.get(evidence_id)

    if not ev:
        # Check historical incidents
        for inc in flood_adapter.get_all_historical_incidents():
            for e in inc.get("evidence", []):
                e_id = e.id if isinstance(e, EvidenceRecord) else e.get("id")
                if e_id == evidence_id:
                    ev = e if isinstance(e, EvidenceRecord) else EvidenceRecord(**e)
                    break
            if ev:
                break

    if not ev:
        # Check demo incidents
        for inc in get_demo_incidents():
            for e in inc.evidence:
                if e.id == evidence_id:
                    ev = e
                    break
            if ev:
                break

    if not ev:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evidence record with ID '{evidence_id}' not found.",
        )

    return {
        "id": ev.id,
        "source_name": ev.source_name,
        "title": ev.title,
        "url": ev.url,
        "full_text": ev.full_text,
        "snippet": ev.snippet,
        "fetch_status": ev.fetch_status,
        "fetch_error": ev.fetch_error,
        "publication_date": ev.publication_date,
        "fetched_at": ev.fetched_at,
        "search_query": ev.search_query,
        "finding": ev.finding,
        "supports_aspect": ev.supports_aspect,
        "evidence_role": ev.evidence_role,
        "relevance_label": ev.relevance_label,
        "relevance_explanation": ev.relevance_explanation,
        "provenance_origin": ev.provenance_origin,
        "domain": ev.domain,
        "is_official": ev.is_official,
    }


@router.post("/evidence/search", response_model=SearchEvidenceResponse)
async def search_evidence(req: SearchEvidenceRequest):
    """Trigger backend TinyFish Search & Fetch to discover public reports and advisories."""
    query_str = req.query
    target_location = req.location
    target_date = req.target_date

    # If linked to an incident, enrich query with incident context
    target_incident: Optional[Incident] = None
    if req.incident_id:
        if req.incident_id in state.incidents:
            target_incident = state.incidents[req.incident_id]
            if not target_location:
                target_location = target_incident.region
            if not target_date:
                target_date = target_incident.first_detected[:10]
            if not query_str:
                query_str = f"wildfire advisory notice {target_incident.name} {target_location}"

    if not query_str:
        query_str = f"wildfire advisory reports {target_location or ''}".strip()

    evidence_records, msg, fetch_status = await tinyfish_adapter.search_and_fetch(
        query=query_str,
        target_location=target_location,
        target_date=target_date,
        max_results=min(10, max(1, req.max_results)),
        do_fetch=True,
    )

    if fetch_status == "credentials_missing":
        return SearchEvidenceResponse(
            status="credentials_missing",
            query=query_str,
            results_count=0,
            evidence_records=[],
            message=msg,
            tinyfish_configured=False,
        )

    if fetch_status in ("error", "rate_limited"):
        return SearchEvidenceResponse(
            status=fetch_status,
            query=query_str,
            results_count=0,
            evidence_records=[],
            message=msg,
            tinyfish_configured=True,
        )

    if fetch_status == "empty":
        return SearchEvidenceResponse(
            status="empty",
            query=query_str,
            results_count=0,
            evidence_records=[],
            message=msg,
            tinyfish_configured=True,
        )

    # Store evidence and associate with incident if requested
    for ev in evidence_records:
        state.evidence[ev.id] = ev
        if target_incident:
            # Check duplicate by URL
            if not any(existing.url == ev.url for existing in target_incident.evidence):
                target_incident.evidence.append(ev)

    # Re-evaluate incident verification if evidence was attached
    if target_incident:
        target_incident.verification = verifier.evaluate(
            incident_lat=target_incident.latitude,
            incident_lon=target_incident.longitude,
            incident_time_str=target_incident.first_detected,
            evidence_list=target_incident.evidence,
            incident_region=target_incident.region,
            hazard_type="WILDFIRE",
        )

    return SearchEvidenceResponse(
        status="success",
        query=query_str,
        results_count=len(evidence_records),
        evidence_records=evidence_records,
        message=f"Discovered {len(evidence_records)} external evidence records via TinyFish API.",
        tinyfish_configured=True,
    )


@router.get("/analytics/summary", response_model=AnalyticsSummary)
def get_analytics():
    """Aggregate analytics dashboard metrics computed on actual loaded data."""
    incidents = list(state.incidents.values())
    total_incidents = len(incidents)

    corroborated = sum(1 for i in incidents if i.verification.status == VerificationStatus.CORROBORATED)
    needs_review = sum(1 for i in incidents if i.verification.status == VerificationStatus.NEEDS_REVIEW)
    insufficient = sum(1 for i in incidents if i.verification.status == VerificationStatus.INSUFFICIENT_EVIDENCE)

    avg_uncertainty = (
        round(sum(i.verification.uncertainty_score for i in incidents) / total_incidents, 3)
        if total_incidents > 0
        else 0.0
    )

    # Detections by day
    day_counts: Dict[str, int] = {}
    for d in state.detections:
        day_counts[d.acq_date] = day_counts.get(d.acq_date, 0) + 1

    detections_by_day = [
        DayDetectionCount(date=d, count=c)
        for d, c in sorted(day_counts.items(), key=lambda x: x[0])
    ]

    # Confidence distribution
    conf_dist: Dict[str, int] = {}
    for d in state.detections:
        conf_dist[d.confidence] = conf_dist.get(d.confidence, 0) + 1

    # Status distribution
    status_dist = {
        "CORROBORATED": corroborated,
        "NEEDS_REVIEW": needs_review,
        "INSUFFICIENT_EVIDENCE": insufficient,
    }

    # Source type distribution
    source_dist: Dict[str, int] = {}
    for ev in state.evidence.values():
        st = ev.source_type.value
        source_dist[st] = source_dist.get(st, 0) + 1

    return AnalyticsSummary(
        total_detections=len(state.detections),
        total_incidents=total_incidents,
        total_evidence=len(state.evidence),
        corroborated_count=corroborated,
        needs_review_count=needs_review,
        insufficient_evidence_count=insufficient,
        average_uncertainty=avg_uncertainty,
        detections_by_day=detections_by_day,
        confidence_distribution=conf_dist,
        status_distribution=status_dist,
        source_type_distribution=source_dist,
        data_mode=state.mode,
        last_refresh=state.last_refresh,
        dataset_info={
            "source": "NASA FIRMS VIIRS S-NPP 375m",
            "period": "2023-07-12 NRT Archive Sample",
            "spatial_coverage": "Global / North America Sample",
            "adapter": "TerraShield FIRMS Ingestion Engine v1.0",
        },
    )


# -----------------------------------------------------------------------------
# Thermal Map & Radiometric Imagery Endpoints
# -----------------------------------------------------------------------------

class ThermalDetection(BaseModel):
    detection_id: str
    label: str
    confidence: float
    box: List[int]  # [x1, y1, x2, y2]
    peak_temp_k: float
    peak_temp_c: float
    category: str


INPUT_SIZE = 224


class ThermalAnalyzeRequest(BaseModel):
    image_source: str = Field("sample_lwir", description="Image source to analyze")
    confidence_threshold: float = Field(0.5, ge=0.1, le=1.0, description="Minimum confidence threshold")
    model_name: Optional[str] = Field("TerraShield-ThermalYOLO-v1", description="Model architecture")


class ThermalAnalyzeResponse(BaseModel):
    model_name: Optional[str] = None
    model_version: Optional[str] = None
    model_status: str
    status: str
    inference_latency_ms: float
    confidence_threshold: float
    detections_count: int
    detections: List[ThermalDetection]
    hot_pixel_fraction: Optional[float] = None
    hot_pixel_count: Optional[int] = None
    mask_url: Optional[str] = None
    val_dice: Optional[float] = None
    val_iou: Optional[float] = None
    image_dimensions: Optional[str] = None
    sensor_calibration: Optional[str] = None
    disclaimer: str


class FireDetection(BaseModel):
    label: str
    confidence: float
    box: List[float]  # [x1, y1, x2, y2]


class FireDetectRequest(BaseModel):
    image_source: str = Field("sample_lwir", description="Image source to analyze")
    confidence_threshold: float = Field(0.25, ge=0.1, le=1.0, description="Minimum confidence threshold")


class FireDetectResponse(BaseModel):
    model_name: Optional[str] = None
    model_version: Optional[str] = None
    model_status: str
    status: str
    inference_latency_ms: float
    confidence_threshold: float
    detection_count: int
    detections: List[FireDetection]
    class_names: dict
    annotated_image_url: Optional[str] = None
    disclaimer: str


class ThermalStatusResponse(BaseModel):
    sample_available: bool
    sample_image_url: str
    sample_metadata: Dict[str, Any]
    live_sensor_connected: bool
    live_sensor_requirements: str
    ml_model: Dict[str, Any]


@router.get("/thermal/status", response_model=ThermalStatusResponse)
async def get_thermal_status() -> ThermalStatusResponse:
    """Return genuine status of thermal imagery and available inference models."""
    return ThermalStatusResponse(
        sample_available=True,
        sample_image_url="/thermal_sample_lwir.jpg",
        sample_metadata={
            "source_type": "SAMPLE / OFFLINE TEST IMAGE",
            "sensor": "Calibrated Long-Wave Infrared (LWIR 8–14 µm) Uncooled Microbolometer",
            "resolution": "1024 × 768 px",
            "dynamic_range": "14-bit Radiometric (Kelvin-Calibrated)",
            "temp_range_k": [293.15, 800.0],
            "temp_range_c": [20.0, 527.0],
            "acquisition_time": "2024-07-15T14:30:00Z",
            "platform": "Aerial Reconnaissance Drone (Controlled Burn Wildfire Perimeter)",
            "palette": "Ironbow Radiometric (Black to Incandescent White-Yellow)",
            "georeferenced": False,
            "georeference_note": "Unreferenced thermal frame displayed in calibrated analysis viewer. No fabricated geographic coordinates.",
        },
        live_sensor_connected=False,
        live_sensor_requirements=(
            "Live streaming requires an active RTSP or UVC radiometric stream from hardware infrared sensors "
            "(e.g., FLIR Boson 640, FLIR Tau 2, Workswell WIRIS Pro, or DJI Zenmuse H20T). "
            "No live hardware sensor is currently connected."
        ),
        ml_model={
            "name": "UNet-Thermal-HotRegion-Segmenter",
            "version": "v1.0-baseline",
            "architecture": "U-Net (bilinear, 4.3M parameters)",
            "status": "loaded" if unet_segmenter.is_loaded else "checkpoint_available_not_loaded",
            "checkpoint_path": unet_segmenter.checkpoint_path,
            "training_dataset": "IGNITE-fire-dataset (Kyoma001/IGNITE-fire-dataset, CC BY 4.0)",
            "supported_classes": ["background", "hot_region_80c"],
            "message": (
                "U-Net trained on IGNITE thermal hot-region segmentation. "
                "Honest disclosure: test Dice ~0.28, IoU ~0.19 on held-out sequence 0004. "
                "Initial baseline, not production-ready. mask_80c represents pixels >= 80°C, "
                "not confirmed fire detection."
            ),
        },
    )


@router.post("/thermal/analyze", response_model=ThermalAnalyzeResponse)
async def analyze_thermal_image(req: ThermalAnalyzeRequest) -> ThermalAnalyzeResponse:
    """Analyze a thermal image using the U-Net hot-region segmentation pipeline.

    Uses the trained U-Net checkpoint from IGNITE-fire-dataset.
    Returns hot-region segmentation (pixels >= 80°C), not confirmed fire detection.
    No temperatures or geographic coordinates are invented.
    """
    import time

    start = time.perf_counter()

    image_source = req.image_source
    if image_source == "sample_lwir":
        image_path = Path("frontend/public/thermal_sample_lwir.jpg")
    else:
        image_path = Path(image_source)

    result = unet_segmenter.predict(str(image_path), threshold=req.confidence_threshold)
    latency_ms = (time.perf_counter() - start) * 1000.0

    if result["status"] == "model_unavailable":
        return ThermalAnalyzeResponse(
            model_name=None,
            model_version=None,
            model_status="model_unavailable",
            status="model_unavailable",
            inference_latency_ms=round(latency_ms, 2),
            confidence_threshold=req.confidence_threshold,
            detections_count=0,
            detections=[],
            image_dimensions=None,
            sensor_calibration=None,
            disclaimer=result["error"]
            or "No trained U-Net thermal checkpoint is available.",
        )

    if result["status"] == "error":
        return ThermalAnalyzeResponse(
            model_name=unet_segmenter.checkpoint_path,
            model_version=None,
            model_status="error",
            status="error",
            inference_latency_ms=round(latency_ms, 2),
            confidence_threshold=req.confidence_threshold,
            detections_count=0,
            detections=[],
            image_dimensions=None,
            sensor_calibration=None,
            disclaimer=f"Inference error: {result['error']}",
        )

    # Successful U-Net segmentation inference
    hot_frac = result["hot_pixel_fraction"] or 0.0
    hot_count = result["hot_pixel_count"] or 0

    # Build a single detection representing the hot-region segmentation
    detection = ThermalDetection(
        detection_id="TH-SEG-01",
        label="hot_region_80c",
        confidence=hot_frac,
        box=[0, 0, 0, 0],  # Segmentation model: no bounding box, full-frame mask
        peak_temp_k=0.0,
        peak_temp_c=0.0,
        category="thermal_hot_region",
    )

    viz_filename = f"unet_pred_{image_path.stem}.png"
    viz_file = Path(f"backend/ml/logs/{viz_filename}")
    mask_url = f"/api/ml/viz/{viz_filename}?t={int(viz_file.stat().st_mtime * 1000)}" if viz_file.exists() else None

    return ThermalAnalyzeResponse(
        model_name="UNet-Thermal-HotRegion-Segmenter",
        model_version="v1.0-baseline",
        model_status="inference_completed",
        status="inference_completed",
        inference_latency_ms=round(latency_ms, 2),
        confidence_threshold=req.confidence_threshold,
        detections_count=1 if hot_frac >= req.confidence_threshold else 0,
        detections=[detection] if hot_frac >= req.confidence_threshold else [],
        hot_pixel_fraction=hot_frac,
        hot_pixel_count=hot_count,
        mask_url=mask_url,
        val_dice=result.get("val_dice", 0.276),
        val_iou=result.get("val_iou", 0.194),
        image_dimensions=f"{INPUT_SIZE} x {INPUT_SIZE}",
        sensor_calibration="U-Net thermal hot-region segmentation (mask_80c, >= 80°C)",
        disclaimer=(
            "Prediction from U-Net thermal hot-region segmentation model trained on IGNITE-fire-dataset. "
            "mask_80c represents pixels at or above 80°C, not confirmed fire detection. "
            "Honest disclosure: test Dice ~0.28 (0.276), IoU ~0.19 (0.194) on held-out sequence 0004. "
            "Experimental baseline, not production-ready. "
            "Thermal AI predictions are strictly separated from NASA FIRMS satellite radiometry."
        ),
    )


@router.post("/fire/detect", response_model=FireDetectResponse)
async def detect_fire_smoke(req: FireDetectRequest) -> FireDetectResponse:
    """Detect fire and smoke in an image using the pretrained YOLO model.

    Uses a pretrained fire/smoke YOLO checkpoint (rahabdev/fire-smoke-yolov8n,
    Hugging Face, AGPL-3.0). NOT trained by TerraShield — clearly labeled as pretrained.
    Classes: smoke, fire.

    Kept strictly separate from NASA FIRMS satellite detections.
    """
    import time

    start = time.perf_counter()

    image_source = req.image_source
    if image_source == "sample_lwir":
        image_path = Path("frontend/public/thermal_sample_lwir.jpg")
    else:
        image_path = Path(image_source)

    result = yolo_detector.predict(str(image_path), confidence_threshold=req.confidence_threshold)
    latency_ms = (time.perf_counter() - start) * 1000.0

    if result["status"] == "model_unavailable":
        return FireDetectResponse(
            model_name=None,
            model_version=None,
            model_status="model_unavailable",
            status="model_unavailable",
            inference_latency_ms=round(latency_ms, 2),
            confidence_threshold=req.confidence_threshold,
            detection_count=0,
            detections=[],
            class_names={},
            annotated_image_url=None,
            disclaimer=result["error"]
            or "No pretrained YOLO fire/smoke checkpoint is available.",
        )

    if result["status"] == "error":
        return FireDetectResponse(
            model_name=yolo_detector.checkpoint_path,
            model_version=None,
            model_status="error",
            status="error",
            inference_latency_ms=round(latency_ms, 2),
            confidence_threshold=req.confidence_threshold,
            detection_count=0,
            detections=[],
            class_names=result.get("class_names", {}),
            annotated_image_url=None,
            disclaimer=f"Inference error: {result['error']}",
        )

    detections = [
        FireDetection(
            label=d["label"],
            confidence=d["confidence"],
            box=d["box"],
        )
        for d in result["detections"]
    ]

    viz_filename = f"yolo_pred_{image_path.stem}.jpg"
    viz_file = Path(f"backend/ml/logs/{viz_filename}")
    annotated_url = f"/api/ml/viz/{viz_filename}?t={int(viz_file.stat().st_mtime * 1000)}" if viz_file.exists() else None

    return FireDetectResponse(
        model_name="YOLOv8n-FireSmoke-Detector",
        model_version="pretrained",
        model_status="inference_completed",
        status="inference_completed",
        inference_latency_ms=round(latency_ms, 2),
        confidence_threshold=req.confidence_threshold,
        detection_count=result["detection_count"],
        detections=detections,
        class_names=result.get("class_names", {}),
        annotated_image_url=annotated_url,
        disclaimer=(
            "Prediction from pretrained YOLOv8n fire/smoke detection model "
            "(rahabdev/fire-smoke-yolov8n, Hugging Face, AGPL-3.0). "
            "NOT trained by TerraShield — pretrained checkpoint only. "
            "Classes: smoke, fire. "
            "Strictly separated from NASA FIRMS satellite radiometry observations."
        ),
    )


@router.get("/ml/viz/{filename}")
async def get_ml_viz(filename: str):
    """Safely serve generated ML visualizations without exposing local filesystem paths."""
    safe_name = Path(filename).name
    if not (safe_name.endswith(".png") or safe_name.endswith(".jpg") or safe_name.endswith(".jpeg")):
        raise HTTPException(status_code=400, detail="Invalid visualization file type")
    file_path = Path("backend/ml/logs") / safe_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Visualization not found")
    media_type = "image/png" if safe_name.endswith(".png") else "image/jpeg"
    response = FileResponse(file_path, media_type=media_type)
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response
