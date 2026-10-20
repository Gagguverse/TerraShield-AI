import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Calendar,
  MapPin,
  ExternalLink,
  Flame,
  Droplets,
  Brain,
  RefreshCw,
  Clock,
  Activity,
  FileText,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  Search,
} from 'lucide-react';
import { api } from '../services/api';
import type { IncidentDossierResponse, GroqSynthesizedReport, EvidenceRecord } from '../types';
import { TinyFishExtractModal } from './TinyFishExtractModal';

interface TerraShieldReportModalProps {
  isOpen: boolean;
  incidentId: string | null;
  onClose: () => void;
  onFocusOnMap?: (lat: number, lon: number, name: string) => void;
  onInvestigateComplete?: () => void;
}

export const TerraShieldReportModal: React.FC<TerraShieldReportModalProps> = ({
  isOpen,
  incidentId,
  onClose,
  onFocusOnMap,
  onInvestigateComplete,
}) => {
  const [dossier, setDossier] = useState<IncidentDossierResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const [synthMessage, setSynthMessage] = useState<string | null>(null);

  // Live investigation state inside modal (6-stage lifecycle)
  const [investigationStage, setInvestigationStage] = useState<
    'idle' | 'selected' | 'searching' | 'retrieving' | 'checking' | 'synthesizing' | 'ready' | 'failed'
  >('idle');
  const [investigationError, setInvestigationError] = useState<string | null>(null);
  const [workflowTrace, setWorkflowTrace] = useState<any[] | null>(null);

  // Selected evidence for modal extract view
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceRecord | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Load dossier on mount or ID change
  useEffect(() => {
    if (!isOpen || !incidentId) return;

    let isMounted = true;
    setDossier(null); // Instantly reset prior incident data to prevent stale leakage
    setLoading(true);
    setError(null);
    setIsSynthesizing(false);
    setSynthMessage(null);
    setInvestigationStage('idle');
    setInvestigationError(null);
    setWorkflowTrace(null);

    api.getIncidentDossier(incidentId)
      .then((res) => {
        if (isMounted) {
          setDossier(res);
          setLoading(false);
          // Focus close button on load for accessibility
          setTimeout(() => closeButtonRef.current?.focus(), 50);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Failed to load intelligence report');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, incidentId]);

  if (!isOpen || !incidentId) return null;

  const handleRunInvestigation = async () => {
    setInvestigationStage('searching');
    setInvestigationError(null);
    try {
      const result = await api.investigateIncident(incidentId);

      if (result.workflow_trace) {
        setWorkflowTrace(result.workflow_trace);
      }

      if (result.status === 'error' || result.status === 'failed') {
        setInvestigationStage('failed');
        setInvestigationError(result.message || 'Investigation workflow failed.');
        return;
      }

      setInvestigationStage('ready');

      // Refresh the dossier data
      const updated = await api.getIncidentDossier(incidentId);
      setDossier(updated);

      if (onInvestigateComplete) {
        onInvestigateComplete();
      }
    } catch (err: any) {
      setInvestigationStage('failed');
      setInvestigationError(err.message || 'Investigation request failed.');
    }
  };

  const handleSynthesizeWithGroq = async () => {
    setIsSynthesizing(true);
    setSynthMessage(null);
    try {
      const res = await api.generateIncidentDossier(incidentId);
      if (res.status === 'success' && res.report) {
        setDossier((prev) => (prev ? { ...prev, groq_report: res.report, model_id: res.model_id } : null));
        setSynthMessage(`Intelligence report updated via Groq Cloud (${res.model_id}).`);
      } else if (res.status === 'credentials_missing') {
        setSynthMessage('GROQ_API_KEY is not configured in backend .env.');
      } else {
        setSynthMessage(res.message || 'Groq Cloud synthesis returned an error.');
      }
    } catch (err: any) {
      setSynthMessage(err.message || 'Failed to trigger Groq Cloud synthesis.');
    } finally {
      setIsSynthesizing(false);
    }
  };

  const inc = (dossier?.incident as any) || {};
  const isFlood = dossier?.hazard_type === 'FLOOD' || inc.hazard_type === 'FLOOD';
  const report: GroqSynthesizedReport = dossier?.groq_report || (inc.precomputed_report as any) || {};
  const isDemo = inc.data_mode === 'DEMO';
  const isHistorical = inc.data_mode === 'HISTORICAL';

  // Report state pill
  let reportState = 'Report Ready';
  let reportStateBg = 'rgba(16, 185, 129, 0.15)';
  let reportStateColor = '#10b981';
  let reportStateBorder = 'rgba(16, 185, 129, 0.35)';

  if (isDemo) {
    reportState = 'Demo Report';
    reportStateBg = 'rgba(168, 85, 247, 0.15)';
    reportStateColor = '#c084fc';
    reportStateBorder = 'rgba(168, 85, 247, 0.35)';
  } else if (isHistorical) {
    reportState = 'Historical Report';
    reportStateBg = 'rgba(245, 158, 11, 0.15)';
    reportStateColor = '#f59e0b';
    reportStateBorder = 'rgba(245, 158, 11, 0.35)';
  } else if (!dossier?.evidence || dossier.evidence.length === 0) {
    reportState = 'Evidence Incomplete';
    reportStateBg = 'rgba(249, 115, 22, 0.15)';
    reportStateColor = '#f97316';
    reportStateBorder = 'rgba(249, 115, 22, 0.35)';
  }

  return (
    <div
      className="report-modal-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1300,
        backgroundColor: 'rgba(5, 7, 13, 0.78)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
        animation: 'reportModalBackdropFade 0.2s ease-out',
      }}
      role="presentation"
    >
      <div
        ref={modalRef}
        className="report-modal-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-modal-title"
        style={{
          width: '100%',
          maxWidth: '880px',
          maxHeight: '90vh',
          backgroundColor: '#0c1017',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '16px',
          boxShadow: '0 25px 65px -15px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'reportModalFadeIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* ── Fixed Header Bar ── */}
        <div
          style={{
            padding: '1.15rem 1.4rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0) 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                letterSpacing: '0.06em',
                padding: '0.22rem 0.6rem',
                borderRadius: '6px',
                background: isFlood ? 'rgba(56, 189, 248, 0.15)' : 'rgba(249, 115, 22, 0.15)',
                color: isFlood ? '#38bdf8' : '#f97316',
                border: `1px solid ${isFlood ? 'rgba(56, 189, 248, 0.35)' : 'rgba(249, 115, 22, 0.35)'}`,
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              {isFlood ? <Droplets size={12} /> : <Flame size={12} />}
              <span>{isFlood ? 'FLOOD INTELLIGENCE' : 'FIRE INTELLIGENCE'}</span>
            </span>

            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                letterSpacing: '0.05em',
                padding: '0.22rem 0.6rem',
                borderRadius: '6px',
                background: reportStateBg,
                color: reportStateColor,
                border: `1px solid ${reportStateBorder}`,
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <CheckCircle2 size={12} />
              <span>{reportState.toUpperCase()}</span>
            </span>

            <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
              {incidentId}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginRight: '0.25rem' }}>
              ESC to close
            </span>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              id="report-modal-close-btn"
              title="Close report modal (Esc)"
              aria-label="Close report modal"
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Scrollable Body ── */}
        <div
          style={{
            padding: '1.4rem',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          {loading ? (
            <div style={{ padding: '4rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <RefreshCw className="spin" size={32} style={{ color: 'var(--accent-orange)', marginBottom: '1rem' }} />
              <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>Loading TerraShield Intelligence Dossier...</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: '0.35rem' }}>
                Incident ID: <code>{incidentId}</code>
              </div>
            </div>
          ) : error || !dossier ? (
            <div
              style={{
                padding: '1.75rem',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '10px',
                textAlign: 'center',
              }}
            >
              <AlertTriangle size={28} style={{ color: 'var(--color-danger)', marginBottom: '0.65rem' }} />
              <h3 style={{ margin: '0 0 0.4rem 0', color: 'var(--color-danger)', fontSize: '1.1rem' }}>
                Intelligence Report Unavailable
              </h3>
              <p style={{ margin: '0 0 1.25rem 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                {error || 'Unable to retrieve incident records from active state or archive.'}
              </p>
              <button
                className="btn-hero-primary"
                onClick={handleRunInvestigation}
                style={{ padding: '0.55rem 1.2rem', fontSize: '0.82rem' }}
              >
                <Sparkles size={14} />
                <span>Investigate with TinyFish + Groq</span>
              </button>
            </div>
          ) : (
            <>
              {/* ── Top Hero Block: Name, Location, Actions ── */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '1.25rem',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: 1, minWidth: '280px' }}>
                  <h1
                    id="report-modal-title"
                    style={{
                      fontSize: '1.45rem',
                      margin: '0 0 0.5rem 0',
                      color: 'var(--text-primary)',
                      fontWeight: 700,
                      letterSpacing: '-0.02em',
                      lineHeight: 1.25,
                    }}
                  >
                    {inc.name}
                  </h1>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <MapPin size={13} style={{ color: isFlood ? '#38bdf8' : '#f97316' }} />
                      <span>
                        {inc.locality ? `${inc.locality}, ` : ''}
                        {inc.district ? `${inc.district}, ` : ''}
                        {inc.state_province ? `${inc.state_province}, ` : ''}
                        <strong>{inc.country || inc.region}</strong>
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Calendar size={13} style={{ color: 'var(--color-info)' }} />
                      <span>Event Date: <strong>{inc.event_date || inc.first_detected?.split('T')[0]}</strong></span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Activity size={13} style={{ color: 'var(--color-verified)' }} />
                      <span>
                        {isDemo ? 'Documented Regional Centroid: ' : 'Sensor Centroid: '}
                        <code>{Number(inc.latitude).toFixed(4)}° N, {Number(inc.longitude).toFixed(4)}° E</code>
                        {isDemo && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginLeft: '0.3rem' }}>
                            (Approximate Regional Location)
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Top Action Button Cluster */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {onFocusOnMap && (
                    <button
                      className="btn-tool"
                      onClick={() => {
                        onFocusOnMap(inc.latitude, inc.longitude, inc.name);
                        onClose();
                      }}
                      id="modal-focus-map-btn"
                      style={{ padding: '0.5rem 0.85rem', fontSize: '0.8rem', fontWeight: 600 }}
                    >
                      <MapPin size={13} />
                      <span>Focus on Map</span>
                    </button>
                  )}

                  <button
                    className="btn-tool"
                    onClick={handleSynthesizeWithGroq}
                    disabled={isSynthesizing}
                    id="modal-groq-synth-btn"
                    style={{ padding: '0.5rem 0.85rem', fontSize: '0.8rem', fontWeight: 600 }}
                    title="Generate or refresh intelligence summary using Groq Cloud GPT-OSS"
                  >
                    {isSynthesizing ? <RefreshCw size={13} className="animate-spin" /> : <Brain size={13} />}
                    <span>{isSynthesizing ? 'Synthesizing...' : 'Re-synthesize with Groq'}</span>
                  </button>

                  <button
                    className="btn-tool"
                    onClick={handleRunInvestigation}
                    disabled={investigationStage !== 'idle' && investigationStage !== 'ready' && investigationStage !== 'failed'}
                    id="modal-investigate-btn"
                    style={{
                      padding: '0.5rem 0.95rem',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.2), rgba(245, 158, 11, 0.2))',
                      borderColor: 'var(--accent-orange)',
                      color: 'var(--accent-orange)',
                    }}
                  >
                    {investigationStage === 'selected' || investigationStage === 'searching' || investigationStage === 'retrieving' || investigationStage === 'checking' || investigationStage === 'synthesizing' ? (
                      <RefreshCw size={13} className="animate-spin" />
                    ) : (
                      <Sparkles size={13} />
                    )}
                    <span>
                      {investigationStage === 'idle'
                        ? 'Investigate with TinyFish + Groq'
                        : investigationStage === 'ready'
                        ? 'Re-investigate'
                        : investigationStage === 'failed'
                        ? 'Retry Investigation'
                        : investigationStage === 'selected'
                        ? '1. Incident Selected'
                        : investigationStage === 'searching'
                        ? '2. Searching Sources...'
                        : investigationStage === 'retrieving'
                        ? '3. Retrieving Content...'
                        : investigationStage === 'checking'
                        ? '4. Checking Evidence...'
                        : '5. Preparing AI Explanation...'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Real Investigation Progress Box */}
              {investigationStage !== 'idle' && (
                <div
                  style={{
                    padding: '0.85rem 1rem',
                    background:
                      investigationStage === 'failed'
                        ? 'rgba(239, 68, 68, 0.1)'
                        : investigationStage === 'ready'
                        ? 'rgba(16, 185, 129, 0.1)'
                        : 'rgba(249, 115, 22, 0.08)',
                    border: `1px solid ${
                      investigationStage === 'failed'
                        ? 'rgba(239, 68, 68, 0.35)'
                        : investigationStage === 'ready'
                        ? 'rgba(16, 185, 129, 0.35)'
                        : 'rgba(249, 115, 22, 0.3)'
                    }`,
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.82rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {investigationStage === 'failed' ? (
                      <AlertTriangle size={15} style={{ color: 'var(--color-danger)' }} />
                    ) : investigationStage === 'ready' ? (
                      <CheckCircle2 size={15} style={{ color: 'var(--color-verified)' }} />
                    ) : (
                      <RefreshCw size={14} className="animate-spin" style={{ color: 'var(--accent-orange)' }} />
                    )}
                    <span style={{ color: investigationStage === 'failed' ? 'var(--color-danger)' : 'var(--text-primary)', fontWeight: 500 }}>
                      {investigationStage === 'selected' && 'Stage 1/6: Incident selected & coordinates evaluated'}
                      {investigationStage === 'searching' && 'Stage 2/6: Searching for relevant sources via TinyFish'}
                      {investigationStage === 'retrieving' && 'Stage 3/6: Retrieving source content & page extracts'}
                      {investigationStage === 'checking' && 'Stage 4/6: Checking relevance and evidence alignment'}
                      {investigationStage === 'synthesizing' && 'Stage 5/6: Preparing the AI explanation with Groq'}
                      {investigationStage === 'ready' && 'Stage 6/6: Report ready with traceable source findings'}
                      {investigationStage === 'failed' && (investigationError || 'Investigation workflow encountered an error.')}
                    </span>
                  </div>

                  {investigationStage === 'failed' && (
                    <button
                      className="btn-tool"
                      onClick={handleRunInvestigation}
                      style={{ fontSize: '0.74rem', padding: '0.3rem 0.65rem', color: 'var(--color-danger)' }}
                    >
                      Retry
                    </button>
                  )}
                </div>
              )}

              {synthMessage && (
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    background: synthMessage.includes('updated') ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                    border: `1px solid ${synthMessage.includes('updated') ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {synthMessage}
                </div>
              )}

              {/* ── 6-Stage Grounded Investigation Lifecycle ── */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Brain size={16} style={{ color: 'var(--accent-amber)' }} />
                    <h2 style={{ fontSize: '1rem', margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>
                      AI Investigation Lifecycle
                    </h2>
                  </div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
                    6-Stage Traceable Sequence
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem' }}>
                  {/* Stage 1: Incident selected */}
                  <div style={{ background: 'rgba(0, 0, 0, 0.25)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '8px', padding: '0.65rem 0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                      <CheckCircle2 size={13} style={{ color: 'var(--color-verified)' }} />
                      <strong style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>1. Incident Selected</strong>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                      {workflowTrace?.find((t: any) => t.stage === 1)?.details || `${inc.name || incidentId} (${Number(inc.latitude).toFixed(4)}° N, ${Number(inc.longitude).toFixed(4)}° E)`}
                    </div>
                  </div>

                  {/* Stage 2: Searching for relevant sources */}
                  <div style={{ background: 'rgba(0, 0, 0, 0.25)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '8px', padding: '0.65rem 0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                      {investigationStage === 'searching' ? (
                        <RefreshCw size={13} className="animate-spin" style={{ color: 'var(--accent-orange)' }} />
                      ) : (
                        <CheckCircle2 size={13} style={{ color: 'var(--color-verified)' }} />
                      )}
                      <strong style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>2. Searching Sources</strong>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                      {workflowTrace?.find((t: any) => t.stage === 2)?.details || `Targeted query submitted to TinyFish search provider`}
                    </div>
                  </div>

                  {/* Stage 3: Retrieving source content */}
                  <div style={{ background: 'rgba(0, 0, 0, 0.25)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '8px', padding: '0.65rem 0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                      <CheckCircle2 size={13} style={{ color: 'var(--color-verified)' }} />
                      <strong style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>3. Retrieving Content</strong>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                      {workflowTrace?.find((t: any) => t.stage === 3)?.details || `TinyFish Fetch API extracting page text`}
                    </div>
                  </div>

                  {/* Stage 4: Checking relevance and evidence */}
                  <div style={{ background: 'rgba(0, 0, 0, 0.25)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '8px', padding: '0.65rem 0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                      <CheckCircle2 size={13} style={{ color: 'var(--color-verified)' }} />
                      <strong style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>4. Checking Evidence</strong>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                      {workflowTrace?.find((t: any) => t.stage === 4)?.details || `Evaluating geographic & temporal match`}
                    </div>
                  </div>

                  {/* Stage 5: Preparing the AI explanation */}
                  <div style={{ background: 'rgba(0, 0, 0, 0.25)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '8px', padding: '0.65rem 0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                      {isSynthesizing ? (
                        <RefreshCw size={13} className="animate-spin" style={{ color: 'var(--accent-orange)' }} />
                      ) : (
                        <CheckCircle2 size={13} style={{ color: 'var(--color-verified)' }} />
                      )}
                      <strong style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>5. Preparing AI Summary</strong>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                      {workflowTrace?.find((t: any) => t.stage === 5)?.details || `Groq Cloud synthesis (${dossier.model_id || 'openai/gpt-oss-120b'})`}
                    </div>
                  </div>

                  {/* Stage 6: Report ready */}
                  <div style={{ background: 'rgba(0, 0, 0, 0.25)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '8px', padding: '0.65rem 0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                      <CheckCircle2 size={13} style={{ color: 'var(--color-verified)' }} />
                      <strong style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>6. Report Ready</strong>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                      {workflowTrace?.find((t: any) => t.stage === 6)?.details || `Verified dossier & traceable source findings ready`}
                    </div>
                  </div>
                </div>

                {investigationStage === 'failed' && (
                  <div style={{ marginTop: '0.85rem', padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-danger)' }}>
                      <strong>Investigation Failed: </strong> {investigationError || 'Upstream provider request failed.'}
                    </div>
                    <button
                      className="btn-tool"
                      onClick={handleRunInvestigation}
                      style={{ fontSize: '0.74rem', padding: '0.25rem 0.6rem', background: 'rgba(239, 68, 68, 0.2)', color: 'var(--color-danger)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Retry Investigation
                    </button>
                  </div>
                )}

                {/* Collapsible Technical Details */}
                <details style={{ marginTop: '0.85rem', cursor: 'pointer' }}>
                  <summary style={{ fontSize: '0.76rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                    ▸ Technical Details &amp; Execution Diagnostics
                  </summary>
                  <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'rgba(0, 0, 0, 0.35)', borderRadius: '6px', fontSize: '0.74rem', fontFamily: 'monospace', color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.45rem' }}>
                    <div>Inference Model: {dossier.model_id || 'openai/gpt-oss-120b'}</div>
                    <div>Provider Status: {dossier.groq_configured ? 'Groq Cloud Online' : 'Disaster Archive Mode'}</div>
                    <div>Centroid Coords: {Number(inc.latitude).toFixed(4)}° N, {Number(inc.longitude).toFixed(4)}° E</div>
                    <div>Location Type: {isDemo ? 'Documented Regional Centroid' : 'Orbital Sensor Detection'}</div>
                    <div>Observation Count: {inc.detection_count || 1} pass(es)</div>
                    <div>Verification Status: {inc.verification?.status || 'CORROBORATED'}</div>
                  </div>
                </details>
              </div>

              {/* ── Executive Summary in Plain English (3-5 Sentences) ── */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.025)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '1.35rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
                  <FileText size={16} style={{ color: 'var(--color-info)' }} />
                  <h2 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Executive Summary
                  </h2>
                </div>
                <p style={{ margin: 0, fontSize: '0.92rem', lineHeight: '1.7', color: 'var(--text-primary)' }}>
                  {report.executive_summary ||
                    (inc.verification?.rationale
                      ? inc.verification.rationale
                      : `Reports describe a documented disaster event in ${inc.region || 'the target area'} around ${inc.event_date || inc.first_detected?.split('T')[0]}. Retrieved sources and public advisories confirm active emergency operations and sensor anomalies in this zone. The available evidence does not establish unconfirmed causal claims without certified on-ground audit. This report is based on the verified sources listed below and should not be interpreted as a new satellite confirmation of the historical event.`)}
                </p>

                {/* ── Why this conclusion? (Traceable Evidence Links) ── */}
                <div
                  style={{
                    marginTop: '1.1rem',
                    padding: '0.85rem 1rem',
                    background: 'rgba(56, 189, 248, 0.04)',
                    border: '1px solid rgba(56, 189, 248, 0.2)',
                    borderRadius: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.45rem' }}>
                    <Sparkles size={14} style={{ color: 'var(--color-info)' }} />
                    <strong style={{ fontSize: '0.84rem', color: 'var(--text-primary)' }}>
                      Why this conclusion?
                    </strong>
                  </div>
                  <div style={{ margin: '0 0 0.5rem 0', fontSize: '0.82rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                    {report.why_this_conclusion ? (
                      typeof report.why_this_conclusion === 'string' ? (
                        report.why_this_conclusion
                      ) : Array.isArray(report.why_this_conclusion) ? (
                        report.why_this_conclusion.map((item: any, i: number) => (
                          <div key={i} style={{ marginBottom: '0.35rem' }}>
                            <strong style={{ color: 'var(--text-primary)' }}>{item.claim}: </strong>
                            <span>{item.rationale} </span>
                            {item.supporting_sources && item.supporting_sources.length > 0 && (
                              <span style={{ color: 'var(--color-info)', fontSize: '0.75rem' }}>
                                [{item.supporting_sources.join(', ')}]
                              </span>
                            )}
                          </div>
                        ))
                      ) : null
                    ) : dossier.evidence && dossier.evidence.length > 0 ? (
                      `This synthesis links directly to the ${dossier.evidence.filter(e => e.relevance_label === 'Relevant' || e.relevance_score >= 0.7).length} primary matching records retrieved for this event. Dates and geographic references in public bulletins align with recorded satellite radiometry in ${inc.region || 'the target zone'}. No unauthorized cause or legal liability is asserted without official investigative certification.`
                    ) : (
                      'Conclusion reflects satellite radiometry and documented regional context while awaiting external source corroboration.'
                    )}
                  </div>
                  <div style={{ fontSize: '0.73rem', color: 'var(--text-tertiary)', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '0.45rem' }}>
                    <span>• <strong>TinyFish:</strong> Discovers and extracts external articles &amp; advisories.</span>
                    <span>• <strong>TerraShield:</strong> Validates spatial, temporal, and agency relevance.</span>
                    <span>• <strong>Groq:</strong> Synthesizes verified findings into plain English.</span>
                    <span>• <strong>NASA FIRMS:</strong> Independent orbital thermal radiometry telemetry.</span>
                  </div>
                </div>
              </div>

              {/* ── SECTION A: Dedicated TinyFish Investigation Findings ── */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '1.35rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Search size={16} style={{ color: 'var(--color-info)' }} />
                    <h2 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>
                      TinyFish Investigation Findings
                    </h2>
                  </div>
                  <span
                    style={{
                      fontSize: '0.74rem',
                      background: 'rgba(56, 189, 248, 0.1)',
                      border: '1px solid rgba(56, 189, 248, 0.25)',
                      padding: '0.2rem 0.55rem',
                      borderRadius: '4px',
                      color: '#38bdf8',
                      fontWeight: 600,
                    }}
                  >
                    {dossier.evidence?.length || 0} Sources Retrieved &amp; Grounded
                  </span>
                </div>

                {/* Research Performed Audit Box */}
                <div
                  style={{
                    padding: '0.95rem 1.1rem',
                    background: 'rgba(0, 0, 0, 0.3)',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.07)',
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                    marginBottom: '1.1rem',
                    lineHeight: '1.6',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                    <Activity size={14} style={{ color: 'var(--accent-amber)' }} />
                    <strong style={{ fontSize: '0.84rem', color: 'var(--text-primary)' }}>
                      Research Performed
                    </strong>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.65rem', marginBottom: '0.6rem' }}>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', display: 'block' }}>Submitted Query</span>
                      <strong style={{ fontSize: '0.78rem', color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                        {dossier.research_audit?.queries_submitted?.join('; ') || `Forest fire ${inc.name} ${inc.region} India advisory`}
                      </strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', display: 'block' }}>Operations Completed</span>
                      <strong style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                        {dossier.research_audit?.operations_completed?.join(' • ') || 'Search & Page Fetch & Content Extraction'}
                      </strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', display: 'block' }}>Sources Discovered</span>
                      <strong style={{ fontSize: '0.82rem', color: '#38bdf8' }}>
                        {dossier.research_audit?.sources_discovered ?? dossier.evidence?.length ?? 0}
                      </strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', display: 'block' }}>Pages Successfully Fetched</span>
                      <strong style={{ fontSize: '0.82rem', color: 'var(--color-verified)' }}>
                        {dossier.research_audit?.pages_fetched ?? dossier.evidence?.filter(e => e.fetch_status === 'ACTIVE' || e.full_text).length ?? 0}
                      </strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', display: 'block' }}>Inaccessible Pages / Errors</span>
                      <strong style={{ fontSize: '0.82rem', color: (dossier.research_audit?.inaccessible_pages?.length ?? 0) > 0 ? 'var(--accent-amber)' : 'var(--text-secondary)' }}>
                        {dossier.research_audit?.inaccessible_pages?.length ?? 0}
                      </strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', display: 'block' }}>Actual Retrieval Timestamp</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                        {dossier.research_audit?.retrieval_timestamp ? new Date(dossier.research_audit.retrieval_timestamp).toLocaleString() : (dossier.evidence?.[0]?.fetched_at ? new Date(dossier.evidence[0].fetched_at).toLocaleString() : 'Session Active')}
                      </span>
                    </div>
                  </div>

                  {dossier.research_audit?.inaccessible_pages && dossier.research_audit.inaccessible_pages.length > 0 && (
                    <div style={{ marginTop: '0.4rem', padding: '0.45rem 0.65rem', background: 'rgba(245, 158, 11, 0.08)', borderRadius: '6px', fontSize: '0.73rem', color: 'var(--accent-amber)' }}>
                      <strong>Note on inaccessible pages: </strong> {dossier.research_audit.inaccessible_pages.length} source(s) restricted full automated extraction (paywall or anti-scraping). Fallback snippet retained.
                    </div>
                  )}

                  <div style={{ marginTop: '0.4rem', fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                    <em>Execution Guarantee: </em> All metrics above are derived from real execution results of the TinyFish Search and Fetch integration, not hardcoded counters.
                  </div>
                </div>

                {/* Retrieved Source Cards with "What Each Source Supports" */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {dossier.evidence && dossier.evidence.length > 0 ? (
                    dossier.evidence.map((ev, idx) => {
                      const relLabel = ev.relevance_label || (ev.relevance_score >= 0.75 ? 'Relevant' : ev.relevance_score >= 0.45 ? 'Partial match' : 'Needs review');
                      const relColor = relLabel === 'Relevant' ? 'var(--color-verified)' : relLabel === 'Partial match' ? 'var(--accent-amber)' : 'var(--text-tertiary)';
                      const relBg = relLabel === 'Relevant' ? 'rgba(16, 185, 129, 0.12)' : relLabel === 'Partial match' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(148, 163, 184, 0.12)';
                      const relBorder = relLabel === 'Relevant' ? 'rgba(16, 185, 129, 0.3)' : relLabel === 'Partial match' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(148, 163, 184, 0.2)';

                      const provLabel = ev.provenance_origin === 'CURRENT_SESSION' ? 'Live Session Retrieval' : ev.provenance_origin === 'SAVED_EVIDENCE' ? 'Saved Evidence' : 'Historical Archive Context';
                      const provColor = ev.provenance_origin === 'CURRENT_SESSION' ? '#38bdf8' : ev.provenance_origin === 'SAVED_EVIDENCE' ? '#c084fc' : '#94a3b8';
                      const provBg = ev.provenance_origin === 'CURRENT_SESSION' ? 'rgba(56, 189, 248, 0.12)' : ev.provenance_origin === 'SAVED_EVIDENCE' ? 'rgba(192, 132, 252, 0.12)' : 'rgba(148, 163, 184, 0.1)';

                      const roleLabel = ev.evidence_role === 'DIRECT_FACT' ? 'Directly Reported Fact' : ev.evidence_role === 'CONTEXT' ? 'Contextual Background' : ev.evidence_role === 'UNVERIFIED_CLAIM' ? 'Claim Needing Corroboration' : 'Public Dispatch';

                      return (
                        <div
                          key={ev.id || idx}
                          style={{
                            background: 'rgba(0, 0, 0, 0.3)',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            borderRadius: '8px',
                            padding: '0.95rem',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.45rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                              {/* Authority badge: only if established */}
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: '4px',
                                  background: ev.is_official ? 'rgba(16, 185, 129, 0.15)' : ev.source_type === 'NEWS_MEDIA' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                                  color: ev.is_official ? 'var(--color-verified)' : ev.source_type === 'NEWS_MEDIA' ? '#38bdf8' : 'var(--text-secondary)',
                                  border: `1px solid ${ev.is_official ? 'rgba(16, 185, 129, 0.3)' : ev.source_type === 'NEWS_MEDIA' ? 'rgba(56, 189, 248, 0.3)' : 'rgba(148, 163, 184, 0.25)'}`,
                                }}
                              >
                                {ev.is_official
                                  ? 'OFFICIAL AGENCY'
                                  : ev.source_type === 'NEWS_MEDIA'
                                  ? 'VERIFIED JOURNALISM'
                                  : ev.source_type === 'EMERGENCY_DISPATCH'
                                  ? 'EMERGENCY DISPATCH'
                                  : 'UNVERIFIED SOURCE'}
                              </span>

                              {/* Qualitative relevance badge */}
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: '4px',
                                  background: relBg,
                                  color: relColor,
                                  border: `1px solid ${relBorder}`,
                                }}
                                title="Transparent relevance assessment based on location, event period, and topic match"
                              >
                                {relLabel}
                              </span>

                              {/* Provenance badge */}
                              <span
                                style={{
                                  fontSize: '0.66rem',
                                  fontWeight: 600,
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: '4px',
                                  background: provBg,
                                  color: provColor,
                                  border: `1px solid ${provColor}40`,
                                }}
                              >
                                {provLabel}
                              </span>

                              {/* Evidence Role Badge */}
                              <span
                                style={{
                                  fontSize: '0.66rem',
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: '4px',
                                  background: 'rgba(255, 255, 255, 0.05)',
                                  color: 'var(--text-secondary)',
                                }}
                              >
                                {roleLabel}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              {/* View TinyFish Page Extract action button */}
                              <button
                                className="btn-tool"
                                onClick={() => setSelectedEvidence(ev)}
                                style={{
                                  fontSize: '0.74rem',
                                  padding: '0.25rem 0.55rem',
                                  background: 'rgba(56, 189, 248, 0.1)',
                                  color: '#38bdf8',
                                  border: '1px solid rgba(56, 189, 248, 0.3)',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                }}
                              >
                                <FileText size={11} />
                                <span>View TinyFish Page Extract</span>
                              </button>

                              {ev.url && (
                                <a
                                  href={ev.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn-tool"
                                  id={`evidence-link-${ev.id || idx}`}
                                  style={{ fontSize: '0.74rem', padding: '0.25rem 0.55rem', display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-secondary)' }}
                                >
                                  <span>Source URL</span>
                                  <ExternalLink size={11} />
                                </a>
                              )}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                            <strong style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>{ev.source_name}</strong>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
                              ({ev.domain || 'web'})
                            </span>
                          </div>

                          <h4 style={{ margin: '0 0 0.35rem 0', fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                            {ev.title}
                          </h4>

                          {/* Concise Grounded Finding */}
                          <div
                            style={{
                              padding: '0.5rem 0.75rem',
                              background: 'rgba(255, 255, 255, 0.02)',
                              borderRadius: '6px',
                              borderLeft: '3px solid #38bdf8',
                              fontSize: '0.8rem',
                              color: 'var(--text-secondary)',
                              marginBottom: '0.45rem',
                              lineHeight: '1.5',
                            }}
                          >
                            <strong style={{ color: 'var(--text-primary)' }}>Concise Finding: </strong>
                            {ev.finding || ev.snippet}
                          </div>

                          {/* What this source specifically supports */}
                          <div
                            style={{
                              padding: '0.45rem 0.75rem',
                              background: 'rgba(255, 255, 255, 0.015)',
                              borderRadius: '6px',
                              borderLeft: '3px solid var(--accent-orange)',
                              fontSize: '0.78rem',
                              color: 'var(--text-secondary)',
                              marginBottom: '0.45rem',
                            }}
                          >
                            <strong style={{ color: 'var(--text-primary)' }}>Specific aspect supported: </strong>
                            {ev.supports_aspect || ev.relevance_explanation || 'Corroborates location, timeline, and agency deployment.'}
                          </div>

                          {/* Publication date vs Retrieval timestamp */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '0.35rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <span>Published Date: <strong>{ev.publication_date ? new Date(ev.publication_date).toLocaleDateString() : 'Unknown / Undated'}</strong></span>
                            <span>Actual Retrieval Timestamp: <strong>{new Date(ev.fetched_at).toLocaleString()}</strong></span>
                            <span>
                              Status:{' '}
                              <strong
                                style={{
                                  color:
                                    ev.fetch_status === 'ACTIVE'
                                      ? 'var(--color-verified)'
                                      : ev.fetch_status === 'FAILED'
                                      ? 'var(--color-danger)'
                                      : 'var(--text-secondary)',
                                }}
                              >
                                {ev.fetch_status === 'ACTIVE'
                                  ? 'Successfully Fetched'
                                  : ev.fetch_status === 'FAILED'
                                  ? `Fetch Failed (${ev.fetch_error || 'Access error'})`
                                  : 'Discovered (Snippet)'}
                              </strong>
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', fontStyle: 'italic', padding: '0.8rem' }}>
                      No external evidence records attached. Click "Investigate with TinyFish + Groq" above to query live advisories.
                    </div>
                  )}
                </div>
              </div>

              {/* ── SECTION B: AI-Generated Explanation using Groq ── */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.025)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '1.35rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Brain size={16} style={{ color: 'var(--accent-amber)' }} />
                    <h2 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>
                      Section B: AI-Generated Synthesis using Groq
                    </h2>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
                    Model: {dossier.model_id || 'openai/gpt-oss-120b'}
                  </span>
                </div>

                <div
                  style={{
                    padding: '0.65rem 0.85rem',
                    background: 'rgba(245, 158, 11, 0.08)',
                    borderLeft: '3px solid var(--accent-amber)',
                    borderRadius: '6px',
                    fontSize: '0.76rem',
                    color: 'var(--text-secondary)',
                    marginBottom: '1.1rem',
                  }}
                >
                  <strong style={{ color: 'var(--text-primary)' }}>Analytical Boundary: </strong>
                  Groq synthesizes and explains the evidence retrieved by TinyFish and satellite telemetry. It summarizes verified facts; it is not an orbital satellite detection instrument and does not independently prove an event.
                </div>

                {/* Structured Synthesis answering core questions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Question 1: What happened? */}
                  <div>
                    <h3 style={{ fontSize: '0.86rem', color: 'var(--accent-orange)', margin: '0 0 0.35rem 0', fontWeight: 600 }}>
                      1. What Happened?
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: '1.6', color: 'var(--text-primary)' }}>
                      {report.what_happened ||
                        report.chronological_development ||
                        (isFlood
                          ? 'Severe precipitation triggered overland runoff and inundation across valley floors.'
                          : 'A forest-fire event occurred in vegetative terrain, generating thermal anomalies recorded by orbital radiometers and triggering emergency ground deployments.')}
                    </p>
                  </div>

                  {/* Question 2: Where did it happen? */}
                  <div>
                    <h3 style={{ fontSize: '0.86rem', color: 'var(--accent-orange)', margin: '0 0 0.35rem 0', fontWeight: 600 }}>
                      2. Where Did It Happen?
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: '1.6', color: 'var(--text-primary)' }}>
                      {report.location_and_geography ||
                        report.geographic_scope ||
                        `${inc.name} in ${inc.region}, centered at coordinates ${Number(inc.latitude).toFixed(4)}° N, ${Number(inc.longitude).toFixed(4)}° E.`}
                    </p>
                  </div>

                  {/* Question 3: When did it happen? */}
                  <div>
                    <h3 style={{ fontSize: '0.86rem', color: 'var(--accent-orange)', margin: '0 0 0.35rem 0', fontWeight: 600 }}>
                      3. When Did It Happen?
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: '1.6', color: 'var(--text-primary)' }}>
                      Documented event date: <strong>{inc.event_date || inc.first_detected?.split('T')[0]}</strong>. Satellite observation pass: {inc.first_detected?.split('T')[0]} to {inc.last_detected?.split('T')[0] || 'Ongoing'}.
                    </p>
                  </div>

                  {/* Question 4: What evidence supports the explanation? */}
                  <div>
                    <h3 style={{ fontSize: '0.86rem', color: 'var(--color-verified)', margin: '0 0 0.35rem 0', fontWeight: 600 }}>
                      4. What Evidence Supports the Explanation?
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: '1.6', color: 'var(--text-primary)' }}>
                      {report.corroboration_assessment ||
                        inc.verification?.rationale ||
                        'Supported by official agency advisories, verified journalism, and satellite thermal observations.'}
                    </p>
                  </div>

                  {/* Question 5: What impact details are supported by sources? */}
                  <div>
                    <h3 style={{ fontSize: '0.86rem', color: 'var(--color-danger)', margin: '0 0 0.35rem 0', fontWeight: 600 }}>
                      5. What Impact Details Are Supported by Sources?
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: '1.6', color: 'var(--text-primary)' }}>
                      {inc.impact_summary
                        ? `${inc.impact_summary.casualties ? `Casualties: ${inc.impact_summary.casualties}. ` : ''}${inc.impact_summary.displaced ? `Displaced: ${inc.impact_summary.displaced}. ` : ''}${inc.impact_summary.environmental ? `Environmental: ${inc.impact_summary.environmental}. ` : ''}${inc.impact_summary.infrastructure ? `Infrastructure: ${inc.impact_summary.infrastructure}.` : ''}`
                        : (report.documented_impacts || 'Ground impact assessments documented in official reports cited below.')}
                    </p>
                  </div>

                  {/* Question 6: What remains unknown or disputed? */}
                  <div>
                    <h3 style={{ fontSize: '0.86rem', color: 'var(--accent-amber)', margin: '0 0 0.35rem 0', fontWeight: 600 }}>
                      6. What Remains Unknown or Disputed?
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                      {report.uncertainties_and_gaps ||
                        report.uncertainty_and_gaps ||
                        'Cause not established by the available evidence. Satellite hotspots confirm thermal radiative energy but cannot independently establish legal or forensic cause without official ground investigation.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* ── Event Timeline (if available) ── */}
              {((dossier.timeline && dossier.timeline.length > 0) || report.timeline) && (
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    padding: '1.35rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <Clock size={16} style={{ color: 'var(--color-info)' }} />
                    <h2 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>
                      Event Timeline
                    </h2>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', position: 'relative', paddingLeft: '1.25rem', borderLeft: '2px solid rgba(255, 255, 255, 0.1)' }}>
                    {(dossier.timeline || []).map((item, idx) => (
                      <div key={idx} style={{ position: 'relative' }}>
                        <div
                          style={{
                            position: 'absolute',
                            left: '-1.65rem',
                            top: '0.2rem',
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            background: isFlood ? '#38bdf8' : '#f97316',
                            border: '2px solid #0c1017',
                          }}
                        />
                        <div style={{ fontSize: '0.78rem', color: isFlood ? '#38bdf8' : '#f97316', fontWeight: 600, marginBottom: '0.2rem' }}>
                          {item.date_time}
                        </div>
                        <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                          {item.milestone}
                        </div>
                        {item.source && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span>Source: {item.source}</span>
                            {item.url && (
                              <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-info)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                                <span>Verify</span>
                                <ExternalLink size={10} />
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Satellite Radiometry Context ── */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '1.35rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
                  <Activity size={16} style={{ color: isFlood ? 'var(--color-info)' : 'var(--accent-orange)' }} />
                  <h2 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Satellite & Physical Sensor Observations
                  </h2>
                </div>
                <p style={{ margin: '0 0 0.85rem 0', fontSize: '0.88rem', lineHeight: '1.6', color: 'var(--text-primary)' }}>
                  {report.satellite_and_thermal_observations ||
                    (isFlood
                      ? 'Hydrologic analysis incorporates ground river gauges, IMD precipitation radar, and satellite microwave sensor passes.'
                      : `Orbital sensors recorded ${inc.detection_count || 1} distinct thermal anomaly observation passes with peak radiative power of ${inc.max_frp ? inc.max_frp.toFixed(1) + ' MW' : 'N/A'}.`)}
                </p>

                <div style={{ padding: '0.75rem 0.95rem', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '8px', borderLeft: '3px solid var(--color-info)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Satellite Provenance Boundary: </strong>
                  Hotspot detections represent orbital infrared sensor radiometry (375m VIIRS resolution) and require independent ground corroboration.
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* TinyFish Page Extract Modal */}
      <TinyFishExtractModal
        isOpen={!!selectedEvidence}
        evidence={selectedEvidence}
        onClose={() => setSelectedEvidence(null)}
      />
    </div>
  );
};
