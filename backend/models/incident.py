"""Incident and verification report models."""

from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field
from .detection import SatelliteDetection
from .evidence import EvidenceRecord

class VerificationStatus(str, Enum):
    CORROBORATED = "CORROBORATED"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"

class VerificationCondition(BaseModel):
    code: str = Field(..., description="Machine-readable rule identifier")
    name: str = Field(..., description="Human-readable rule name")
    met: bool = Field(..., description="Whether this condition passed")
    details: str = Field(..., description="Detailed explanation of evaluation")

class VerificationReport(BaseModel):
    status: VerificationStatus = Field(..., description="Final review classification")
    rationale: str = Field(..., description="Comprehensive human-readable decision explanation")
    uncertainty_score: float = Field(..., description="Quantified uncertainty level (0.0=certain to 1.0=unverified)")
    confidence_score: float = Field(..., description="Overall verification confidence (0.0 - 1.0)")
    geographic_distance_km: Optional[float] = Field(None, description="Distance to nearest matching evidence in km")
    time_delta_hours: Optional[float] = Field(None, description="Time difference in hours between detection and report")
    conditions_met: List[VerificationCondition] = Field(default_factory=list, description="Rules satisfied")
    conditions_failed: List[VerificationCondition] = Field(default_factory=list, description="Rules not satisfied")
    missing_evidence: List[str] = Field(default_factory=list, description="Specific gaps preventing corroboration")
    independent_sources_count: int = Field(0, description="Count of distinct independent corroborating sources")
    has_official_advisory: bool = Field(False, description="Whether at least one official agency advisory corroborated")
    direct_sources_count: int = Field(0, description="Count of directly corroborating contemporary ground evidence sources")
    contextual_sources_count: int = Field(0, description="Count of historical or regional background sources")
    pages_fetched_count: int = Field(0, description="Count of successfully fetched full-text pages")
    verified_region_label: Optional[str] = Field(None, description="Geographically verified region or administrative label")
    geo_match_confirmed: bool = Field(False, description="Whether spatial alignment was strictly verified")
    temporal_match_confirmed: bool = Field(False, description="Whether temporal alignment was strictly verified")
    evaluated_at: str = Field(..., description="Timestamp of verification execution")

class Incident(BaseModel):
    id: str = Field(..., description="Unique incident identifier (e.g. INC-2023-0712-001)")
    name: str = Field(..., description="Descriptive label (e.g. Fort Nelson Complex / Fire Hotspot #42)")
    region: str = Field(..., description="Administrative region or country")
    latitude: float = Field(..., description="Incident centroid latitude")
    longitude: float = Field(..., description="Incident centroid longitude")
    first_detected: str = Field(..., description="Initial satellite detection timestamp")
    last_detected: str = Field(..., description="Most recent satellite detection timestamp")
    detection_count: int = Field(1, description="Number of grouped satellite thermal anomalies")
    max_frp: Optional[float] = Field(None, description="Maximum observed Fire Radiative Power (MW)")
    max_brightness: Optional[float] = Field(None, description="Maximum observed brightness temp (Kelvin)")
    primary_detection: Optional[SatelliteDetection] = Field(None, description="Primary anchor detection")
    detections: List[SatelliteDetection] = Field(default_factory=list, description="Associated satellite detections")
    evidence: List[EvidenceRecord] = Field(default_factory=list, description="Linked public and official evidence records")
    verification: VerificationReport = Field(..., description="Deterministic verification assessment")
    data_mode: str = Field("HISTORICAL_SAMPLE", description="Data provenance: LIVE, HISTORICAL_SAMPLE, DEMO")
