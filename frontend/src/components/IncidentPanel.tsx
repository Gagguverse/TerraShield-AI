import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  Search,
  RefreshCw,
  Copy,
  Check,
  Radio,
  Satellite,
  ChevronDown,
  ChevronUp,
  FileText,
  ShieldCheck,
  Info,
} from 'lucide-react';
import type { Incident } from '../types';

interface IncidentPanelProps {
  incident: Incident | null;
  onOpenTinyFishSearch: (incident: Incident) => void;
  onReverify: (incidentId: string) => Promise<void>;
  isVerifying: boolean;
}

export const IncidentPanel: React.FC<IncidentPanelProps> = ({
  incident,
  onOpenTinyFishSearch,
  onReverify,
  isVerifying,
}) => {
  const [copied, setCopied] = useState(false);
  const [showAllDetections, setShowAllDetections] = useState(false);
  const [expandedEvidenceId, setExpandedEvidenceId] = useState<string | null>(null);

  if (!incident) {
    return (
      <div className="incident-investigation-panel" style={{ justifyContent: 'center', alignItems: 'center', padding: '2rem', textAlign: 'center' }}>
        <Radio size={32} color="var(--text-tertiary)" style={{ marginBottom: '0.75rem' }} />
        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
          No Incident Selected
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: '280px', lineHeight: 1.45 }}>
          Select a fire marker on the geospatial map or choose an incident from the investigation queue to inspect telemetry, evidence trail, and deterministic verification.
        </div>
      </div>
    );
  }

  const { verification } = incident;

  const handleCopyCoords = () => {
    navigator.clipboard.writeText(`${incident.latitude.toFixed(5)}, ${incident.longitude.toFixed(5)}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const detectionsToDisplay = showAllDetections
    ? incident.detections
    : incident.detections.slice(0, 3);

  return (
    <div className="incident-investigation-panel">
      {/* Header */}
      <div className="investigation-header">
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
              {incident.id}
            </span>
            <span className={`status-badge ${verification.status}`}>
              {verification.status === 'CORROBORATED' && <CheckCircle2 size={11} />}
              {verification.status === 'NEEDS_REVIEW' && <AlertCircle size={11} />}
              {verification.status === 'INSUFFICIENT_EVIDENCE' && <HelpCircle size={11} />}
              {verification.status.replace('_', ' ')}
            </span>
          </div>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.25 }}>
            {incident.name}
          </h2>
          <div style={{ fontSize: '0.725rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
            {incident.region}
          </div>
        </div>

        <button
          onClick={handleCopyCoords}
          className="btn-secondary"
          style={{ padding: '0.25rem 0.5rem', fontSize: '0.6875rem', flexShrink: 0 }}
          title="Copy Centroid Coordinates"
        >
          {copied ? <Check size={11} color="var(--color-verified)" /> : <Copy size={11} />}
          <span style={{ fontFamily: 'var(--font-mono)' }}>
            {incident.latitude.toFixed(3)}, {incident.longitude.toFixed(3)}
          </span>
        </button>
      </div>

      {/* Body */}
      <div className="investigation-body">
        {/* Telemetry Summary */}
        <div>
          <div className="section-label">
            <span>Satellite Observation Telemetry</span>
            <Satellite size={12} color="var(--accent-orange)" />
          </div>
          <div className="telemetry-grid">
            <div className="telemetry-box">
              <div className="label">Clustered Hotspots</div>
              <div className="val">{incident.detection_count} detections</div>
            </div>
            <div className="telemetry-box">
              <div className="label">Peak FRP</div>
              <div className="val">{incident.max_frp ? `${incident.max_frp} MW` : 'N/A'}</div>
            </div>
            <div className="telemetry-box">
              <div className="label">Peak Brightness</div>
              <div className="val">{incident.max_brightness ? `${incident.max_brightness} K` : 'N/A'}</div>
            </div>
            <div className="telemetry-box">
              <div className="label">Sensor / Orbit</div>
              <div className="val">VIIRS 375m NRT</div>
            </div>
          </div>
        </div>

        {/* Verification Engine Decision & Rationale */}
        <div>
          <div className="section-label">
            <span>Verification Rationale</span>
            <span style={{ color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>
              Uncertainty: {Math.round(verification.uncertainty_score * 100)}%
            </span>
          </div>

          <div className={`rationale-card ${verification.status}`}>
            {verification.rationale}
          </div>
        </div>

        {/* Satellite vs Public Evidence Notice */}
        <div
          style={{
            background: 'var(--bg-root)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-xs)',
            padding: '0.55rem 0.75rem',
            fontSize: '0.725rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.45,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--color-info)', fontWeight: 600, marginBottom: '0.2rem' }}>
            <Info size={12} />
            <span>Independent Data Modalities</span>
          </div>
          <div>
            Satellite hotspots reflect orbital thermal radiance detections. Public reports represent municipal advisories and news media.
            <strong style={{ color: 'var(--text-primary)' }}> A lack of public reports does not mean a fire is absent.</strong>
          </div>
        </div>

        {/* Satellite Hotspot Detections in this Cluster */}
        <div>
          <div className="section-label">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--accent-orange)' }}>
              <Satellite size={12} />
              <span>FIRMS Detections ({incident.detection_count})</span>
            </div>
            {incident.detections.length > 3 && (
              <button
                onClick={() => setShowAllDetections(!showAllDetections)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--accent-amber)',
                  fontSize: '0.6875rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.15rem',
                }}
              >
                <span>{showAllDetections ? 'Show Less' : `View All (${incident.detections.length})`}</span>
                {showAllDetections ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {detectionsToDisplay.map((det) => (
              <div
                key={det.id}
                style={{
                  background: 'var(--bg-root)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-xs)',
                  padding: '0.45rem 0.65rem',
                  fontSize: '0.725rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                    {det.latitude.toFixed(4)}, {det.longitude.toFixed(4)}
                  </span>
                  <span
                    style={{
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      color: det.confidence === 'high' ? 'var(--color-danger)' : 'var(--accent-orange)',
                      textTransform: 'uppercase',
                    }}
                  >
                    {det.confidence} confidence
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-tertiary)', fontSize: '0.6875rem', fontFamily: 'var(--font-mono)' }}>
                  <span>{det.acq_date} {det.acq_time} UTC</span>
                  <span>{det.satellite}/{det.instrument}</span>
                  <span>FRP: {det.frp ? `${det.frp} MW` : 'N/A'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Deterministic Rules Checklist */}
        <div>
          <div className="section-label">Deterministic Rules Evaluation</div>
          <div className="condition-list">
            {verification.conditions_met.map((c) => (
              <div key={c.code} className="condition-item met">
                <CheckCircle2 size={13} color="var(--color-verified)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: '0.6875rem' }}>{c.details}</div>
                </div>
              </div>
            ))}
            {verification.conditions_failed.map((c) => (
              <div key={c.code} className="condition-item failed">
                <AlertCircle size={13} color="var(--color-danger)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: 600, color: '#fca5a5' }}>{c.name}</div>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: '0.6875rem' }}>{c.details}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Missing Evidence Gaps */}
        {verification.missing_evidence.length > 0 && (
          <div>
            <div className="section-label" style={{ color: 'var(--accent-amber)' }}>
              Evidence Gaps Preventing Corroboration
            </div>
            <ul style={{ paddingLeft: '1.15rem', fontSize: '0.725rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {verification.missing_evidence.map((gap, idx) => (
                <li key={idx}>{gap}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Associated Public Evidence Sources */}
        <div>
          <div className="section-label">
            <span>Linked Public Evidence ({incident.evidence.length})</span>
            <button
              className="btn-tool btn-accent"
              onClick={() => onOpenTinyFishSearch(incident)}
              style={{ fontSize: '0.6875rem', height: '24px', padding: '0 0.45rem' }}
            >
              <Search size={11} />
              <span>Search TinyFish</span>
            </button>
          </div>

          {incident.evidence.length === 0 ? (
            <div
              style={{
                background: 'var(--bg-root)',
                border: '1px dashed var(--border-subtle)',
                padding: '0.85rem',
                borderRadius: 'var(--radius-xs)',
                textAlign: 'center',
                fontSize: '0.75rem',
                color: 'var(--text-tertiary)',
              }}
            >
              No public advisories or news reports attached yet. Use Search TinyFish to discover public evidence.
            </div>
          ) : (
            <div className="evidence-list">
              {incident.evidence.map((ev) => (
                <div key={ev.id} className="evidence-card">
                  <div className="evidence-header">
                    <span className={`source-badge ${ev.source_type}`}>
                      {ev.is_official ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <ShieldCheck size={10} /> Official Agency
                        </span>
                      ) : (
                        ev.source_type.replace('_', ' ')
                      )}
                    </span>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                      Rel: {Math.round(ev.relevance_score * 100)}%
                    </span>
                  </div>

                  <a
                    href={ev.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="evidence-title"
                  >
                    <span>{ev.title}</span>
                    <ExternalLink size={11} />
                  </a>

                  <p className="evidence-snippet">{ev.snippet}</p>

                  {/* TinyFish Fetch full text drawer */}
                  {ev.full_text && (
                    <div style={{ marginTop: '0.25rem' }}>
                      <button
                        onClick={() =>
                          setExpandedEvidenceId(expandedEvidenceId === ev.id ? null : ev.id)
                        }
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--accent-amber)',
                          fontSize: '0.6875rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                          padding: 0,
                        }}
                      >
                        <FileText size={11} />
                        <span>
                          {expandedEvidenceId === ev.id
                            ? 'Hide Fetched Text'
                            : 'View TinyFish Page Extract'}
                        </span>
                      </button>

                      {expandedEvidenceId === ev.id && (
                        <div
                          style={{
                            marginTop: '0.35rem',
                            padding: '0.45rem',
                            background: 'var(--bg-root)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-xs)',
                            fontSize: '0.6875rem',
                            color: 'var(--text-secondary)',
                            maxHeight: '150px',
                            overflowY: 'auto',
                            whiteSpace: 'pre-wrap',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {ev.full_text}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="evidence-meta">
                    <span>Source: <strong>{ev.source_name}</strong></span>
                    {ev.event_date && <span>Date: {ev.event_date}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
          <button
            className="btn-secondary"
            onClick={() => onReverify(incident.id)}
            disabled={isVerifying}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            <RefreshCw size={12} className={isVerifying ? 'animate-spin' : ''} />
            <span>Re-evaluate Verification</span>
          </button>
        </div>
      </div>
    </div>
  );
};
