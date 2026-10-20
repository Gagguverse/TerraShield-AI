"""Deterministic Evidence Association and Incident Verification Engine.

Evaluates whether independent public reports and official advisories plausibly
corroborate satellite detections without making unwarranted assumptions.
Groq must NOT decide whether an incident is corroborated.
A satellite hotspot is not, by itself, proof of a ground wildfire.
"""

import math
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple
from urllib.parse import urlparse

from backend.config import settings
from backend.engine.geo_temporal_validator import (
    evaluate_temporal_alignment,
    haversine_distance_km,
    normalize_utc_timestamp,
    validate_coordinates,
    validate_named_location_match,
    validate_point_in_region,
)
from backend.models.evidence import EvidenceRecord, EvidenceStatus, SourceType
from backend.models.incident import (
    VerificationCondition,
    VerificationReport,
    VerificationStatus,
)


def parse_datetime_flexible(dt_str: Optional[str]) -> Optional[datetime]:
    """Backward-compatible wrapper for flexible UTC datetime parsing."""
    return normalize_utc_timestamp(dt_str)


# Known wire syndication keywords and domains that share identical copy
WIRE_SYNDICATE_TOKENS = [
    "press trust of india", "pti", "ani", "asian news international",
    "reuters wire", "associated press", "ap newsroom", "ians"
]


class VerificationEngine:
    def __init__(
        self,
        max_distance_km: Optional[float] = None,
        max_time_hours: Optional[float] = None,
        min_independent_sources: Optional[int] = None,
    ):
        self.max_distance_km = (
            max_distance_km
            if max_distance_km is not None
            else settings.MAX_CORROBORATION_DISTANCE_KM
        )
        self.max_time_hours = (
            max_time_hours
            if max_time_hours is not None
            else settings.MAX_TEMPORAL_DELTA_HOURS
        )
        self.min_independent_sources = (
            min_independent_sources
            if min_independent_sources is not None
            else settings.MIN_INDEPENDENT_SOURCES_FOR_CORROBORATION
        )

    def extract_independent_domains(self, evidence_list: List[EvidenceRecord]) -> Set[str]:
        """Deduplicate syndications and multiple articles from the same publisher or wire service."""
        independent_sources = set()
        seen_wire_stories: Set[str] = set()

        for ev in evidence_list:
            text_sample = f"{ev.title} {ev.snippet or ''}".lower()

            # Check if this article is an explicit wire republication (e.g. PTI / ANI syndication)
            is_wire = False
            for wire in WIRE_SYNDICATE_TOKENS:
                if wire in text_sample or (ev.source_name and wire in ev.source_name.lower()):
                    # Use a normalized wire story key based on title slug to avoid counting multiple newspapers carrying the same wire
                    title_clean = (ev.title or "").lower().strip()
                    for prefix in [f"{wire} wire:", f"{wire} wire -", f"{wire} wire", f"{wire}:", f"{wire} -", f"{wire} report:", f"{wire}"]:
                        if title_clean.startswith(prefix):
                            title_clean = title_clean[len(prefix):].strip()
                            break
                    clean_slug = re.sub(r'[^a-z0-9]', '', title_clean[:40])
                    wire_key = f"wire_{wire}_{clean_slug}"
                    if wire_key in seen_wire_stories:
                        is_wire = True
                        break
                    seen_wire_stories.add(wire_key)
                    independent_sources.add(wire_key)
                    is_wire = True
                    break

            if is_wire:
                continue

            # Canonical domain deduplication
            if ev.url:
                try:
                    netloc = urlparse(ev.url).netloc.lower()
                    if netloc.startswith("www."):
                        netloc = netloc[4:]
                    if netloc:
                        independent_sources.add(netloc)
                        continue
                except Exception:
                    pass

            # Fallback to normalized source name
            if ev.source_name:
                clean_src = ev.source_name.strip().lower()
                independent_sources.add(clean_src)

        return independent_sources

    def evaluate(
        self,
        incident_lat: float,
        incident_lon: float,
        incident_time_str: str,
        evidence_list: List[EvidenceRecord],
        incident_region: Optional[str] = None,
        hazard_type: Optional[str] = "WILDFIRE",
    ) -> VerificationReport:
        """Run deterministic verification rule engine comparing incident to evidence records.

        Groq must NOT decide whether an incident is corroborated.
        Rules:
        - A search result snippet is discovered info, not successfully fetched content.
        - Successful fetch does not automatically make a source relevant or independently verified.
        - Historical articles can provide background, but must NOT corroborate a current incident.
        - Duplicate URLs, syndicated copies, and multiple pages from same underlying reporting
          must NOT be counted as independent corroboration.
        - Unrelated events, countries, locations, and dates must be rejected as direct evidence.
        - If only NASA FIRMS satellite data is available, report must state that a satellite
          thermal anomaly was observed and ground wildfire status remains unconfirmed.
        """
        now_str = datetime.now(timezone.utc).isoformat()
        conditions_met: List[VerificationCondition] = []
        conditions_failed: List[VerificationCondition] = []
        missing_evidence: List[str] = []

        incident_dt = normalize_utc_timestamp(incident_time_str)

        # 1. Geographic Coordinate Validation
        coord_valid, coord_diag = validate_coordinates(incident_lat, incident_lon)
        if coord_valid:
            conditions_met.append(
                VerificationCondition(
                    code="GEO_COORDINATE_VALID",
                    name="Valid Satellite Centroid Coordinates",
                    met=True,
                    details=f"Centroid at ({incident_lat:.4f}, {incident_lon:.4f}) is geographically valid.",
                )
            )
        else:
            conditions_failed.append(
                VerificationCondition(
                    code="GEO_COORDINATE_VALID",
                    name="Valid Satellite Centroid Coordinates",
                    met=False,
                    details=coord_diag,
                )
            )

        # Region boundary verification
        verified_region_label = incident_region
        if incident_region and coord_valid:
            reg_valid, reg_diag, actual_region = validate_point_in_region(
                incident_lat, incident_lon, incident_region
            )
            if reg_valid:
                conditions_met.append(
                    VerificationCondition(
                        code="REGION_BOUNDARY_VERIFIED",
                        name="Incident Region Boundary Alignment",
                        met=True,
                        details=reg_diag,
                    )
                )
                if actual_region:
                    verified_region_label = actual_region
            else:
                conditions_failed.append(
                    VerificationCondition(
                        code="REGION_BOUNDARY_VERIFIED",
                        name="Incident Region Boundary Alignment",
                        met=False,
                        details=reg_diag,
                    )
                )
                missing_evidence.append(f"Geographic point reconciliation for {incident_region}")
                if actual_region:
                    verified_region_label = f"{actual_region} (Mismatched assignment: {incident_region})"

        # Handle zero evidence case
        if not evidence_list:
            missing_evidence.extend([
                "No public reports or official advisories found matching area",
                "Ground emergency dispatch or municipal fire service bulletin",
                "Independent journalistic reporting from verified news media",
                "Official forest/disaster agency damage assessment",
            ])

            conditions_failed.append(
                VerificationCondition(
                    code="INDEPENDENT_CORROBORATION",
                    name="Independent Ground Evidence Association",
                    met=False,
                    details="Zero external news reports or official agency advisories associated with hotspot.",
                )
            )

            rationale = (
                f"NASA FIRMS satellite thermal anomaly observed at ({incident_lat:.4f}, {incident_lon:.4f}) "
                f"on {incident_time_str}. Ground wildfire status remains unconfirmed. "
                "A satellite hotspot is not, by itself, proof of a ground wildfire. "
                "Satellite thermal hotspots can indicate thermal anomalies, controlled burns, industrial flares, "
                "or false reflections. Human review and on-ground reports are required before treating this as a confirmed wildfire incident."
            )

            return VerificationReport(
                status=VerificationStatus.INSUFFICIENT_EVIDENCE,
                rationale=rationale,
                uncertainty_score=0.95,
                confidence_score=0.05,
                geographic_distance_km=None,
                time_delta_hours=None,
                conditions_met=conditions_met,
                conditions_failed=conditions_failed,
                missing_evidence=missing_evidence,
                independent_sources_count=0,
                has_official_advisory=False,
                direct_sources_count=0,
                contextual_sources_count=0,
                pages_fetched_count=0,
                verified_region_label=verified_region_label,
                geo_match_confirmed=False,
                temporal_match_confirmed=False,
                evaluated_at=now_str,
            )

        # 2. Strict Evidence Categorization
        direct_evidence: List[EvidenceRecord] = []
        contextual_evidence: List[EvidenceRecord] = []
        excluded_evidence: List[Tuple[EvidenceRecord, str]] = []

        best_distance: Optional[float] = None
        best_time_delta: Optional[float] = None
        has_official_direct = False
        pages_fetched_count = 0

        # Topic keywords for event-type matching
        is_flood_incident = (hazard_type or "").upper() == "FLOOD"
        event_keywords = (
            ["flood", "landslide", "inundation", "debris", "cwc", "river", "rainfall", "submerged", "overflow"]
            if is_flood_incident
            else ["wildfire", "fire", "blaze", "smoke", "evacuation", "forest fire", "fsi", "flame", "dousing", "containment"]
        )

        for ev in evidence_list:
            # Count successfully fetched full-text pages or active official agency advisories
            is_page_fetched = (
                ev.fetch_status == EvidenceStatus.ACTIVE
                and (
                    bool(ev.full_text and len(ev.full_text.strip()) > 30)
                    or ev.is_official
                    or ev.source_type == SourceType.OFFICIAL_AGENCY
                )
            )
            if is_page_fetched:
                pages_fetched_count += 1

            # Event type check
            combined_text = f"{ev.title} {ev.snippet or ''} {ev.full_text or ''}".lower()
            topic_match = any(kw in combined_text for kw in event_keywords)
            if not topic_match:
                excluded_evidence.append((ev, "Unrelated topic: does not discuss the observed hazard type."))
                continue

            # Geographic match evaluation
            spatial_match = False
            ev_dist: Optional[float] = None
            if ev.latitude is not None and ev.longitude is not None:
                ev_coord_ok, _ = validate_coordinates(ev.latitude, ev.longitude)
                if ev_coord_ok:
                    ev_dist = haversine_distance_km(incident_lat, incident_lon, ev.latitude, ev.longitude)
                    if best_distance is None or ev_dist < best_distance:
                        best_distance = ev_dist
                    if ev_dist <= self.max_distance_km:
                        spatial_match = True
                    else:
                        excluded_evidence.append((
                            ev,
                            f"Location mismatch: reported coordinates are {ev_dist:.1f} km away (limit: {self.max_distance_km} km)."
                        ))
                        continue
                else:
                    excluded_evidence.append((ev, "Invalid coordinates on evidence record."))
                    continue
            else:
                # Named location check: reject broad country matches!
                loc_ok, match_type, loc_diag = validate_named_location_match(
                    incident_region or "",
                    ev.extracted_location,
                    combined_text,
                )
                if loc_ok:
                    spatial_match = True
                else:
                    excluded_evidence.append((ev, f"Geographic mismatch: {loc_diag}"))
                    continue

            # Temporal match evaluation
            ev_date_str = ev.event_date or ev.publication_date
            ev_dt = normalize_utc_timestamp(ev_date_str)

            temporal_res = evaluate_temporal_alignment(
                observation_dt=incident_dt,
                report_dt=ev_dt,
                max_hours=self.max_time_hours,
            )

            if temporal_res["matched"]:
                if temporal_res["delta_hours"] is not None:
                    if best_time_delta is None or temporal_res["delta_hours"] < best_time_delta:
                        best_time_delta = temporal_res["delta_hours"]

                is_official_agency = ev.is_official or ev.source_type == SourceType.OFFICIAL_AGENCY
                # Direct corroborating source: full page fetched OR verified official agency advisory
                if is_page_fetched or (is_official_agency and ev.fetch_status == EvidenceStatus.ACTIVE):
                    direct_evidence.append(ev)
                    if is_official_agency:
                        has_official_direct = True
                else:
                    # Discovered snippet without full page fetch or unofficial partial
                    contextual_evidence.append(ev)
            elif temporal_res["is_historical"]:
                # Historical article: provide context only, cannot corroborate current event
                contextual_evidence.append(ev)
            elif temporal_res["missing_date"]:
                # Missing date: unresolved temporal status, cannot claim direct corroboration
                contextual_evidence.append(ev)
            else:
                # Out of window (e.g. recent but wrong week/month)
                excluded_evidence.append((ev, temporal_res["explanation"]))

        # 3. Independent Corroborating Source Diversity on DIRECT evidence
        independent_direct_domains = self.extract_independent_domains(direct_evidence)
        indep_direct_count = len(independent_direct_domains)

        # 4. Build Conditions Audit
        # Spatial Condition
        if best_distance is not None:
            if best_distance <= self.max_distance_km:
                conditions_met.append(
                    VerificationCondition(
                        code="PROXIMITY_WITHIN_THRESHOLD",
                        name="Geographic Proximity Match",
                        met=True,
                        details=f"Nearest coordinate-verified evidence is within {best_distance:.1f} km (threshold: {self.max_distance_km} km).",
                    )
                )
            else:
                conditions_failed.append(
                    VerificationCondition(
                        code="PROXIMITY_WITHIN_THRESHOLD",
                        name="Geographic Proximity Match",
                        met=False,
                        details=f"Nearest coordinate-verified evidence is {best_distance:.1f} km away (exceeds {self.max_distance_km} km threshold).",
                    )
                )
                missing_evidence.append(f"Direct reports within {self.max_distance_km}km of coordinates")
        elif any(ev in direct_evidence for ev in evidence_list):
            conditions_met.append(
                VerificationCondition(
                    code="NAMED_LOCATION_ASSOCIATION",
                    name="Localized Administrative Match",
                    met=True,
                    details=f"Evidence text directly matches localized district/locality within {verified_region_label or incident_region}.",
                )
            )
        else:
            conditions_failed.append(
                VerificationCondition(
                    code="NAMED_LOCATION_ASSOCIATION",
                    name="Localized Administrative Match",
                    met=False,
                    details="No sources match localized districts or validated coordinates.",
                )
            )
            missing_evidence.append("Localized ground report matching specific district")

        # Temporal Condition
        if best_time_delta is not None and best_time_delta <= self.max_time_hours:
            conditions_met.append(
                VerificationCondition(
                    code="TEMPORAL_WINDOW_MATCH",
                    name="Temporal Proximity Alignment",
                    met=True,
                    details=f"Aligned within {best_time_delta:.1f} hours of satellite observation (threshold: {self.max_time_hours} hours).",
                )
            )
        else:
            conditions_failed.append(
                VerificationCondition(
                    code="TEMPORAL_WINDOW_MATCH",
                    name="Temporal Proximity Alignment",
                    met=False,
                    details=(
                        f"Nearest time difference of {best_time_delta:.1f}h exceeds {self.max_time_hours}h window."
                        if best_time_delta is not None
                        else "No matching evidence carries a verified contemporary timestamp within relevance window."
                    ),
                )
            )
            missing_evidence.append(f"Contemporary report within {self.max_time_hours}-hour window")

        # Independent Sources Condition
        if indep_direct_count >= self.min_independent_sources:
            conditions_met.append(
                VerificationCondition(
                    code="INDEPENDENT_SOURCE_DIVERSITY",
                    name="Independent Source Diversity",
                    met=True,
                    details=f"Corroborated by {indep_direct_count} independent publishing sources: {', '.join(sorted(independent_direct_domains)[:3])}.",
                )
            )
        else:
            conditions_failed.append(
                VerificationCondition(
                    code="INDEPENDENT_SOURCE_DIVERSITY",
                    name="Independent Source Diversity",
                    met=False,
                    details=(
                        f"Found {indep_direct_count} independent direct publisher(s) (threshold: {self.min_independent_sources}). "
                        "Single-source or un-fetched claims require manual review."
                    ),
                )
            )
            missing_evidence.append(f"Second independent publisher or official agency advisory")

        # Official Agency Advisory Condition
        if has_official_direct:
            conditions_met.append(
                VerificationCondition(
                    code="OFFICIAL_AGENCY_CORROBORATION",
                    name="Official Agency Ground Confirmation",
                    met=True,
                    details="Verified advisory from official emergency management or government forestry authority.",
                )
            )
        else:
            conditions_failed.append(
                VerificationCondition(
                    code="OFFICIAL_AGENCY_CORROBORATION",
                    name="Official Agency Ground Confirmation",
                    met=False,
                    details="No official government agency bulletin or fire service incident record found.",
                )
            )
            missing_evidence.append("Official government fire service incident bulletin")

        # Fetched Content Condition
        if pages_fetched_count > 0:
            conditions_met.append(
                VerificationCondition(
                    code="PAGE_CONTENT_FETCHED",
                    name="Full Page Content Retrievable",
                    met=True,
                    details=f"Successfully fetched and extracted {pages_fetched_count} full-text page(s).",
                )
            )
        else:
            conditions_failed.append(
                VerificationCondition(
                    code="PAGE_CONTENT_FETCHED",
                    name="Full Page Content Retrievable",
                    met=False,
                    details="Zero full-text pages successfully fetched. Only discovered snippets available.",
                )
            )
            missing_evidence.append("Full-text article extract from primary publisher")

        # 5. Deterministic Verification Status & Score Calculation
        # Criteria for CORROBORATED:
        # - Spatial condition passed
        # - Temporal condition passed
        # - At least 1 official agency report OR >= 2 independent direct sources
        # - At least 1 successfully fetched/extracted full page (or official agency text)
        spatial_ok = any(c.code in ("PROXIMITY_WITHIN_THRESHOLD", "NAMED_LOCATION_ASSOCIATION") and c.met for c in conditions_met)
        temporal_ok = any(c.code == "TEMPORAL_WINDOW_MATCH" and c.met for c in conditions_met)
        independence_ok = has_official_direct or indep_direct_count >= self.min_independent_sources

        if spatial_ok and temporal_ok and independence_ok and len(direct_evidence) >= 1:
            status = VerificationStatus.CORROBORATED
            # Mathematical uncertainty score calculation:
            # Starts at 0.22 base, reduced by official advisory (-0.08), distance proximity (-0.04), source diversity (-0.03)
            base_uncertainty = 0.22
            if has_official_direct:
                base_uncertainty -= 0.08
            if best_distance is not None and best_distance < 15.0:
                base_uncertainty -= 0.04
            if indep_direct_count >= 3:
                base_uncertainty -= 0.03
            uncertainty_score = round(max(0.08, min(0.28, base_uncertainty)), 2)
            confidence_score = round(1.0 - uncertainty_score, 2)

            sources_summary = (
                f"official agency advisories ({', '.join(sorted(independent_direct_domains)[:2])})"
                if has_official_direct
                else f"{indep_direct_count} independent journalistic reports ({', '.join(sorted(independent_direct_domains)[:3])})"
            )
            rationale = (
                f"Incident corroborated: Satellite hotspot at ({incident_lat:.4f}, {incident_lon:.4f}) aligns "
                f"spatially and temporally with {sources_summary}. "
                "Evidence satisfies independent corroboration and localized ground verification criteria."
            )

        elif len(direct_evidence) > 0 or len(contextual_evidence) > 0:
            status = VerificationStatus.NEEDS_REVIEW
            # Mathematical uncertainty for review states:
            base_uncertainty = 0.52
            if not spatial_ok:
                base_uncertainty += 0.10
            if not temporal_ok:
                base_uncertainty += 0.08
            if pages_fetched_count == 0:
                base_uncertainty += 0.08
            if indep_direct_count == 1:
                base_uncertainty -= 0.04
            uncertainty_score = round(max(0.38, min(0.70, base_uncertainty)), 2)
            confidence_score = round(1.0 - uncertainty_score, 2)

            review_reasons = []
            if not spatial_ok:
                review_reasons.append("unresolved geographic coordinates or district boundaries")
            if not temporal_ok:
                review_reasons.append("unverified or out-of-window reporting timestamps")
            if indep_direct_count < self.min_independent_sources and not has_official_direct:
                review_reasons.append(f"only {indep_direct_count} independent source found")
            if pages_fetched_count == 0:
                review_reasons.append("relying on search snippets without full-text page fetch")

            rationale = (
                f"Needs Review: Satellite thermal anomaly detected at ({incident_lat:.4f}, {incident_lon:.4f}). "
                f"Potential reports exist in region ({len(direct_evidence)} direct, {len(contextual_evidence)} contextual), "
                f"but ground confirmation remains inconclusive due to: {'; '.join(review_reasons) or 'incomplete verification'}. "
                f"Missing: {', '.join(missing_evidence[:2])}."
            )

        else:
            status = VerificationStatus.INSUFFICIENT_EVIDENCE
            uncertainty_score = 0.92
            confidence_score = 0.08
            rationale = (
                f"NASA FIRMS satellite thermal anomaly observed at ({incident_lat:.4f}, {incident_lon:.4f}) "
                f"on {incident_time_str}. Ground wildfire status remains unconfirmed. "
                f"All {len(evidence_list)} external search results failed spatial, temporal, or relevance criteria "
                f"({len(excluded_evidence)} excluded). A satellite hotspot is not, by itself, proof of a ground wildfire."
            )

        return VerificationReport(
            status=status,
            rationale=rationale,
            uncertainty_score=uncertainty_score,
            confidence_score=confidence_score,
            geographic_distance_km=best_distance,
            time_delta_hours=best_time_delta,
            conditions_met=conditions_met,
            conditions_failed=conditions_failed,
            missing_evidence=missing_evidence,
            independent_sources_count=indep_direct_count,
            has_official_advisory=has_official_direct,
            direct_sources_count=len(direct_evidence),
            contextual_sources_count=len(contextual_evidence),
            pages_fetched_count=pages_fetched_count,
            verified_region_label=verified_region_label,
            geo_match_confirmed=spatial_ok,
            temporal_match_confirmed=temporal_ok,
            evaluated_at=now_str,
        )


verifier = VerificationEngine()
