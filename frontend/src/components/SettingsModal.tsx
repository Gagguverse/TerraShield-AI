import React from 'react';
import {
  X,
  SlidersHorizontal,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import type { HealthResponse } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  health: HealthResponse | null;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  health,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <SlidersHorizontal size={16} color="var(--accent-amber)" />
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                System Configuration & Operational Parameters
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>
                Real backend thresholds, API service statuses, and provenance settings
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-tool"
            style={{ padding: '0.25rem', borderRadius: '50%' }}
            aria-label="Close configuration modal"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {/* 1. API Services & Keys Health */}
          <div>
            <div className="section-label">External Upstream Services</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
              {/* NASA FIRMS */}
              <div
                style={{
                  background: 'var(--bg-root)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.785rem' }}>
                    NASA FIRMS API
                  </div>
                  <span
                    className={`status-badge ${health?.firms_configured ? 'CORROBORATED' : 'INSUFFICIENT_EVIDENCE'}`}
                    style={{ fontSize: '0.625rem' }}
                  >
                    {health?.firms_configured ? 'CONFIGURED' : 'UNCONFIGURED'}
                  </span>
                </div>
                <div style={{ fontSize: '0.725rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  Required for streaming real-time satellite fire detections from VIIRS & MODIS.
                </div>
                <div style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                  Backend Env: <code style={{ color: 'var(--accent-orange)' }}>FIRMS_MAP_KEY</code>
                </div>
                {!health?.firms_configured && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <a
                      href="https://firms.modaps.eosdis.nasa.gov/api/map_key"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontSize: '0.6875rem',
                        color: 'var(--accent-amber)',
                        textDecoration: 'none',
                      }}
                    >
                      <span>Obtain Free Map Key</span>
                      <ExternalLink size={11} />
                    </a>
                  </div>
                )}
              </div>

                {/* TinyFish */}
                <div
                  style={{
                    background: 'var(--bg-root)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.785rem' }}>
                      TinyFish Search & Fetch
                    </div>
                    <span
                      className={`status-badge ${health?.tinyfish_configured ? 'CORROBORATED' : 'INSUFFICIENT_EVIDENCE'}`}
                      style={{ fontSize: '0.625rem' }}
                    >
                      {health?.tinyfish_configured ? 'CONFIGURED' : 'UNCONFIGURED'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.725rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    Discovers public advisories and fetches rendered web text for corroboration.
                  </div>
                  <div style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                    Backend Env: <code style={{ color: 'var(--accent-orange)' }}>TINYFISH_API_KEY</code>
                  </div>
                  {!health?.tinyfish_configured && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <a
                        href="https://www.tinyfish.ai/"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          fontSize: '0.6875rem',
                          color: 'var(--accent-amber)',
                          textDecoration: 'none',
                        }}
                      >
                        <span>Obtain TinyFish Key</span>
                        <ExternalLink size={11} />
                      </a>
                    </div>
                  )}
                </div>

                {/* CARTO Maps API */}
                <div
                  style={{
                    background: 'var(--bg-root)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.75rem',
                    gridColumn: 'span 2',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.785rem' }}>
                      CARTO Basemaps API (Dark Matter)
                    </div>
                    <span
                      className={`status-badge ${health?.carto_configured ? 'CORROBORATED' : 'NEEDS_REVIEW'}`}
                      style={{ fontSize: '0.625rem' }}
                    >
                      {health?.carto_configured ? 'KEY CONFIGURED' : 'API KEY REQUIRED'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.725rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    NASA EOSDIS GIBS True-Color satellite imagery is prioritized by default. When toggled to CARTO Dark Matter, raster tiles are loaded with the authenticated key query parameter (<code style={{ color: 'var(--accent-orange)' }}>?key=...</code>). Note: client-side basemap keys are visible to browser users in HTTP network requests as standard for web maps.
                  </div>
                  <div style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                    Env: <code style={{ color: 'var(--accent-orange)' }}>CARTO_API_KEY</code> / <code>VITE_CARTO_API_KEY</code>
                  </div>
                </div>
              </div>
            </div>

          {/* 2. Deterministic Verification Thresholds */}
          <div>
            <div className="section-label">Deterministic Verification Rules</div>
            <div className="telemetry-grid">
              <div className="telemetry-box">
                <div className="label">Max Corroboration Distance</div>
                <div className="val">35.0 km</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                  Spatial tolerance between satellite centroid & report location
                </div>
              </div>

              <div className="telemetry-box">
                <div className="label">Max Temporal Delta</div>
                <div className="val">72.0 hours</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                  Observation lookback window for matching reports
                </div>
              </div>

              <div className="telemetry-box">
                <div className="label">Min Independent Sources</div>
                <div className="val">2 distinct domains</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                  Syndicated news reprints count as a single source
                </div>
              </div>

              <div className="telemetry-box">
                <div className="label">Official Advisory Weight</div>
                <div className="val">Priority Override</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                  Government emergency agency advisories grant high authority
                </div>
              </div>
            </div>
          </div>

          {/* 3. Security & Provenance Guarantee */}
          <div
            style={{
              background: 'var(--bg-root)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.75rem',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.45,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-verified)', fontWeight: 600, marginBottom: '0.25rem' }}>
              <ShieldCheck size={14} />
              <span>Zero-Leakage Security Guarantee</span>
            </div>
            <div>
              All external credentials (<code style={{ color: 'var(--text-primary)' }}>FIRMS_MAP_KEY</code>, <code style={{ color: 'var(--text-primary)' }}>TINYFISH_API_KEY</code>) are stored exclusively in the backend runtime environment. Secret values are never transmitted to frontend clients, logged, or exposed in client bundles.
            </div>
          </div>
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
