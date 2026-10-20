"""Geographic and Temporal Validation Engine for TerraShield AI.

Provides reusable coordinate validation, point-in-region bounding verification,
strict localized administrative matching, and UTC-normalized temporal alignment.
Prevents broad country-level false matches and historical date contamination.
"""

import math
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple


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


def validate_coordinates(lat: Any, lon: Any) -> Tuple[bool, str]:
    """Validate latitude and longitude values and detect inversions or invalid bounds."""
    try:
        lat_f = float(lat)
        lon_f = float(lon)
    except (ValueError, TypeError):
        return False, f"Coordinates ({lat}, {lon}) are not valid numbers."

    if math.isnan(lat_f) or math.isnan(lon_f) or math.isinf(lat_f) or math.isinf(lon_f):
        return False, f"Coordinates ({lat_f}, {lon_f}) contain NaN or infinite values."

    # Detect swapped coordinates where lat is outside [-90, 90] but lon is within [-90, 90]
    if (abs(lat_f) > 90.0 and abs(lon_f) <= 90.0) or (abs(lat_f) > 90.0 and abs(lon_f) <= 180.0):
        return False, f"Latitude {lat_f} exceeds valid [-90, 90] range (possible coordinate inversion)."

    if not (-90.0 <= lat_f <= 90.0):
        return False, f"Latitude {lat_f} is out of bounds [-90, 90]."

    if not (-180.0 <= lon_f <= 180.0):
        return False, f"Longitude {lon_f} is out of bounds [-180, 180]."

    return True, f"Coordinates ({lat_f:.4f}, {lon_f:.4f}) are geographically valid."


# Standardized administrative bounding boxes [min_lat, max_lat, min_lon, max_lon]
KNOWN_REGION_BOUNDS: Dict[str, Dict[str, Any]] = {
    # Indian States & Zones
    "uttarakhand": {
        "name": "Uttarakhand",
        "bbox": (28.7, 31.5, 77.5, 81.1),
        "districts": [
            "dehradun", "pauri garhwal", "garhwal", "chamoli", "rudraprayag",
            "tehri", "uttarkashi", "nainital", "almora", "pithoragarh",
            "bageshwar", "champawat", "haridwar", "udham singh nagar"
        ],
        "country": "India",
    },
    "odisha": {
        "name": "Odisha",
        "bbox": (17.8, 22.6, 81.3, 87.5),
        "districts": [
            "mayurbhanj", "simlipal", "similipal", "khordha", "cuttack",
            "ganjam", "puri", "sambalpur", "balasore", "koraput", "sundargarh"
        ],
        "country": "India",
    },
    "karnataka": {
        "name": "Karnataka",
        "bbox": (11.5, 18.5, 74.0, 78.6),
        "districts": [
            "bandipur", "chamarajanagar", "mysuru", "mysore", "kodagu",
            "coorg", "bengaluru", "uttara kannada", "dakshina kannada",
            "shivamogga", "chikmagalur", "belagavi", "ballari"
        ],
        "country": "India",
    },
    "kerala": {
        "name": "Kerala",
        "bbox": (8.2, 12.8, 74.8, 77.4),
        "districts": [
            "wayanad", "chooralmala", "mundakkai", "meppadi", "vythiri",
            "malappuram", "kozhikode", "idukki", "palakkad", "kannur",
            "thiruvananthapuram", "ernakulam", "kottayam", "alappuzha"
        ],
        "country": "India",
    },
    "himachal pradesh": {
        "name": "Himachal Pradesh",
        "bbox": (30.3, 33.3, 75.6, 79.1),
        "districts": ["shimla", "kullu", "mandi", "kangra", "kinnaur", "chamba", "solan", "sirmour"],
        "country": "India",
    },
    "assam": {
        "name": "Assam",
        "bbox": (24.1, 28.2, 89.7, 96.0),
        "districts": ["kaziranga", "kamrup", "guwahati", "dhubri", "morigaon", "nagaon", "dibrugarh", "jorhat"],
        "country": "India",
    },
    "madhya pradesh": {
        "name": "Madhya Pradesh",
        "bbox": (21.1, 26.9, 74.0, 82.8),
        "districts": ["bhopal", "indore", "kanha", "bandhavgarh", "jabalpur", "gwalior"],
        "country": "India",
    },
    "chhattisgarh": {
        "name": "Chhattisgarh",
        "bbox": (17.8, 24.1, 80.2, 84.4),
        "districts": ["bastar", "raipur", "bilaspur", "durg", "surguja"],
        "country": "India",
    },
    "maharashtra": {
        "name": "Maharashtra",
        "bbox": (15.6, 22.0, 72.6, 80.9),
        "districts": ["mumbai", "pune", "nagpur", "gadchiroli", "nashik", "thane", "satara"],
        "country": "India",
    },
    # Global Regions
    "british columbia": {
        "name": "British Columbia, Canada",
        "bbox": (48.3, 60.0, -139.1, -114.0),
        "districts": ["mcdougall creek", "kelowna", "kamloops", "prince george", "okanagan", "vancouver", "shuswap"],
        "country": "Canada",
    },
    "alberta": {
        "name": "Alberta, Canada",
        "bbox": (49.0, 60.0, -120.0, -110.0),
        "districts": ["jasper", "edmonton", "calgary", "fort mcmurray", "slave lake"],
        "country": "Canada",
    },
    "california": {
        "name": "California, USA",
        "bbox": (32.5, 42.0, -124.5, -114.1),
        "districts": ["butte county", "paradise", "los angeles", "san diego", "san francisco", "sonoma", "redding", "camp fire"],
        "country": "USA",
    },
    "oregon": {
        "name": "Oregon, USA",
        "bbox": (42.0, 46.3, -124.6, -116.4),
        "districts": ["portland", "salem", "eugene", "bend", "medford"],
        "country": "USA",
    },
}


def find_matching_region_definition(region_str: str) -> Optional[Tuple[str, Dict[str, Any]]]:
    """Find the best-matching known region definition from a text string."""
    if not region_str:
        return None

    r_lower = region_str.lower()
    for key, data in KNOWN_REGION_BOUNDS.items():
        if key in r_lower:
            return key, data
        for dist in data["districts"]:
            if dist in r_lower:
                return key, data

    return None


def validate_point_in_region(
    lat: float, lon: float, assigned_region: str
) -> Tuple[bool, str, Optional[str]]:
    """Compare point coordinates against assigned state/region bounding box.

    Returns: (is_valid_match, diagnostic_reason, verified_location_label)
    """
    coord_ok, coord_msg = validate_coordinates(lat, lon)
    if not coord_ok:
        return False, coord_msg, "Invalid Coordinates"

    region_match = find_matching_region_definition(assigned_region)
    if not region_match:
        # Fallback to broader country / global zones
        if 6.5 <= lat <= 37.5 and 68.0 <= lon <= 97.5:
            return True, f"Point ({lat:.4f}, {lon:.4f}) falls within Indian territory (broad boundary).", "India (Unspecified Region)"
        return True, f"Point ({lat:.4f}, {lon:.4f}) has valid coordinates; detailed regional boundary not indexed.", assigned_region or "Unknown Region"

    reg_key, reg_data = region_match
    min_lat, max_lat, min_lon, max_lon = reg_data["bbox"]

    # Allow slight buffer (0.3 degrees ~ 33km) around administrative bounding boxes
    buffer_deg = 0.3
    in_lat = (min_lat - buffer_deg) <= lat <= (max_lat + buffer_deg)
    in_lon = (min_lon - buffer_deg) <= lon <= (max_lon + buffer_deg)

    if in_lat and in_lon:
        return (
            True,
            f"Point ({lat:.4f}, {lon:.4f}) verified inside {reg_data['name']} boundaries.",
            reg_data["name"],
        )

    # Coordinates are OUTSIDE the claimed region! Determine where the point actually is
    actual_region = None
    for other_key, other_data in KNOWN_REGION_BOUNDS.items():
        o_min_lat, o_max_lat, o_min_lon, o_max_lon = other_data["bbox"]
        if (o_min_lat - buffer_deg) <= lat <= (o_max_lat + buffer_deg) and (o_min_lon - buffer_deg) <= lon <= (o_max_lon + buffer_deg):
            actual_region = other_data["name"]
            break

    actual_loc_str = actual_region or f"Zone ({lat:.2f}°, {lon:.2f}°)"
    diag = (
        f"Geographic mismatch: Coordinates ({lat:.4f}, {lon:.4f}) are located in {actual_loc_str}, "
        f"which is outside the assigned region '{reg_data['name']}' "
        f"(bbox: lat {min_lat}-{max_lat}, lon {min_lon}-{max_lon})."
    )
    return False, diag, actual_loc_str


def validate_named_location_match(
    target_region: str,
    extracted_location: Optional[str],
    text_content: Optional[str],
) -> Tuple[bool, str, str]:
    """Validate whether an article's location genuinely matches the target incident region.

    Rejects broad generic country names ('India', 'USA', 'Canada') as proof of localized spatial match.
    Returns: (is_match, match_type, explanation)
    """
    combined = f"{extracted_location or ''} {text_content or ''}".lower()
    target_lower = (target_region or "").lower()

    if not target_lower:
        return False, "NO_TARGET", "Target region not specified."

    region_def = find_matching_region_definition(target_region)
    if region_def:
        reg_key, reg_data = region_def
        # Check specific districts first (high precision)
        matching_districts = [d for d in reg_data["districts"] if re.search(r"\b" + re.escape(d) + r"\b", combined)]
        if matching_districts:
            return (
                True,
                "DISTRICT_MATCH",
                f"Direct localized match for district/locality: '{matching_districts[0].title()}' in {reg_data['name']}.",
            )

        # Check state name (medium precision)
        if re.search(r"\b" + re.escape(reg_key) + r"\b", combined) or re.search(r"\b" + re.escape(reg_data["name"].lower()) + r"\b", combined):
            return (
                True,
                "STATE_MATCH",
                f"Matches state/province name '{reg_data['name']}'.",
            )

    # Check non-generic tokens from target_region
    # Ignore broad generic words
    generic_stopwords = {
        "india", "usa", "canada", "united", "states", "national", "overview",
        "zone", "region", "central", "northern", "southern", "eastern", "western",
        "district", "state", "province", "forest", "fire", "wildfire", "flood"
    }
    tokens = [
        tok.strip(" ,&()")
        for tok in target_lower.replace("&", ",").replace("/", ",").split(",")
        if len(tok.strip(" ,&()")) >= 4 and tok.strip(" ,&()") not in generic_stopwords
    ]

    for tok in tokens:
        if re.search(r"\b" + re.escape(tok) + r"\b", combined):
            return (
                True,
                "NAMED_SUBREGION",
                f"Matches specific regional entity '{tok.title()}'.",
            )

    return (
        False,
        "UNVERIFIED_LOCATION",
        f"Source does not mention specific localized districts or subregions for '{target_region}'. Broad country/general matches are rejected as ground corroboration.",
    )


def normalize_utc_timestamp(dt_str: Optional[str]) -> Optional[datetime]:
    """Parse flexible datetime strings into UTC-aware datetime objects."""
    if not dt_str:
        return None

    dt_str = str(dt_str).strip()
    # Normalize Z to +00:00
    if dt_str.endswith("Z"):
        dt_str = dt_str[:-1] + "+00:00"

    formats = [
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%S.%f%z",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S%z",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d",
        "%d %b %Y",
        "%d-%m-%Y",
    ]

    for fmt in formats:
        try:
            dt = datetime.strptime(dt_str, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            else:
                dt = dt.astimezone(timezone.utc)
            return dt
        except ValueError:
            continue

    return None


def evaluate_temporal_alignment(
    observation_dt: Optional[datetime],
    report_dt: Optional[datetime],
    max_hours: float = 72.0,
) -> Dict[str, Any]:
    """Strictly evaluate temporal delta between satellite observation and source report.

    Enforces temporal window and prevents historical articles from corroborating current events.
    """
    if observation_dt is None:
        return {
            "matched": False,
            "status": "OBSERVATION_TIME_UNKNOWN",
            "delta_hours": None,
            "is_historical": False,
            "missing_date": True,
            "explanation": "Satellite observation timestamp is unknown or missing.",
        }

    if report_dt is None:
        return {
            "matched": False,
            "status": "REPORT_TIME_UNKNOWN",
            "delta_hours": None,
            "is_historical": False,
            "missing_date": True,
            "explanation": "Source report lacks a verified publication or event date. Unverifiable temporal proximity.",
        }

    delta_seconds = (report_dt - observation_dt).total_seconds()
    delta_hours = round(abs(delta_seconds) / 3600.0, 1)

    # If the report is within the accepted window
    if delta_hours <= max_hours:
        return {
            "matched": True,
            "status": "CONTEMPORARY_MATCH",
            "delta_hours": delta_hours,
            "is_historical": False,
            "missing_date": False,
            "explanation": f"Report timestamp aligns within {delta_hours:.1f} hours of satellite observation (threshold: {max_hours:.1f}h).",
        }

    # If report is published significantly earlier or later than observation
    is_historical = (observation_dt.year - report_dt.year) >= 1 or delta_hours > 720.0  # >30 days
    return {
        "matched": False,
        "status": "OUT_OF_WINDOW",
        "delta_hours": delta_hours,
        "is_historical": is_historical,
        "missing_date": False,
        "explanation": (
            f"Report timestamp differs by {delta_hours:.1f} hours from satellite observation, "
            f"exceeding the {max_hours:.1f}-hour relevance window. "
            + ("Historical material can provide background but cannot corroborate a current event." if is_historical else "Out-of-period report.")
        ),
    }
