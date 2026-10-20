import React, { useState } from 'react';
import {
  ShieldAlert,
  Settings,
  ChevronLeft,
  ChevronRight,
  Globe,
} from 'lucide-react';
import type { DataMode, FirmsRegion, HealthResponse, Incident } from '../types';

export type NavTab = 'map' | 'incidents' | 'history' | 'evidence' | 'analytics';

interface AppSidebarProps {
  currentTab?: NavTab;
  onTabChange?: (tab: NavTab) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenSettings: () => void;
  health: HealthResponse | null;
  totalDetectionsCount: number;
  incidents: Incident[];
  selectedIncident: Incident | null;
  onSelectIncident: (incident: Incident) => void;
  regions: FirmsRegion[];
  selectedRegionId: string;
  onRegionChange: (regionId: string) => void;
  currentMode: DataMode;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  currentTab: _currentTab,
  onTabChange: _onTabChange,
  isCollapsed,
  onToggleCollapse,
  onOpenSettings,
  health,
  totalDetectionsCount,
  incidents,
  selectedIncident,
  onSelectIncident,
  regions,
  selectedRegionId,
  onRegionChange,
  currentMode,
}) => {
  const [incidentSearch, setIncidentSearch] = useState('');

  // Selected region object
  const currentRegion = regions.find((r) => r.id === selectedRegionId) || regions[0] || {
    id: 'INDIA_ALL',
    name: 'India (National Overview)',
    country: 'India',
  };

  const filteredIncidents = incidents.filter((inc) => {
    if (!incidentSearch) return true;
    const q = incidentSearch.toLowerCase();
    return (
      inc.name.toLowerCase().includes(q) ||
      inc.region.toLowerCase().includes(q) ||
      inc.id.toLowerCase().includes(q)
    );
  });

  return (
    <aside className={`sidebar rocket-sidebar ${isCollapsed ? 'collapsed' : ''}`} aria-label="Operational Navigation">
      {/* 1. Brand Header */}
      <div className="sidebar-brand">
        <div className="brand-icon" title="TerraShield AI — Evidence-Driven Wildfire Intelligence">
          <ShieldAlert size={16} />
        </div>
        {!isCollapsed && (
          <div className="brand-info">
            <div className="brand-title-text">
              <span>TerraShield</span>
              <span style={{ color: 'var(--accent-orange)' }}>AI</span>
            </div>
            <div className="brand-subtext">GEOINT OPS • INDIA FIRST</div>
          </div>
        )}
      </div>



      {/* 3. RocketMapper Style Telemetry Metric & Region Filter (Expanded State) */}
      {!isCollapsed && (
        <div className="rocket-sidebar-header">
          {/* Tracking Status Pill & Explicit Data State Badge */}
          <div className="rocket-status-indicator" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span
                className="status-dot"
                style={{
                  backgroundColor:
                    currentMode === 'LIVE'
                      ? 'var(--color-verified)'
                      : currentMode === 'DEMO'
                      ? '#c084fc'
                      : 'var(--accent-amber)',
                }}
              />
              <span className="rocket-status-text">
                {currentMode === 'LIVE' ? 'LIVE ORBITAL PASS' : currentMode === 'DEMO' ? 'DEMO DATASET' : 'HISTORICAL SAMPLE'}
              </span>
            </div>
            <span
              style={{
                fontSize: '9.5px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                padding: '0.15rem 0.45rem',
                borderRadius: '3px',
                background:
                  currentMode === 'LIVE'
                    ? 'rgba(34, 197, 94, 0.15)'
                    : currentMode === 'DEMO'
                    ? 'rgba(168, 85, 247, 0.15)'
                    : 'rgba(245, 158, 11, 0.15)',
                color:
                  currentMode === 'LIVE'
                    ? 'var(--color-verified)'
                    : currentMode === 'DEMO'
                    ? '#c084fc'
                    : 'var(--accent-amber)',
                border: `1px solid ${
                  currentMode === 'LIVE'
                    ? 'rgba(34, 197, 94, 0.3)'
                    : currentMode === 'DEMO'
                    ? 'rgba(168, 85, 247, 0.3)'
                    : 'rgba(245, 158, 11, 0.3)'
                }`,
              }}
            >
              {currentMode}
            </span>
          </div>

          {/* 3-4 Key Operational Summary Indicators */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', margin: '0.55rem 0' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '6px', padding: '0.45rem' }}>
              <span style={{ fontSize: '9px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Hotspots (375m)</span>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--accent-orange)', fontFamily: 'var(--font-mono)' }}>
                {totalDetectionsCount.toLocaleString()}
              </div>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '6px', padding: '0.45rem' }}>
              <span style={{ fontSize: '9px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Clusters</span>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                {incidents.length}
              </div>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '6px', padding: '0.45rem' }}>
              <span style={{ fontSize: '9px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Corroborated</span>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-verified)', fontFamily: 'var(--font-mono)' }}>
                {incidents.filter((i) => i.verification.status === 'CORROBORATED').length}
              </div>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '6px', padding: '0.45rem' }}>
              <span style={{ fontSize: '9px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Active AOI</span>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {currentRegion.name.split(' ')[0]} 🇮🇳
              </div>
            </div>
          </div>

          {/* Collapsible Advanced Telemetry Details & Region Filter */}
          <details style={{ marginTop: '0.35rem', marginBottom: '0.35rem' }}>
            <summary style={{ fontSize: '10.5px', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '0.2rem 0', userSelect: 'none' }}>
              Advanced Telemetry & Filters
            </summary>
            <div style={{ paddingTop: '0.45rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-tertiary)' }}>
                <span>Sensor Product:</span>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>VIIRS 375m / MODIS 1km</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-tertiary)' }}>
                <span>Observation Window:</span>
                <span style={{ color: 'var(--text-secondary)' }}>24-Hour Rolling Orbit</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-tertiary)' }}>
                <span>Telemetry Sync:</span>
                <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  {health?.last_refresh ? new Date(health.last_refresh).toLocaleTimeString() : 'Live'}
                </span>
              </div>

              {/* India Monitoring Region Selector */}
              <div className="rocket-region-select-box" style={{ marginTop: '0.3rem' }}>
                <div className="region-select-header">
                  <Globe size={11} color="var(--accent-orange)" />
                  <span>Monitoring Region:</span>
                </div>
                <select
                  className="select-filter-compact rocket-region-select"
                  value={selectedRegionId}
                  onChange={(e) => onRegionChange(e.target.value)}
                  title="Select geographic monitoring zone"
                >
                  {regions.map((reg) => (
                    <option key={reg.id} value={reg.id}>
                      {reg.name} {reg.country === 'India' ? '🇮🇳' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </details>

          {/* Search Candidate Cluster Filter */}
          <div style={{ marginTop: '0.35rem' }}>
            <input
              type="text"
              placeholder="Search candidate clusters..."
              className="input-search-compact"
              style={{ width: '100%', fontSize: '11px', padding: '0.35rem 0.5rem' }}
              value={incidentSearch}
              onChange={(e) => setIncidentSearch(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* 4. Candidate Incident Clusters List */}
      {!isCollapsed && (
        <div className="rocket-incident-list">
          <div className="section-label" style={{ padding: '0.35rem 0.65rem 0.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontWeight: 600 }}>Candidate Incident Clusters</span>
              <div style={{ fontSize: '9px', color: 'var(--text-tertiary)', textTransform: 'none', letterSpacing: 'normal' }}>
                Spatial groups within 30 km perimeter
              </div>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }}>{filteredIncidents.length} clusters</span>
          </div>

          {filteredIncidents.length === 0 ? (
            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
              No candidate clusters matching filter.
            </div>
          ) : (
            filteredIncidents.map((inc) => {
              const isSelected = selectedIncident?.id === inc.id;
              const status = inc.verification.status;

              // Border color based on status (RocketMapper style)
              const accentColor =
                status === 'CORROBORATED'
                  ? 'var(--color-verified)'
                  : status === 'NEEDS_REVIEW'
                  ? 'var(--accent-amber)'
                  : 'var(--border-subtle)';

              return (
                <div
                  key={inc.id}
                  className={`rocket-item-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => onSelectIncident(inc)}
                  style={{ borderLeftColor: accentColor }}
                >
                  <div className="item-card-left">
                    <div className="item-card-title">{inc.name}</div>
                    <div className="item-card-sub">
                      <span>{inc.region}</span>
                      {inc.max_frp ? (
                        <>
                          <span className="dot-separator">•</span>
                          <span style={{ color: 'var(--accent-orange)' }}>{inc.max_frp.toFixed(1)} MW</span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="item-card-right">
                    <span
                      className="count-pill tabular-nums"
                      title={`${inc.detection_count} satellite observations clustered in this candidate perimeter`}
                      style={{ fontSize: '10px', padding: '0.15rem 0.45rem', whiteSpace: 'nowrap' }}
                    >
                      {inc.detection_count} {inc.detection_count === 1 ? 'det' : 'dets'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 5. Footer with Collapse Button & System Health */}
      <div className="sidebar-footer">
        {!isCollapsed && (
          <div className="rocket-provenance-footer">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-tertiary)' }}>NASA FIRMS</span>
              <span
                style={{
                  color: health?.firms_configured ? 'var(--color-verified)' : 'var(--text-disabled)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                }}
              >
                {health?.firms_configured ? 'CONNECTED' : 'STANDBY'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
              <span style={{ color: 'var(--text-tertiary)' }}>TINYFISH</span>
              <span
                style={{
                  color: health?.tinyfish_configured ? 'var(--color-verified)' : 'var(--text-disabled)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                }}
              >
                {health?.tinyfish_configured ? 'CONFIGURED' : 'UNCONFIGURED'}
              </span>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <button
            className="sidebar-collapse-btn"
            onClick={onOpenSettings}
            title="System Settings & Thresholds"
            style={{ width: isCollapsed ? '100%' : 'auto', flex: isCollapsed ? 'none' : '0 0 32px' }}
          >
            <Settings size={14} />
          </button>

          <button
            className="sidebar-collapse-btn"
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            style={{ flex: 1 }}
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            {!isCollapsed && <span>Collapse</span>}
          </button>
        </div>
      </div>
    </aside>
  );
};
