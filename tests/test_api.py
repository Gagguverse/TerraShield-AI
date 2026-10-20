"""Integration tests for FastAPI endpoints."""

from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from backend.adapters.tinyfish_adapter import tinyfish_adapter
from backend.config import settings
from backend.main import app
from backend.models.detection import SatelliteDetection
from backend.models.evidence import EvidenceRecord, EvidenceStatus, SourceType

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["app_name"] == "TerraShield AI"
    assert "current_mode" in data
    assert "tinyfish_configured" in data


def test_detections_endpoint():
    response = client.get("/api/detections?limit=10")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    if len(data) > 0:
        det = data[0]
        assert "latitude" in det
        assert "longitude" in det
        assert "confidence" in det
        assert "data_mode" in det


def test_incidents_endpoint():
    response = client.get("/api/incidents")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    if len(data) > 0:
        inc = data[0]
        assert "id" in inc
        assert "verification" in inc
        assert inc["verification"]["status"] in [
            "CORROBORATED",
            "NEEDS_REVIEW",
            "INSUFFICIENT_EVIDENCE",
        ]


def test_mode_switch():
    # Switch to DEMO mode
    resp = client.post("/api/mode", json={"mode": "DEMO"})
    assert resp.status_code == 200
    assert resp.json()["mode"] == "DEMO"

    # Verify DEMO incidents are loaded
    inc_resp = client.get("/api/incidents")
    assert inc_resp.status_code == 200
    assert len(inc_resp.json()) == 3

    # Switch back to HISTORICAL_SAMPLE mode
    resp_sample = client.post("/api/mode", json={"mode": "HISTORICAL_SAMPLE"})
    assert resp_sample.status_code == 200
    assert resp_sample.json()["mode"] == "HISTORICAL_SAMPLE"


def test_analytics_summary_endpoint():
    response = client.get("/api/analytics/summary")
    assert response.status_code == 200
    data = response.json()
    assert "total_detections" in data
    assert "total_incidents" in data
    assert "corroborated_count" in data
    assert "needs_review_count" in data
    assert "insufficient_evidence_count" in data
    assert "status_distribution" in data


def test_firms_regions_endpoint():
    response = client.get("/api/firms/regions")
    assert response.status_code == 200
    data = response.json()
    assert "regions" in data
    assert len(data["regions"]) >= 6
    assert any(r["id"] == "PACIFIC_NORTHWEST" for r in data["regions"])
    assert "supported_sources" in data
    assert "VIIRS_SNPP_NRT" in data["supported_sources"]
    assert "firms_configured" in data


def test_firms_fetch_endpoint_credentials_missing():
    with patch.object(settings, "FIRMS_MAP_KEY", ""):
        response = client.post(
            "/api/firms/fetch",
            json={"region": "PACIFIC_NORTHWEST", "source": "VIIRS_SNPP_NRT", "day_range": 1},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "credentials_missing"
        assert data["firms_configured"] is False
        assert data["detections_count"] == 0
        assert "FIRMS_MAP_KEY is not configured" in data["message"]


def test_firms_fetch_endpoint_mock_success():
    fake_detections = [
        SatelliteDetection(
            id="FIRMS-LIVE-1-5100-12000",
            latitude=51.50,
            longitude=-120.50,
            bright_ti4=345.0,
            frp=42.0,
            acq_date="2026-10-19",
            acq_time="18:30",
            timestamp="2026-10-19T18:30:00Z",
            satellite="N",
            instrument="VIIRS",
            confidence="high",
            confidence_score=0.95,
            daynight="D",
            data_mode="LIVE",
        )
    ]

    with patch(
        "backend.adapters.firms_adapter.firms_adapter.fetch_live_firms",
        new_callable=AsyncMock,
    ) as mock_fetch:
        mock_fetch.return_value = (
            fake_detections,
            "Successfully loaded 1 live detections.",
            "success",
        )

        response = client.post(
            "/api/firms/fetch",
            json={"region": "PACIFIC_NORTHWEST", "source": "VIIRS_SNPP_NRT", "day_range": 1},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["detections_count"] == 1
        assert data["incidents_count"] == 1

        # Reset state back to HISTORICAL_SAMPLE
        client.post("/api/mode", json={"mode": "HISTORICAL_SAMPLE"})


def test_firms_fetch_endpoint_cached_fallback():
    cached_detections = [
        SatelliteDetection(
            id="FIRMS-CACH-1-2250-7850",
            latitude=22.50,
            longitude=78.50,
            bright_ti4=342.0,
            frp=38.0,
            acq_date="2026-10-19",
            acq_time="14:15",
            timestamp="2026-10-19T14:15:00Z",
            satellite="N",
            instrument="VIIRS",
            confidence="nominal",
            confidence_score=0.70,
            daynight="D",
            data_mode="CACHED",
        )
    ]

    with patch(
        "backend.adapters.firms_adapter.firms_adapter.fetch_live_firms",
        new_callable=AsyncMock,
    ) as mock_fetch:
        mock_fetch.return_value = (
            cached_detections,
            "NASA FIRMS upstream error (HTTP 502). Serving 1 cached detections from 2026-10-19T14:15:00Z (Stale).",
            "cached",
        )

        response = client.post(
            "/api/firms/fetch",
            json={"region": "INDIA_ALL", "source": "VIIRS_SNPP_NRT", "day_range": 1},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "cached"
        assert data["is_cached"] is True
        assert data["detections_count"] == 1
        assert "Stale" in data["message"]

        # Detections endpoint returns them as CACHED
        det_resp = client.get("/api/detections")
        assert det_resp.status_code == 200
        dets = det_resp.json()
        assert len(dets) == 1
        assert dets[0]["data_mode"] == "CACHED"

        # Reset state back
        client.post("/api/mode", json={"mode": "HISTORICAL_SAMPLE"})


def test_firms_fetch_endpoint_upstream_error_no_cache():
    with patch(
        "backend.adapters.firms_adapter.firms_adapter.fetch_live_firms",
        new_callable=AsyncMock,
    ) as mock_fetch:
        mock_fetch.return_value = (
            [],
            "NASA FIRMS API request failed: HTTP 502: Bad Gateway. No cached data available.",
            "error",
        )

        response = client.post(
            "/api/firms/fetch",
            json={"region": "INDIA_ALL", "source": "VIIRS_SNPP_NRT", "day_range": 1},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "error"
        assert data["detections_count"] == 0
        assert data["is_cached"] is False
        assert "502" in data["message"]


def test_evidence_search_credentials_missing():
    with patch.object(tinyfish_adapter, "api_key", ""):
        response = client.post(
            "/api/evidence/search",
            json={"query": "wildfire advisory test"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "credentials_missing"
        assert data["tinyfish_configured"] is False
        assert data["results_count"] == 0
        assert "TINYFISH_API_KEY is not configured" in data["message"]


def test_evidence_search_mock_success_and_incident_link():
    mock_record = EvidenceRecord(
        id="TF-EVID-TEST-1",
        source_name="BC Wildfire Service",
        source_type=SourceType.OFFICIAL_AGENCY,
        title="Official Fire Warning - Test Area",
        url="https://wildfiresituation.nrs.gov.bc.ca/test-notice",
        snippet="Evacuation order active in test area.",
        full_text="# Official Wildfire Bulletin\nUrgent action required.",
        extracted_location="Northern BC",
        event_date="2023-07-12",
        fetched_at="2026-10-19T18:00:00Z",
        is_official=True,
        relevance_score=0.95,
        relevance_explanation="Matches test wildfire query",
        fetch_status=EvidenceStatus.ACTIVE,
    )

    with patch(
        "backend.adapters.tinyfish_adapter.tinyfish_adapter.search_and_fetch",
        new_callable=AsyncMock,
    ) as mock_sf:
        mock_sf.return_value = (
            [mock_record],
            "Discovered 1 evidence record.",
            "success",
        )

        response = client.post(
            "/api/evidence/search",
            json={
                "incident_id": "INC-HIST-001",
                "query": "Donnie Creek fire",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["results_count"] == 1
        assert data["evidence_records"][0]["url"] == "https://wildfiresituation.nrs.gov.bc.ca/test-notice"
        assert data["evidence_records"][0]["is_official"] is True


def test_thermal_status_endpoint():
    response = client.get("/api/thermal/status")
    assert response.status_code == 200
    data = response.json()
    assert data["sample_available"] is True
    assert data["sample_image_url"] == "/thermal_sample_lwir.jpg"
    assert data["live_sensor_connected"] is False
    assert "FLIR" in data["live_sensor_requirements"]
    assert data["ml_model"]["name"] == "UNet-Thermal-HotRegion-Segmenter"
    assert data["ml_model"]["architecture"] == "U-Net (bilinear, 4.3M parameters)"
    assert data["ml_model"]["training_dataset"] is not None
    assert "IGNITE" in data["ml_model"]["training_dataset"]
    assert "hot_region" in data["ml_model"]["message"].lower() or "80" in data["ml_model"]["message"]


def test_thermal_analyze_endpoint():
    response = client.post("/api/thermal/analyze", json={"confidence_threshold": 0.5})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "inference_completed"
    assert data["model_status"] == "inference_completed"
    assert data["model_name"] == "UNet-Thermal-HotRegion-Segmenter"
    assert "hot_region" in data["disclaimer"].lower() or "80" in data["disclaimer"]
    assert "FIRMS" in data["disclaimer"]

    # Higher threshold may return 0 detections if hot fraction below threshold
    high_resp = client.post("/api/thermal/analyze", json={"confidence_threshold": 0.9})
    assert high_resp.status_code == 200
    high_data = high_resp.json()
    assert high_data["detections_count"] == 0


def test_fire_detect_endpoint():
    response = client.post("/api/fire/detect", json={"confidence_threshold": 0.25})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "inference_completed"
    assert data["model_status"] == "inference_completed"
    assert data["model_name"] == "YOLOv8n-FireSmoke-Detector"
    assert data["detection_count"] >= 0
    assert isinstance(data["detections"], list)
    assert "pretrained" in data["disclaimer"].lower()
    assert "FIRMS" in data["disclaimer"]

    # Verify class names are present
    assert "smoke" in data["class_names"].values() or "fire" in data["class_names"].values()

    # Higher threshold should reduce or maintain detection count
    high_resp = client.post("/api/fire/detect", json={"confidence_threshold": 0.9})
    assert high_resp.status_code == 200
    high_data = high_resp.json()
    assert high_data["detection_count"] <= data["detection_count"]


def test_root_serves_website():
    """Verify that GET / serves the compiled frontend HTML website."""
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers.get("content-type", "")
    assert '<div id="root"></div>' in response.text
    assert "TerraShield AI" in response.text


def test_spa_fallback_and_api_404():
    """Verify that SPA fallback returns index.html for client routes, while /api routes 404 as JSON."""
    # SPA fallback for frontend client route
    spa_resp = client.get("/history/chamoli")
    assert spa_resp.status_code == 200
    assert "text/html" in spa_resp.headers.get("content-type", "")
    assert '<div id="root"></div>' in spa_resp.text

    # Unmapped API route must NOT return HTML fallback
    api_resp = client.get("/api/unmapped-endpoint-test")
    assert api_resp.status_code == 404
    assert "application/json" in api_resp.headers.get("content-type", "")
    assert api_resp.json()["detail"] == "Not Found"

