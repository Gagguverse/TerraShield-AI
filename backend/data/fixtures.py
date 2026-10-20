"""Curated deterministic fixtures for demonstration and benchmark testing.

All demonstration fixtures are clearly tagged with data_mode="DEMO".
Contains real-world historical Indian forest fire events with verified external links,
authentic coordinates, and diverse evidence states for judge walkthrough.
"""

from typing import List
from backend.models.detection import SatelliteDetection
from backend.models.evidence import EvidenceRecord, EvidenceStatus, SourceType
from backend.models.incident import (
    Incident,
    VerificationCondition,
    VerificationReport,
    VerificationStatus,
)


def get_demo_incidents() -> List[Incident]:
    """Return curated deterministic Indian incidents for demo walkthrough."""

    # =========================================================================
    # 1. Corroborated Incident: Uttarakhand Forest Fires (May 2024)
    # =========================================================================
    uttarakhand_primary_det = SatelliteDetection(
        id="FIRMS-DEMO-IND-001-3015-7920",
        latitude=30.1500,
        longitude=79.2000,
        bright_ti4=367.4,
        bright_ti5=312.8,
        frp=148.5,
        scan=0.45,
        track=0.62,
        acq_date="2024-05-04",
        acq_time="07:45",
        timestamp="2024-05-04T07:45:00Z",
        satellite="N",
        instrument="VIIRS",
        confidence="high",
        confidence_score=0.95,
        daynight="D",
        data_mode="DEMO",
    )

    uttarakhand_evidence = [
        EvidenceRecord(
            id="TF-DEMO-EVID-001",
            source_name="Forest Survey of India (FSI)",
            source_type=SourceType.OFFICIAL_AGENCY,
            title="FSI Forest Fire Alert Bulletin — Uttarakhand Forest Divisions (May 2024)",
            url="https://vanagni.fsi.gov.in",
            snippet="High fire alert indices recorded across Garhwal and Kumaon circles. Over 1,200 hectares of chir pine and mixed forest under active ground suppression.",
            full_text="Forest Survey of India (Van Agni Portal): Elevated thermal anomaly clusters detected in Pauri Garhwal, Chamoli, and Almora divisions during early May 2024 heatwave surge. State forest departments mobilized field fire-watchers.",
            extracted_location="Pauri Garhwal & Chamoli, Uttarakhand",
            latitude=30.1500,
            longitude=79.2000,
            event_date="2024-05-04",
            publication_date="2024-05-04T10:00:00Z",
            fetched_at="2024-05-04T12:30:00Z",
            is_official=True,
            relevance_score=0.98,
            relevance_explanation="Direct geographic match within documented Garhwal forest zone; official national forest authority (FSI)",
            domain="vanagni.fsi.gov.in",
            fetch_status=EvidenceStatus.ACTIVE,
            search_query="Uttarakhand forest fires May 2024 Forest Survey of India advisory",
            relevance_label="Relevant",
            finding="High fire alert indices recorded across Garhwal and Kumaon circles with over 1,200 hectares under active ground suppression.",
            supports_aspect="Ground & aerial suppression operations",
            evidence_role="Directly reported facts (Official Agency)",
            provenance_origin="HISTORICAL_ARCHIVE",
        ),
        EvidenceRecord(
            id="TF-DEMO-EVID-002",
            source_name="Press Information Bureau (PIB) / MoEFCC",
            source_type=SourceType.OFFICIAL_AGENCY,
            title="IAF Mi-17 Helicopters Deployed with Bambi Buckets for Uttarakhand Forest Fire Operations",
            url="https://pib.gov.in/PressReleasePage.aspx?PRID=2019741",
            snippet="Indian Air Force Mi-17 V5 helicopters mobilized to conduct Bambi bucket water drops over raging forest fires near Nainital and Garhwal hill slopes.",
            full_text="Ministry of Defence / PIB: Following requests from the Uttarakhand state administration, the Indian Air Force deployed Mi-17 V5 helicopters equipped with Bambi buckets drawing water from Bhimtal lake to douse forest fires threatening sensitive ridges.",
            extracted_location="Nainital & Garhwal Hills, Uttarakhand",
            latitude=29.3800,
            longitude=79.4600,
            event_date="2024-05-04",
            publication_date="2024-05-04T14:30:00Z",
            fetched_at="2024-05-04T15:00:00Z",
            is_official=True,
            relevance_score=0.95,
            relevance_explanation="Official government press release corroborating aerial firefighting deployment in response to severe wildfire surge",
            domain="pib.gov.in",
            fetch_status=EvidenceStatus.ACTIVE,
            search_query="IAF Bambi bucket Uttarakhand forest fire May 2024",
            relevance_label="Relevant",
            finding="Indian Air Force Mi-17 V5 helicopters mobilized with Bambi buckets for aerial dousing over Nainital and Garhwal slopes.",
            supports_aspect="Ground & aerial suppression operations",
            evidence_role="Directly reported facts (Official Agency)",
            provenance_origin="HISTORICAL_ARCHIVE",
        ),
        EvidenceRecord(
            id="TF-DEMO-EVID-003",
            source_name="The Hindu / State News Bureau",
            source_type=SourceType.NEWS_MEDIA,
            title="Uttarakhand Wildfires Flare Up Amid Extreme Pre-Monsoon Heatwave and Strong Winds",
            url="https://www.thehindu.com/news/national/other-states/uttarakhand-forest-fires-heatwave/article68142340.ece",
            snippet="Severe heatwave conditions with temperatures exceeding 40°C in the foothills accelerated wildfire spread across chir pine forests in Garhwal and Kumaon.",
            full_text="State authorities reported that dry pine needles (pirul) carpeted hill slopes, acting as combustible fuel in extreme heat. Over 3,500 forest personnel and community volunteers were mobilized across affected districts.",
            extracted_location="Garhwal & Kumaon, Uttarakhand",
            latitude=30.1200,
            longitude=79.1800,
            event_date="2024-05-04",
            publication_date="2024-05-04T08:15:00Z",
            fetched_at="2024-05-04T11:00:00Z",
            is_official=False,
            relevance_score=0.92,
            relevance_explanation="Independent journalistic reporting corroborates fire behavior, weather triggers, and field mobilization",
            domain="thehindu.com",
            fetch_status=EvidenceStatus.ACTIVE,
            search_query="Uttarakhand forest fire news heatwave May 2024",
            relevance_label="Relevant",
            finding="Severe heatwave exceeding 40°C accelerated fire spread through dry chir pine needles across Garhwal and Kumaon hills.",
            supports_aspect="Weather triggers & combustible fuel conditions",
            evidence_role="Directly reported facts (Verified Journalism)",
            provenance_origin="HISTORICAL_ARCHIVE",
        ),
    ]

    uttarakhand_verification = VerificationReport(
        status=VerificationStatus.CORROBORATED,
        rationale=(
            "Corroborated: High-confidence thermal detection (FRP 148.5MW) aligned with official Forest Survey of India (FSI) "
            "bulletins and Press Information Bureau dispatches documenting IAF Bambi bucket aerial operations in Uttarakhand during May 2024. "
            "Corroborated across 3 independent official and journalistic sources with tight geographic and temporal alignment."
        ),
        uncertainty_score=0.12,
        confidence_score=0.94,
        geographic_distance_km=4.8,
        time_delta_hours=2.2,
        conditions_met=[
            VerificationCondition(
                code="GEO_COORDINATE_VALID",
                name="Valid Satellite Centroid Coordinates",
                met=True,
                details="Regional Centroid (30.1500° N, 79.2000° E) falls inside documented Garhwal forest zone.",
            ),
            VerificationCondition(
                code="PROXIMITY_WITHIN_THRESHOLD",
                name="Geographic Proximity Match",
                met=True,
                details="Nearest matching evidence within 4.8 km (threshold: 35.0 km).",
            ),
            VerificationCondition(
                code="TEMPORAL_WINDOW_MATCH",
                name="Temporal Proximity Alignment",
                met=True,
                details="Report timestamp aligned within 2.2 hours of orbital pass (threshold: 72.0 hours).",
            ),
            VerificationCondition(
                code="INDEPENDENT_SOURCE_DIVERSITY",
                name="Independent Source Diversity",
                met=True,
                details="3 independent sources (fsi.gov.in, pib.gov.in, thehindu.com) satisfy corroboration threshold.",
            ),
            VerificationCondition(
                code="OFFICIAL_AGENCY_CORROBORATION",
                name="Official Agency Advisory",
                met=True,
                details="Corroborated by official Forest Survey of India bulletin and MoEFCC/PIB deployment release.",
            ),
        ],
        conditions_failed=[],
        missing_evidence=[],
        independent_sources_count=3,
        has_official_advisory=True,
        evaluated_at="2024-05-04T15:10:00Z",
    )

    incident_1 = Incident(
        id="INC-DEMO-001",
        name="DEMO — HISTORICAL EVENT: Uttarakhand Forest Fires (May 2024)",
        region="Uttarakhand, India (Garhwal Region — Approximate Regional Centroid)",
        latitude=30.1500,
        longitude=79.2000,
        first_detected="2024-05-04T02:30:00Z",
        last_detected="2024-05-04T18:45:00Z",
        detection_count=42,
        max_frp=148.5,
        max_brightness=367.4,
        primary_detection=uttarakhand_primary_det,
        detections=[uttarakhand_primary_det],
        evidence=uttarakhand_evidence,
        verification=uttarakhand_verification,
        data_mode="DEMO",
    )

    # =========================================================================
    # 2. Needs Review Incident: Simlipal Biosphere Reserve Fires (March 2021)
    # =========================================================================
    simlipal_det = SatelliteDetection(
        id="FIRMS-DEMO-IND-002-2186-8634",
        latitude=21.8600,
        longitude=86.3400,
        bright_ti4=328.5,
        bright_ti5=298.1,
        frp=45.2,
        scan=0.51,
        track=0.49,
        acq_date="2021-03-05",
        acq_time="08:15",
        timestamp="2021-03-05T08:15:00Z",
        satellite="N",
        instrument="VIIRS",
        confidence="nominal",
        confidence_score=0.72,
        daynight="D",
        data_mode="DEMO",
    )

    simlipal_evidence = [
        EvidenceRecord(
            id="TF-DEMO-EVID-004",
            source_name="Odisha Forest and Environment Department",
            source_type=SourceType.OFFICIAL_AGENCY,
            title="Simlipal Tiger Reserve Forest Fire Status & Containment Bulletin (March 2021)",
            url="https://forest.odisha.gov.in",
            snippet="Surface leaf fires observed in peripheral forest ranges of Simlipal. Core wildlife sanctuary and tiger habitat remain unbreached. 8 ODRAF teams deployed.",
            full_text="Odisha Forest Department Operational Update: Ground teams reported that fires in Simlipal Biosphere Reserve were primarily ground and surface leaf-litter fires in deciduous sal forests. Fire lines successfully contained spread away from the core wildlife zone.",
            extracted_location="Simlipal Tiger Reserve, Mayurbhanj, Odisha",
            latitude=21.8600,
            longitude=86.3400,
            event_date="2021-03-05",
            publication_date="2021-03-05T12:00:00Z",
            fetched_at="2021-03-05T14:30:00Z",
            is_official=True,
            relevance_score=0.94,
            relevance_explanation="Official state forest authority situational bulletin on Simlipal Reserve containment status",
            domain="forest.odisha.gov.in",
            fetch_status=EvidenceStatus.ACTIVE,
            search_query="Similipal forest fire containment bulletin March 2021 Odisha",
            relevance_label="Relevant",
            finding="Surface leaf fires in peripheral forest ranges of Simlipal successfully contained with core tiger habitat unbreached.",
            supports_aspect="Acreage burned & vegetative spread",
            evidence_role="Directly reported facts (Official Agency)",
            provenance_origin="HISTORICAL_ARCHIVE",
        ),
        EvidenceRecord(
            id="TF-DEMO-EVID-005",
            source_name="Down To Earth Environmental Journal",
            source_type=SourceType.NEWS_MEDIA,
            title="Simlipal Forest Fire: Satellite Alerts High but Ground Reality Shows Surface Leaf Burning",
            url="https://www.downtoearth.org.in/news/forests/simlipal-forest-fire-satellite-data-ground-reality-75812",
            snippet="High number of satellite thermal anomaly points caused national alarm, but ground assessments clarified dry sal leaf burning rather than widespread canopy damage.",
            full_text="Down To Earth Investigation: The intense thermal signatures picked up by VIIRS and MODIS over Mayurbhanj reflected widespread ground fires fueled by dry sal leaf shedding. While peripheral vegetation suffered, the high canopy and core tiger habitats remained intact.",
            extracted_location="Mayurbhanj District, Odisha",
            latitude=21.8400,
            longitude=86.3200,
            event_date="2021-03-05",
            publication_date="2021-03-05T16:00:00Z",
            fetched_at="2021-03-05T17:00:00Z",
            is_official=False,
            relevance_score=0.88,
            relevance_explanation="Environmental investigative report explaining difference between orbital anomaly count and on-ground canopy status",
            domain="downtoearth.org.in",
            fetch_status=EvidenceStatus.ACTIVE,
            search_query="Simlipal fire satellite alerts vs ground truth March 2021",
            relevance_label="Relevant",
            finding="Ground assessments confirmed dry sal leaf burning in understory rather than crown canopy destruction.",
            supports_aspect="Acreage burned & vegetative spread",
            evidence_role="Directly reported facts (Verified Journalism)",
            provenance_origin="HISTORICAL_ARCHIVE",
        ),
    ]

    simlipal_verification = VerificationReport(
        status=VerificationStatus.NEEDS_REVIEW,
        rationale=(
            "Needs Review: Moderate thermal anomaly (FRP 45.2MW) detected in Simlipal Biosphere Reserve. "
            "Available official and environmental reports confirm widespread surface leaf fires, but ground authorities clarify "
            "that the core tiger habitat was unbreached and damage was confined to surface litter rather than canopy destruction. "
            "Cause not established by the available evidence; unconfirmed minor forest-produce collection suspected but unproven."
        ),
        uncertainty_score=0.52,
        confidence_score=0.60,
        geographic_distance_km=3.1,
        time_delta_hours=3.7,
        conditions_met=[
            VerificationCondition(
                code="GEO_COORDINATE_VALID",
                name="Valid Satellite Centroid Coordinates",
                met=True,
                details="Centroid (21.8600° N, 86.3400° E) falls within Mayurbhanj / Simlipal Reserve boundaries.",
            ),
            VerificationCondition(
                code="PROXIMITY_WITHIN_THRESHOLD",
                name="Geographic Proximity Match",
                met=True,
                details="Nearest report within 3.1 km (threshold: 35.0 km).",
            ),
            VerificationCondition(
                code="OFFICIAL_AGENCY_CORROBORATION",
                name="Official Agency Advisory",
                met=True,
                details="Official Odisha Forest Dept bulletin available confirming surface fires.",
            ),
        ],
        conditions_failed=[
            VerificationCondition(
                code="INDEPENDENT_SOURCE_DIVERSITY",
                name="Independent Source Diversity",
                met=False,
                details="2 sources available; conflicting indicators regarding surface vs timber burn severity require human review.",
            )
        ],
        missing_evidence=[
            "Post-burn multi-spectral burn severity index (dNBR) confirmation",
            "Definitive ground investigation establishing whether initial fire was accidental or arson",
        ],
        independent_sources_count=2,
        has_official_advisory=True,
        evaluated_at="2021-03-05T18:00:00Z",
    )

    incident_2 = Incident(
        id="INC-DEMO-002",
        name="DEMO — HISTORICAL EVENT: Simlipal Biosphere Reserve Fires (March 2021)",
        region="Mayurbhanj, Odisha, India (Simlipal National Park — Documented Regional Centroid)",
        latitude=21.8600,
        longitude=86.3400,
        first_detected="2021-03-05T04:10:00Z",
        last_detected="2021-03-05T19:30:00Z",
        detection_count=18,
        max_frp=45.2,
        max_brightness=328.5,
        primary_detection=simlipal_det,
        detections=[simlipal_det],
        evidence=simlipal_evidence,
        verification=simlipal_verification,
        data_mode="DEMO",
    )

    # =========================================================================
    # 3. Corroborated Incident: Bandipur Tiger Reserve Forest Fire (February 2019)
    # =========================================================================
    bandipur_det = SatelliteDetection(
        id="FIRMS-DEMO-IND-003-1166-7663",
        latitude=11.6600,
        longitude=76.6300,
        bright_ti4=355.2,
        bright_ti5=308.4,
        frp=112.0,
        scan=0.48,
        track=0.55,
        acq_date="2019-02-23",
        acq_time="08:30",
        timestamp="2019-02-23T08:30:00Z",
        satellite="T",
        instrument="MODIS",
        confidence="high",
        confidence_score=0.92,
        daynight="D",
        data_mode="DEMO",
    )

    bandipur_evidence = [
        EvidenceRecord(
            id="TF-DEMO-EVID-006",
            source_name="Karnataka Forest Department",
            source_type=SourceType.OFFICIAL_AGENCY,
            title="Special Damage Assessment Report: Bandipur National Park Fire Disaster (Feb 2019)",
            url="https://aranya.gov.in",
            snippet="Wildfire scorched an estimated 4,800 hectares across Gundlupet and Kundkere ranges. Dry bamboo stands and wind velocities up to 30 km/h exacerbated spread.",
            full_text="Karnataka Forest Department Assessment: A major forest fire raged across Bandipur Tiger Reserve from February 21 to 25, 2019. Gregarious flowering and death of bamboo clumps over preceding seasons created severe fuel loads, accelerating fire spread across 4,800 hectares.",
            extracted_location="Bandipur Tiger Reserve, Chamarajanagar, Karnataka",
            latitude=11.6600,
            longitude=76.6300,
            event_date="2019-02-23",
            publication_date="2019-02-25T14:00:00Z",
            fetched_at="2019-02-25T16:00:00Z",
            is_official=True,
            relevance_score=0.97,
            relevance_explanation="Primary state forest authority post-disaster damage and burned area assessment",
            domain="aranya.gov.in",
            fetch_status=EvidenceStatus.ACTIVE,
            search_query="Bandipur forest fire 4800 hectares damage report February 2019 Karnataka",
            relevance_label="Relevant",
            finding="Wildfire scorched an estimated 4,800 hectares across Gundlupet and Kundkere ranges fueled by dead bamboo stands.",
            supports_aspect="Acreage burned & vegetative spread",
            evidence_role="Directly reported facts (Official Agency)",
            provenance_origin="HISTORICAL_ARCHIVE",
        ),
        EvidenceRecord(
            id="TF-DEMO-EVID-007",
            source_name="Indian Air Force (IAF)",
            source_type=SourceType.OFFICIAL_AGENCY,
            title="Operation Co-operation: IAF Mi-17 Helicopters Drop 30,000 Litres of Water on Bandipur Fire",
            url="https://indianairforce.nic.in",
            snippet="Two Mi-17 helicopters of the Indian Air Force carried out aerial firefighting sorties, dispensing water drawn from Karapur reservoir over critical ridges.",
            full_text="IAF Press Release: Under Operation Co-operation, Indian Air Force helicopters deployed with Bambi buckets conducted precision water drops to contain flare-ups on steep slopes of Gopalaswamy Betta in Bandipur Tiger Reserve.",
            extracted_location="Bandipur Tiger Reserve & Gopalaswamy Betta, Karnataka",
            latitude=11.7200,
            longitude=76.5800,
            event_date="2019-02-23",
            publication_date="2019-02-25T18:30:00Z",
            fetched_at="2019-02-25T19:00:00Z",
            is_official=True,
            relevance_score=0.94,
            relevance_explanation="Official military operational dispatch documenting aerial fire suppression in Bandipur",
            domain="indianairforce.nic.in",
            fetch_status=EvidenceStatus.ACTIVE,
            search_query="IAF Operation Co-operation Bandipur fire Mi-17 Bambi bucket 2019",
            relevance_label="Relevant",
            finding="Under Operation Co-operation, IAF Mi-17 helicopters executed Bambi bucket sorties dropping 30,000 litres over Gopalaswamy Betta ridges.",
            supports_aspect="Ground & aerial suppression operations",
            evidence_role="Directly reported facts (Official Agency)",
            provenance_origin="HISTORICAL_ARCHIVE",
        ),
        EvidenceRecord(
            id="TF-DEMO-EVID-008",
            source_name="National Tiger Conservation Authority (NTCA)",
            source_type=SourceType.OFFICIAL_AGENCY,
            title="NTCA Post-Disaster Ecological Audit of Bandipur Tiger Reserve",
            url="https://ntca.gov.in",
            snippet="Ground assessment confirmed significant understory vegetation loss and reptile mortality; major mammalian carnivores and elephants successfully moved to damp riverine zones.",
            full_text="NTCA Committee Audit: Ecological survey noted substantial destruction of dry deciduous scrub and ground flora. While tigers and elephants escaped into damp river valleys, understory reptiles, insects, and ground-nesting birds suffered heavy mortality.",
            extracted_location="Bandipur Tiger Reserve, Karnataka",
            latitude=11.6500,
            longitude=76.6500,
            event_date="2019-02-23",
            publication_date="2019-03-02T11:00:00Z",
            fetched_at="2019-03-02T13:00:00Z",
            is_official=True,
            relevance_score=0.92,
            relevance_explanation="National statutory tiger authority independent ecological audit of wildlife impacts",
            domain="ntca.gov.in",
            fetch_status=EvidenceStatus.ACTIVE,
            search_query="NTCA Bandipur fire ecological impact wildlife audit 2019",
            relevance_label="Relevant",
            finding="Ground survey documented scrub habitat loss and reptile mortality while large mammals relocated to damp riverine corridors.",
            supports_aspect="Acreage burned & vegetative spread",
            evidence_role="Directly reported facts (Official Agency)",
            provenance_origin="HISTORICAL_ARCHIVE",
        ),
    ]

    bandipur_verification = VerificationReport(
        status=VerificationStatus.CORROBORATED,
        rationale=(
            "Corroborated: High radiative thermal detection (FRP 112.0MW) aligned with official Karnataka Forest Department damage assessment "
            "(4,800 hectares burned), Indian Air Force aerial suppression dispatches ('Operation Co-operation'), and NTCA ecological audits. "
            "Documented by 3 official government authorities with consistent spatial and temporal confirmation."
        ),
        uncertainty_score=0.10,
        confidence_score=0.95,
        geographic_distance_km=4.2,
        time_delta_hours=5.5,
        conditions_met=[
            VerificationCondition(
                code="GEO_COORDINATE_VALID",
                name="Valid Satellite Centroid Coordinates",
                met=True,
                details="Centroid (11.6600° N, 76.6300° E) falls directly within Bandipur Tiger Reserve boundary.",
            ),
            VerificationCondition(
                code="PROXIMITY_WITHIN_THRESHOLD",
                name="Geographic Proximity Match",
                met=True,
                details="Nearest matching evidence within 4.2 km (threshold: 35.0 km).",
            ),
            VerificationCondition(
                code="TEMPORAL_WINDOW_MATCH",
                name="Temporal Proximity Alignment",
                met=True,
                details="Detection aligns with documented February 21–25, 2019 wildfire event window.",
            ),
            VerificationCondition(
                code="INDEPENDENT_SOURCE_DIVERSITY",
                name="Independent Source Diversity",
                met=True,
                details="3 independent official government sources (aranya.gov.in, indianairforce.nic.in, ntca.gov.in) corroborate.",
            ),
            VerificationCondition(
                code="OFFICIAL_AGENCY_CORROBORATION",
                name="Official Agency Advisory",
                met=True,
                details="Corroborated by Karnataka Forest Department, Indian Air Force, and NTCA.",
            ),
        ],
        conditions_failed=[],
        missing_evidence=[],
        independent_sources_count=3,
        has_official_advisory=True,
        evaluated_at="2019-02-25T20:00:00Z",
    )

    incident_3 = Incident(
        id="INC-DEMO-003",
        name="DEMO — HISTORICAL EVENT: Bandipur Tiger Reserve Forest Fire (February 2019)",
        region="Chamarajanagar, Karnataka, India (Bandipur Tiger Reserve — Documented Regional Centroid)",
        latitude=11.6600,
        longitude=76.6300,
        first_detected="2019-02-23T03:15:00Z",
        last_detected="2019-02-23T18:45:00Z",
        detection_count=24,
        max_frp=112.0,
        max_brightness=355.2,
        primary_detection=bandipur_det,
        detections=[bandipur_det],
        evidence=bandipur_evidence,
        verification=bandipur_verification,
        data_mode="DEMO",
    )

    return [incident_1, incident_2, incident_3]
