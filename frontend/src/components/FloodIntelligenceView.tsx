import React, { useState, useEffect } from 'react';
import {
  Droplets,
  Flame,
  Home,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Calendar,
  MapPin,
  Activity,
  Layers,
  Sparkles,
  ArrowRight,
  ChevronRight,
  Database,
  Search,
  Info,
} from 'lucide-react';
import { api } from '../services/api';
import type { HealthResponse, HistoricalIncident } from '../types';

interface FloodIntelligenceViewProps {
  onNavigateHome: () => void;
  onNavigateFire: () => void;
  onOpenReport: (incidentId: string) => void;
  onOpenHistory?: () => void;
  onFocusMap?: (lat: number, lon: number, name: string) => void;
  health: HealthResponse | null;
}

interface FloodAlertsResponse {
  status: string;
  message: string;
  region: string;
  observations_count: number;
  observations: any[];
  last_sync: string;
}

export const FloodIntelligenceView: React.FC<FloodIntelligenceViewProps> = ({
  onNavigateHome,
  onNavigateFire,
  onOpenReport,
  onOpenHistory: _onOpenHistory,
  onFocusMap,
  health: _health,
}) => {
  const [floodIncidents, setFloodIncidents] = useState<HistoricalIncident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<HistoricalIncident | null>(null);
  const [floodAlerts, setFloodAlerts] = useState<FloodAlertsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [stateFilter, setStateFilter] = useState<string>('ALL');
  const [investigatingId, setInvestigatingId] = useState<string | null>(null);
  const [investigationMessage, setInvestigationMessage] = useState<string | null>(null);

  // Load verified Indian flood incidents and live hydrologic alerts
  const loadFloodData = async () => {
    try {
      setRefreshing(true);
      const [incidentsRes, alertsRes] = await Promise.all([
        api.getHistoricalIncidents('FLOOD', undefined, undefined, 'INDIA'),
        api.getFloodAlerts('INDIA_ALL'),
      ]);

      setFloodIncidents(incidentsRes);
      setFloodAlerts(alertsRes);

      if (incidentsRes.length > 0) {
        setSelectedIncident((prev) => {
          if (!prev) return incidentsRes[0];
          const found = incidentsRes.find((i) => i.id === prev.id);
          return found || incidentsRes[0];
        });
      }
    } catch (err) {
      console.warn('Failed to load flood intelligence data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadFloodData();
  }, []);

  const handleInvestigate = async (incidentId: string) => {
    setInvestigatingId(incidentId);
    setInvestigationMessage('Querying official flood bulletins (NDMA, KSDMA, CWC) and running Groq Cloud synthesis...');
    try {
      const res = await api.investigateIncident(incidentId);
      if (res.status === 'success') {
        setInvestigationMessage(`Investigation completed: ${res.report?.executive_summary ? 'Dossier synthesized.' : 'Evidence verified.'}`);
        await loadFloodData();
      } else {
        setInvestigationMessage(`Status: ${res.message || 'Complete'}`);
      }
    } catch (err: any) {
      setInvestigationMessage(`Investigation note: ${err.message || 'Service offline'}`);
    } finally {
      setInvestigatingId(null);
    }
  };

  const filteredIncidents = floodIncidents.filter((inc) => {
    const matchesSearch =
      !searchQuery ||
      inc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.region.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.locality?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesState =
      stateFilter === 'ALL' ||
      inc.state_province?.toLowerCase() === stateFilter.toLowerCase() ||
      inc.region?.toLowerCase().includes(stateFilter.toLowerCase());

    return matchesSearch && matchesState;
  });

  return (
    <div className="flood-view-root">
      {/* ── Top Command Bar ── */}
      <div className="flood-view-header">
        <div className="flood-header-brand">
          <div className="flood-header-icon">
            <Droplets size={20} />
          </div>
          <div>
            <div className="flood-header-title-row">
              <h1 className="flood-header-title">Flood Intelligence Dashboard</h1>
              <span className="flood-badge-live">HYDROLOGIC MONITORING</span>
              <span className="flood-badge-scope">INDIA FIRST 🇮🇳</span>
            </div>
            <p className="flood-header-subtitle">
              Central Water Commission (CWC) river gauges, IMD precipitation telemetry, and verified historical flood inundation dossiers.
            </p>
          </div>
        </div>

        <div className="flood-header-actions">
          <button
            className="btn-flood-hazard-switch"
            onClick={onNavigateFire}
            title="Switch to Wildfire Intelligence Dashboard"
            id="btn-switch-to-fire"
          >
            <Flame size={14} color="var(--accent-orange)" />
            <span>Fire Dashboard</span>
            <ChevronRight size={13} />
          </button>

          <button
            className="btn-flood-action"
            onClick={onNavigateHome}
            title="Return to TerraShield Homepage"
            id="btn-flood-home"
          >
            <Home size={14} />
            <span>Home</span>
          </button>

          <button
            className="btn-flood-action"
            onClick={loadFloodData}
            disabled={refreshing}
            title="Refresh hydrologic data feeds"
            id="btn-flood-refresh"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? 'Syncing...' : 'Sync Feeds'}</span>
          </button>
        </div>
      </div>

      {/* ── Operational Telemetry Metric Cards ── */}
      <div className="flood-telemetry-grid">
        {/* Metric 1: Live CWC River Basin Status */}
        <div className="flood-metric-card">
          <div className="flood-metric-header">
            <span className="flood-metric-label">LIVE HYDROLOGIC MONITORING</span>
            <Activity size={14} className="flood-cyan-text" />
          </div>
          <div className="flood-metric-value">
            {floodAlerts?.status === 'empty' ? 'Nominal / Safe' : 'Monitoring Active'}
          </div>
          <div className="flood-metric-detail">
            {floodAlerts?.message || 'No critical embankment breaches in current observation window.'}
          </div>
          <div className="flood-metric-footer">
            <span>Source: CWC Real-Time Gauges</span>
            <span className="tabular-nums">
              {floodAlerts?.last_sync ? new Date(floodAlerts.last_sync).toLocaleTimeString() : 'Live'}
            </span>
          </div>
        </div>

        {/* Metric 2: Verified Disaster Archive */}
        <div className="flood-metric-card">
          <div className="flood-metric-header">
            <span className="flood-metric-label">VERIFIED INDIAN FLOOD INCIDENTS</span>
            <ShieldCheck size={14} color="var(--color-verified)" />
          </div>
          <div className="flood-metric-value">{floodIncidents.length} Verified Disasters</div>
          <div className="flood-metric-detail">
            Curated ground-truth events with multi-agency situation reports (Wayanad, Chamoli, Assam, Kerala).
          </div>
          <div className="flood-metric-footer">
            <span>Primary Sources: NDMA, KSDMA, IMD</span>
            <span>Historical Ground Truth</span>
          </div>
        </div>

        {/* Metric 3: Monitored Basins */}
        <div className="flood-metric-card">
          <div className="flood-metric-header">
            <span className="flood-metric-label">PRIORITY RIVER BASINS</span>
            <Database size={14} className="flood-cyan-text" />
          </div>
          <div className="flood-metric-value">4 Monitored Basins</div>
          <div className="flood-metric-detail">
            Chaliyar (Wayanad), Rishiganga / Dhauliganga, Brahmaputra / Barak, Periyar / Pamba.
          </div>
          <div className="flood-metric-footer">
            <span>Geographic Centroid: India</span>
            <span>Hydro-Meteorological Network</span>
          </div>
        </div>

        {/* Metric 4: Satellite Inundation Layer Status (Honest Telemetry) */}
        <div className="flood-metric-card">
          <div className="flood-metric-header">
            <span className="flood-metric-label">SATELLITE INUNDATION STATUS</span>
            <Layers size={14} color="var(--text-tertiary)" />
          </div>
          <div className="flood-metric-value" style={{ fontSize: '1.1rem', color: '#38bdf8' }}>
            Sentinel-1 SAR Radar
          </div>
          <div className="flood-metric-detail">
            Synthetic Aperture Radar water extent processing in roadmap. Ground hydrologic verification active.
          </div>
          <div className="flood-metric-footer">
            <span className="flood-tag-roadmap">ROADMAP INGESTION</span>
            <span>Zero Fake Pixel Counts</span>
          </div>
        </div>
      </div>

      {/* ── Main Two-Column View ── */}
      <div className="flood-main-container">
        {/* Left Column: Flood Incidents Queue */}
        <div className="flood-queue-column">
          <div className="flood-queue-header">
            <div className="flood-queue-title-row">
              <h2 className="flood-queue-title">Verified Flood Disasters</h2>
              <span className="flood-queue-count">{filteredIncidents.length}</span>
            </div>

            {/* Search and Filters */}
            <div className="flood-search-bar">
              <Search size={13} color="var(--text-tertiary)" />
              <input
                type="text"
                placeholder="Search by disaster, state, or river..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flood-search-input"
              />
            </div>

            <div className="flood-filter-pills">
              {['ALL', 'Kerala', 'Uttarakhand', 'Assam'].map((st) => (
                <button
                  key={st}
                  className={`flood-filter-btn ${stateFilter === st ? 'active' : ''}`}
                  onClick={() => setStateFilter(st)}
                >
                  {st === 'ALL' ? 'All India' : st}
                </button>
              ))}
            </div>
          </div>

          <div className="flood-incident-list">
            {loading ? (
              <div className="flood-empty-state">
                <RefreshCw size={20} className="animate-spin flood-cyan-text" />
                <p>Loading verified flood incidents...</p>
              </div>
            ) : filteredIncidents.length === 0 ? (
              <div className="flood-empty-state">
                <AlertTriangle size={20} color="var(--accent-amber)" />
                <p>No flood incidents found matching current filters.</p>
              </div>
            ) : (
              filteredIncidents.map((incident) => {
                const isSelected = selectedIncident?.id === incident.id;
                const metrics = incident.hydrologic_metrics;

                return (
                  <div
                    key={incident.id}
                    className={`flood-incident-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedIncident(incident)}
                  >
                    <div className="flood-card-header">
                      <div className="flood-card-title-group">
                        <span className="flood-card-id">{incident.id}</span>
                        <h3 className="flood-card-title">{incident.name}</h3>
                      </div>
                      <span className="flood-severity-pill">{incident.severity || 'MAJOR'}</span>
                    </div>

                    <div className="flood-card-meta">
                      <span className="flood-meta-item">
                        <MapPin size={11} />
                        {incident.region}
                      </span>
                      <span className="flood-meta-item">
                        <Calendar size={11} />
                        {incident.event_date || 'Historical'}
                      </span>
                    </div>

                    {incident.river_basin && (
                      <div className="flood-basin-tag">
                        <span>River Basin:</span> {incident.river_basin}
                      </div>
                    )}

                    {/* Sourced Metrics Chips */}
                    {metrics && (
                      <div className="flood-metrics-row">
                        {metrics.rainfall_48h_mm && (
                          <div className="flood-metric-chip">
                            <span className="chip-label">48h Rain:</span>
                            <span className="chip-value">{metrics.rainfall_48h_mm} mm</span>
                          </div>
                        )}
                        {metrics.inundation_area_sqkm && (
                          <div className="flood-metric-chip">
                            <span className="chip-label">Inundation:</span>
                            <span className="chip-value">{metrics.inundation_area_sqkm} km²</span>
                          </div>
                        )}
                        {metrics.debris_runout_km && (
                          <div className="flood-metric-chip">
                            <span className="chip-label">Debris Runout:</span>
                            <span className="chip-value">{metrics.debris_runout_km} km</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flood-card-actions">
                      <button
                        className="btn-flood-view-dossier"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenReport(incident.id);
                        }}
                        title="Open full AI-synthesized intelligence dossier"
                      >
                        <Sparkles size={12} />
                        <span>Open Intelligence Dossier</span>
                        <ArrowRight size={11} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Selected Incident Deep Dive & Dossier */}
        <div className="flood-detail-column">
          {selectedIncident ? (
            <div className="flood-detail-card">
              {/* Header */}
              <div className="flood-detail-header">
                <div>
                  <div className="flood-detail-eyebrow">
                    <span>{selectedIncident.id}</span>
                    <span>•</span>
                    <span>{selectedIncident.country || 'India'}</span>
                    <span>•</span>
                    <span className="flood-cyan-text">{selectedIncident.hazard_type}</span>
                  </div>
                  <h2 className="flood-detail-title">{selectedIncident.name}</h2>
                  <div className="flood-detail-location">
                    <MapPin size={13} className="flood-cyan-text" />
                    <span>{selectedIncident.locality ? `${selectedIncident.locality}, ` : ''}{selectedIncident.region}</span>
                    <span className="tabular-nums" style={{ color: 'var(--text-tertiary)', fontSize: '11px', marginLeft: '0.4rem' }}>
                      ({selectedIncident.latitude.toFixed(4)}°N, {selectedIncident.longitude.toFixed(4)}°E)
                    </span>
                  </div>
                </div>

                <div className="flood-detail-header-actions">
                  {onFocusMap && (
                    <button
                      className="btn-flood-investigate"
                      onClick={() => onFocusMap(selectedIncident.latitude, selectedIncident.longitude, selectedIncident.name)}
                      title="Focus on incident location on map"
                      id="btn-flood-focus-map"
                    >
                      <MapPin size={13} className="flood-cyan-text" />
                      <span>Focus on Map</span>
                    </button>
                  )}

                  <button
                    className="btn-flood-dossier-primary"
                    onClick={() => onOpenReport(selectedIncident.id)}
                    id="btn-open-dossier-primary"
                  >
                    <Sparkles size={14} />
                    <span>Open Full AI Dossier</span>
                  </button>

                  <button
                    className="btn-flood-investigate"
                    onClick={() => handleInvestigate(selectedIncident.id)}
                    disabled={investigatingId === selectedIncident.id}
                    id="btn-flood-investigate"
                  >
                    <RefreshCw size={13} className={investigatingId === selectedIncident.id ? 'animate-spin' : ''} />
                    <span>{investigatingId === selectedIncident.id ? 'Investigating...' : 'Run Investigation'}</span>
                  </button>
                </div>
              </div>

              {/* Status / Notice if investigating */}
              {investigationMessage && (
                <div className="flood-investigation-banner">
                  <Info size={14} className="flood-cyan-text" />
                  <span>{investigationMessage}</span>
                </div>
              )}

              {/* Verified Impact Summary */}
              {selectedIncident.impact_summary && (
                <div className="flood-section-box">
                  <h3 className="flood-section-heading">Verified Human & Infrastructure Impact</h3>
                  <div className="flood-impact-grid">
                    <div className="flood-impact-item">
                      <span className="impact-label">Casualties / Missing:</span>
                      <span className="impact-val danger">{selectedIncident.impact_summary.casualties || 'Documented in situation reports'}</span>
                    </div>
                    <div className="flood-impact-item">
                      <span className="impact-label">Displaced Population:</span>
                      <span className="impact-val warning">{selectedIncident.impact_summary.displaced || 'Relief camps deployed'}</span>
                    </div>
                    <div className="flood-impact-item full-width">
                      <span className="impact-label">Infrastructure Damaged:</span>
                      <span className="impact-val">{selectedIncident.impact_summary.infrastructure || 'Bridges, road networks, and schools impacted.'}</span>
                    </div>
                    {selectedIncident.impact_summary.environmental && (
                      <div className="flood-impact-item full-width">
                        <span className="impact-label">Environmental Impact:</span>
                        <span className="impact-val">{selectedIncident.impact_summary.environmental}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Hydrologic AWS Telemetry */}
              {selectedIncident.hydrologic_metrics && (
                <div className="flood-section-box">
                  <h3 className="flood-section-heading">Hydrologic & Meteorological Telemetry</h3>
                  <div className="flood-hydro-grid">
                    <div className="hydro-stat-box">
                      <span className="hydro-label">48-Hour Precipitation</span>
                      <span className="hydro-value">{selectedIncident.hydrologic_metrics.rainfall_48h_mm} mm</span>
                      <span className="hydro-sub">{selectedIncident.hydrologic_metrics.station || 'IMD Station'}</span>
                    </div>
                    <div className="hydro-stat-box">
                      <span className="hydro-label">Monsoon Deviation</span>
                      <span className="hydro-value flood-cyan-text">{selectedIncident.hydrologic_metrics.normal_monsoon_pct || 'Excess'}</span>
                      <span className="hydro-sub">Compared to historical normal</span>
                    </div>
                    <div className="hydro-stat-box">
                      <span className="hydro-label">Channelized Runout</span>
                      <span className="hydro-value">{selectedIncident.hydrologic_metrics.debris_runout_km || '—'} km</span>
                      <span className="hydro-sub">Debris flow track</span>
                    </div>
                    <div className="hydro-stat-box">
                      <span className="hydro-label">Inundation Extent</span>
                      <span className="hydro-value">{selectedIncident.hydrologic_metrics.inundation_area_sqkm || '—'} km²</span>
                      <span className="hydro-sub">Submerged terrain footprint</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Timeline of Official Bulletins */}
              {selectedIncident.timeline && selectedIncident.timeline.length > 0 && (
                <div className="flood-section-box">
                  <h3 className="flood-section-heading">Chronological Timeline of Official Bulletins</h3>
                  <div className="flood-timeline-list">
                    {selectedIncident.timeline.map((item, idx) => (
                      <div key={idx} className="flood-timeline-item">
                        <div className="timeline-dot" />
                        <div className="timeline-content">
                          <div className="timeline-header">
                            <span className="timeline-date">{item.date_time}</span>
                            <span className="timeline-source">{item.source}</span>
                          </div>
                          <p className="timeline-text">{item.milestone}</p>
                          {item.url && (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="timeline-link"
                            >
                              <span>Official bulletin link</span>
                              <ExternalLink size={10} />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Primary Evidence Sources */}
              {selectedIncident.evidence && selectedIncident.evidence.length > 0 && (
                <div className="flood-section-box">
                  <h3 className="flood-section-heading">Primary Sourced Evidence ({selectedIncident.evidence.length})</h3>
                  <div className="flood-evidence-list">
                    {selectedIncident.evidence.map((ev: any) => (
                      <div key={ev.id} className="flood-evidence-item">
                        <div className="evidence-header">
                          <span className="evidence-agency">{ev.source_name}</span>
                          {ev.is_official && <span className="evidence-official-tag">OFFICIAL REGULATORY</span>}
                        </div>
                        <div className="evidence-title">{ev.title}</div>
                        {ev.snippet && <p className="evidence-snippet">"{ev.snippet}"</p>}
                        {ev.url && (
                          <a
                            href={ev.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="evidence-url"
                          >
                            <span>{ev.url}</span>
                            <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flood-detail-empty">
              <Droplets size={36} className="flood-cyan-text" />
              <h3>Select a Verified Flood Disaster</h3>
              <p>Choose an incident from the queue on the left to inspect official hydrologic records, situation reports, and AI dossier synthesis.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
