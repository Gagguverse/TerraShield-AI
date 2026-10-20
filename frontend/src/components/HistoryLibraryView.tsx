import React, { useState, useEffect } from 'react';
import {
  Archive,
  ArrowLeft,
  Search,
  Flame,
  MapPin,
  Calendar,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Sparkles,
  Globe,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../services/api';
import type { HistoricalIncident } from '../types';

interface HistoryLibraryViewProps {
  onBack: () => void;
  onOpenDossier: (incidentId: string) => void;
  onFocusMap: (lat: number, lon: number, name: string) => void;
  onOpenDemo?: () => void;
}

type ScopeFilterType = 'INDIA_FIRE' | 'INTERNATIONAL';

export const HistoryLibraryView: React.FC<HistoryLibraryViewProps> = ({
  onBack,
  onOpenDossier,
  onFocusMap,
}) => {
  const [incidents, setIncidents] = useState<HistoricalIncident[]>([]);
  const [internationalIncidents, setInternationalIncidents] = useState<HistoricalIncident[]>([]);
  const [activeFilter, setActiveFilter] = useState<ScopeFilterType>('INDIA_FIRE');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [showInternationalSection, setShowInternationalSection] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const scopeParam: string = activeFilter === 'INTERNATIONAL' ? 'INTERNATIONAL' : 'INDIA';
    const hazardParam = 'WILDFIRE';

    Promise.all([
      api.getHistoricalIncidents(hazardParam, undefined, searchQuery, scopeParam),
      scopeParam === 'INDIA'
        ? api.getHistoricalIncidents('WILDFIRE', undefined, undefined, 'INTERNATIONAL')
        : Promise.resolve([]),
    ])
      .then(([primaryRes, intlRes]) => {
        if (isMounted) {
          setIncidents(primaryRes);
          if (intlRes && intlRes.length > 0) {
            setInternationalIncidents(intlRes);
          }
          setLoading(false);
        }
      })
      .catch((err) => {
        console.warn('Failed to load historical incidents:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeFilter, searchQuery]);

  const renderIncidentCard = (item: HistoricalIncident, isInternational = false) => {
    const countryFlag = item.country === 'India' ? '🇮🇳' : item.country === 'Canada' ? '🇨🇦' : '🇺🇸';
    const modeBadge = item.data_mode || 'HISTORICAL';

    return (
      <div
        key={item.id}
        className="history-card"
        style={{
          background: 'var(--surface-raised)',
          border: isInternational ? '1px dashed var(--border-subtle)' : '1px solid var(--border-subtle)',
          borderRadius: '10px',
          padding: '1.2rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '0.9rem',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
          position: 'relative',
        }}
      >
        <div>
          {/* Top meta tags */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.55rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  background: 'rgba(249, 115, 22, 0.15)',
                  color: '#f97316',
                  border: '1px solid rgba(249, 115, 22, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <Flame size={11} />
                <span>{item.hazard_type}</span>
              </span>

              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  padding: '0.18rem 0.45rem',
                  borderRadius: '4px',
                  background: isInternational ? 'rgba(148, 163, 184, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                  color: isInternational ? 'var(--text-secondary)' : '#f59e0b',
                  border: `1px solid ${isInternational ? 'rgba(148, 163, 184, 0.25)' : 'rgba(245, 158, 11, 0.3)'}`,
                  letterSpacing: '0.04em',
                }}
              >
                {isInternational ? 'INTERNATIONAL BENCHMARK' : modeBadge}
              </span>
            </div>

            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {countryFlag} {item.country}
            </span>
          </div>

          <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '1.05rem', color: 'var(--text-primary)', fontWeight: 700 }}>
            {item.name}
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <MapPin size={13} style={{ color: '#f97316' }} />
              <span>{item.region}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Calendar size={13} style={{ color: 'var(--color-info)' }} />
              <span>Event Date: <strong>{item.event_date}</strong></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <ShieldCheck size={13} style={{ color: 'var(--color-verified)' }} />
              <span style={{ fontSize: '0.74rem' }}>
                {item.detection_count} satellite detections grouped
              </span>
            </div>
          </div>

          {item.impact_summary?.casualties && (
            <div style={{ marginTop: '0.65rem', padding: '0.5rem 0.65rem', background: 'var(--surface-sunken)', borderRadius: '6px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--color-danger)' }}>Documented Impact: </strong>
              {item.impact_summary.casualties}
            </div>
          )}
        </div>

        {/* Card Action Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.85rem' }}>
          <button
            className="btn-tool"
            onClick={() => onOpenDossier(item.id)}
            id={`open-dossier-${item.id}`}
            style={{
              flex: 1,
              justifyContent: 'center',
              padding: '0.5rem',
              fontWeight: 600,
              fontSize: '0.8rem',
              background: 'rgba(249, 115, 22, 0.08)',
              borderColor: 'rgba(249, 115, 22, 0.3)',
              color: '#f97316',
            }}
          >
            <span>View Intelligence Report</span>
            <ChevronRight size={14} />
          </button>

          <button
            className="btn-tool"
            onClick={() => onFocusMap(item.latitude, item.longitude, item.name)}
            id={`focus-map-${item.id}`}
            title="Center on Map"
            style={{ padding: '0.5rem 0.75rem' }}
          >
            <MapPin size={14} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div
      className="history-library-root"
      style={{
        padding: '1.25rem',
        overflowY: 'auto',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.15rem',
      }}
    >
      {/* ── Header with Back Button & Breadcrumb ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '0.85rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            className="btn-tool"
            onClick={onBack}
            id="history-back-btn"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.75rem', fontWeight: 600 }}
          >
            <ArrowLeft size={15} />
            <span>Back to Map</span>
          </button>
          <div style={{ height: '18px', width: '1px', background: 'var(--border-subtle)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Archive size={16} style={{ color: 'var(--accent-orange)' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
              HISTORICAL DISASTERS ARCHIVE · INDIA FIRST
            </span>
          </div>
        </div>

        <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
          {incidents.length} Verified Records Found
        </div>
      </div>

      {/* ── Banner: Indian Wildfire Spotlight (Simlipal Biosphere 2021) ── */}
      <div
        className="history-spotlight-card"
        style={{
          background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.1) 0%, rgba(245, 158, 11, 0.06) 100%)',
          border: '1px solid rgba(249, 115, 22, 0.35)',
          borderRadius: '10px',
          padding: '1.15rem 1.35rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.35rem' }}>
            <Sparkles size={14} style={{ color: '#f59e0b' }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', color: '#f59e0b' }}>
              PRIMARY WILDFIRE SPOTLIGHT · INDIA 🇮🇳
            </span>
          </div>
          <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem', color: 'var(--text-primary)', fontWeight: 700 }}>
            Simlipal Biosphere Reserve Forest Fires (Odisha, March 2021)
          </h3>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            High-severity dry deciduous forest fire complex verified across FSI SNPR bulletins, Odisha Forest Dept advisories, and NASA FIRMS VIIRS 375m orbital passes.
          </p>
        </div>

        <button
          className="btn-hero-primary"
          onClick={() => onOpenDossier('INC-HIST-IND-005')}
          id="spotlight-open-dossier-btn"
          style={{ whiteSpace: 'nowrap', padding: '0.6rem 1.15rem', fontSize: '0.84rem' }}
        >
          <span>View Intelligence Report</span>
          <ChevronRight size={14} />
        </button>
      </div>

      {/* ── Filter & Search Toolbar ── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.85rem',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--surface-raised)',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          border: '1px solid var(--border-subtle)',
        }}
      >
        {/* Simple Filters: India Wildfires, International Wildfires */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
          <button
            className={`btn-tool ${activeFilter === 'INDIA_FIRE' ? 'active' : ''}`}
            onClick={() => setActiveFilter('INDIA_FIRE')}
            id="hist-filter-fire"
            style={{
              fontSize: '0.78rem',
              padding: '0.35rem 0.8rem',
              color: activeFilter === 'INDIA_FIRE' ? '#f97316' : undefined,
              borderColor: activeFilter === 'INDIA_FIRE' ? 'rgba(249, 115, 22, 0.45)' : undefined,
              fontWeight: activeFilter === 'INDIA_FIRE' ? 700 : 500,
            }}
          >
            <Flame size={12} style={{ marginRight: '0.3rem' }} />
            <span>India Wildfires 🇮🇳</span>
          </button>

          <button
            className={`btn-tool ${activeFilter === 'INTERNATIONAL' ? 'active' : ''}`}
            onClick={() => setActiveFilter('INTERNATIONAL')}
            id="hist-filter-international"
            style={{
              fontSize: '0.78rem',
              padding: '0.35rem 0.8rem',
              color: activeFilter === 'INTERNATIONAL' ? '#a78bfa' : 'var(--text-secondary)',
              borderColor: activeFilter === 'INTERNATIONAL' ? 'rgba(167, 139, 250, 0.45)' : undefined,
              fontWeight: activeFilter === 'INTERNATIONAL' ? 700 : 500,
            }}
          >
            <Globe size={12} style={{ marginRight: '0.3rem' }} />
            <span>International Wildfire Examples (2)</span>
          </button>
        </div>

        {/* Search Input */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-sunken)', borderRadius: '6px', border: '1px solid var(--border-subtle)', padding: '0.35rem 0.75rem', minWidth: '260px' }}>
          <Search size={13} style={{ color: 'var(--text-tertiary)', marginRight: '0.45rem' }} />
          <input
            type="text"
            placeholder="Search verified events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            id="history-search-input"
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '0.8rem',
              width: '100%',
            }}
          />
        </div>
      </div>

      {/* ── Primary Incident Records Grid (India-First) ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-secondary)' }}>
          <RefreshCw className="spin" size={26} style={{ color: 'var(--accent-orange)', marginBottom: '0.6rem' }} />
          <div>Querying verified historical disaster repository...</div>
        </div>
      ) : incidents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-tertiary)' }}>
          No verified historical records match the selected filter.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.1rem' }}>
          {incidents.map((item) => renderIncidentCard(item, activeFilter === 'INTERNATIONAL'))}
        </div>
      )}

      {/* ── Collapsible International Benchmark Section (Secondary) ── */}
      {activeFilter !== 'INTERNATIONAL' && internationalIncidents.length > 0 && (
        <div
          style={{
            marginTop: '1rem',
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: '1.2rem',
          }}
        >
          <button
            onClick={() => setShowInternationalSection(!showInternationalSection)}
            id="toggle-international-section-btn"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: 0,
              color: 'var(--text-secondary)',
              fontSize: '0.84rem',
              fontWeight: 600,
            }}
          >
            <Globe size={15} style={{ color: 'var(--text-tertiary)' }} />
            <span>International Benchmark Reference Disasters (2 Records)</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
              {showInternationalSection ? '• Click to collapse' : '• Click to expand'}
            </span>
            {showInternationalSection ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          {showInternationalSection && (
            <div style={{ marginTop: '0.9rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.1rem' }}>
              {internationalIncidents.map((item) => renderIncidentCard(item, true))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
