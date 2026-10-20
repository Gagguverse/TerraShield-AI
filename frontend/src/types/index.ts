/**
 * TypeScript types for TerraShield AI.
 */

export type DataMode = 'HISTORICAL_SAMPLE' | 'LIVE' | 'DEMO' | 'CACHED';

export type VerificationStatusType = 'CORROBORATED' | 'NEEDS_REVIEW' | 'INSUFFICIENT_EVIDENCE';

export type SourceType =
  | 'OFFICIAL_AGENCY'
  | 'EMERGENCY_DISPATCH'
  | 'NEWS_MEDIA'
  | 'CITIZEN_REPORT'
  | 'SATELLITE_HOTSPOT'
  | 'UNVERIFIED';

export type EvidenceStatus = 'ACTIVE' | 'PARTIAL' | 'FAILED' | 'CREDENTIALS_MISSING';

export interface SatelliteDetection {
  id: string;
  latitude: float;
  longitude: float;
  bright_ti4?: number;
  bright_ti5?: number;
  frp?: number;
  scan?: number;
  track?: number;
  acq_date: string;
  acq_time: string;
  timestamp: string;
  satellite: string;
  instrument: string;
  confidence: string;
  confidence_score: number;
  daynight: string;
  data_mode: DataMode;
}

// Helper alias for TypeScript
type float = number;

export interface EvidenceRecord {
  id: string;
  source_name: string;
  source_type: SourceType;
  title: string;
  url: string;
  snippet: string;
  full_text?: string;
  extracted_location?: string;
  latitude?: number;
  longitude?: number;
  event_date?: string;
  publication_date?: string;
  fetched_at: string;
  is_official: boolean;
  relevance_score: number;
  relevance_explanation: string;
  domain?: string;
  fetch_status: EvidenceStatus;
  search_query?: string;
  relevance_label?: 'Relevant' | 'Partial match' | 'Needs review' | string;
  finding?: string;
  supports_aspect?: string;
  evidence_role?: string;
  fetch_error?: string;
  provenance_origin?: 'CURRENT_SESSION' | 'PREVIOUSLY_SAVED' | 'HISTORICAL_ARCHIVE' | string;
}

export interface ResearchAudit {
  query?: string;
  queries_submitted?: string[];
  operations_completed?: string[];
  sources_discovered?: number;
  pages_fetched?: number;
  failed_requests?: { url: string; reason: string }[];
  inaccessible_pages?: string[];
  retrieval_timestamps?: string;
  retrieval_timestamp?: string;
  [key: string]: any;
}

export interface VerificationCondition {
  code: string;
  name: string;
  met: boolean;
  details: string;
}

export interface VerificationReport {
  status: VerificationStatusType;
  rationale: string;
  uncertainty_score: number;
  confidence_score: number;
  geographic_distance_km?: number;
  time_delta_hours?: number;
  conditions_met: VerificationCondition[];
  conditions_failed: VerificationCondition[];
  missing_evidence: string[];
  independent_sources_count: number;
  has_official_advisory: boolean;
  evaluated_at: string;
}

export interface Incident {
  id: string;
  name: string;
  region: string;
  latitude: number;
  longitude: number;
  first_detected: string;
  last_detected: string;
  detection_count: number;
  max_frp?: number;
  max_brightness?: number;
  primary_detection?: SatelliteDetection;
  detections: SatelliteDetection[];
  evidence: EvidenceRecord[];
  verification: VerificationReport;
  data_mode: DataMode;
}

export interface AnalyticsSummary {
  total_detections: number;
  total_incidents: number;
  total_evidence: number;
  corroborated_count: number;
  needs_review_count: number;
  insufficient_evidence_count: number;
  average_uncertainty: number;
  detections_by_day: { date: string; count: number }[];
  confidence_distribution: Record<string, number>;
  status_distribution: Record<string, number>;
  source_type_distribution: Record<string, number>;
  data_mode: DataMode;
  last_refresh: string;
  dataset_info: Record<string, any>;
}

export interface HealthResponse {
  status: string;
  app_name: string;
  version: string;
  current_mode: DataMode;
  tinyfish_configured: boolean;
  firms_configured: boolean;
  carto_configured?: boolean;
  carto_api_key?: string;
  total_detections: number;
  total_incidents: number;
  last_refresh: string;
  firms_last_sync?: string;
  firms_last_region?: string;
  firms_last_source?: string;
}

export interface SearchEvidenceResponse {
  status: string;
  query: string;
  results_count: number;
  evidence_records: EvidenceRecord[];
  message?: string;
  tinyfish_configured: boolean;
}

export interface FirmsRegion {
  id: string;
  name: string;
  country?: string;
  bbox: string;
  center: [number, number];
  default_zoom: number;
}

export interface FirmsRegionsResponse {
  regions: FirmsRegion[];
  default_region?: string;
  supported_sources: string[];
  firms_configured: boolean;
  carto_configured?: boolean;
}

export interface FetchLiveFirmsRequest {
  region: string;
  source: string;
  day_range: number;
}

export interface FetchLiveFirmsResponse {
  status: string;
  message: string;
  detections_count: number;
  incidents_count: number;
  region: string;
  source: string;
  firms_configured: boolean;
  is_cached?: boolean;
  cached_at?: string;
}

export type HazardType = 'WILDFIRE' | 'FLOOD';

export interface TimelineMilestone {
  date_time: string;
  milestone: string;
  source: string;
  url?: string;
}

export interface ImpactSummary {
  casualties?: string;
  displaced?: string;
  infrastructure?: string;
  environmental?: string;
  economic?: string;
  [key: string]: any;
}

export interface GroqSynthesizedReport {
  executive_summary?: string;
  geographic_scope?: string;
  root_causes?: string;
  chronological_development?: string;
  impact_and_response?: string;
  corroboration_assessment?: string;
  uncertainty_and_gaps?: string;
  contributing_factors?: string[];
  event_narrative?: string;
  timeline_milestones?: any[];
  impact_assessment?: Record<string, string>;
  conflicting_claims?: string[];
  evidence_gaps?: string[];
  citations?: { claim?: string; source_title?: string; url?: string }[];
  why_this_conclusion?: string | { claim: string; supporting_sources: string[]; rationale: string }[];
  [key: string]: any;
}

export interface HistoricalIncident {
  id: string;
  name: string;
  hazard_type: HazardType;
  region: string;
  country: string;
  state_province?: string;
  district?: string;
  locality?: string;
  latitude: number;
  longitude: number;
  event_date: string;
  event_time?: string;
  first_detected: string;
  last_detected: string;
  detection_count: number;
  severity: string;
  data_mode: string;
  river_basin?: string;
  hydrologic_metrics?: Record<string, any>;
  fire_metrics?: Record<string, any>;
  impact_summary?: ImpactSummary;
  timeline?: TimelineMilestone[];
  evidence?: EvidenceRecord[];
  precomputed_report?: GroqSynthesizedReport;
}

export interface IncidentDossierResponse {
  status: string;
  incident: HistoricalIncident | Incident;
  hazard_type: HazardType;
  timeline: TimelineMilestone[];
  impact_summary: ImpactSummary;
  hydrologic_metrics?: Record<string, any>;
  fire_metrics?: Record<string, any>;
  evidence: EvidenceRecord[];
  research_audit?: ResearchAudit;
  groq_report?: GroqSynthesizedReport;
  groq_configured: boolean;
  model_id?: string;
}

export interface GroqStatusResponse {
  configured: boolean;
  status: string;
  message: string;
  configured_model: string;
  model_verified?: boolean;
  available_models: string[];
}

export interface ThermalStatusResponse {
  sample_available: boolean;
  sample_image_url: string;
  sample_metadata: Record<string, any>;
  live_sensor_connected: boolean;
  live_sensor_requirements: string;
  ml_model: {
    name: string | null;
    version: string | null;
    architecture: string;
    status: string;
    checkpoint_path: string | null;
    training_dataset: string | null;
    supported_classes: string[];
    message: string;
  };
}

export interface ThermalDetection {
  detection_id: string;
  label: string;
  confidence: number;
  box: [number, number, number, number];
  peak_temp_k: number;
  peak_temp_c: number;
  category: string;
}

export interface ThermalAnalyzeResponse {
  model_name: string | null;
  model_version: string | null;
  model_status: string;
  status: string;
  inference_latency_ms: number;
  confidence_threshold: number;
  detections_count: number;
  detections: ThermalDetection[];
  hot_pixel_fraction?: number | null;
  hot_pixel_count?: number | null;
  mask_url?: string | null;
  val_dice?: number | null;
  val_iou?: number | null;
  image_dimensions?: string | null;
  sensor_calibration?: string | null;
  disclaimer: string;
}

export interface FireDetection {
  label: string;
  confidence: number;
  box: [number, number, number, number];
}

export interface FireDetectResponse {
  model_name: string | null;
  model_version: string | null;
  model_status: string;
  status: string;
  inference_latency_ms: number;
  confidence_threshold: number;
  detection_count: number;
  detections: FireDetection[];
  class_names: Record<string, string>;
  annotated_image_url?: string | null;
  disclaimer: string;
}

