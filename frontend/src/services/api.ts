/**
 * Centralized API client for TerraShield AI.
 */

import type {
  AnalyticsSummary,
  DataMode,
  EvidenceRecord,
  FetchLiveFirmsRequest,
  FetchLiveFirmsResponse,
  FirmsRegionsResponse,
  HealthResponse,
  Incident,
  SatelliteDetection,
  SearchEvidenceResponse,
  VerificationReport,
  ThermalStatusResponse,
  ThermalAnalyzeResponse,
  FireDetectResponse,
} from '../types';

function resolveApiBase(): string {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl) {
    return '/api';
  }
  // When running in browser and deployed on a non-localhost host (such as onrender.com),
  // always use relative '/api' on the same deployed origin even if envUrl points to localhost.
  if (
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
  ) {
    if (envUrl.includes('localhost') || envUrl.includes('127.0.0.1')) {
      return '/api';
    }
  }
  return envUrl.replace(/\/+$/, '');
}

const API_BASE = resolveApiBase();

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorDetail = `HTTP ${res.status}: ${res.statusText}`;
    try {
      const errJson = await res.json();
      if (errJson.detail) {
        errorDetail = errJson.detail;
      }
    } catch {
      // fallback to status text
    }
    throw new Error(errorDetail);
  }
  return res.json() as Promise<T>;
}

export const api = {
  async getHealth(): Promise<HealthResponse> {
    const res = await fetch(`${API_BASE}/health`);
    return handleResponse<HealthResponse>(res);
  },

  async getDetections(limit = 800, minConfidence?: string, daynight?: string): Promise<SatelliteDetection[]> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (minConfidence) params.append('min_confidence', minConfidence);
    if (daynight) params.append('daynight', daynight);

    const res = await fetch(`${API_BASE}/detections?${params.toString()}`);
    return handleResponse<SatelliteDetection[]>(res);
  },

  async getIncidents(statusFilter?: string, region?: string): Promise<Incident[]> {
    const params = new URLSearchParams();
    if (statusFilter) params.append('status_filter', statusFilter);
    if (region) params.append('region', region);

    const res = await fetch(`${API_BASE}/incidents?${params.toString()}`);
    return handleResponse<Incident[]>(res);
  },

  async getIncident(id: string): Promise<Incident> {
    const res = await fetch(`${API_BASE}/incidents/${id}`);
    return handleResponse<Incident>(res);
  },

  async verifyIncident(id: string): Promise<VerificationReport> {
    const res = await fetch(`${API_BASE}/incidents/${id}/verify`, {
      method: 'POST',
    });
    return handleResponse<VerificationReport>(res);
  },

  async getEvidence(sourceType?: string, search?: string, limit = 100): Promise<EvidenceRecord[]> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (sourceType) params.append('source_type', sourceType);
    if (search) params.append('search', search);

    const res = await fetch(`${API_BASE}/evidence?${params.toString()}`);
    return handleResponse<EvidenceRecord[]>(res);
  },

  async getEvidenceExtract(evidenceId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/evidence/${evidenceId}/extract`);
    return handleResponse<any>(res);
  },

  async searchTinyFishEvidence(payload: {
    incident_id?: string;
    query?: string;
    location?: string;
    target_date?: string;
    max_results?: number;
  }): Promise<SearchEvidenceResponse> {
    const res = await fetch(`${API_BASE}/evidence/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<SearchEvidenceResponse>(res);
  },

  async searchEvidence(payload: {
    incident_id?: string;
    query?: string;
    location?: string;
    target_date?: string;
    max_results?: number;
  }): Promise<SearchEvidenceResponse> {
    return this.searchTinyFishEvidence(payload);
  },

  async getAnalytics(): Promise<AnalyticsSummary> {
    const res = await fetch(`${API_BASE}/analytics/summary`);
    return handleResponse<AnalyticsSummary>(res);
  },

  async switchMode(mode: DataMode): Promise<{ status: string; mode: DataMode; message: string; last_refresh: string }> {
    const res = await fetch(`${API_BASE}/mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    return handleResponse(res);
  },

  async getFirmsRegions(): Promise<FirmsRegionsResponse> {
    const res = await fetch(`${API_BASE}/firms/regions`);
    return handleResponse<FirmsRegionsResponse>(res);
  },

  async fetchLiveFirms(payload: FetchLiveFirmsRequest): Promise<FetchLiveFirmsResponse> {
    const res = await fetch(`${API_BASE}/firms/fetch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<FetchLiveFirmsResponse>(res);
  },

  async getHistoricalIncidents(hazardType?: string, region?: string, search?: string, scope?: string): Promise<any[]> {
    const params = new URLSearchParams();
    if (hazardType && hazardType !== 'ALL') params.append('hazard_type', hazardType);
    if (region) params.append('region', region);
    if (search) params.append('search', search);
    if (scope) params.append('scope', scope);

    const res = await fetch(`${API_BASE}/history/incidents?${params.toString()}`);
    return handleResponse<any[]>(res);
  },

  async getHistoricalIncident(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/history/incidents/${id}`);
    return handleResponse<any>(res);
  },

  async getIncidentDossier(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/incidents/${id}/dossier`);
    return handleResponse<any>(res);
  },

  async generateIncidentDossier(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/incidents/${id}/dossier/generate`, {
      method: 'POST',
    });
    return handleResponse<any>(res);
  },

  async getIndianDisasterDemo(): Promise<any> {
    const res = await fetch(`${API_BASE}/demo/indian-disaster`);
    return handleResponse<any>(res);
  },

  async getFloodAlerts(region = 'INDIA_ALL', severity?: string): Promise<any> {
    const params = new URLSearchParams({ region });
    if (severity) params.append('severity', severity);
    const res = await fetch(`${API_BASE}/flood/alerts?${params.toString()}`);
    return handleResponse<any>(res);
  },

  async getGroqStatus(): Promise<any> {
    const res = await fetch(`${API_BASE}/groq/status`);
    return handleResponse<any>(res);
  },

  async investigateIncident(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/incidents/${id}/investigate`, {
      method: 'POST',
    });
    return handleResponse<any>(res);
  },

  async getThermalCapabilities(): Promise<any> {
    const res = await fetch(`${API_BASE}/thermal/capabilities`);
    return handleResponse<any>(res);
  },

  async getThermalStatus(): Promise<ThermalStatusResponse> {
    const res = await fetch(`${API_BASE}/thermal/status`);
    return handleResponse<ThermalStatusResponse>(res);
  },

  async analyzeThermalImage(params: {
    image_source?: string;
    confidence_threshold?: number;
    model_name?: string;
  }): Promise<ThermalAnalyzeResponse> {
    const res = await fetch(`${API_BASE}/thermal/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return handleResponse<ThermalAnalyzeResponse>(res);
  },

  async detectFireSmoke(params: {
    image_source?: string;
    confidence_threshold?: number;
  }): Promise<FireDetectResponse> {
    const res = await fetch(`${API_BASE}/fire/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return handleResponse<FireDetectResponse>(res);
  },
};

