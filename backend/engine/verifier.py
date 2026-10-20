"""Deterministic Evidence Association and Incident Verification Engine.

Evaluates whether independent public reports and official advisories plausibly
corroborate satellite detections without making unwarranted assumptions.
"""

import math
from datetime import datetime, timezone
from typing import List, Optional, Tuple, Set
from urllib.parse import urlparse

from backend.config import settings
from backend.models.evidence import EvidenceRecord, SourceType
from backend.models.incident import (
    VerificationCondition,
    VerificationReport,
    VerificationStatus,
)


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two points on Earth in kilometers."""
    r = 6371.0  # Earth radius in kilometers

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

    return round(r * c, 2)


def parse_datetime_flexible(dt_str: Optional[str]) -> Optional[datetime]:
    """Parse multiple timestamp formats (ISO8601, YYYY-MM-DD, etc.) into UTC datetime."""
    if not dt_str:
        return None

    dt_str = dt_str.strip()
    formats = [
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d",
    ]

    for fmt in formats:
        try:
            dt = datetime.strptime(dt_str.replace("Z", "+00:00") if "Z" in dt_str else dt_str, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            continue

    return None


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
        """Deduplicate syndications and multiple articles from the same publisher domain."""
        independent_sources = set()
        for ev in evidence_list:
            if ev.url:
                try:
                    netloc = urlparse(ev.url).netloc.lower()
                    # Strip leading www.
                    if netloc.startswith("www."):
                        netloc = netloc[4:]
                    if netloc:
                        independent_sources.add(netloc)
                        continue
                except Exception:
                    pass
            # Fallback to source name
            if ev.source_name:
                independent_sources.add(ev.source_name.strip().lower())
        return independent_sources

    def evaluate(
        self,
        incident_lat: float,
        incident_lon: float,
        incident_time_str: str,
        evidence_list: List[EvidenceRecord],
    ) -> VerificationReport:
        """Run deterministic verification rule engine comparing incident to evidence."""
        now_str = datetime.now(timezone.utc).isoformat()
        conditions_met: List[VerificationCondition] = []
        conditions_failed: List[VerificationCondition] = []
        missing_evidence: List[str] = []

        incident_dt = parse_datetime_flexible(incident_time_str)

        # 1. Hotspot Validity Condition
        hotspot_valid = (-90.0 <= incident_lat <= 90.0 and -180.0 <= incident_lon <= 180.0)
        if hotspot_valid:
            conditions_met.append(
                VerificationCondition(
                    code="GEO_COORDINATE_VALID",
                    name="Valid Satellite Centroid Coordinates",
                    met=True,
                    details=f"Center at ({incident_lat:.4f}, {incident_lon:.4f}) is geographically valid.",
                )
            )
        else:
            conditions_failed.append(
                VerificationCondition(
                    code="GEO_COORDINATE_VALID",
                    name="Valid Satellite Centroid Coordinates",
                    met=False,
                    details=f"Centroid ({incident_lat}, {incident_lon}) is invalid.",
                )
            )

        # If zero evidence records attached
        if not evidence_list:
            missing_evidence.append("No public reports or official advisories found matching area")
            missing_evidence.append("Independent multi-spectral thermal verification")
            missing_evidence.append("Ground authority emergency dispatch record")

            conditions_failed.append(
                VerificationCondition(
                    code="INDEPENDENT_CORROBORATION",
                    name="Independent Evidence Association",
                    met=False,
                    details="Zero independent public or official reports associated with hotspot.",
                )
            )

            rationale = (
                f"Satellite thermal detection at ({incident_lat:.4f}, {incident_lon:.4f}) on {incident_time_str} "
                "currently lacks any matching public news reports or official agency advisories. "
                "Satellite thermal hotspots can indicate thermal anomalies, controlled burns, industrial flares, "
                "or false reflections. Human review is required before treating this as a confirmed wildfire incident."
            )

            return VerificationReport(
                status=VerificationStatus.INSUFFICIENT_EVIDENCE,
                rationale=rationale,
                uncertainty_score=0.92,
                confidence_score=0.15,
                geographic_distance_km=None,
                time_delta_hours=None,
                conditions_met=conditions_met,
                conditions_failed=conditions_failed,
                missing_evidence=missing_evidence,
                independent_sources_count=0,
                has_official_advisory=False,
                evaluated_at=now_str,
            )

        # 2. Evaluate Evidence Proximity and Time
        best_distance: Optional[float] = None
        best_time_delta: Optional[float] = None
        has_official = False
        spatially_matched_evidence: List[EvidenceRecord] = []
        conflicting_evidence: List[str] = []

        for ev in evidence_list:
            if ev.is_official or ev.source_type == SourceType.OFFICIAL_AGENCY:
                has_official = True

            # Geographic distance check if evidence has coordinates
            if ev.latitude is not None and ev.longitude is not None:
                dist = haversine_distance_km(
                    incident_lat, incident_lon, ev.latitude, ev.longitude
                )
                if best_distance is None or dist < best_distance:
                    best_distance = dist

                if dist <= self.max_distance_km:
                    spatially_matched_evidence.append(ev)
                else:
                    conflicting_evidence.append(
                        f"{ev.source_name} reported location {dist:.1f}km away (threshold: {self.max_distance_km}km)"
                    )
            else:
                # If evidence doesn't have exact coordinates but was matched by location keyword
                spatially_matched_evidence.append(ev)

            # Temporal distance check
            ev_dt = parse_datetime_flexible(ev.event_date) or parse_datetime_flexible(ev.publication_date)
            if incident_dt and ev_dt:
                hours_diff = abs((incident_dt - ev_dt).total_seconds()) / 3600.0
                if best_time_delta is None or hours_diff < best_time_delta:
                    best_time_delta = round(hours_diff, 1)

        # Check Spatial Proximity Condition
        if best_distance is not None:
            if best_distance <= self.max_distance_km:
                conditions_met.append(
                    VerificationCondition(
                        code="PROXIMITY_WITHIN_THRESHOLD",
                        name="Geographic Proximity Match",
                        met=True,
                        details=f"Nearest evidence report is within {best_distance:.1f} km (limit: {self.max_distance_km} km).",
                    )
                )
            else:
                conditions_failed.append(
                    VerificationCondition(
                        code="PROXIMITY_WITHIN_THRESHOLD",
                        name="Geographic Proximity Match",
                        met=False,
                        details=f"Nearest coordinate-verified evidence is {best_distance:.1f} km away, exceeding {self.max_distance_km} km threshold.",
                    )
                )
                missing_evidence.append(f"Reports within {self.max_distance_km}km of coordinates")
        else:
            # Evidence has named location only
            conditions_met.append(
                VerificationCondition(
                    code="NAMED_LOCATION_ASSOCIATION",
                    name="Named Location Association",
                    met=True,
                    details="Evidence matches incident named region; exact coordinates not reported by source.",
                )
            )

        # Check Temporal Proximity Condition
        if best_time_delta is not None:
            if best_time_delta <= self.max_time_hours:
                conditions_met.append(
                    VerificationCondition(
                        code="TEMPORAL_WINDOW_MATCH",
                        name="Temporal Proximity Alignment",
                        met=True,
                        details=f"Time difference between observation and report is {best_time_delta:.1f} hours (limit: {self.max_time_hours} hours).",
                    )
                )
            else:
                conditions_failed.append(
                    VerificationCondition(
                        code="TEMPORAL_WINDOW_MATCH",
                        name="Temporal Proximity Alignment",
                        met=False,
                        details=f"Time difference of {best_time_delta:.1f} hours exceeds temporal window of {self.max_time_hours} hours.",
                    )
                )
                missing_evidence.append("Contemporary observation within 72-hour window")
        else:
            missing_evidence.append("Precise event timestamp in source report")

        # Check Independent Source Count
        independent_domains = self.extract_independent_domains(evidence_list)
        indep_count = len(independent_domains)

        if indep_count >= self.min_independent_sources:
            conditions_met.append(
                VerificationCondition(
                    code="INDEPENDENT_SOURCE_DIVERSITY",
                    name="Independent Source Diversity",
                    met=True,
                    details=f"Corroborated by {indep_count} independent publishing sources: {', '.join(sorted(independent_domains)[:3])}.",
                )
            )
        else:
            conditions_failed.append(
                VerificationCondition(
                    code="INDEPENDENT_SOURCE_DIVERSITY",
                    name="Independent Source Diversity",
                    met=False,
                    details=f"Only {indep_count} independent publisher found (minimum required: {self.min_independent_sources}). Single sources require manual review.",
                )
            )
            missing_evidence.append("Second independent publisher or agency report")

        # Check Official Agency Advisory
        if has_official:
            conditions_met.append(
                VerificationCondition(
                    code="OFFICIAL_AGENCY_CORROBORATION",
                    name="Official Agency Advisory",
                    met=True,
                    details="Contains verified advisory from official fire authority or emergency management agency.",
                )
            )
        else:
            conditions_failed.append(
                VerificationCondition(
                    code="OFFICIAL_AGENCY_CORROBORATION",
                    name="Official Agency Advisory",
                    met=False,
                    details="No official government agency bulletin or fire service incident record found.",
                )
            )
            missing_evidence.append("Official government fire service incident bulletin")

        # 3. Determine Final Status Deterministically
        # Corroborated requires:
        # - Spatial proximity condition met
        # - Temporal window condition met (if dates available)
        # - Either has_official is True OR indep_count >= min_independent_sources
        # - No overwhelming geographic contradictions
        spatial_ok = any(c.code in ("PROXIMITY_WITHIN_THRESHOLD", "NAMED_LOCATION_ASSOCIATION") and c.met for c in conditions_met)
        temporal_ok = not any(c.code == "TEMPORAL_WINDOW_MATCH" and not c.met for c in conditions_failed)

        if spatial_ok and temporal_ok and (has_official or indep_count >= self.min_independent_sources):
            status = VerificationStatus.CORROBORATED
            uncertainty_score = 0.18 if has_official else 0.32
            confidence_score = 0.88 if has_official else 0.74
            agency_note = "official emergency agency advisories" if has_official else f"{indep_count} independent journalistic reports"
            rationale = (
                f"Incident corroborated: Satellite hotspot at ({incident_lat:.4f}, {incident_lon:.4f}) aligns "
                f"spatially and temporally with {agency_note}. "
                "Evidence satisfies independent corroboration thresholds."
            )
        elif len(spatially_matched_evidence) > 0 or indep_count > 0:
            status = VerificationStatus.NEEDS_REVIEW
            uncertainty_score = 0.55
            confidence_score = 0.48
            rationale = (
                f"Needs Review: Potential incident detected. Some public reports exist in region, "
                f"but evidence is incomplete, lacks official agency confirmation, or has only a single unverified source. "
                f"Missing: {', '.join(missing_evidence[:2])}."
            )
        else:
            status = VerificationStatus.INSUFFICIENT_EVIDENCE
            uncertainty_score = 0.85
            confidence_score = 0.20
            rationale = (
                f"Insufficient Evidence: Thermal hotspot detected, but reports in database fail spatial/temporal criteria. "
                f"Cannot confidently associate satellite reading with any reported wildfire event."
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
            independent_sources_count=indep_count,
            has_official_advisory=has_official,
            evaluated_at=now_str,
        )


verifier = VerificationEngine()
