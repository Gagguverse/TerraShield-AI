import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import type { EvidenceRecord, Incident } from '../types';
import { api } from '../services/api';

interface TinyFishSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetIncident: Incident | null;
  onEvidenceAttached: () => void;
}

export const TinyFishSearchModal: React.FC<TinyFishSearchModalProps> = ({
  isOpen,
  onClose,
  targetIncident,
  onEvidenceAttached,
}) => {
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [maxResults, setMaxResults] = useState(5);

  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<EvidenceRecord[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState<boolean>(true);
  const [attachedUrls, setAttachedUrls] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (targetIncident) {
      setQuery(`wildfire emergency advisory ${targetIncident.name} ${targetIncident.region}`);
      setLocation(targetIncident.region);
      setTargetDate(targetIncident.first_detected.slice(0, 10));
    } else {
      setQuery('wildfire emergency bulletin');
      setLocation('');
      setTargetDate('2023-07-12');
    }
    setResults([]);
    setStatusMessage(null);
  }, [targetIncident, isOpen]);

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setStatusMessage(null);

    try {
      const response = await api.searchTinyFishEvidence({
        incident_id: targetIncident?.id,
        query: query.trim(),
        location: location.trim(),
        target_date: targetDate.trim(),
        max_results: maxResults,
      });

      setResults(response.evidence_records);
      setIsConfigured(response.tinyfish_configured);
      setStatusMessage(response.message || null);

      if (response.status === 'success' && targetIncident) {
        onEvidenceAttached();
      }
    } catch (err: any) {
      setStatusMessage(err.message || 'TinyFish search failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAttachItem = (record: EvidenceRecord) => {
    if (!targetIncident) return;
    setAttachedUrls((prev) => new Set([...prev, record.url]));
    onEvidenceAttached();
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 'var(--radius-xs)',
                background: 'var(--color-info-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-info)',
              }}
            >
              <Search size={14} />
            </div>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                TinyFish Web Evidence Retrieval
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>
                Querying <code style={{ color: 'var(--color-info)' }}>api.search.tinyfish.ai</code> & <code style={{ color: 'var(--color-info)' }}>api.fetch.tinyfish.ai</code>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn-tool"
            style={{ padding: '0.25rem', borderRadius: '50%' }}
            aria-label="Close modal"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {targetIncident && (
            <div
              style={{
                background: 'var(--bg-root)',
                border: '1px solid var(--border-subtle)',
                padding: '0.55rem 0.75rem',
                borderRadius: 'var(--radius-xs)',
                fontSize: '0.75rem',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <div>
                Target Incident: <strong>{targetIncident.name}</strong> ({targetIncident.id})
              </div>
              <div style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                Centroid: {targetIncident.latitude.toFixed(3)}, {targetIncident.longitude.toFixed(3)}
              </div>
            </div>
          )}

          {/* Search Form */}
          <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '0.25rem', fontWeight: 600 }}>
                Query Objective
              </label>
              <input
                type="text"
                className="input-search-compact"
                style={{ width: '100%', height: '32px' }}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. Uttarakhand forest fires May 2024 Forest Survey of India advisory"
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 110px', gap: '0.65rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '0.25rem', fontWeight: 600 }}>
                  Target Region
                </label>
                <input
                  type="text"
                  className="input-search-compact"
                  style={{ width: '100%', height: '30px' }}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. British Columbia"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '0.25rem', fontWeight: 600 }}>
                  Observation Date
                </label>
                <input
                  type="text"
                  className="input-search-compact"
                  style={{ width: '100%', height: '30px' }}
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  placeholder="2023-07-12"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '0.25rem', fontWeight: 600 }}>
                  Max Sources
                </label>
                <select
                  className="select-filter-compact"
                  style={{ width: '100%', height: '30px' }}
                  value={maxResults}
                  onChange={(e) => setMaxResults(Number(e.target.value))}
                >
                  <option value={3}>3 sources</option>
                  <option value={5}>5 sources</option>
                  <option value={10}>10 sources</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.2rem' }}>
              <button
                type="submit"
                className="btn-primary"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Searching Web via TinyFish...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={13} />
                    <span>Execute TinyFish Search</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Status / Unconfigured Message */}
          {statusMessage && !isConfigured && (
            <div className="setup-alert-box">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                <AlertTriangle size={15} color="var(--accent-amber)" />
                <strong style={{ fontSize: '0.8125rem' }}>TinyFish API Key Setup Required</strong>
              </div>
              <p style={{ marginBottom: '0.4rem', fontSize: '0.75rem' }}>{statusMessage}</p>
              <div style={{ background: 'var(--bg-root)', padding: '0.5rem', borderRadius: 'var(--radius-xs)', fontFamily: 'var(--font-mono)', fontSize: '0.725rem', color: 'var(--text-primary)' }}>
                # In your root .env file:<br />
                TINYFISH_API_KEY=tf_live_your_actual_api_key_here
              </div>
              <div style={{ marginTop: '0.4rem', fontSize: '0.725rem', color: 'var(--text-secondary)' }}>
                You can explore the <strong>HISTORICAL SAMPLE</strong> or <strong>DEMO</strong> modes which include authentic verified ground-truth records.
              </div>
            </div>
          )}

          {statusMessage && isConfigured && (
            <div style={{ fontSize: '0.75rem', color: 'var(--color-info)', padding: '0.25rem 0' }}>
              {statusMessage}
            </div>
          )}

          {/* Results List */}
          {results.length > 0 && (
            <div style={{ marginTop: '0.25rem' }}>
              <div className="section-label">
                Discovered Evidence Sources ({results.length})
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {results.map((rec) => {
                  const isAttached = attachedUrls.has(rec.url);
                  return (
                    <div key={rec.id} className="evidence-card">
                      <div className="evidence-header">
                        <span className={`source-badge ${rec.source_type}`}>
                          {rec.is_official ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <ShieldCheck size={10} /> Official Agency
                            </span>
                          ) : (
                            rec.source_type.replace('_', ' ')
                          )}
                        </span>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                          Rel: {Math.round(rec.relevance_score * 100)}%
                        </span>
                      </div>

                      <a
                        href={rec.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="evidence-title"
                      >
                        <span>{rec.title}</span>
                        <ExternalLink size={11} />
                      </a>

                      <p className="evidence-snippet">{rec.snippet}</p>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                        <div className="evidence-meta">
                          <span>Domain: <strong>{rec.domain || rec.source_name}</strong></span>
                        </div>

                        {targetIncident && (
                          <button
                            className="btn-secondary"
                            onClick={() => handleAttachItem(rec)}
                            disabled={isAttached}
                            style={{ fontSize: '0.6875rem', padding: '0.2rem 0.45rem' }}
                          >
                            {isAttached ? (
                              <>
                                <CheckCircle size={11} color="var(--color-verified)" />
                                <span>Attached</span>
                              </>
                            ) : (
                              <span>Link to Incident</span>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
