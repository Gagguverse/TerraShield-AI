"""Satellite detection models for NASA FIRMS."""

from typing import Optional
from pydantic import BaseModel, Field

class SatelliteDetection(BaseModel):
    id: str = Field(..., description="Unique detection identifier")
    latitude: float = Field(..., description="Latitude coordinate (-90 to 90)")
    longitude: float = Field(..., description="Longitude coordinate (-180 to 180)")
    bright_ti4: Optional[float] = Field(None, description="VIIRS I-4 Channel Brightness Temp (Kelvin)")
    bright_ti5: Optional[float] = Field(None, description="VIIRS I-5 Channel Brightness Temp (Kelvin)")
    frp: Optional[float] = Field(None, description="Fire Radiative Power (MW)")
    scan: Optional[float] = Field(None, description="Spatial resolution along scan")
    track: Optional[float] = Field(None, description="Spatial resolution along track")
    acq_date: str = Field(..., description="Acquisition date (YYYY-MM-DD)")
    acq_time: str = Field(..., description="Acquisition time (UTC)")
    timestamp: str = Field(..., description="Normalized ISO 8601 acquisition timestamp")
    satellite: str = Field("N", description="Satellite platform (N=Suomi NPP, NOAA-20, Terra, Aqua)")
    instrument: str = Field("VIIRS", description="Sensor instrument (VIIRS or MODIS)")
    confidence: str = Field("nominal", description="Confidence category: low, nominal, high or percent")
    confidence_score: float = Field(0.7, description="Normalized confidence scalar (0.0 - 1.0)")
    daynight: str = Field("D", description="Day or Night acquisition (D/N)")
    data_mode: str = Field("HISTORICAL_SAMPLE", description="Data provenance: LIVE, HISTORICAL_SAMPLE, DEMO")
