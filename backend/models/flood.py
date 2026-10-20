"""Flood observation models for TerraShield AI Multi-Hazard Intelligence."""

from typing import Optional
from pydantic import BaseModel, Field


class FloodObservation(BaseModel):
    id: str = Field(..., description="Unique flood observation/alert identifier")
    name: str = Field(..., description="River basin, catchment, or locality name")
    region: str = Field(..., description="State, province, or administrative district")
    country: str = Field("India", description="Country")
    latitude: float = Field(..., description="Latitude coordinate")
    longitude: float = Field(..., description="Longitude coordinate")
    severity: str = Field("WARNING", description="Severity: ADVISORY, WARNING, SEVERE, CATASTROPHIC")
    river_basin: Optional[str] = Field(None, description="River system or catchment basin")
    water_level_m: Optional[float] = Field(None, description="Recorded water level in meters")
    danger_level_m: Optional[float] = Field(None, description="Danger threshold level in meters")
    inundation_area_sqkm: Optional[float] = Field(None, description="Estimated inundated surface area in km²")
    rainfall_24h_mm: Optional[float] = Field(None, description="24h cumulative rainfall anomaly in mm")
    observation_time: str = Field(..., description="ISO 8601 observation timestamp")
    source: str = Field("CWC_NDMA", description="Monitoring agency: CWC India, GDACS, Copernicus")
    status: str = Field("ACTIVE", description="Current stage: ACTIVE, RECEDING, NORMALIZING")
    data_mode: str = Field("LIVE", description="Data provenance: LIVE, DEMO, HISTORY")
