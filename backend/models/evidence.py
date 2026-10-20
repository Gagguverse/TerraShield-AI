"""Evidence models for TinyFish search and fetch integration."""

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field

class SourceType(str, Enum):
    OFFICIAL_AGENCY = "OFFICIAL_AGENCY"
    EMERGENCY_DISPATCH = "EMERGENCY_DISPATCH"
    NEWS_MEDIA = "NEWS_MEDIA"
    CITIZEN_REPORT = "CITIZEN_REPORT"
    SATELLITE_HOTSPOT = "SATELLITE_HOTSPOT"
    SCIENTIFIC_STUDY = "SCIENTIFIC_STUDY"
    SATELLITE_DATA = "SATELLITE_DATA"
    UNVERIFIED = "UNVERIFIED"

class EvidenceStatus(str, Enum):
    ACTIVE = "ACTIVE"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"
    CREDENTIALS_MISSING = "CREDENTIALS_MISSING"

class EvidenceRecord(BaseModel):
    id: str = Field(..., description="Unique evidence record ID")
    source_name: str = Field(..., description="Original publication or agency name")
    source_type: SourceType = Field(SourceType.NEWS_MEDIA, description="Categorized authority level")
    title: str = Field(..., description="Document or headline title")
    url: str = Field(..., description="Authentic original URL of the source")
    snippet: str = Field(..., description="Relevant text excerpt from TinyFish Search/Fetch")
    full_text: Optional[str] = Field(None, description="Clean extracted markdown/text from TinyFish Fetch")
    extracted_location: Optional[str] = Field(None, description="Geographic entity or town referenced")
    latitude: Optional[float] = Field(None, description="Extracted or matched latitude")
    longitude: Optional[float] = Field(None, description="Extracted or matched longitude")
    event_date: Optional[str] = Field(None, description="Date of the actual incident referenced (YYYY-MM-DD)")
    publication_date: Optional[str] = Field(None, description="Publication timestamp of the report")
    fetched_at: str = Field(..., description="ISO 8601 UTC timestamp of retrieval")
    is_official: bool = Field(False, description="Whether source is an official government or fire authority")
    relevance_score: float = Field(0.0, description="Calculated relevance to incident (0.0 - 1.0)")
    relevance_explanation: str = Field("", description="Explainable description of evidence association")
    domain: Optional[str] = Field(None, description="Domain name (e.g. bcwildfire.ca, calfire.ca.gov)")
    fetch_status: EvidenceStatus = Field(EvidenceStatus.ACTIVE, description="Status of fetch operation")
    search_query: Optional[str] = Field(None, description="Original query string sent to TinyFish")
    relevance_label: str = Field("Relevant", description="Human-understandable qualitative label: 'Relevant', 'Partial match', 'Needs review'")
    finding: Optional[str] = Field(None, description="Concise finding extracted from the source")
    supports_aspect: Optional[str] = Field(None, description="Specific incident aspect supported by the source")
    evidence_role: Optional[str] = Field("Directly reported facts", description="Role: Directly reported facts | Contextual background | Claims needing corroboration | Conflicting or unverified")
    fetch_error: Optional[str] = Field(None, description="Explanation if content fetch failed")
    provenance_origin: Optional[str] = Field("CURRENT_SESSION", description="CURRENT_SESSION | PREVIOUSLY_SAVED | HISTORICAL_ARCHIVE")

