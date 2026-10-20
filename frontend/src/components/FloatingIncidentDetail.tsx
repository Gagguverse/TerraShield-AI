import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Flame,
  Search,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  LocateFixed,
  ShieldAlert,
  FileText,
  RefreshCw,
  Sparkles,
  Satellite,
  Clock,
} from 'lucide-react';
import { api } from '../services/api';
import type { Incident, SatelliteDetection } from '../types';

interface FloatingIncidentDetailProps {
  incident: Incident | null;
  selectedDetection: SatelliteDetection | null;
  onClose: () => void;
  onOpenEvidence?: (incident: Incident) => void;
  onReverify?: (incidentId: string) => void;
  isVerifying?: boolean;
  onZoomToIncident?: (lat: number, lon: number) => void;
  onOpenDossier?: (incidentId: string) => void;
  onInvestigateComplete?: () => void;
  layoutMode?: 'floating' | 'docked';
}

export const FloatingIncidentDetail: React.FC<FloatingIncidentDetailProps> = ({
  incident,
  selectedDetection,
  onClose,
  onOpenEvidence,
  onReverify,
  isVerifying = false,
  onZoomToIncident,
  onOpenDossier,
  onInvestigateComplete,
  layoutMode = 'floating',
}) => {
  const [investigationStage, setInvestigationStage] = useState<
    'idle' | 'preparing' | 'searching' | 'fetching' | 'synthesizing' | 'ready' | 'failed'
  >('idle');
  const [investigationError, setInvestigationError] = useState<string | null>(null);

  const recordId = incident ? incident.id : (selectedDetection ? selectedDetection.id : null);
  const activeRecordIdRef = useRef<string | null>(recordId);
  activeRecordIdRef.current = recordId;

  // Reset stage and error immediately when selected hotspot/incident changes
  useEffect(() => {
    setInvestigationStage('idle');
    setInvestigationError(null);
  }, [recordId]);

  // Support Escape key to dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!incident && !selectedDetection) return null;

  // Determine primary display entity
  const isCluster = !!incident;
  const title = incident ? incident.name : `Thermal Hotspot ${selectedDetection?.id}`;
  const region = incident ? incident.region : (selectedDetection?.satellite === 'N' ? 'Suomi-NPP VIIRS Pass' : 'Satellite Telemetry');
  const lat = incident ? incident.latitude : (selectedDetection?.latitude || 0);
  const lon = incident ? incident.longitude : (selectedDetection?.longitude || 0);
  const frp = incident ? incident.max_frp : selectedDetection?.frp;
  const brightness = incident ? incident.max_brightness : (selectedDetection?.bright_ti4 || selectedDetection?.bright_ti5);
  const detectionCount = incident ? incident.detection_count : 1;
  const status = incident?.verification?.status || 'INSUFFICIENT_EVIDENCE';
  const uncertainty = incident?.verification?.uncertainty_score ?? 0.85;

  // Observation time & sensor metadata
  const obsTime = incident
    ? incident.first_detected?.replace('T', ' ').substring(0, 16) || 'Archived'
    : selectedDetection
    ? `${selectedDetection.acq_date || ''} ${selectedDetection.acq_time || ''} UTC`.trim()
    : 'N/A';

  const sensorName = selectedDetection
    ? `${selectedDetection.satellite || 'SNPP'} ${selectedDetection.instrument || 'VIIRS'}`
    : incident?.primary_detection
    ? `${incident.primary_detection.satellite || 'NASA'} ${incident.primary_detection.instrument || 'VIIRS'}`
    : 'NASA FIRMS Sensor';

  const isCorroborated = status === 'CORROBORATED';
  const isReview = status === 'NEEDS_REVIEW';

  const statusBadgeColor = isCorroborated
    ? 'var(--color-verified)'
    : isReview
    ? 'var(--accent-amber)'
    : 'var(--text-tertiary)';

  const statusBg = isCorroborated
    ? 'var(--color-verified-subtle)'
    : isReview
    ? 'var(--accent-amber-subtle)'
    : 'var(--color-insufficient-subtle)';

  const statusBorder = isCorroborated
    ? 'var(--color-verified-border)'
    : isReview
    ? 'var(--accent-amber-border)'
    : 'var(--border-subtle)';

  const handleInvestigate = async () => {
    if (!recordId) return;
    const currentId = recordId;
    setInvestigationStage('preparing');
    setInvestigationError(null);

    try {
      await new Promise((r) => setTimeout(r, 250));
      if (activeRecordIdRef.current !== currentId) return;

      setInvestigationStage('searching');
      const result = await api.investigateIncident(currentId);

      if (activeRecordIdRef.current !== currentId) return;

      if (result.status === 'failed' || result.status === 'error') {
        setInvestigationStage('failed');
        setInvestigationError(result.message || 'Investigation workflow failed.');
        return;
      }

      setInvestigationStage('ready');

      if (onInvestigateComplete) {
        onInvestigateComplete();
      }

      if (onOpenDossier) {
        onOpenDossier(currentId);
      }
    } catch (err: any) {
      if (activeRecordIdRef.current !== currentId) return;
      setInvestigationStage('failed');
      setInvestigationError(err.message || 'Investigation request failed.');
    }
  };

  return (
    <div
      className={layoutMode === 'docked' ? 'rocket-docked-card' : 'rocket-floating-card'}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. Header Bar: Tag & Close Button */}
      <div className="floating-card-header">
        <div className="floating-card-tag">
          <Flame size={12} color="var(--accent-orange)" />
          <span>{isCluster ? 'CLUSTERED FIRE INCIDENT' : 'NASA VIIRS HOTSPOT'}</span>
          <span className="dot-separator">•</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-tertiary)' }}>
            {recordId}
          </span>
        </div>
        <button
          className="floating-card-close"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          title="Dismiss detail card (Esc)"
          aria-label="Close"
          id="btn-close-hotspot-popup"
        >
          <X size={14} />
        </button>
      </div>

      {/* 2. Title & Region */}
      <div className="floating-card-title-group">
        <h3 className="floating-card-title">{title}</h3>
        <div className="floating-card-subtitle">
          <span>{region}</span>
          <span className="dot-separator">•</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            {detectionCount} {detectionCount === 1 ? 'detection' : 'satellite detections'}
          </span>
          {onZoomToIncident && (
            <button
              onClick={() => onZoomToIncident(lat, lon)}
              className="btn-locate-link"
              title="Center map camera on these coordinates"
            >
              <LocateFixed size={11} />
              <span>Center</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. 2x2 Telemetry Grid */}
      <div className="rocket-grid-2x2">
        <div className="rocket-grid-cell">
          <span className="cell-label">RADIATIVE POWER</span>
          <span className="cell-value tabular-nums" style={{ color: 'var(--accent-orange)' }}>
            {frp != null ? `${frp.toFixed(1)} MW` : 'N/A'}
          </span>
        </div>

        <div className="rocket-grid-cell">
          <span className="cell-label">THERMAL TEMP</span>
          <span className="cell-value tabular-nums">
            {brightness != null ? `${brightness.toFixed(1)} K` : 'N/A'}
          </span>
        </div>

        <div className="rocket-grid-cell">
          <span className="cell-label">LATITUDE</span>
          <span className="cell-value mono tabular-nums">
            {lat.toFixed(4)}° {lat >= 0 ? 'N' : 'S'}
          </span>
        </div>

        <div className="rocket-grid-cell">
          <span className="cell-label">LONGITUDE</span>
          <span className="cell-value mono tabular-nums">
            {lon.toFixed(4)}° {lon >= 0 ? 'E' : 'W'}
          </span>
        </div>
      </div>

      {/* Observation Metadata Strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.35rem 0.65rem',
          background: 'rgba(255, 255, 255, 0.03)',
          borderRadius: '4px',
          fontSize: '10.5px',
          color: 'var(--text-tertiary)',
          margin: '0.45rem 0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Clock size={11} />
          <span>Observed:</span>
          <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{obsTime}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Satellite size={11} />
          <span style={{ color: 'var(--text-secondary)' }}>{sensorName}</span>
        </div>
      </div>

      {/* 4. Explainable Verification Status Bar */}
      <div
        className="floating-card-verification"
        style={{
          backgroundColor: statusBg,
          borderColor: statusBorder,
        }}
      >
        <div className="verification-status-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            {isCorroborated && <CheckCircle2 size={13} color="var(--color-verified)" />}
            {isReview && <AlertTriangle size={13} color="var(--accent-amber)" />}
            {!isCorroborated && !isReview && <HelpCircle size={13} color="var(--text-tertiary)" />}
            <span style={{ fontWeight: 600, color: statusBadgeColor, fontSize: '11px' }}>
              {isCluster ? status.replace('_', ' ') : 'RAW SATELLITE DETECTION'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ fontSize: '10.5px', color: 'var(--text-tertiary)' }}>Uncertainty:</span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                fontSize: '11px',
                color: uncertainty < 0.3 ? 'var(--color-verified)' : uncertainty < 0.6 ? 'var(--accent-amber)' : 'var(--color-danger)',
              }}
            >
              {Math.round(uncertainty * 100)}%
            </span>
          </div>
        </div>

        <p className="verification-rationale-text">
          {incident?.verification?.rationale ||
            'Raw orbital thermal anomaly from NASA FIRMS. Does not confirm ground wildfire without field evidence.'}
        </p>
      </div>

      {/* 5. Investigation Workflow Status */}
      {investigationStage !== 'idle' && (
        <div
          style={{
            margin: '0.5rem 0',
            padding: '0.5rem 0.75rem',
            borderRadius: '4px',
            background: investigationStage === 'failed' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(249, 115, 22, 0.12)',
            border: `1px solid ${investigationStage === 'failed' ? 'rgba(239, 68, 68, 0.35)' : 'rgba(249, 115, 22, 0.3)'}`,
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
          }}
        >
          {investigationStage === 'failed' ? (
            <AlertTriangle size={13} style={{ color: 'var(--color-danger)' }} />
          ) : investigationStage === 'ready' ? (
            <CheckCircle2 size={13} style={{ color: 'var(--color-verified)' }} />
          ) : (
            <RefreshCw size={13} className="animate-spin" style={{ color: 'var(--accent-orange)' }} />
          )}
          <span style={{ color: investigationStage === 'failed' ? 'var(--color-danger)' : 'var(--text-primary)' }}>
            {investigationStage === 'preparing' && 'Preparing context & queries...'}
            {investigationStage === 'searching' && 'Searching corroborating sources via TinyFish...'}
            {investigationStage === 'fetching' && 'Retrieving source evidence & bulletins...'}
            {investigationStage === 'synthesizing' && 'Synthesizing report via Groq Cloud GPT-OSS...'}
            {investigationStage === 'ready' && 'Report ready! Opening TerraShield Intelligence Report...'}
            {investigationStage === 'failed' && (investigationError || 'Investigation failed.')}
          </span>
        </div>
      )}

      {/* 6. Universal Action Buttons (Available for ALL record types) */}
      <div className="floating-card-actions" style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.5rem' }}>
        {recordId && (
          <button
            className="btn-floating-primary"
            onClick={handleInvestigate}
            disabled={investigationStage !== 'idle' && investigationStage !== 'ready' && investigationStage !== 'failed'}
            id="floating-investigate-btn"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              padding: '0.55rem',
              fontWeight: 600,
              background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.25), rgba(245, 158, 11, 0.25))',
              borderColor: 'var(--accent-orange)',
              color: 'var(--accent-orange)',
            }}
            title="Execute authentic end-to-end TinyFish evidence retrieval and Groq Cloud intelligence synthesis"
          >
            {investigationStage === 'preparing' || investigationStage === 'searching' || investigationStage === 'fetching' || investigationStage === 'synthesizing' ? (
              <RefreshCw size={13} className="animate-spin" />
            ) : investigationStage === 'failed' ? (
              <RefreshCw size={13} />
            ) : (
              <Sparkles size={13} />
            )}
            <span>
              {investigationStage === 'idle'
                ? 'Investigate with TinyFish + Groq'
                : investigationStage === 'ready'
                ? 'Re-investigate with TinyFish + Groq'
                : investigationStage === 'failed'
                ? 'Retry Investigation with TinyFish + Groq'
                : investigationStage === 'preparing'
                ? 'Validating Context...'
                : investigationStage === 'searching'
                ? 'Searching TinyFish Evidence...'
                : investigationStage === 'fetching'
                ? 'Fetching Source Bulletins...'
                : 'Synthesizing with Groq...'}
            </span>
          </button>
        )}

        <div style={{ display: 'flex', gap: '0.4rem', width: '100%' }}>
          {recordId && onOpenDossier && (
            <button
              className="btn-floating-secondary"
              onClick={() => onOpenDossier(recordId)}
              title="Open comprehensive, source-grounded TerraShield Intelligence Report"
              id="floating-open-dossier-btn"
              style={{ flex: 1, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', fontSize: '11px' }}
            >
              <FileText size={12} style={{ color: 'var(--color-info)' }} />
              <span>View Intelligence Report</span>
            </button>
          )}

          {incident && onOpenEvidence && (
            <button
              className="btn-floating-secondary"
              onClick={() => onOpenEvidence(incident)}
              title="Inspect public evidence, news, and official advisories for this location"
              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.6rem', fontSize: '11px' }}
            >
              <Search size={11} />
              <span>Evidence</span>
              {incident.evidence && incident.evidence.length > 0 && (
                <span className="badge-count-pill">{incident.evidence.length}</span>
              )}
            </button>
          )}

          {onZoomToIncident && (
            <button
              className="btn-floating-secondary"
              onClick={() => onZoomToIncident(lat, lon)}
              title="Focus map camera on these coordinates"
              id="btn-focus-map-action"
              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.6rem', fontSize: '11px' }}
            >
              <LocateFixed size={11} />
              <span>Focus Map</span>
            </button>
          )}

          {incident && onReverify && (
            <button
              className="btn-floating-secondary"
              onClick={() => onReverify(incident.id)}
              disabled={isVerifying}
              title="Re-run deterministic verification rules with latest evidence"
              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.6rem', fontSize: '11px' }}
            >
              <ShieldAlert size={11} className={isVerifying ? 'animate-spin' : ''} />
              <span>{isVerifying ? 'Verifying...' : 'Re-verify'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
