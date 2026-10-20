"""Spatial clustering of raw satellite detections into candidate wildfire incidents."""

import math
from typing import List, Dict
from backend.models.detection import SatelliteDetection
from backend.models.incident import Incident
from backend.engine.verifier import verifier, haversine_distance_km

def get_region_name(lat: float, lon: float) -> str:
    """Derive descriptive regional name from coordinates."""
    # India bounding box (approx lat 6.5 to 37.5, lon 68.0 to 97.5)
    if 6.5 <= lat <= 37.5 and 68.0 <= lon <= 97.5:
        if 28.5 <= lat <= 35.5 and 73.5 <= lon <= 81.5:
            return "Northern Himalayas (Uttarakhand / HP), India"
        elif 18.0 <= lat <= 26.0 and 74.0 <= lon <= 84.5:
            return "Central India (MP / CG / MH), India"
        elif 21.5 <= lat <= 29.5 and 89.5 <= lon <= 97.5:
            return "Northeast India (Assam / Arunachal / Mizoram), India"
        elif 8.0 <= lat <= 18.5 and 74.0 <= lon <= 81.0:
            return "Southern India & Western Ghats, India"
        elif 20.0 <= lat <= 30.0 and 68.0 <= lon <= 78.0:
            return "Western India (Gujarat / Rajasthan), India"
        else:
            return "India (National Overview)"
    elif 48.0 <= lat <= 60.0 and -139.0 <= lon <= -114.0:
        return "British Columbia / Yukon, Canada"
    elif 49.0 <= lat <= 60.0 and -120.0 <= lon <= -110.0:
        return "Alberta, Canada"
    elif 45.0 <= lat <= 60.0 and -80.0 <= lon <= -57.0:
        return "Quebec, Canada"
    elif 32.0 <= lat <= 42.0 and -125.0 <= lon <= -114.0:
        return "California, USA"
    elif 42.0 <= lat <= 46.5 and -124.5 <= lon <= -116.5:
        return "Oregon, USA"
    elif 45.5 <= lat <= 49.0 and -124.5 <= lon <= -117.0:
        return "Washington, USA"
    elif -40.0 <= lat <= -10.0 and 112.0 <= lon <= 154.0:
        return "Australia"
    elif 35.0 <= lat <= 45.0 and -10.0 <= lon <= 30.0:
        return "Mediterranean Basin"
    elif -35.0 <= lat <= 5.0 and -80.0 <= lon <= -35.0:
        return "Amazon Basin, South America"
    elif 0.0 <= lat <= 30.0 and -20.0 <= lon <= 50.0:
        return "Central / Northern Africa"
    else:
        lat_dir = "N" if lat >= 0 else "S"
        lon_dir = "E" if lon >= 0 else "W"
        return f"Zone {abs(lat):.1f}°{lat_dir}, {abs(lon):.1f}°{lon_dir}"

def cluster_detections_into_incidents(
    detections: List[SatelliteDetection],
    cluster_radius_km: float = 25.0,
    max_incidents: int = 40,
    data_mode: str = "HISTORICAL_SAMPLE",
) -> List[Incident]:
    """Group satellite detections within cluster_radius_km into candidate incidents."""
    if not detections:
        return []

    # Sort detections by brightness or FRP descending to prioritize intense thermal cores
    sorted_dets = sorted(
        detections,
        key=lambda d: (d.frp or 0.0, d.bright_ti4 or 0.0),
        reverse=True,
    )

    clusters: List[List[SatelliteDetection]] = []

    for det in sorted_dets:
        placed = False
        for cl in clusters:
            # Check distance to cluster centroid or first element
            anchor = cl[0]
            dist = haversine_distance_km(anchor.latitude, anchor.longitude, det.latitude, det.longitude)
            if dist <= cluster_radius_km:
                cl.append(det)
                placed = True
                break

        if not placed:
            clusters.append([det])
            if len(clusters) >= max_incidents * 2:
                break

    incidents: List[Incident] = []

    for idx, cl in enumerate(clusters[:max_incidents]):
        primary = cl[0]
        # Calculate centroid
        avg_lat = sum(d.latitude for d in cl) / len(cl)
        avg_lon = sum(d.longitude for d in cl) / len(cl)
        max_frp = max((d.frp or 0.0 for d in cl), default=None)
        max_bright = max((d.bright_ti4 or 0.0 for d in cl), default=None)

        region = get_region_name(avg_lat, avg_lon)
        incident_id = f"INC-{data_mode[:4]}-{idx + 1:03d}"
        incident_name = f"{region.split(',')[0]} Thermal Cluster #{idx + 1}"

        # Initial verification (no public evidence attached initially for raw FIRMS clusters)
        verification_report = verifier.evaluate(
            incident_lat=avg_lat,
            incident_lon=avg_lon,
            incident_time_str=primary.timestamp,
            evidence_list=[],
        )

        incident = Incident(
            id=incident_id,
            name=incident_name,
            region=region,
            latitude=round(avg_lat, 5),
            longitude=round(avg_lon, 5),
            first_detected=primary.timestamp,
            last_detected=cl[-1].timestamp,
            detection_count=len(cl),
            max_frp=round(max_frp, 1) if max_frp else None,
            max_brightness=round(max_bright, 1) if max_bright else None,
            primary_detection=primary,
            detections=cl[:15],  # store up to 15 detections per incident
            evidence=[],
            verification=verification_report,
            data_mode=data_mode,
        )
        incidents.append(incident)

    return incidents
