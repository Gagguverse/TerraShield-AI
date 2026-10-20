import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Search,
  ChevronRight,
  ChevronLeft,
  Flame,
} from 'lucide-react';
import type { Incident } from '../types';

interface IncidentVerificationListProps {
  incidents: Incident[];
  selectedIncident: Incident | null;
  onSelectIncident: (incident: Incident) => void;
  statusFilter?: string;
  onStatusFilterChange?: (status: string) => void;
  onBack?: () => void;
}

export const IncidentVerificationList: React.FC<IncidentVerificationListProps> = ({
  incidents,
  selectedIncident,
  onSelectIncident,
  statusFilter = 'ALL',
  onStatusFilterChange,
  onBack,
}) => {
  const [internalStatusFilter, setInternalStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [geoFilter, setGeoFilter] = useState<'ALL' | 'INDIA'>('ALL');

  const activeStatus = onStatusFilterChange ? statusFilter : internalStatusFilter;
  const setStatus = onStatusFilterChange || setInternalStatusFilter;

  const indiaCount = incidents.filter((i) => i.region.toLowerCase().includes('india')).length;

  const filtered = incidents.filter((inc) => {
    if (activeStatus !== 'ALL' && inc.verification.status !== activeStatus) {
      return false;
    }
    if (geoFilter === 'INDIA' && !inc.region.toLowerCase().includes('india')) {
      return false;
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      if (
        !inc.name.toLowerCase().includes(q) &&
        !inc.region.toLowerCase().includes(q) &&
        !inc.id.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* View Header with Back button */}
      <div className="view-section-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {onBack && (
            <button className="btn-tool" onClick={onBack} title="Back to Map View" id="incidents-back-btn">
              <ChevronLeft size={13} />
              <span>Map</span>
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Flame size={14} color="var(--accent-orange)" />
            <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>Fire Incidents Queue</span>
          </div>
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
            {incidents.length} total incidents
          </span>
        </div>
      </div>
      {/* Search & Filters */}
      <div
        style={{
          display: 'flex',
          gap: '0.65rem',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.75rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <Search
            size={12}
            style={{
              position: 'absolute',
              left: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-tertiary)',
            }}
          />
          <input
            type="text"
            className="input-search-compact"
            placeholder="Filter incidents by title, region, or ID..."
            style={{ width: '100%' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Geographic Scope Toggle (Priority 7) */}
        <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
          <button
            className={`btn-tool ${geoFilter === 'ALL' ? 'active-tool' : ''}`}
            onClick={() => setGeoFilter('ALL')}
            title="View all incidents across global and national records"
          >
            All Scope
          </button>
          <button
            className={`btn-tool ${geoFilter === 'INDIA' ? 'active-tool' : ''}`}
            onClick={() => setGeoFilter('INDIA')}
            title="Filter to India monitoring region only"
          >
            🇮🇳 India Only ({indiaCount})
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <button
            className={`btn-tool ${activeStatus === 'ALL' ? 'active-tool' : ''}`}
            onClick={() => setStatus('ALL')}
          >
            All ({incidents.length})
          </button>
          <button
            className={`btn-tool ${activeStatus === 'CORROBORATED' ? 'active-tool' : ''}`}
            onClick={() => setStatus('CORROBORATED')}
            style={{ color: activeStatus === 'CORROBORATED' ? 'var(--color-verified)' : undefined }}
          >
            Corroborated
          </button>
          <button
            className={`btn-tool ${activeStatus === 'NEEDS_REVIEW' ? 'active-tool' : ''}`}
            onClick={() => setStatus('NEEDS_REVIEW')}
            style={{ color: activeStatus === 'NEEDS_REVIEW' ? 'var(--color-review)' : undefined }}
          >
            Needs Review
          </button>
          <button
            className={`btn-tool ${activeStatus === 'INSUFFICIENT_EVIDENCE' ? 'active-tool' : ''}`}
            onClick={() => setStatus('INSUFFICIENT_EVIDENCE')}
            style={{ color: activeStatus === 'INSUFFICIENT_EVIDENCE' ? 'var(--color-insufficient)' : undefined }}
          >
            Insufficient
          </button>
        </div>
      </div>

      {/* Incidents List */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.45rem',
          overflowY: 'auto',
          flex: 1,
          paddingRight: '2px',
        }}
      >
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
            No fire incidents match the current filters.
          </div>
        ) : (
          filtered.map((inc) => {
            const isSelected = selectedIncident?.id === inc.id;
            const status = inc.verification.status;

            return (
              <div
                key={inc.id}
                onClick={() => onSelectIncident(inc)}
                style={{
                  background: isSelected ? 'var(--bg-active)' : 'var(--bg-surface)',
                  border: isSelected ? '1px solid var(--accent-amber)' : '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.65rem 0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.12s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ flex: 1, minWidth: 0, marginRight: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                      {inc.id}
                    </span>
                    <span className={`status-badge ${status}`}>
                      {status === 'CORROBORATED' && <CheckCircle2 size={10} />}
                      {status === 'NEEDS_REVIEW' && <AlertCircle size={10} />}
                      {status === 'INSUFFICIENT_EVIDENCE' && <HelpCircle size={10} />}
                      {status.replace('_', ' ')}
                    </span>
                    {inc.region.toLowerCase().includes('india') ? (
                      <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-amber)', fontWeight: 600 }}>
                        🇮🇳 India
                      </span>
                    ) : (
                      <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(255, 255, 255, 0.06)', color: 'var(--text-tertiary)' }}>
                        🌐 Global Archive
                      </span>
                    )}
                  </div>

                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.8125rem', marginBottom: '0.15rem' }}>
                    {inc.name}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
                    {inc.region} &bull; Centroid: <span style={{ fontFamily: 'var(--font-mono)' }}>{inc.latitude.toFixed(2)}, {inc.longitude.toFixed(2)}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ textAlign: 'right', minWidth: '70px' }}>
                    <div style={{ fontSize: '0.625rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                      Hotspots
                    </div>
                    <div style={{ fontSize: '0.785rem', fontWeight: 600, color: 'var(--accent-orange)', fontFamily: 'var(--font-mono)' }}>
                      {inc.detection_count}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', minWidth: '65px' }}>
                    <div style={{ fontSize: '0.625rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                      Evidence
                    </div>
                    <div style={{ fontSize: '0.785rem', fontWeight: 600, color: 'var(--color-info)', fontFamily: 'var(--font-mono)' }}>
                      {inc.evidence.length}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', minWidth: '75px' }}>
                    <div style={{ fontSize: '0.625rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                      Uncertainty
                    </div>
                    <div
                      style={{
                        fontSize: '0.785rem',
                        fontWeight: 600,
                        color: status === 'CORROBORATED' ? 'var(--color-verified)' : status === 'NEEDS_REVIEW' ? 'var(--color-review)' : 'var(--color-insufficient)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {Math.round(inc.verification.uncertainty_score * 100)}%
                    </div>
                  </div>

                  <ChevronRight size={15} color="var(--text-tertiary)" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
