import React, { useState } from 'react';
import {
  X,
  Search,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { api } from '../services/api';
import type { Incident } from '../types';

interface ContextualEvidenceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  incident: Incident | null;
  onEvidenceAttached: () => Promise<void>;
  tinyfishConfigured?: boolean;
}

export const ContextualEvidenceDrawer: React.FC<ContextualEvidenceDrawerProps> = ({
  isOpen,
  onClose,
  incident,
  onEvidenceAttached,
  tinyfishConfigured = false,
}) => {
  if (!isOpen || !incident) return null;

  // Search state
  const defaultQuery = `Forest fire ${incident.name} ${incident.region} India Forest Survey of India advisory`;
  const [searchQuery, setSearchQuery] = useState(defaultQuery);
  const [locationParam, setLocationParam] = useState(incident.region || 'India');
  const [isSearching, setIsSearching] = useState(false);
  const [searchStatus, setSearchStatus] = useState<{
    type: 'success' | 'warning' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [expandedArticleId, setExpandedArticleId] = useState<string | null>(null);

  const handleSearchAndFetch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchStatus(null);

    try {
      const res = await api.searchEvidence({
        incident_id: incident.id,
        query: searchQuery.trim(),
        location: locationParam.trim() || undefined,
        target_date: incident.last_detected ? incident.last_detected.split('T')[0] : undefined,
        max_results: 5,
      });

      if (res.status === 'credentials_missing') {
        setSearchStatus({
          type: 'warning',
          text: res.message || 'TINYFISH_API_KEY is not configured in backend environment (.env).',
        });
      } else if (res.status === 'error') {
        setSearchStatus({
          type: 'error',
          text: res.message || 'TinyFish search failed. Check API key validity or upstream status.',
        });
      } else if (res.results_count === 0) {
        setSearchStatus({
          type: 'info',
          text: 'No public news, reports, or official advisories found matching this query in the specified window.',
        });
      } else {
        setSearchStatus({
          type: 'success',
          text: `Retrieved ${res.results_count} public evidence records. Incident verification re-evaluated.`,
        });
        await onEvidenceAttached();
      }
    } catch (err: any) {
      setSearchStatus({
        type: 'error',
        text: `Evidence retrieval failed: ${err.message || String(err)}`,
      });
    } finally {
      setIsSearching(false);
    }
  };

  const getSourceBadge = (type: string, isOfficial: boolean) => {
    if (isOfficial || type === 'OFFICIAL_AGENCY') {
      return {
        label: 'Official Indian Agency',
        color: 'var(--color-verified)',
        bg: 'var(--color-verified-subtle)',
        border: 'var(--color-verified-border)',
      };
    }
    if (type === 'NEWS_MEDIA') {
      return {
        label: 'News Media Report',
        color: 'var(--color-info)',
        bg: 'var(--color-info-subtle)',
        border: 'var(--color-info-border)',
      };
    }
    return {
      label: 'Public Source',
      color: 'var(--text-secondary)',
      bg: 'var(--bg-elevated)',
      border: 'var(--border-subtle)',
    };
  };

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside className="rocket-drawer" onClick={(e) => e.stopPropagation()}>
        {/* Drawer Header */}
        <div className="drawer-header">
          <div className="drawer-title-group">
            <span className="drawer-category">INCIDENT EVIDENCE & PROVENANCE</span>
            <h2 className="drawer-title">{incident.name}</h2>
            <div className="drawer-coords">
              <span>{incident.region}</span>
              <span className="dot-separator">•</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>
                {incident.latitude.toFixed(4)}° N, {incident.longitude.toFixed(4)}° E
              </span>
            </div>
          </div>
          <button className="drawer-close-btn" onClick={onClose} aria-label="Close drawer">
            <X size={16} />
          </button>
        </div>

        {/* Verification Status Summary */}
        <div className="drawer-verification-summary">
          <div className="verification-status-pill">
            {incident.verification.status === 'CORROBORATED' ? (
              <ShieldCheck size={14} color="var(--color-verified)" />
            ) : incident.verification.status === 'NEEDS_REVIEW' ? (
              <AlertTriangle size={14} color="var(--accent-amber)" />
            ) : (
              <HelpCircle size={14} color="var(--text-tertiary)" />
            )}
            <span style={{ fontWeight: 600 }}>{incident.verification.status.replace('_', ' ')}</span>
            <span className="dot-separator">•</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>
              {Math.round(incident.verification.uncertainty_score * 100)}% Uncertainty
            </span>
          </div>
          <p className="verification-rationale-text">{incident.verification.rationale}</p>
        </div>

        {/* Live Search & Fetch Section */}
        <div className="drawer-search-box">
          <div className="section-label" style={{ marginBottom: '0.45rem' }}>
            <span>Live TinyFish Web Evidence Search</span>
            <span
              style={{
                fontSize: '10px',
                color: tinyfishConfigured ? 'var(--color-verified)' : 'var(--accent-amber)',
              }}
            >
              {tinyfishConfigured ? '● TinyFish Active' : '○ Key Missing / Check .env'}
            </span>
          </div>

          <form onSubmit={handleSearchAndFetch}>
            <div style={{ marginBottom: '0.45rem' }}>
              <input
                type="text"
                className="input-search-compact"
                style={{ width: '100%', padding: '0.45rem 0.65rem' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search query (e.g. Forest fire Uttarakhand India)..."
              />
            </div>

            <div style={{ display: 'flex', gap: '0.45rem', marginBottom: '0.5rem' }}>
              <input
                type="text"
                className="input-search-compact"
                style={{ flex: 1, padding: '0.4rem 0.65rem' }}
                value={locationParam}
                onChange={(e) => setLocationParam(e.target.value)}
                placeholder="Target location (e.g. Uttarakhand, India)"
              />
              <button
                type="submit"
                className="btn-tool btn-accent"
                disabled={isSearching}
                style={{ padding: '0.4rem 0.85rem' }}
              >
                <Search size={12} className={isSearching ? 'animate-spin' : ''} />
                <span>{isSearching ? 'Fetching...' : 'Search Web'}</span>
              </button>
            </div>
          </form>

          {searchStatus && (
            <div
              style={{
                padding: '0.45rem 0.65rem',
                fontSize: '0.75rem',
                borderRadius: 'var(--radius-xs)',
                border: '1px solid',
                backgroundColor:
                  searchStatus.type === 'success'
                    ? 'var(--color-verified-subtle)'
                    : searchStatus.type === 'warning'
                    ? 'var(--accent-amber-subtle)'
                    : searchStatus.type === 'error'
                    ? 'var(--color-danger-subtle)'
                    : 'var(--color-info-subtle)',
                borderColor:
                  searchStatus.type === 'success'
                    ? 'var(--color-verified-border)'
                    : searchStatus.type === 'warning'
                    ? 'var(--accent-amber-border)'
                    : searchStatus.type === 'error'
                    ? 'var(--color-danger-border)'
                    : 'var(--color-info-border)',
                color:
                  searchStatus.type === 'success'
                    ? 'var(--color-verified)'
                    : searchStatus.type === 'warning'
                    ? 'var(--accent-amber)'
                    : searchStatus.type === 'error'
                    ? 'var(--color-danger)'
                    : 'var(--color-info)',
                marginTop: '0.35rem',
              }}
            >
              {searchStatus.text}
            </div>
          )}
        </div>

        {/* Retrieved Evidence List */}
        <div className="drawer-evidence-list">
          <div className="section-label" style={{ marginBottom: '0.5rem' }}>
            <span>Associated Public Reports & Advisories</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>{incident.evidence.length} sources</span>
          </div>

          {incident.evidence.length === 0 ? (
            <div className="empty-evidence-placeholder">
              <FileText size={20} color="var(--text-tertiary)" style={{ marginBottom: '0.4rem' }} />
              <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                No Supporting Public Reports Linked
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', maxWidth: '280px', margin: '0 auto' }}>
                This thermal hotspot has not yet been corroborated by public news or official bulletins. Use the search tool above to discover independent sources.
              </p>
            </div>
          ) : (
            incident.evidence.map((ev) => {
              const badge = getSourceBadge(ev.source_type, ev.is_official);
              const isExpanded = expandedArticleId === ev.id;

              return (
                <div key={ev.id} className="evidence-card-drawer">
                  <div className="evidence-card-top">
                    <span
                      className="source-authority-tag"
                      style={{
                        color: badge.color,
                        backgroundColor: badge.bg,
                        borderColor: badge.border,
                      }}
                    >
                      {badge.label}
                    </span>
                    <span
                      className="relevance-score-badge"
                      style={{
                        color: ev.relevance_label === 'Relevant' ? 'var(--color-verified)' : ev.relevance_label === 'Partial match' ? 'var(--accent-amber)' : 'var(--text-tertiary)',
                        borderColor: ev.relevance_label === 'Relevant' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)',
                        background: ev.relevance_label === 'Relevant' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                      }}
                    >
                      {ev.relevance_label || (ev.relevance_score >= 0.75 ? 'Relevant' : ev.relevance_score >= 0.45 ? 'Partial match' : 'Needs review')}
                    </span>
                  </div>

                  <h4 className="evidence-card-title">{ev.title}</h4>

                  <div className="evidence-card-meta">
                    {ev.domain && <span>Domain: {ev.domain}</span>}
                    {ev.publication_date && (
                      <>
                        <span className="dot-separator">•</span>
                        <span>Published: {ev.publication_date}</span>
                      </>
                    )}
                    <span className="dot-separator">•</span>
                    <span>Retrieved: {new Date(ev.fetched_at).toLocaleDateString()}</span>
                  </div>

                  <p className="evidence-card-snippet">{ev.snippet}</p>

                  {/* Expandable full text */}
                  {ev.full_text && (
                    <div style={{ marginTop: '0.4rem' }}>
                      <button
                        onClick={() => setExpandedArticleId(isExpanded ? null : ev.id)}
                        className="btn-locate-link"
                        style={{ fontSize: '11px', color: 'var(--text-secondary)' }}
                      >
                        {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                        <span>{isExpanded ? 'Collapse Full Article' : 'Read Full Retrieved Article'}</span>
                      </button>

                      {isExpanded && (
                        <div className="expanded-article-box">
                          {ev.full_text}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="evidence-card-footer">
                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                      {ev.relevance_explanation}
                    </span>
                    {ev.url && ev.url.startsWith('http') && (
                      <a
                        href={ev.url}
                        target="_blank"
                        rel="noreferrer"
                        className="evidence-source-link"
                        title="Open original verified publisher URL"
                      >
                        <span>Open Source</span>
                        <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
};
