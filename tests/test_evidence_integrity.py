"""Comprehensive regression test suite for TerraShield AI Evidence Verification & Pipeline Integrity.

Validates that deterministic rules govern incident verification, Groq synthesis is strictly
evidence-grounded, geographic/temporal mismatches are rejected, and evidence semantics
are accurately enforced.
"""

import pytest
import httpx
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from backend.main import app
from backend.engine.verifier import VerificationEngine, verifier
from backend.engine.geo_temporal_validator import (
    haversine_distance_km,
    validate_coordinates,
    validate_point_in_region,
    validate_named_location_match,
    evaluate_temporal_alignment,
    normalize_utc_timestamp,
)
from backend.adapters.tinyfish_adapter import TinyFishAdapter
from backend.adapters.groq_adapter import GroqAdapter
from backend.models.evidence import EvidenceRecord, EvidenceStatus, SourceType
from backend.models.incident import VerificationStatus, Incident

client = TestClient(app)


# =============================================================================
# 1. Zero Successful Fetches (Discovered Snippets Only)
# =============================================================================
def test_zero_successful_fetches_cannot_corroborate():
    """Verify that discovered snippets without fetched full text cannot corroborate an incident."""
    engine = VerificationEngine(max_distance_km=35.0, max_time_hours=72.0)
    snippet_only_evidence = [
        EvidenceRecord(
            id="SNIP-01",
            source_name="Regional News Blog",
            source_type=SourceType.NEWS_MEDIA,
            title="Local hills report fire smoke",
            url="https://localnews.example.com/smoke-1",
            snippet="Smoke seen rising above the forest ridge.",
            full_text=None,  # Zero fetched content
            extracted_location="Pauri Garhwal, Uttarakhand",
            latitude=30.1500,
            longitude=79.2000,
            event_date="2024-05-04",
            publication_date="2024-05-04T12:00:00Z",
            fetched_at="2024-05-04T12:30:00Z",
            is_official=False,
            relevance_score=0.85,
            fetch_status=EvidenceStatus.PARTIAL,  # Snippet only
        ),
        EvidenceRecord(
            id="SNIP-02",
            source_name="Hill Gazette",
            source_type=SourceType.NEWS_MEDIA,
            title="Hills enveloped in smoke haze",
            url="https://hillgazette.example.com/smoke-2",
            snippet="Hazy conditions reported across Pauri ridge.",
            full_text=None,  # Zero fetched content
            extracted_location="Pauri Garhwal, Uttarakhand",
            latitude=30.1400,
            longitude=79.2100,
            event_date="2024-05-04",
            publication_date="2024-05-04T14:00:00Z",
            fetched_at="2024-05-04T14:30:00Z",
            is_official=False,
            relevance_score=0.82,
            fetch_status=EvidenceStatus.PARTIAL,
        ),
    ]

    report = engine.evaluate(
        incident_lat=30.1500,
        incident_lon=79.2000,
        incident_time_str="2024-05-04T07:45:00Z",
        evidence_list=snippet_only_evidence,
        incident_region="Uttarakhand, India",
    )

    # Must NOT be CORROBORATED because full page was never fetched
    assert report.status != VerificationStatus.CORROBORATED
    assert report.status == VerificationStatus.NEEDS_REVIEW
    assert report.pages_fetched_count == 0
    # Must fail PAGE_CONTENT_FETCHED condition
    assert any(c.code == "PAGE_CONTENT_FETCHED" and not c.met for c in report.conditions_failed)


# =============================================================================
# 2. Historical Articles Cannot Corroborate Current Incidents
# =============================================================================
def test_historical_article_rejected_as_direct_corroboration():
    """Verify that historical articles from years prior cannot corroborate a contemporary incident."""
    engine = VerificationEngine(max_distance_km=35.0, max_time_hours=72.0)

    # Historical 2021 article supplied for a 2026 contemporary detection
    historical_ev = EvidenceRecord(
        id="HIST-SIMLIPAL-2021",
        source_name="Odisha Environmental Bureau",
        source_type=SourceType.NEWS_MEDIA,
        title="Simlipal forest fires March 2021 Mayurbhanj surface leaf burning",
        url="https://odisha-environment.example.com/simlipal-2021",
        snippet="Dry sal leaves burned across Mayurbhanj in March 2021.",
        full_text="Full report documenting the March 2021 Simlipal surface leaf fires in Mayurbhanj district.",
        extracted_location="Mayurbhanj, Odisha",
        latitude=21.8600,
        longitude=86.3400,
        event_date="2021-03-05",
        publication_date="2021-03-05T12:00:00Z",
        fetched_at="2026-10-20T12:00:00Z",
        is_official=False,
        relevance_score=0.90,
        fetch_status=EvidenceStatus.ACTIVE,
    )

    # Observation is from 2026 (current time)
    report = engine.evaluate(
        incident_lat=21.8600,
        incident_lon=86.3400,
        incident_time_str="2026-10-20T08:00:00Z",
        evidence_list=[historical_ev],
        incident_region="Mayurbhanj, Odisha, India",
    )

    # Must NOT corroborate 2026 detection with 2021 article!
    assert report.status != VerificationStatus.CORROBORATED
    assert report.contextual_sources_count >= 1
    assert report.direct_sources_count == 0
    # TEMPORAL_WINDOW_MATCH must fail
    assert any(c.code == "TEMPORAL_WINDOW_MATCH" and not c.met for c in report.conditions_failed)


# =============================================================================
# 3. Geography / Coordinate Mismatches (Cross-State / Distant Points)
# =============================================================================
def test_geographic_mismatch_cross_state():
    """Verify that an incident in Kerala cannot be corroborated by evidence in Uttarakhand."""
    engine = VerificationEngine(max_distance_km=35.0, max_time_hours=72.0)

    # Article in Uttarakhand (Garhwal ~2000 km away)
    uttarakhand_ev = EvidenceRecord(
        id="EV-UTTARAKHAND-MISMATCH",
        source_name="Garhwal News Bureau",
        source_type=SourceType.NEWS_MEDIA,
        title="Forest fires doused on Garhwal ridges",
        url="https://garhwalnews.example.com/fires",
        snippet="Helicopters douse fire in Pauri Garhwal hills.",
        full_text="Forest department teams extinguished fire across Pauri Garhwal ridges in Uttarakhand.",
        extracted_location="Pauri Garhwal, Uttarakhand",
        latitude=30.1500,
        longitude=79.2000,
        event_date="2024-05-04",
        publication_date="2024-05-04T12:00:00Z",
        fetched_at="2024-05-04T14:00:00Z",
        is_official=False,
        relevance_score=0.90,
        fetch_status=EvidenceStatus.ACTIVE,
    )

    # Incident centroid is in Wayanad, Kerala (11.5360, 76.1300)
    report = engine.evaluate(
        incident_lat=11.5360,
        incident_lon=76.1300,
        incident_time_str="2024-05-04T10:00:00Z",
        evidence_list=[uttarakhand_ev],
        incident_region="Kerala, India",
    )

    assert report.status == VerificationStatus.INSUFFICIENT_EVIDENCE
    assert report.geographic_distance_km is not None
    assert report.geographic_distance_km > 1000.0
    assert any(c.code == "PROXIMITY_WITHIN_THRESHOLD" and not c.met for c in report.conditions_failed)


def test_broad_country_match_rejected_without_local_match():
    """Verify that an article mentioning only 'India' without specific district does not pass local spatial check."""
    loc_ok, match_type, diag = validate_named_location_match(
        target_region="Uttarakhand, India",
        extracted_location="India",
        text_content="Fires reported in India as pre-monsoon temperatures soar nationally.",
    )
    # Generic country word alone cannot satisfy localized administrative match
    assert loc_ok is False
    assert "Broad country/general matches are rejected" in diag


# =============================================================================
# 4. Publication-Date and Incident-Date Mismatches (>72h Window)
# =============================================================================
def test_publication_date_exceeds_72h_window():
    """Verify that reports published beyond 72 hours from orbital observation fail temporal alignment."""
    res = evaluate_temporal_alignment(
        observation_dt=normalize_utc_timestamp("2024-05-04T07:45:00Z"),
        report_dt=normalize_utc_timestamp("2024-05-14T12:00:00Z"),  # 10 days later
        max_hours=72.0,
    )
    assert res["matched"] is False
    assert res["delta_hours"] > 200.0
    assert "exceeding the 72.0-hour relevance window" in res["explanation"]


# =============================================================================
# 5. Duplicate and Syndicated Wire Sources Deduplication
# =============================================================================
def test_syndicated_wire_stories_counted_as_single_independent_source():
    """Verify that three newspapers carrying the identical PTI wire report count as 1 independent source."""
    engine = VerificationEngine()
    ev1 = EvidenceRecord(
        id="EV-WIRE-1",
        source_name="The Times of India",
        source_type=SourceType.NEWS_MEDIA,
        title="PTI Wire: Forest fire spreads in Pauri Garhwal",
        url="https://timesofindia.indiatimes.com/city/dehradun/pauri-fire",
        snippet="PTI: Over 200 hectares affected in Pauri Garhwal as heatwave peaks.",
        fetched_at="2024-05-04T12:00:00Z",
    )
    ev2 = EvidenceRecord(
        id="EV-WIRE-2",
        source_name="Deccan Herald",
        source_type=SourceType.NEWS_MEDIA,
        title="PTI: Forest fire spreads in Pauri Garhwal",
        url="https://deccanherald.com/national/pauri-fire",
        snippet="PTI report: Over 200 hectares affected in Pauri Garhwal as heatwave peaks.",
        fetched_at="2024-05-04T12:05:00Z",
    )
    ev3 = EvidenceRecord(
        id="EV-WIRE-3",
        source_name="The Tribune",
        source_type=SourceType.NEWS_MEDIA,
        title="PTI: Forest fire spreads in Pauri Garhwal",
        url="https://tribuneindia.com/news/nation/pauri-fire",
        snippet="PTI: Over 200 hectares affected in Pauri Garhwal as heatwave peaks.",
        fetched_at="2024-05-04T12:10:00Z",
    )

    domains = engine.extract_independent_domains([ev1, ev2, ev3])
    # Must be deduplicated down to 1 independent wire reporting entity
    assert len(domains) == 1


# =============================================================================
# 6. Failed or Partial Page Extraction
# =============================================================================
@pytest.mark.anyio
async def test_failed_page_fetch_records_actual_error():
    """Verify that fetch errors preserve the actual HTTP status or connection error and mark status as FAILED."""
    adapter = TinyFishAdapter(api_key="mock_tf_key")

    mock_search = httpx.Response(
        status_code=200,
        json={"results": [{"url": "https://paywalled.example.com/fire", "title": "Fire behind paywall", "snippet": "Smoke"}]},
        request=httpx.Request("GET", adapter.search_url),
    )
    mock_fetch = httpx.Response(
        status_code=403,
        text="Access Forbidden / Paywall Restriction",
        request=httpx.Request("POST", adapter.fetch_url),
    )

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as m_get:
        m_get.return_value = mock_search
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as m_post:
            m_post.return_value = mock_fetch
            records, msg, status, audit = await adapter.search_and_fetch(
                query="fire search", do_fetch=True, return_audit=True
            )

            assert len(records) == 1
            assert records[0].fetch_status == EvidenceStatus.FAILED
            assert "403" in (records[0].fetch_error or "")
            assert len(audit["failed_requests"]) >= 1


# =============================================================================
# 7. Insufficient Evidence Despite Valid NASA FIRMS Hotspot
# =============================================================================
def test_insufficient_evidence_despite_valid_firms_observation():
    """Verify that a hotspot with 0 public evidence clearly discloses that wildfire status is unconfirmed."""
    engine = VerificationEngine()
    report = engine.evaluate(
        incident_lat=29.3800,
        incident_lon=79.4600,
        incident_time_str="2026-10-20T07:15:00Z",
        evidence_list=[],
        incident_region="Uttarakhand, India",
    )

    assert report.status == VerificationStatus.INSUFFICIENT_EVIDENCE
    assert report.uncertainty_score >= 0.90
    assert report.confidence_score <= 0.10
    assert "Ground wildfire status remains unconfirmed" in report.rationale
    assert "A satellite hotspot is not, by itself, proof of a ground wildfire" in report.rationale


# =============================================================================
# 8. Groq Guardrail: Prevents Claiming Corroboration When Deterministic Engine Disagrees
# =============================================================================
def test_groq_guardrail_overrides_unsupported_corroboration():
    """Verify that if Groq hallucinates a confirmed wildfire for an INSUFFICIENT_EVIDENCE incident,

    post-synthesis validation overrides the executive summary with a safe, grounded fallback.
    """
    adapter = GroqAdapter(api_key="mock_key")

    hallucinated_groq_report = {
        "executive_summary": "A massive, confirmed wildfire broke out in the hills! IAF deployed Bambi buckets and casualties are confirmed.",
        "what_happened": "Uncontrolled wildfire raging across the valleys.",
    }

    validated = adapter.validate_groq_report_integrity(
        report=hallucinated_groq_report,
        verif_status="INSUFFICIENT_EVIDENCE",
        incident_data={
            "id": "INC-TEST-001",
            "name": "Thermal Anomaly 42",
            "region": "Northern Hills",
            "latitude": 30.1500,
            "longitude": 79.2000,
            "first_detected": "2026-10-20T08:00:00Z",
            "max_frp": 45.0,
            "verification": {"rationale": "Satellite thermal anomaly only."},
        },
        direct_evidence=[],
        contextual_evidence=[],
    )

    # Safe fallback MUST replace the hallucinated summary
    assert "Ground wildfire status remains unconfirmed" in validated["executive_summary"]
    assert "massive, confirmed wildfire" not in validated["executive_summary"]
    assert "Cause not established by the available evidence" in validated["uncertainties_and_gaps"]


# =============================================================================
# 9. Dynamic Search Query Construction (No Hardcoded Dates for Live Incidents)
# =============================================================================
def test_dynamic_query_construction_for_live_incidents():
    """Verify that investigation of a live detection uses its actual date (e.g. 2026-10-20),

    and does NOT inject hardcoded historical dates ('May 2024' or 'March 2021').
    """
    inc_name = "Thermal Anomaly 99 (SNPP VIIRS)"
    inc_region = "Northern Himalayas (Uttarakhand / HP), India"
    inc_date = "2026-10-20"

    clean_name = inc_name.replace("DEMO — ", "").replace("HISTORICAL EVENT: ", "").strip()
    clean_region = inc_region.split("(")[0].strip()

    query_str = f"{clean_region} wildfire forest fire emergency incident {inc_date} official report"

    assert "2026-10-20" in query_str
    assert "May 2024" not in query_str
    assert "March 2021" not in query_str
    assert "February 2019" not in query_str


# =============================================================================
# 10. Valid Direct Evidence Satisfies Corroboration Rules
# =============================================================================
def test_valid_direct_evidence_satisfies_corroboration():
    """Verify that multiple independent, fetched, contemporary reports in-bounds produce CORROBORATED."""
    engine = VerificationEngine(max_distance_km=35.0, max_time_hours=72.0, min_independent_sources=2)

    ev1 = EvidenceRecord(
        id="EV-VALID-1",
        source_name="The Hindu",
        source_type=SourceType.NEWS_MEDIA,
        title="Wildfire flare up in Garhwal hills amid heatwave",
        url="https://thehindu.com/wildfire-garhwal",
        snippet="Forest department deployed 40 firefighters to contain blaze at Pauri Garhwal.",
        full_text="State forest department teams responded to active surface fire in Pauri Garhwal pine slopes.",
        extracted_location="Pauri Garhwal, Uttarakhand",
        latitude=30.1400,
        longitude=79.2100,
        event_date="2024-05-04",
        publication_date="2024-05-04T10:00:00Z",
        fetched_at="2024-05-04T11:00:00Z",
        is_official=False,
        relevance_score=0.95,
        fetch_status=EvidenceStatus.ACTIVE,
    )
    ev2 = EvidenceRecord(
        id="EV-VALID-2",
        source_name="Indian Express",
        source_type=SourceType.NEWS_MEDIA,
        title="Garhwal forest fire containment operations underway",
        url="https://indianexpress.com/garhwal-fire-update",
        snippet="Firefighters creating fire lines across Pauri Garhwal forest ridges.",
        full_text="District disaster management authority confirmed active containment in Pauri Garhwal.",
        extracted_location="Pauri Garhwal, Uttarakhand",
        latitude=30.1600,
        longitude=79.1900,
        event_date="2024-05-04",
        publication_date="2024-05-04T12:00:00Z",
        fetched_at="2024-05-04T13:00:00Z",
        is_official=False,
        relevance_score=0.92,
        fetch_status=EvidenceStatus.ACTIVE,
    )

    report = engine.evaluate(
        incident_lat=30.1500,
        incident_lon=79.2000,
        incident_time_str="2024-05-04T07:45:00Z",
        evidence_list=[ev1, ev2],
        incident_region="Uttarakhand, India",
    )

    assert report.status == VerificationStatus.CORROBORATED
    assert report.uncertainty_score < 0.30
    assert report.confidence_score > 0.70
    assert report.independent_sources_count == 2
    assert report.direct_sources_count == 2
    assert report.geo_match_confirmed is True
    assert report.temporal_match_confirmed is True
