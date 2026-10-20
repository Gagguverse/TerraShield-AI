"""Analytics and intelligence summary models."""

from typing import Dict, List, Any
from pydantic import BaseModel, Field

class DayDetectionCount(BaseModel):
    date: str
    count: int

class AnalyticsSummary(BaseModel):
    total_detections: int = Field(..., description="Total satellite detections loaded")
    total_incidents: int = Field(..., description="Total clustered incidents")
    total_evidence: int = Field(..., description="Total evidence reports retrieved")
    corroborated_count: int = Field(..., description="Incidents verified by independent evidence")
    needs_review_count: int = Field(..., description="Incidents with partial or conflicting evidence")
    insufficient_evidence_count: int = Field(..., description="Hotspots lacking corroborating reports")
    average_uncertainty: float = Field(..., description="Mean uncertainty score across active incidents")
    detections_by_day: List[DayDetectionCount] = Field(default_factory=list, description="Time series")
    confidence_distribution: Dict[str, int] = Field(default_factory=dict, description="Counts by confidence band")
    status_distribution: Dict[str, int] = Field(default_factory=dict, description="Counts by verification status")
    source_type_distribution: Dict[str, int] = Field(default_factory=dict, description="Counts by evidence source type")
    data_mode: str = Field(..., description="Active operational data mode")
    last_refresh: str = Field(..., description="ISO 8601 timestamp of last data refresh")
    dataset_info: Dict[str, Any] = Field(default_factory=dict, description="Provenance metadata of dataset")
