"""Unit tests for the evidence association and verification engine."""

from backend.engine.verifier import (
    VerificationEngine,
    haversine_distance_km,
    parse_datetime_flexible,
)
from backend.models.evidence import EvidenceRecord, EvidenceStatus, SourceType
from backend.models.incident import VerificationStatus


def test_haversine_distance():
    # Known distance: Paris (48.8566, 2.3522) to London (51.5074, -0.1278) ~343 km
    dist = haversine_distance_km(48.8566, 2.3522, 51.5074, -0.1278)
    assert 340.0 <= dist <= 346.0

    # Same point distance should be 0.0
    assert haversine_distance_km(37.7749, -122.4194, 37.7749, -122.4194) == 0.0


def test_flexible_datetime_parsing():
    dt1 = parse_datetime_flexible("2023-07-12T20:18:00Z")
    assert dt1 is not None
    assert dt1.year == 2023 and dt1.month == 7 and dt1.day == 12

    dt2 = parse_datetime_flexible("2023-07-12")
    assert dt2 is not None
    assert dt2.year == 2023 and dt2.month == 7 and dt2.day == 12

    assert parse_datetime_flexible("") is None
    assert parse_datetime_flexible(None) is None


def test_status_insufficient_evidence_when_no_reports():
    engine = VerificationEngine(max_distance_km=35.0, max_time_hours=72.0)
    report = engine.evaluate(
        incident_lat=57.5124,
        incident_lon=-121.8415,
        incident_time_str="2023-07-12T20:18:00Z",
        evidence_list=[],
    )
    assert report.status == VerificationStatus.INSUFFICIENT_EVIDENCE
    assert report.uncertainty_score > 0.8
    assert len(report.missing_evidence) > 0
    assert any("No public reports" in m for m in report.missing_evidence)


def test_status_corroborated_with_official_agency():
    engine = VerificationEngine(max_distance_km=35.0, max_time_hours=72.0)
    official_ev = EvidenceRecord(
        id="EVID-1",
        source_name="BC Wildfire Service",
        source_type=SourceType.OFFICIAL_AGENCY,
        title="Donnie Creek Wildfire of Note",
        url="https://wildfiresituation.nrs.gov.bc.ca/incidents?fireYear=2023&incidentNumber=G80280",
        snippet="Out of control fire at 57.53, -121.82",
        latitude=57.5300,
        longitude=-121.8200,
        event_date="2023-07-12",
        publication_date="2023-07-12T18:00:00Z",
        fetched_at="2023-07-12T20:30:00Z",
        is_official=True,
        relevance_score=0.98,
        domain="gov.bc.ca",
        fetch_status=EvidenceStatus.ACTIVE,
    )
    report = engine.evaluate(
        incident_lat=57.5124,
        incident_lon=-121.8415,
        incident_time_str="2023-07-12T20:18:00Z",
        evidence_list=[official_ev],
    )
    assert report.status == VerificationStatus.CORROBORATED
    assert report.has_official_advisory is True
    assert report.uncertainty_score < 0.25
    assert report.geographic_distance_km is not None
    assert report.geographic_distance_km <= 5.0


def test_status_needs_review_when_single_unverified_source():
    engine = VerificationEngine(max_distance_km=35.0, max_time_hours=72.0, min_independent_sources=2)
    single_news = EvidenceRecord(
        id="EVID-2",
        source_name="Local Blog",
        source_type=SourceType.NEWS_MEDIA,
        title="Smoke seen near ridge",
        url="https://localblog.example.com/smoke",
        snippet="Someone saw smoke near the ridge",
        latitude=57.5300,
        longitude=-121.8200,
        event_date="2023-07-12",
        publication_date="2023-07-12T18:00:00Z",
        fetched_at="2023-07-12T20:30:00Z",
        is_official=False,
        relevance_score=0.5,
        domain="localblog.example.com",
        fetch_status=EvidenceStatus.ACTIVE,
    )
    report = engine.evaluate(
        incident_lat=57.5124,
        incident_lon=-121.8415,
        incident_time_str="2023-07-12T20:18:00Z",
        evidence_list=[single_news],
    )
    assert report.status == VerificationStatus.NEEDS_REVIEW
    assert any("INDEPENDENT_SOURCE_DIVERSITY" in c.code and not c.met for c in report.conditions_failed)


def test_deduplicate_syndicated_sources():
    engine = VerificationEngine()
    # Two articles from same publisher domain should count as 1 independent domain
    ev1 = EvidenceRecord(
        id="EVID-A",
        source_name="CBC News",
        source_type=SourceType.NEWS_MEDIA,
        title="Fire report 1",
        url="https://www.cbc.ca/news/canada/article1",
        snippet="Fire burns",
        fetched_at="2023-07-12T20:30:00Z",
    )
    ev2 = EvidenceRecord(
        id="EVID-B",
        source_name="CBC British Columbia",
        source_type=SourceType.NEWS_MEDIA,
        title="Fire report 2",
        url="https://www.cbc.ca/news/bc/article2",
        snippet="Update on fire",
        fetched_at="2023-07-12T20:35:00Z",
    )
    independent = engine.extract_independent_domains([ev1, ev2])
    assert len(independent) == 1
    assert "cbc.ca" in independent


def test_status_when_conflicting_geographic_evidence():
    engine = VerificationEngine(max_distance_km=35.0, max_time_hours=72.0)
    # Evidence is located 120km away (conflicting location)
    conflicting_ev = EvidenceRecord(
        id="EVID-CONFLICT",
        source_name="Regional News Outlet",
        source_type=SourceType.NEWS_MEDIA,
        title="Fire incident 120km south",
        url="https://regionalnews.com/distant-fire",
        snippet="Fire confirmed 120km away from satellite hotspot",
        latitude=56.4000,
        longitude=-121.8200,
        event_date="2023-07-12",
        publication_date="2023-07-12T18:00:00Z",
        fetched_at="2023-07-12T20:30:00Z",
        is_official=False,
        relevance_score=0.4,
        domain="regionalnews.com",
        fetch_status=EvidenceStatus.ACTIVE,
    )
    report = engine.evaluate(
        incident_lat=57.5124,
        incident_lon=-121.8415,
        incident_time_str="2023-07-12T20:18:00Z",
        evidence_list=[conflicting_ev],
    )
    # Because distance (123.7km) exceeds threshold (35km), Proximity Condition fails!
    assert report.status != VerificationStatus.CORROBORATED
    assert report.geographic_distance_km is not None
    assert report.geographic_distance_km > 35.0
    assert any("PROXIMITY_WITHIN_THRESHOLD" in c.code and not c.met for c in report.conditions_failed)

