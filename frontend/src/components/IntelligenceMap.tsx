import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  RotateCcw,
  Layers,
  MapPin,
  Satellite,
  AlertCircle,
  CheckCircle2,
  Info,
  X,
  ChevronDown,
  ChevronUp,
  Globe,
  Radio,
  Moon,
  Compass,
  Cpu,
} from 'lucide-react';
import { api } from '../services/api';
import type { DataMode, FirmsRegion, HealthResponse, Incident, SatelliteDetection } from '../types';
import { AoiDropdown } from './AoiDropdown';
import { MLAnalysisPanel } from './MLAnalysisPanel';

// Verified NASA GIBS WMTS Satellite Thermal & Infrared Products in EPSG:3857 (Web Mercator)
export type GibsThermalProduct =
  | 'VIIRS_SNPP_Brightness_Temp_BandI5_Day'
  | 'VIIRS_SNPP_Brightness_Temp_BandI5_Night'
  | 'VIIRS_SNPP_CorrectedReflectance_BandsM11-I2-I1'
  | 'MODIS_Terra_Brightness_Temp_Band31_Day';

export interface GibsProductConfig {
  id: GibsThermalProduct;
  label: string;
  shortLabel: string;
  instrument: string;
  platform: string;
  resolution: string;
  spectrum: string;
  tileMatrixSet: string;
  format: 'png' | 'jpg';
  maxNativeZoom: number;
  minDate: string;
  description: string;
  radiometricNote: string;
}

export const GIBS_THERMAL_PRODUCTS: Record<GibsThermalProduct, GibsProductConfig> = {
  VIIRS_SNPP_Brightness_Temp_BandI5_Day: {
    id: 'VIIRS_SNPP_Brightness_Temp_BandI5_Day',
    label: 'VIIRS Band I5 Day (375m Radiometric Thermal)',
    shortLabel: 'VIIRS Day Thermal (11.45µm)',
    instrument: 'VIIRS (Visible Infrared Imaging Radiometer Suite)',
    platform: 'Suomi NPP / NASA EOSDIS GIBS',
    resolution: '375m Ground Sample Distance',
    spectrum: 'Long-Wave Infrared (11.45 µm)',
    tileMatrixSet: 'GoogleMapsCompatible_Level9',
    format: 'png',
    maxNativeZoom: 9,
    minDate: '2012-01-20',
    description: 'Daytime top-of-atmosphere radiative brightness temperature showing regional land heating and high-radiance thermal signatures.',
    radiometricNote: 'Measures radiative brightness temperature (Kelvin), not calibrated ground flame temperature. Elevated values reflect land surface heating and thermal emission.',
  },
  VIIRS_SNPP_Brightness_Temp_BandI5_Night: {
    id: 'VIIRS_SNPP_Brightness_Temp_BandI5_Night',
    label: 'VIIRS Band I5 Night (375m Thermal Radiance)',
    shortLabel: 'VIIRS Night Thermal (11.45µm)',
    instrument: 'VIIRS (Visible Infrared Imaging Radiometer Suite)',
    platform: 'Suomi NPP / NASA EOSDIS GIBS',
    resolution: '375m Ground Sample Distance',
    spectrum: 'Long-Wave Infrared (11.45 µm Nocturnal)',
    tileMatrixSet: 'GoogleMapsCompatible_Level9',
    format: 'png',
    maxNativeZoom: 9,
    minDate: '2012-01-20',
    description: 'Nighttime thermal radiation. High-heat anomalies stand out with zero solar reflectance contamination.',
    radiometricNote: 'Measures nocturnal surface radiative brightness temperature. Sharp thermal contrasts indicate active high-radiance ground emissions.',
  },
  'VIIRS_SNPP_CorrectedReflectance_BandsM11-I2-I1': {
    id: 'VIIRS_SNPP_CorrectedReflectance_BandsM11-I2-I1',
    label: 'VIIRS SWIR M11 (375m Smoke Penetration)',
    shortLabel: 'VIIRS SWIR Fire Penetration (2.25µm)',
    instrument: 'VIIRS (Shortwave & Near Infrared)',
    platform: 'Suomi NPP / NASA EOSDIS GIBS',
    resolution: '375m Ground Sample Distance',
    spectrum: 'Shortwave Infrared (Bands M11 2.25µm, I2 0.86µm, I1 0.64µm)',
    tileMatrixSet: 'GoogleMapsCompatible_Level9',
    format: 'jpg',
    maxNativeZoom: 9,
    minDate: '2012-01-20',
    description: 'False-color composite penetrating dense atmospheric smoke to reveal active fire fronts in bright red/orange and burn scars in dark brown.',
    radiometricNote: 'Shortwave infrared (2.25 µm) pierces smoke particles to highlight flaming combustion fronts in red-orange.',
  },
  MODIS_Terra_Brightness_Temp_Band31_Day: {
    id: 'MODIS_Terra_Brightness_Temp_Band31_Day',
    label: 'MODIS Terra Band 31 (1km Long-Term Thermal Archive)',
    shortLabel: 'MODIS 1km Thermal Archive',
    instrument: 'MODIS (Moderate Resolution Imaging Spectroradiometer)',
    platform: 'Terra / NASA EOSDIS GIBS',
    resolution: '1000m (1km) Ground Sample Distance',
    spectrum: 'Thermal Infrared (Band 31: 11.03 µm)',
    tileMatrixSet: 'GoogleMapsCompatible_Level7',
    format: 'png',
    maxNativeZoom: 7,
    minDate: '2000-02-24',
    description: 'Continuous long-term global thermal archive providing uninterrupted daily observations from 2000 to present.',
    radiometricNote: 'Continuous multi-decade climate and historical fire baseline.',
  },
};

// Compute yesterday in UTC ISO format (guaranteed 100% complete daily global composite across all meridians)
function getYesterdayIso(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split('T')[0];
}

const HISTORICAL_PRESETS = [
  { date: '2024-05-04', label: '2024 Uttarakhand Wildfires' },
  { date: '2021-03-05', label: '2021 Similipal Fire' },
  { date: '2019-02-23', label: '2019 Bandipur Fire' },
];

export type BasemapView = 'dark_street' | 'satellite_imagery' | 'street_geography';

interface IntelligenceMapProps {
  incidents: Incident[];
  detections: SatelliteDetection[];
  selectedIncident: Incident | null;
  selectedDetection: SatelliteDetection | null;
  onSelectIncident: (incident: Incident | null) => void;
  onSelectDetection: (detection: SatelliteDetection | null) => void;
  onRefreshData?: () => Promise<void>;
  selectedRegionId: string;
  onRegionChange: (regionId: string) => void;
  regions: FirmsRegion[];
  currentMode?: DataMode;
  health?: HealthResponse | null;
  mapFocusTarget?: { lat: number; lon: number; zoom?: number; timestamp: number } | null;
}

export const IntelligenceMap: React.FC<IntelligenceMapProps> = ({
  incidents,
  detections,
  selectedIncident,
  selectedDetection,
  onSelectIncident,
  onSelectDetection,
  onRefreshData,
  selectedRegionId,
  onRegionChange,
  regions,
  currentMode = 'HISTORICAL_SAMPLE',
  health,
  mapFocusTarget,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Layer references (Proper layered architecture: Basemap (z:1) -> Thermal Overlay (z:2) -> Labels (z:3))
  const basemapLayerRef = useRef<L.TileLayer | null>(null);
  const thermalLayerRef = useRef<L.TileLayer | null>(null);
  const labelLayerRef = useRef<L.TileLayer | null>(null);
  const incidentLayerRef = useRef<L.LayerGroup | null>(null);
  const detectionLayerRef = useRef<L.LayerGroup | null>(null);

  // 1. Basemap State (Always rendered as underlying base)
  const [basemapView, setBasemapView] = useState<BasemapView>('dark_street');

  // 2. Separate Thermal Imagery Overlay State
  const [showThermalImagery, setShowThermalImagery] = useState<boolean>(true);
  const [thermalOpacity, setThermalOpacity] = useState<number>(0.7);

  // Selected NASA GIBS Thermal Imagery Product
  const [gibsProductKey, setGibsProductKey] = useState<GibsThermalProduct>(
    'VIIRS_SNPP_Brightness_Temp_BandI5_Day'
  );

  // Temporal Selection: Latest Available (NRT Daily Composite) vs. Historical Archive
  const [timeMode, setTimeMode] = useState<'latest' | 'historical'>('latest');
  const latestDateIso = getYesterdayIso();
  const [historicalDate, setHistoricalDate] = useState<string>('2024-05-04');
  const [dateOutOfRangeWarning, setDateOutOfRangeWarning] = useState<string | null>(null);

  // Active product configuration
  const activeGibsConfig = GIBS_THERMAL_PRODUCTS[gibsProductKey];
  const effectiveDate = timeMode === 'latest' ? latestDateIso : historicalDate;

  // Labels & Telemetry Badge toggles
  const [showSatelliteLabels, setShowSatelliteLabels] = useState<boolean>(true);
  const [showTelemetryBadge, setShowTelemetryBadge] = useState<boolean>(true);
  const [showMLPanel, setShowMLPanel] = useState<boolean>(false);

  // Sensor selection & live query state
  const [supportedSources] = useState<string[]>([
    'VIIRS_SNPP_NRT',
    'VIIRS_NOAA20_NRT',
    'VIIRS_NOAA21_NRT',
    'MODIS_NRT',
  ]);
  const [selectedSource, setSelectedSource] = useState<string>('VIIRS_SNPP_NRT');
  const [dayRange, setDayRange] = useState<number>(1);
  const [isFetchingFirms, setIsFetchingFirms] = useState<boolean>(false);
  const [firmsStatusBanner, setFirmsStatusBanner] = useState<{
    type: 'success' | 'warning' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Layer toggles: Hotspots overlay is separate and optional
  const [showDetectionsLayer, setShowDetectionsLayer] = useState(true);
  const [showIncidentsLayer, setShowIncidentsLayer] = useState(false);
  const [isLegendOpen, setIsLegendOpen] = useState(false);

  // Selected region object
  const currentRegion = regions.find((r) => r.id === selectedRegionId) || {
    id: 'INDIA_ALL',
    name: 'India (National Overview)',
    country: 'India',
    center: [22.5, 82.0],
    default_zoom: 5,
  };

  // 1. Initialize Leaflet Map (Centered at World-Scale Extent [20, 0] zoom 2)
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialCenter: [number, number] = [20.0, 0.0];
    const initialZoom = 2;

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      minZoom: 2,
      maxZoom: 19,
      zoomControl: false,
      worldCopyJump: true,
    });

    // Add zoom control at top-right
    L.control.zoom({ position: 'topright' }).addTo(map);

    const incidentGroup = L.layerGroup().addTo(map);
    const detectionGroup = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;
    incidentLayerRef.current = incidentGroup;
    detectionLayerRef.current = detectionGroup;

    // ResizeObserver for dynamic layout shifts
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Underlying Basemap Tile Layer Effect (Dark Street | Satellite Imagery | Streets)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove previous base layer
    if (basemapLayerRef.current) {
      map.removeLayer(basemapLayerRef.current);
      basemapLayerRef.current = null;
    }

    const cartoKey = (
      health?.carto_api_key ||
      import.meta.env.VITE_CARTO_API_KEY ||
      ''
    ).trim();

    let baseLayer: L.TileLayer;

    if (basemapView === 'satellite_imagery') {
      // Option B: High-Resolution Satellite Orthoimagery (Esri World Imagery)
      baseLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution:
            'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community | Fire Telemetry: <a href="https://firms.modaps.eosdis.nasa.gov/" target="_blank" rel="noreferrer">NASA FIRMS</a>',
          maxZoom: 19,
          maxNativeZoom: 19,
          zIndex: 1,
        }
      );
    } else if (basemapView === 'street_geography') {
      // Option C: CARTO Voyager (Streets & Geography)
      const voyagerUrl = cartoKey
        ? `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(cartoKey)}`
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

      baseLayer = L.tileLayer(voyagerUrl, {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a> | Fire Telemetry: <a href="https://firms.modaps.eosdis.nasa.gov/" target="_blank" rel="noreferrer">NASA FIRMS</a>',
        subdomains: 'abcd',
        maxZoom: 20,
        zIndex: 1,
      });
    } else {
      // Option A: CARTO Dark Matter (Dark Street Network) — Default
      const cartoTileUrl = cartoKey
        ? `https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(cartoKey)}`
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png';

      baseLayer = L.tileLayer(cartoTileUrl, {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a> | Fire Telemetry: <a href="https://firms.modaps.eosdis.nasa.gov/" target="_blank" rel="noreferrer">NASA FIRMS</a>',
        subdomains: 'abcd',
        maxZoom: 20,
        zIndex: 1,
      });
    }

    baseLayer.addTo(map);
    baseLayer.bringToBack();
    basemapLayerRef.current = baseLayer;
  }, [basemapView, health?.carto_api_key]);

  // 3. Separate NASA GIBS Satellite Thermal / Infrared Overlay Effect
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove previous thermal layer
    if (thermalLayerRef.current) {
      map.removeLayer(thermalLayerRef.current);
      thermalLayerRef.current = null;
    }

    // Only render thermal overlay if enabled
    if (!showThermalImagery) {
      return;
    }

    // Validate date bounds
    const isDateValid =
      effectiveDate >= activeGibsConfig.minDate &&
      effectiveDate <= latestDateIso;

    if (!isDateValid) {
      return;
    }

    // Genuine NASA EOSDIS GIBS WMTS Thermal / Infrared Imagery in EPSG:3857 (Web Mercator)
    const gibsUrl = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${activeGibsConfig.id}/default/${effectiveDate}/${activeGibsConfig.tileMatrixSet}/{z}/{y}/{x}.${activeGibsConfig.format}`;

    const gibsLayer = L.tileLayer(gibsUrl, {
      attribution: `Thermal Satellite Imagery &copy; <a href="https://earthdata.nasa.gov/eosdis/science-system-description/eosdis-components/gibs" target="_blank" rel="noreferrer">NASA EOSDIS GIBS</a> (${activeGibsConfig.label})`,
      maxNativeZoom: activeGibsConfig.maxNativeZoom,
      maxZoom: 18,
      opacity: thermalOpacity,
      zIndex: 2,
    }).addTo(map);

    thermalLayerRef.current = gibsLayer;
  }, [
    showThermalImagery,
    gibsProductKey,
    effectiveDate,
    thermalOpacity,
    activeGibsConfig,
    latestDateIso,
  ]);

  // 4. Transparent Political Boundaries & City Labels Overlay Effect
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (labelLayerRef.current) {
      map.removeLayer(labelLayerRef.current);
      labelLayerRef.current = null;
    }

    if (showSatelliteLabels) {
      const cartoKey = (
        health?.carto_api_key ||
        import.meta.env.VITE_CARTO_API_KEY ||
        ''
      ).trim();

      const labelsUrl = cartoKey
        ? `https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(cartoKey)}`
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png';

      const labelOverlay = L.tileLayer(labelsUrl, {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20,
        opacity: 0.92,
        zIndex: 3,
      }).addTo(map);

      labelLayerRef.current = labelOverlay;
    }
  }, [showSatelliteLabels, health?.carto_api_key]);

  // Date change handler with truthful bounds validation
  const handleDateChange = (newDate: string) => {
    setHistoricalDate(newDate);
    if (newDate < activeGibsConfig.minDate) {
      setDateOutOfRangeWarning(
        `NASA GIBS ${activeGibsConfig.shortLabel} is unavailable for ${newDate}. This product's archive begins on ${activeGibsConfig.minDate}. Please select a date between ${activeGibsConfig.minDate} and ${latestDateIso}.`
      );
    } else if (newDate > latestDateIso) {
      setDateOutOfRangeWarning(
        `NASA GIBS composite for ${newDate} is not yet available. Daily global orbital composites require up to 24 hours for complete stitching. Please select a date on or before ${latestDateIso}.`
      );
    } else {
      setDateOutOfRangeWarning(null);
    }
  };

  // Prominent Global Thermal Satellite Click Action (Flies to world extent [20, 0] zoom 2 and ensures thermal overlay is ON)
  const handleGlobalThermalSatelliteClick = () => {
    setShowThermalImagery(true);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([20, 0], 2, { duration: 1.2 });
    }
  };

  // Pan to region when selected region changes
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedRegionId) return;
    const found = regions.find((r) => r.id === selectedRegionId);
    if (found) {
      mapInstanceRef.current.flyTo(found.center, found.default_zoom, { duration: 1.0 });
    }
  }, [selectedRegionId, regions]);

  // Trigger Live NASA FIRMS API Query
  const handleFetchLiveFirms = async () => {
    setIsFetchingFirms(true);
    setFirmsStatusBanner(null);

    try {
      const result = await api.fetchLiveFirms({
        region: selectedRegionId,
        source: selectedSource,
        day_range: dayRange,
      });

      if (result.status === 'credentials_missing') {
        setFirmsStatusBanner({
          type: 'warning',
          text: result.message || 'FIRMS_MAP_KEY is unconfigured in backend environment (.env). Register at https://firms.modaps.eosdis.nasa.gov/api/map_key.',
        });
      } else if (result.status === 'rate_limited') {
        setFirmsStatusBanner({
          type: 'warning',
          text: result.message || 'NASA FIRMS API rate limit reached (HTTP 429). Please wait before querying again.',
        });
      } else if (result.status === 'cached') {
        setFirmsStatusBanner({
          type: 'warning',
          text: result.message || `NASA FIRMS upstream transient failure. Displaying ${result.detections_count} cached detections (Stale).`,
        });
        if (onRefreshData) {
          await onRefreshData();
        }
      } else if (result.status === 'error') {
        setFirmsStatusBanner({
          type: 'error',
          text: result.message || 'NASA FIRMS API query failed. Check upstream status or key validity.',
        });
      } else if (result.status === 'empty') {
        setFirmsStatusBanner({
          type: 'info',
          text: result.message || `No active satellite detections found across ${currentRegion.name} in this ${dayRange}-day lookback window (${selectedSource.replace('_NRT', '')}). Try expanding lookback days or testing another sensor.`,
        });
        if (onRefreshData) {
          await onRefreshData();
        }
      } else {
        setFirmsStatusBanner({
          type: 'success',
          text: `Retrieved ${result.detections_count} live satellite detections via NASA FIRMS (${result.source}).`,
        });
        if (onRefreshData) {
          await onRefreshData();
        }
      }
    } catch (err: any) {
      const errMsg = err.message || String(err);
      const is502 = errMsg.includes('502') || errMsg.includes('Bad Gateway');
      setFirmsStatusBanner({
        type: 'error',
        text: is502
          ? `Live FIRMS fetch failed: HTTP 502: Bad Gateway (Backend service or upstream gateway unreachable). Use Retry below.`
          : `Live FIRMS fetch failed: ${errMsg}`,
      });
    } finally {
      setIsFetchingFirms(false);
    }
  };

  // Plot Genuine Hotspots & Incidents on the Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !incidentLayerRef.current || !detectionLayerRef.current) return;

    const incidentGroup = incidentLayerRef.current;
    const detectionGroup = detectionLayerRef.current;

    incidentGroup.clearLayers();
    detectionGroup.clearLayers();

    // Map background click deselects active incident and detection
    const handleMapClick = (e: L.LeafletMouseEvent) => {
      const origTarget = e.originalEvent?.target as HTMLElement | null;
      if (
        origTarget &&
        (origTarget.closest('.rocket-floating-card') ||
          origTarget.closest('.rocket-docked-card') ||
          origTarget.closest('.rocket-map-controls') ||
          origTarget.closest('.rocket-aoi-dropdown-container') ||
          origTarget.closest('.custom-incident-marker') ||
          origTarget.closest('.leaflet-control'))
      ) {
        return;
      }
      onSelectIncident(null);
      onSelectDetection(null);
    };

    map.off('click');
    map.on('click', handleMapClick);

    // Plot Clustered Incidents
    if (showIncidentsLayer) {
      incidents.forEach((inc) => {
        const isSelected = selectedIncident?.id === inc.id;
        const statusClass =
          inc.verification.status === 'CORROBORATED'
            ? 'marker-corroborated'
            : inc.verification.status === 'NEEDS_REVIEW'
            ? 'marker-review'
            : 'marker-insufficient';

        const iconHtml = `
          <div class="marker-pin ${statusClass}" style="transform: ${isSelected ? 'scale(1.4)' : 'scale(1)'}">
            <div style="width: 7px; height: 7px; border-radius: 50%; background: #fff;"></div>
          </div>
        `;

        const customIcon = L.divIcon({
          html: iconHtml,
          className: 'custom-incident-marker',
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });

        const marker = L.marker([inc.latitude, inc.longitude], { icon: customIcon });

        marker.on('click', (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e);
          onSelectIncident(inc);
          onSelectDetection(inc.primary_detection || null);
        });

        incidentGroup.addLayer(marker);
      });
    }

    // Plot Individual Coordinate-Accurate NASA FIRMS Detections
    if (showDetectionsLayer) {
      detections.forEach((det) => {
        const isSelected = selectedDetection?.id === det.id;
        const radius = Math.min(9, Math.max(3.5, (det.frp || 1.0) / 10));
        const color =
          det.confidence === 'high'
            ? '#ef4444'
            : det.confidence === 'nominal'
            ? '#f97316'
            : '#9aa3ad';

        const circleMarker = L.circleMarker([det.latitude, det.longitude], {
          radius: isSelected ? radius + 3 : radius,
          fillColor: color,
          fillOpacity: 0.85,
          color: isSelected ? '#ffffff' : 'rgba(255,255,255,0.7)',
          weight: isSelected ? 2 : 0.85,
        });

        circleMarker.on('click', (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e);
          const matchingInc = incidents.find(
            (i) => i.id === det.id || i.detections.some((d) => d.id === det.id)
          );
          if (matchingInc) {
            onSelectIncident(matchingInc);
            onSelectDetection(det);
          } else {
            onSelectIncident(null);
            onSelectDetection(det);
          }
        });

        circleMarker.bindTooltip(
          `NASA FIRMS Hotspot: ${det.frp != null ? `${det.frp.toFixed(1)} MW` : 'Active'} (${det.confidence} conf, ${det.acq_time} UTC)`,
          { className: 'leaflet-dark-tooltip' }
        );

        detectionGroup.addLayer(circleMarker);
      });
    }
  }, [
    incidents,
    detections,
    selectedIncident,
    selectedDetection,
    showDetectionsLayer,
    showIncidentsLayer,
    onSelectIncident,
    onSelectDetection,
  ]);

  // Direct map camera focus target
  useEffect(() => {
    if (!mapFocusTarget || !mapInstanceRef.current) return;
    const { lat, lon, zoom = 9 } = mapFocusTarget;
    if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      const map = mapInstanceRef.current;
      map.invalidateSize();
      map.setView([lat, lon], Math.min(zoom, map.getMaxZoom()), { animate: true });
    }
  }, [mapFocusTarget]);

  // Center on selected incident when selection changes
  useEffect(() => {
    if (selectedIncident && mapInstanceRef.current) {
      mapInstanceRef.current.setView(
        [selectedIncident.latitude, selectedIncident.longitude],
        Math.max(7, mapInstanceRef.current.getZoom()),
        { animate: true }
      );
    }
  }, [selectedIncident]);

  const handleResetView = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(currentRegion.center as [number, number], currentRegion.default_zoom, {
        duration: 0.8,
      });
    }
  };

  return (
    <div className="rocket-map-container" style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* 1. Primary Header Toolbar */}
      <div className="rocket-map-header-bar">
        {/* Left Action Cluster: Prominent "Global Thermal Satellite" + Basemap Selector + Thermal Overlay Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Prominent Global Thermal Satellite Primary Action */}
          <button
            id="btn-global-thermal-satellite"
            type="button"
            className={`btn-global-satellite-primary ${showThermalImagery ? 'active' : ''}`}
            onClick={handleGlobalThermalSatelliteClick}
            title="Switch to full-map global view [20, 0] zoom 2 with genuine NASA EOSDIS satellite infrared/thermal imagery"
          >
            <Globe size={13} />
            <span>Global Thermal Satellite</span>
            <span
              style={{
                fontSize: '9px',
                background: showThermalImagery ? '#FFFFFF' : 'rgba(249, 115, 22, 0.25)',
                color: showThermalImagery ? '#EA580C' : '#FFA552',
                padding: '1px 5px',
                borderRadius: '3px',
                fontWeight: 700,
              }}
            >
              NASA GIBS
            </span>
          </button>

          {/* Restored Basemap Selector (Always Available & Switching Does Not Reset Thermal Settings) */}
          <div className="btn-group-toggle" role="group" aria-label="Basemap Selector">
            <button
              type="button"
              className={`btn-tool ${basemapView === 'dark_street' ? 'active-tool' : ''}`}
              onClick={() => setBasemapView('dark_street')}
              title="CARTO Dark Matter — Tactical dark street network"
            >
              <Moon size={11} />
              <span>Dark Street</span>
            </button>
            <button
              type="button"
              className={`btn-tool ${basemapView === 'satellite_imagery' ? 'active-tool' : ''}`}
              onClick={() => setBasemapView('satellite_imagery')}
              title="Esri World Imagery — High-resolution satellite orthoimagery"
            >
              <Globe size={11} />
              <span>Satellite</span>
            </button>
            <button
              type="button"
              className={`btn-tool ${basemapView === 'street_geography' ? 'active-tool' : ''}`}
              onClick={() => setBasemapView('street_geography')}
              title="CARTO Voyager — Geography and street topology"
            >
              <Compass size={11} />
              <span>Streets</span>
            </button>
          </div>

          {/* Separate Thermal Imagery Overlay Toggle & Opacity Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              className={`btn-thermal-toggle ${showThermalImagery ? 'active' : ''}`}
              onClick={() => setShowThermalImagery(!showThermalImagery)}
              title="Toggle NASA GIBS Thermal & Infrared Satellite Overlay"
            >
              <Layers size={11} color={showThermalImagery ? 'var(--accent-orange)' : 'var(--text-tertiary)'} />
              <span>Thermal Layer {showThermalImagery ? 'ON' : 'OFF'}</span>
            </button>

            {showThermalImagery && (
              <>
                {/* Opacity Slider */}
                <div className="thermal-opacity-control" title="Adjust Thermal Imagery Overlay Opacity">
                  <span>Opacity:</span>
                  <input
                    type="range"
                    min="0.15"
                    max="1.0"
                    step="0.05"
                    value={thermalOpacity}
                    onChange={(e) => setThermalOpacity(parseFloat(e.target.value))}
                  />
                  <span style={{ fontFamily: 'var(--font-mono)', minWidth: '28px', textAlign: 'right' }}>
                    {Math.round(thermalOpacity * 100)}%
                  </span>
                </div>

                {/* NASA GIBS Product Selector */}
                <select
                  className="select-filter-compact"
                  value={gibsProductKey}
                  onChange={(e) => {
                    setGibsProductKey(e.target.value as GibsThermalProduct);
                    setDateOutOfRangeWarning(null);
                  }}
                  title="NASA GIBS Satellite Infrared / Thermal Product"
                  style={{ fontSize: '11px', padding: '0.25rem 0.45rem', maxWidth: '245px' }}
                >
                  {Object.values(GIBS_THERMAL_PRODUCTS).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>

                {/* Latest Available vs. Historical Archive Selector */}
                <div className="btn-group-toggle" role="group" aria-label="Temporal Mode">
                  <button
                    type="button"
                    className={`btn-tool ${timeMode === 'latest' ? 'active-tool' : ''}`}
                    onClick={() => {
                      setTimeMode('latest');
                      setDateOutOfRangeWarning(null);
                    }}
                    title="Latest Available near-real-time global orbital composite (NASA EOSDIS)"
                    style={{ fontSize: '10.5px', padding: '0.2rem 0.5rem' }}
                  >
                    <span>Latest Available</span>
                    <span style={{ fontSize: '9px', color: timeMode === 'latest' ? 'var(--accent-orange)' : 'var(--text-tertiary)', marginLeft: '3px', fontFamily: 'var(--font-mono)' }}>
                      ({latestDateIso})
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`btn-tool ${timeMode === 'historical' ? 'active-tool' : ''}`}
                    onClick={() => setTimeMode('historical')}
                    title="Browse historical satellite archive with exact date selection"
                    style={{ fontSize: '10.5px', padding: '0.2rem 0.5rem' }}
                  >
                    <span>Historical</span>
                  </button>
                </div>

                {/* Historical Date Picker & Presets */}
                {timeMode === 'historical' && (
                  <div className="thermal-date-toolbar">
                    <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>Date:</span>
                    <input
                      type="date"
                      className="thermal-date-input"
                      value={historicalDate}
                      min={activeGibsConfig.minDate}
                      max={latestDateIso}
                      onChange={(e) => handleDateChange(e.target.value)}
                      title="Select historical satellite acquisition date"
                    />
                    {HISTORICAL_PRESETS.map((preset) => (
                      <button
                        key={preset.date}
                        type="button"
                        className={`thermal-preset-pill ${historicalDate === preset.date ? 'active' : ''}`}
                        onClick={() => handleDateChange(preset.date)}
                        title={`Load ${preset.label} satellite imagery`}
                      >
                        {preset.label.replace(' Wildfires', '').replace(' Fire', '')}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Quick AOI Dropdown */}
          {onRegionChange && (
            <AoiDropdown
              regions={regions}
              selectedRegionId={selectedRegionId}
              onRegionChange={onRegionChange}
              compact
            />
          )}

          {/* Sensor Selection & Lookback Days */}
          <select
            className="select-filter-compact"
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            title="Satellite Sensor Product"
            style={{ fontSize: '11px', padding: '0.25rem 0.45rem' }}
          >
            {supportedSources.map((src) => (
              <option key={src} value={src}>
                {src.replace('_NRT', '')}
              </option>
            ))}
          </select>

          <select
            className="select-filter-compact"
            value={dayRange}
            onChange={(e) => setDayRange(Number(e.target.value))}
            title="Observation Lookback Window"
            style={{ width: '65px', fontSize: '11px', padding: '0.25rem 0.35rem' }}
          >
            <option value={1}>1 Day</option>
            <option value={2}>2 Days</option>
            <option value={3}>3 Days</option>
            <option value={5}>5 Days</option>
          </select>

          <button
            className="btn-tool btn-accent"
            onClick={handleFetchLiveFirms}
            disabled={isFetchingFirms}
            title="Query official NASA FIRMS satellite fire detections"
            style={{ fontSize: '11px', padding: '0.25rem 0.6rem' }}
          >
            <Satellite size={11} className={isFetchingFirms ? 'animate-spin' : ''} />
            <span>{isFetchingFirms ? 'Querying...' : 'Fetch Live FIRMS'}</span>
          </button>

          {/* Independent Hotspot & Label Layer Visibility Toggles */}
          <div className="btn-group-toggle">
            <button
              className={`btn-tool ${showDetectionsLayer ? 'active-tool' : ''}`}
              onClick={() => setShowDetectionsLayer(!showDetectionsLayer)}
              title="Coordinate-accurate NASA FIRMS satellite fire detections"
              style={{ fontSize: '10.5px' }}
            >
              <Radio size={11} color="var(--accent-orange)" />
              <span>Hotspots ({detections.length})</span>
            </button>
            <button
              className={`btn-tool ${showIncidentsLayer ? 'active-tool' : ''}`}
              onClick={() => setShowIncidentsLayer(!showIncidentsLayer)}
              title="Toggle Clustered Incidents Layer"
              style={{ fontSize: '10.5px' }}
            >
              <MapPin size={11} color="var(--color-verified)" />
              <span>Clusters ({incidents.length})</span>
            </button>
            <button
              className={`btn-tool ${showSatelliteLabels ? 'active-tool' : ''}`}
              onClick={() => setShowSatelliteLabels(!showSatelliteLabels)}
              title="Toggle transparent CARTO political boundaries and city labels"
              style={{ fontSize: '10.5px' }}
            >
              <Layers size={10} color={showSatelliteLabels ? 'var(--accent-orange)' : 'var(--text-tertiary)'} />
              <span>Labels {showSatelliteLabels ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          <button
            className="btn-tool"
            onClick={handleResetView}
            title="Reset view to selected region extent"
            style={{ padding: '0.25rem 0.45rem' }}
          >
            <RotateCcw size={11} />
          </button>

          {/* ML Analysis Suite Compact Toggle Button */}
          <button
            id="btn-ml-analysis-toggle"
            type="button"
            className={`btn-tool ${showMLPanel ? 'active-tool' : ''}`}
            onClick={() => setShowMLPanel(!showMLPanel)}
            title="Open ML Analysis Panel (Thermal U-Net Segmentation & YOLOv8n Fire/Smoke Detection)"
            style={{
              fontSize: '11px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              backgroundColor: showMLPanel ? 'rgba(249, 115, 22, 0.22)' : 'rgba(31, 41, 55, 0.6)',
              borderColor: showMLPanel ? 'var(--accent-orange)' : 'rgba(249, 115, 22, 0.4)',
              color: showMLPanel ? '#FFA552' : '#F3F4F6',
              fontWeight: 600,
              padding: '0.25rem 0.55rem',
            }}
          >
            <Cpu size={12} color={showMLPanel ? 'var(--accent-orange)' : '#FB923C'} />
            <span>ML Analysis</span>
            <span
              style={{
                fontSize: '8.5px',
                background: 'rgba(249, 115, 22, 0.3)',
                color: '#FFA552',
                padding: '1px 4px',
                borderRadius: '3px',
                fontWeight: 700,
              }}
            >
              AI
            </span>
          </button>
        </div>
      </div>

      {/* 2. Date Out-of-Range Truthful Empty State Banner */}
      {dateOutOfRangeWarning && (
        <div className="thermal-empty-state-banner">
          <AlertCircle size={15} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, fontSize: '0.75rem', lineHeight: 1.35 }}>
            <strong>Imagery Unavailable:</strong> {dateOutOfRangeWarning}
          </div>
          <button
            onClick={() => {
              setTimeMode('latest');
              setDateOutOfRangeWarning(null);
            }}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.4)',
              borderRadius: '3px',
              color: '#fff',
              padding: '2px 6px',
              fontSize: '10.5px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Reset to Latest
          </button>
        </div>
      )}

      {/* 3. Status Banner for FIRMS API responses (if active) */}
      {firmsStatusBanner && (
        <div
          style={{
            position: 'absolute',
            top: '48px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            maxWidth: '600px',
            padding: '0.45rem 0.85rem',
            fontSize: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid',
            boxShadow: 'var(--shadow-panel)',
            backdropFilter: 'blur(8px)',
            background:
              firmsStatusBanner.type === 'success'
                ? 'rgba(16, 185, 129, 0.92)'
                : firmsStatusBanner.type === 'warning'
                ? 'rgba(245, 158, 11, 0.92)'
                : firmsStatusBanner.type === 'error'
                ? 'rgba(239, 68, 68, 0.92)'
                : 'rgba(14, 165, 233, 0.92)',
            borderColor: 'transparent',
            color: '#FFFFFF',
          }}
        >
          {firmsStatusBanner.type === 'success' && <CheckCircle2 size={13} />}
          {firmsStatusBanner.type === 'warning' && <AlertCircle size={13} />}
          {firmsStatusBanner.type === 'error' && <AlertCircle size={13} />}
          {firmsStatusBanner.type === 'info' && <Info size={13} />}
          <span>{firmsStatusBanner.text}</span>
          {(firmsStatusBanner.type === 'error' || firmsStatusBanner.type === 'warning') && (
            <button
              onClick={handleFetchLiveFirms}
              disabled={isFetchingFirms}
              title="Retry fetching NASA FIRMS satellite observations"
              style={{
                background: 'rgba(255, 255, 255, 0.22)',
                border: '1px solid rgba(255, 255, 255, 0.5)',
                borderRadius: '4px',
                color: '#FFFFFF',
                padding: '2px 8px',
                fontSize: '11px',
                cursor: 'pointer',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                marginLeft: 'auto',
                whiteSpace: 'nowrap',
              }}
            >
              <RotateCcw size={10} className={isFetchingFirms ? 'animate-spin' : ''} />
              <span>{isFetchingFirms ? 'Retrying...' : 'Retry'}</span>
            </button>
          )}
          <button
            onClick={() => setFirmsStatusBanner(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              marginLeft: (firmsStatusBanner.type === 'error' || firmsStatusBanner.type === 'warning') ? '6px' : 'auto',
              display: 'flex',
            }}
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* 4. Main Workspace Area: Pure Leaflet Map Container */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
        <div
          ref={mapContainerRef}
          className="rocket-leaflet-map"
          style={{
            width: '100%',
            height: '100%',
          }}
        />

        {/* 5. Floating Radiometric Telemetry Badge for Thermal Overlay */}
        {showThermalImagery && showTelemetryBadge && (
          <div className="thermal-satellite-badge">
            <div className="thermal-satellite-badge-title">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Satellite size={13} color="var(--accent-orange)" />
                <span>NASA EOSDIS GIBS — SATELLITE THERMAL OVERLAY</span>
              </div>
              <button
                onClick={() => setShowTelemetryBadge(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                }}
                title="Dismiss telemetry badge"
              >
                <X size={12} />
              </button>
            </div>

            <div className="thermal-satellite-badge-row">
              <span>Basemap (Base Layer):</span>
              <strong>
                {basemapView === 'satellite_imagery'
                  ? 'Esri World Imagery (High-Res Ortho)'
                  : basemapView === 'street_geography'
                  ? 'CARTO Voyager (Streets & Topology)'
                  : 'CARTO Dark Matter (Dark Tactical)'}
              </strong>
            </div>
            <div className="thermal-satellite-badge-row">
              <span>Thermal Satellite / Sensor:</span>
              <strong>{activeGibsConfig.platform}</strong>
            </div>
            <div className="thermal-satellite-badge-row">
              <span>Channel & Resolution:</span>
              <strong>{activeGibsConfig.spectrum} ({activeGibsConfig.resolution})</strong>
            </div>
            <div className="thermal-satellite-badge-row">
              <span>Observation Date:</span>
              <strong>
                {effectiveDate} ({timeMode === 'latest' ? 'Latest Daily Composite' : 'Historical Archive'})
              </strong>
            </div>
            <div className="thermal-satellite-badge-row">
              <span>Overlay Opacity:</span>
              <strong style={{ color: 'var(--accent-orange)' }}>{Math.round(thermalOpacity * 100)}% Blend</strong>
            </div>

            <div className="thermal-satellite-badge-disclaimer">
              <strong>Measurement:</strong> {activeGibsConfig.radiometricNote}
            </div>
          </div>
        )}

        {/* Re-open telemetry badge button if minimized */}
        {showThermalImagery && !showTelemetryBadge && (
          <button
            onClick={() => setShowTelemetryBadge(true)}
            className="btn-tool"
            style={{
              position: 'absolute',
              bottom: '24px',
              left: '16px',
              zIndex: 900,
              background: 'rgba(16, 18, 20, 0.9)',
              padding: '4px 8px',
              fontSize: '11px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            }}
            title="Open Satellite Radiometric Telemetry Badge"
          >
            <Info size={11} color="var(--accent-orange)" />
            <span>Thermal Overlay Metadata</span>
          </button>
        )}

        {/* Collapsible Symbology Legend */}
        <div className="rocket-legend-card">
          <div className="legend-header" onClick={() => setIsLegendOpen(!isLegendOpen)} style={{ cursor: 'pointer' }}>
            <span>Symbology & Provenance</span>
            <button
              style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', display: 'flex', padding: 0 }}
            >
              {isLegendOpen ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
            </button>
          </div>

          {isLegendOpen && (
            <div style={{ marginTop: '0.4rem' }}>
              <div className="legend-row">
                <span className="legend-circle" style={{ backgroundColor: '#ef4444' }} />
                <span>VIIRS High Confidence Hotspot</span>
              </div>
              <div className="legend-row">
                <span className="legend-circle" style={{ backgroundColor: '#f97316' }} />
                <span>VIIRS Nominal Confidence Hotspot</span>
              </div>
              <div className="legend-row">
                <span className="legend-circle" style={{ backgroundColor: '#9aa3ad' }} />
                <span>VIIRS Low Confidence Hotspot</span>
              </div>
              <div className="legend-row" style={{ marginTop: '3px' }}>
                <span className="legend-pin marker-corroborated" />
                <span>Corroborated Incident</span>
              </div>
              <div className="legend-row">
                <span className="legend-pin marker-review" />
                <span>Needs Review Incident</span>
              </div>
              <div className="legend-row">
                <span className="legend-pin marker-insufficient" />
                <span>Insufficient Evidence Incident</span>
              </div>

              <div
                style={{
                  marginTop: '6px',
                  paddingTop: '5px',
                  borderTop: '1px solid var(--border-subtle)',
                  fontSize: '0.625rem',
                  color: 'var(--text-tertiary)',
                  lineHeight: 1.3,
                }}
              >
                <div>
                  <strong>Data Mode:</strong> {currentMode}
                </div>
                <div>
                  <strong>Base Map:</strong>{' '}
                  {basemapView === 'satellite_imagery'
                    ? 'Esri High-Res World Imagery'
                    : basemapView === 'street_geography'
                    ? 'CARTO Voyager (Streets)'
                    : 'CARTO Dark Matter (Dark Tactical)'}
                </div>
                <div>
                  <strong>Thermal Overlay:</strong>{' '}
                  {showThermalImagery
                    ? `${activeGibsConfig.label} (${Math.round(thermalOpacity * 100)}% opacity)`
                    : 'Disabled (Base Map Only)'}
                </div>
                <div>
                  <strong>Fire Hotspots:</strong> NASA FIRMS Active Anomaly Observations
                </div>
                <div style={{ marginTop: '2px', color: 'var(--text-tertiary)' }}>
                  <strong>Navigation:</strong> Worldwide (All Continents) | Active Query: {currentRegion.name}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating ML Analysis Panel (U-Net Thermal Segmentation & YOLOv8n Detection) */}
      <MLAnalysisPanel isOpen={showMLPanel} onClose={() => setShowMLPanel(false)} />
    </div>
  );
};
