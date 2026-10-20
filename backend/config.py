"""Configuration management for TerraShield AI."""

import os
from pathlib import Path
from typing import Any, Dict, List
from dotenv import load_dotenv

# Load .env file from project root if it exists
ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

class Settings:
    # Project Paths
    BASE_DIR: Path = Path(__file__).resolve().parent
    DATA_DIR: Path = BASE_DIR / "data"
    FIRMS_SAMPLE_CSV_PATH: Path = DATA_DIR / "sample_viirs_snpp_071223.csv"

    # API Keys - Check FIRMS_MAP_KEY first as specified in prompt, fallback to NASA_FIRMS_MAP_KEY
    FIRMS_MAP_KEY: str = (
        os.getenv("FIRMS_MAP_KEY") or os.getenv("NASA_FIRMS_MAP_KEY", "")
    ).strip()
    TINYFISH_API_KEY: str = os.getenv("TINYFISH_API_KEY", "").strip()
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "").strip()
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b").strip()
    GROQ_API_BASE_URL: str = os.getenv("GROQ_API_BASE_URL", "https://api.groq.com/openai/v1").strip()
    CARTO_API_KEY: str = (
        os.getenv("CARTO_API_KEY")
        or os.getenv("VITE_CARTO_API_KEY")
        or os.getenv("CARTO_MAP_KEY", "")
    ).strip()

    # Application Mode: LIVE, HISTORICAL_SAMPLE, DEMO
    DATA_MODE: str = os.getenv("DATA_MODE", "HISTORICAL_SAMPLE").upper()
    DEFAULT_REGION: str = os.getenv("DEFAULT_REGION", "INDIA_ALL")

    # Server configuration
    APP_ENV: str = os.getenv("APP_ENV", "development")
    PORT: int = int(os.getenv("PORT", "8000"))
    HOST: str = os.getenv("HOST", "127.0.0.1")

    # CORS
    CORS_ORIGINS: List[str] = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://localhost:8000",
        ).split(",")
        if origin.strip()
    ]

    # Verification Engine Thresholds
    MAX_CORROBORATION_DISTANCE_KM: float = float(
        os.getenv("MAX_CORROBORATION_DISTANCE_KM", "35.0")
    )
    MAX_TEMPORAL_DELTA_HOURS: float = float(
        os.getenv("MAX_TEMPORAL_DELTA_HOURS", "72.0")
    )
    MIN_INDEPENDENT_SOURCES_FOR_CORROBORATION: int = int(
        os.getenv("MIN_INDEPENDENT_SOURCES_FOR_CORROBORATION", "2")
    )

    # NASA FIRMS Endpoints & Sources
    FIRMS_API_BASE_URL: str = "https://firms.modaps.eosdis.nasa.gov/api"
    SUPPORTED_FIRMS_SOURCES: List[str] = [
        "VIIRS_SNPP_NRT",
        "VIIRS_NOAA20_NRT",
        "VIIRS_NOAA21_NRT",
        "MODIS_NRT",
    ]

    # Pre-configured Monitoring Regions (India First, extensible globally)
    # Coordinate format: west, south, east, north (min_lon, min_lat, max_lon, max_lat)
    MONITORING_REGIONS: Dict[str, Dict[str, Any]] = {
        "INDIA_ALL": {
            "id": "INDIA_ALL",
            "name": "India (National Overview)",
            "country": "India",
            "bbox": "68.0,6.5,97.5,37.5",
            "center": [22.5, 82.0],
            "default_zoom": 5,
        },
        "INDIA_CENTRAL": {
            "id": "INDIA_CENTRAL",
            "name": "Central India (MP, Chhattisgarh, Maharashtra)",
            "country": "India",
            "bbox": "74.0,18.0,84.5,26.0",
            "center": [22.0, 79.0],
            "default_zoom": 6,
        },
        "INDIA_NORTH": {
            "id": "INDIA_NORTH",
            "name": "Northern Himalayas (Uttarakhand, HP, J&K)",
            "country": "India",
            "bbox": "73.5,28.5,81.5,35.5",
            "center": [30.5, 78.5],
            "default_zoom": 7,
        },
        "INDIA_NORTHEAST": {
            "id": "INDIA_NORTHEAST",
            "name": "Northeast India (Assam, Arunachal, Mizoram)",
            "country": "India",
            "bbox": "89.5,21.5,97.5,29.5",
            "center": [26.0, 93.0],
            "default_zoom": 6,
        },
        "INDIA_WEST": {
            "id": "INDIA_WEST",
            "name": "Western India (Gujarat, Rajasthan)",
            "country": "India",
            "bbox": "68.0,20.0,78.0,30.0",
            "center": [25.0, 73.0],
            "default_zoom": 6,
        },
        "INDIA_SOUTH": {
            "id": "INDIA_SOUTH",
            "name": "Southern India & Western Ghats (KA, KL, TN)",
            "country": "India",
            "bbox": "74.0,8.0,81.0,18.5",
            "center": [13.0, 77.0],
            "default_zoom": 6,
        },
        "INDIA_UP": {
            "id": "INDIA_UP",
            "name": "Uttar Pradesh (Lucknow Area)",
            "country": "India",
            "bbox": "77.0,23.5,84.5,30.5",
            "center": [26.8467, 80.9462],
            "default_zoom": 12,
        },
        # Global monitoring regions for extensible coverage
        "CALIFORNIA": {
            "id": "CALIFORNIA",
            "name": "California / US Southwest",
            "country": "United States",
            "bbox": "-125.0,32.0,-114.0,42.0",
            "center": [37.0, -119.5],
            "default_zoom": 6,
        },
        "PACIFIC_NORTHWEST": {
            "id": "PACIFIC_NORTHWEST",
            "name": "Pacific Northwest / British Columbia",
            "country": "Canada/US",
            "bbox": "-130.0,42.0,-114.0,60.0",
            "center": [52.0, -121.5],
            "default_zoom": 5,
        },
        "AMAZON_BASIN": {
            "id": "AMAZON_BASIN",
            "name": "Amazon Basin (South America)",
            "country": "Brazil",
            "bbox": "-75.0,-15.0,-45.0,5.0",
            "center": [-5.0, -60.0],
            "default_zoom": 5,
        },
        "MEDITERRANEAN": {
            "id": "MEDITERRANEAN",
            "name": "Mediterranean Basin",
            "country": "Europe",
            "bbox": "-10.0,35.0,30.0,45.0",
            "center": [40.0, 15.0],
            "default_zoom": 5,
        },
        "AUSTRALIA": {
            "id": "AUSTRALIA",
            "name": "Australia",
            "country": "Australia",
            "bbox": "112.0,-44.0,154.0,-10.0",
            "center": [-25.0, 134.0],
            "default_zoom": 4,
        },
        "WORLD": {
            "id": "WORLD",
            "name": "Global Coverage",
            "country": "Global",
            "bbox": "world",
            "center": [20.0, 0.0],
            "default_zoom": 2,
        },
    }

    # TinyFish endpoints
    TINYFISH_SEARCH_URL: str = "https://api.search.tinyfish.ai"
    TINYFISH_FETCH_URL: str = "https://api.fetch.tinyfish.ai"

    @property
    def has_tinyfish_key(self) -> bool:
        return bool(self.TINYFISH_API_KEY and len(self.TINYFISH_API_KEY) > 5)

    @property
    def has_firms_key(self) -> bool:
        return bool(self.FIRMS_MAP_KEY and len(self.FIRMS_MAP_KEY) > 5)

    @property
    def has_carto_key(self) -> bool:
        return bool(self.CARTO_API_KEY and len(self.CARTO_API_KEY) > 5)

    @property
    def has_groq_key(self) -> bool:
        return bool(self.GROQ_API_KEY and len(self.GROQ_API_KEY) > 5)

settings = Settings()
