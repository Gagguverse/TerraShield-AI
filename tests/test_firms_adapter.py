"""Unit tests for NASA FIRMS adapter."""

import asyncio
from unittest.mock import AsyncMock, patch
import httpx
import pytest

from backend.adapters.firms_adapter import FirmsAdapter
from backend.config import settings


def test_confidence_normalization():
    adapter = FirmsAdapter()

    label, score = adapter.normalize_confidence("h")
    assert label == "high"
    assert score >= 0.9

    label, score = adapter.normalize_confidence("n")
    assert label == "nominal"
    assert 0.6 <= score <= 0.8

    label, score = adapter.normalize_confidence("l")
    assert label == "low"
    assert score <= 0.4

    # MODIS numeric percentage
    label, score = adapter.normalize_confidence("85")
    assert label == "high"
    assert score == 0.85

    label, score = adapter.normalize_confidence("50")
    assert label == "nominal"
    assert score == 0.50


def test_parse_valid_row():
    adapter = FirmsAdapter()
    row = {
        "latitude": "57.5124",
        "longitude": "-121.8415",
        "bright_ti4": "367.4",
        "scan": "0.45",
        "track": "0.62",
        "acq_date": "2023-07-12",
        "acq_time": "2018",
        "satellite": "N",
        "instrument": "VIIRS",
        "confidence": "h",
        "bright_ti5": "312.8",
        "frp": "148.5",
        "daynight": "D",
    }
    det = adapter.parse_row(row, 1, data_mode="HISTORICAL_SAMPLE")
    assert det is not None
    assert det.latitude == 57.5124
    assert det.longitude == -121.8415
    assert det.bright_ti4 == 367.4
    assert det.frp == 148.5
    assert det.confidence == "high"
    assert det.acq_time == "20:18"
    assert "2023-07-12" in det.timestamp


def test_parse_malformed_coordinates():
    adapter = FirmsAdapter()
    # Out of bounds latitude
    row = {
        "latitude": "95.0",
        "longitude": "-121.8415",
        "acq_date": "2023-07-12",
        "acq_time": "1200",
    }
    det = adapter.parse_row(row, 2)
    assert det is None

    # Missing coordinates
    row_missing = {
        "latitude": "",
        "longitude": "-121.8415",
    }
    det_missing = adapter.parse_row(row_missing, 3)
    assert det_missing is None


def test_sample_csv_loading():
    adapter = FirmsAdapter()
    detections = adapter.load_sample_csv(limit=50)
    assert len(detections) > 0
    assert all(-90.0 <= d.latitude <= 90.0 for d in detections)
    assert all(-180.0 <= d.longitude <= 180.0 for d in detections)
    assert all(d.data_mode == "HISTORICAL_SAMPLE" for d in detections)


def test_fetch_live_firms_without_credentials():
    adapter = FirmsAdapter()
    with patch.object(settings, "FIRMS_MAP_KEY", ""):
        detections, msg, status = asyncio.run(adapter.fetch_live_firms())
        assert detections == []
        assert status == "credentials_missing"
        assert "FIRMS_MAP_KEY is not configured" in msg


def test_fetch_live_firms_success_mock():
    adapter = FirmsAdapter()
    sample_csv_content = (
        "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight\n"
        "51.4502,-120.3211,345.2,0.39,0.36,2026-10-19,1930,N,VIIRS,h,2.0NRT,295.4,62.8,D\n"
        "51.4610,-120.3105,355.8,0.39,0.36,2026-10-19,1930,N,VIIRS,n,2.0NRT,301.2,85.1,D\n"
    )

    mock_resp = httpx.Response(
        status_code=200,
        text=sample_csv_content,
        request=httpx.Request("GET", "https://firms.modaps.eosdis.nasa.gov/api"),
    )

    with patch.object(settings, "FIRMS_MAP_KEY", "test_mock_firms_key_12345"):
        with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_resp
            detections, msg, status = asyncio.run(
                adapter.fetch_live_firms(area="PACIFIC_NORTHWEST", day_range=1)
            )

            assert status == "success"
            assert len(detections) == 2
            assert detections[0].latitude == 51.4502
            assert detections[0].longitude == -120.3211
            assert detections[0].confidence == "high"
            assert detections[0].data_mode == "LIVE"
            assert detections[1].confidence == "nominal"
            assert "Successfully loaded 2 live satellite detections" in msg


def test_fetch_live_firms_invalid_map_key_body():
    adapter = FirmsAdapter()
    mock_resp = httpx.Response(
        status_code=200,
        text="Invalid MAP_KEY",
        request=httpx.Request("GET", "https://firms.modaps.eosdis.nasa.gov/api"),
    )

    with patch.object(settings, "FIRMS_MAP_KEY", "invalid_key"):
        with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_resp
            detections, msg, status = asyncio.run(adapter.fetch_live_firms())

            assert status == "error"
            assert detections == []
            assert "Invalid MAP_KEY" in msg


def test_fetch_live_firms_empty_data():
    adapter = FirmsAdapter()
    mock_resp = httpx.Response(
        status_code=200,
        text="No data",
        request=httpx.Request("GET", "https://firms.modaps.eosdis.nasa.gov/api"),
    )

    with patch.object(settings, "FIRMS_MAP_KEY", "valid_key_12345"):
        with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_resp
            detections, msg, status = asyncio.run(adapter.fetch_live_firms())

            assert status == "empty"
            assert detections == []
            assert "No active satellite detections found" in msg


def test_fetch_live_firms_rate_limited():
    adapter = FirmsAdapter()
    mock_resp = httpx.Response(
        status_code=429,
        text="Too Many Requests",
        request=httpx.Request("GET", "https://firms.modaps.eosdis.nasa.gov/api"),
    )

    with patch.object(settings, "FIRMS_MAP_KEY", "valid_key_12345"):
        with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_resp
            detections, msg, status = asyncio.run(adapter.fetch_live_firms())

            assert status == "rate_limited"
            assert detections == []
            assert "rate limit reached" in msg


def test_fetch_live_firms_upstream_502_no_cache():
    """Verify that upstream 502 retries bounded times and returns error without leaking key."""
    adapter = FirmsAdapter()
    adapter._cache.clear()

    mock_502 = httpx.Response(
        status_code=502,
        text="<html><body>502 Bad Gateway</body></html>",
        request=httpx.Request("GET", "https://firms.modaps.eosdis.nasa.gov/api"),
    )

    secret_key = "super_secret_firms_key_abc123"
    with patch.object(settings, "FIRMS_MAP_KEY", secret_key):
        with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_502
            with patch("asyncio.sleep", new_callable=AsyncMock):
                detections, msg, status = asyncio.run(adapter.fetch_live_firms())

                assert status == "error"
                assert detections == []
                assert "502" in msg
                assert secret_key not in msg
                # Confirms bounded retries were executed (3 attempts)
                assert mock_get.call_count == 3


def test_fetch_live_firms_upstream_502_with_cached_fallback():
    """Verify that when upstream returns 502 and cached data exists, it serves cached data labeled CACHED."""
    adapter = FirmsAdapter()

    # Pre-populate cache
    sample_csv_content = (
        "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight\n"
        "22.5100,78.3200,340.5,0.4,0.4,2026-10-19,1430,N,VIIRS,h,2.0NRT,298.0,45.2,D\n"
    )
    with patch.object(settings, "FIRMS_MAP_KEY", "test_key_123"):
        with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = httpx.Response(
                status_code=200,
                text=sample_csv_content,
                request=httpx.Request("GET", "https://firms.modaps.eosdis.nasa.gov/api"),
            )
            dets, _, st = asyncio.run(adapter.fetch_live_firms(area="INDIA_ALL", source="VIIRS_SNPP_NRT"))
            assert st == "success"
            assert len(dets) == 1

    # Now simulate upstream 502 failure
    mock_502 = httpx.Response(
        status_code=502,
        text="502 Bad Gateway",
        request=httpx.Request("GET", "https://firms.modaps.eosdis.nasa.gov/api"),
    )

    with patch.object(settings, "FIRMS_MAP_KEY", "test_key_123"):
        with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_502
            with patch("asyncio.sleep", new_callable=AsyncMock):
                detections, msg, status = asyncio.run(
                    adapter.fetch_live_firms(area="INDIA_ALL", source="VIIRS_SNPP_NRT")
                )

                assert status == "cached"
                assert len(detections) == 1
                # Must be explicitly labeled CACHED, NOT LIVE
                assert detections[0].data_mode == "CACHED"
                assert "Serving 1 cached detections" in msg
                assert "Stale" in msg


def test_fetch_live_firms_timeout_retry():
    """Verify that network timeout retries up to MAX_RETRIES."""
    adapter = FirmsAdapter()
    adapter._cache.clear()

    with patch.object(settings, "FIRMS_MAP_KEY", "test_key_123"):
        with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
            mock_get.side_effect = httpx.ReadTimeout("Read timed out")
            with patch("asyncio.sleep", new_callable=AsyncMock):
                detections, msg, status = asyncio.run(adapter.fetch_live_firms())

                assert status == "error"
                assert detections == []
                assert "ReadTimeout" in msg or "unavailable" in msg
                assert mock_get.call_count == 3

