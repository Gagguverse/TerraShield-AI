"""Unit tests for Groq Cloud dossier generation, Flood telemetry, and Historical incident library."""

import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from backend.main import app
from backend.adapters.flood_adapter import flood_adapter
from backend.adapters.groq_adapter import GroqAdapter, groq_adapter
from backend.config import settings

client = TestClient(app)


def test_flood_live_alerts_honest_empty():
    """Verify live flood telemetry reports honest empty state rather than inventing fake disasters."""
    resp = client.get("/api/flood/alerts")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "empty"
    assert "No qualifying flood anomaly detected" in data["message"]
    assert data["observations_count"] == 0
    assert isinstance(data["observations"], list)


def test_demo_indian_disaster_endpoint():
    """Verify Indian disaster demo returns the authentic Wayanad 2024 disaster."""
    resp = client.get("/api/demo/indian-disaster")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == "INC-DEMO-WAYANAD-2024"
    assert "Wayanad" in data["name"]
    assert data["hazard_type"] == "FLOOD"
    assert data["country"] == "India"
    assert data["state_province"] == "Kerala"
    assert abs(data["latitude"] - 11.5360) < 0.01
    assert abs(data["longitude"] - 76.1300) < 0.01
    assert len(data["timeline"]) >= 4
    assert len(data["evidence"]) >= 3
    assert data["hydrologic_metrics"]["rainfall_48h_mm"] == 572.0


def test_historical_incidents_search_and_filter():
    """Verify historical disaster archive supports filtering by hazard_type and search."""
    # All
    resp = client.get("/api/history/incidents")
    assert resp.status_code == 200
    all_incidents = resp.json()
    assert len(all_incidents) >= 6

    # Filter by hazard_type=FLOOD
    resp_flood = client.get("/api/history/incidents?hazard_type=FLOOD")
    assert resp_flood.status_code == 200
    flood_incidents = resp_flood.json()
    assert len(flood_incidents) >= 3
    assert all(i["hazard_type"] == "FLOOD" for i in flood_incidents)

    # Filter by hazard_type=WILDFIRE
    resp_fire = client.get("/api/history/incidents?hazard_type=WILDFIRE")
    assert resp_fire.status_code == 200
    fire_incidents = resp_fire.json()
    assert len(fire_incidents) >= 3
    assert all(i["hazard_type"] == "WILDFIRE" for i in fire_incidents)

    # Search for Chamoli
    resp_search = client.get("/api/history/incidents?search=Chamoli")
    assert resp_search.status_code == 200
    search_results = resp_search.json()
    assert len(search_results) == 1
    assert "Chamoli" in search_results[0]["name"]


def test_get_incident_dossier_historical():
    """Verify getting full dossier for historical incident returns timeline, impacts, and evidence."""
    resp = client.get("/api/incidents/INC-HIST-IND-001/dossier")
    assert resp.status_code == 200
    dossier = resp.json()
    assert dossier["status"] == "success"
    assert dossier["hazard_type"] == "FLOOD"
    assert len(dossier["timeline"]) >= 4
    assert len(dossier["evidence"]) >= 3
    assert "executive_summary" in dossier["groq_report"]


def test_groq_status_unconfigured():
    """Verify /api/groq/status reports credentials_missing safely when no key is set."""
    with patch.object(groq_adapter, "api_key", ""):
        resp = client.get("/api/groq/status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["configured"] is False
        assert data["status"] == "credentials_missing"
        assert "GROQ_API_KEY is not configured" in data["message"]


@pytest.mark.anyio
async def test_groq_adapter_masked_key():
    """Verify Groq adapter never leaks real API key in error messages."""
    adapter = GroqAdapter(api_key="gsk_secret_key_123456789")
    masked = adapter._mask_key("Error communicating with gsk_secret_key_123456789 endpoint")
    assert "gsk_secret_key_123456789" not in masked
    assert "***REDACTED***" in masked


def test_thermal_capabilities_endpoint():
    """Verify thermal imaging capabilities disclose honest 3-level hierarchy."""
    resp = client.get("/api/thermal/capabilities")
    assert resp.status_code == 200
    data = resp.json()
    assert "level_1_radiometry" in data
    assert data["level_1_radiometry"]["status"] == "operational"
    assert "level_2_imagery" in data
    assert data["level_2_imagery"]["status"] == "operational"
    assert "level_3_computer_vision" in data
    assert data["level_3_computer_vision"]["status"] == "architectural_roadmap"
    assert "Standard RGB YOLO models do not generalize" in data["level_3_computer_vision"]["honest_disclosure"]


def test_investigate_incident_endpoint():
    """Verify unified investigation workflow endpoint on historical incident."""
    resp = client.post("/api/incidents/INC-HIST-IND-001/investigate")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] in ("success", "partial_evidence")
    assert data["incident_id"] == "INC-HIST-IND-001"
    assert "workflow_trace" in data
    assert "report" in data
    report = data["report"]
    assert "executive_summary" in report
    assert "what_happened" in report


def test_history_scope_india_default():
    """Verify historical incidents endpoint defaults to verified Indian records."""
    resp = client.get("/api/history/incidents")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 6
    # All records in default scope must be in India
    assert all(inc["country"] == "India" for inc in data)
    names = [inc["name"] for inc in data]
    assert any("Wayanad" in n for n in names)
    assert any("Chamoli" in n for n in names)
    assert any("Assam" in n for n in names)
    assert any("Uttarakhand" in n for n in names)
    assert any("Simlipal" in n for n in names)
    assert any("Kerala" in n for n in names)


def test_history_scope_international():
    """Verify international scope returns only non-India reference benchmarks."""
    resp = client.get("/api/history/incidents?scope=INTERNATIONAL")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    assert all(inc["country"] in ("Canada", "United States") for inc in data)
    ids = [inc["id"] for inc in data]
    assert "INC-HIST-INT-001" in ids
    assert "INC-HIST-INT-002" in ids


def test_history_scope_all():
    """Verify scope=ALL returns Indian records first, then international benchmarks."""
    resp = client.get("/api/history/incidents?scope=ALL")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 8
    # First item must be India
    assert data[0]["country"] == "India"


def test_investigate_nonexistent_returns_404():
    """Verify non-existent incident ID cleanly returns 404 rather than internal error or false report."""
    resp = client.post("/api/incidents/INC-DEFINITELY-DOES-NOT-EXIST/investigate")
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


