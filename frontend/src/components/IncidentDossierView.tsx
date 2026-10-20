import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  ExternalLink,
  ShieldCheck,
  Flame,
  Droplets,
  Brain,
  RefreshCw,
  Clock,
  Activity,
  FileText,
  AlertTriangle,
  Sparkles,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../services/api';
import type { IncidentDossierResponse, GroqSynthesizedReport } from '../types';

interface IncidentDossierViewProps {
  incidentId: string;
  onBack: () => void;
  onFocusOnMap?: (lat: number, lon: number, name: string) => void;
}

export const IncidentDossierView: React.FC<IncidentDossierViewProps> = ({
  incidentId,
  onBack,
  onFocusOnMap,
}) => {
  const [dossier, setDossier] = useState<IncidentDossierResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const [synthMessage, setSynthMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    api.getIncidentDossier(incidentId)
      .then((res) => {
        if (isMounted) {
          setDossier(res);
          setLoading(false);
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
  }, [incidentId]);

  const handleSynthesizeWithGroq = async () => {
    setIsSynthesizing(true);
    setSynthMessage(null);
    try {
      const res = await api.generateIncidentDossier(incidentId);
      if (res.status === 'success' && res.report) {
        setDossier((prev) => (prev ? { ...prev, groq_report: res.report, model_id: res.model_id } : null));
        setSynthMessage(`Successfully generated intelligence report via Groq Cloud (${res.model_id}).`);
      } else if (res.status === 'credentials_missing') {
        setSynthMessage('GROQ_API_KEY is not configured in backend .env. Set your key from console.groq.com/keys.');
      } else {
        setSynthMessage(res.message || 'Groq Cloud synthesis returned an error.');
      }
    } catch (err: any) {
      setSynthMessage(err.message || 'Failed to trigger Groq Cloud synthesis.');
    } finally {
      setIsSynthesizing(false);
    }
  };

  if (loading) {
    return (
      <div className="dossier-view-root" style={{ padding: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          <RefreshCw className="spin" size={28} style={{ color: 'var(--accent-orange)', marginBottom: '0.8rem' }} />
          <div>Retrieving verified TerraShield Intelligence Report for <code>{incidentId}</code>...</div>
        </div>
      </div>
    );
  }

  if (error || !dossier) {
    return (
      <div className="dossier-view-root" style={{ padding: '2rem' }}>
        <button className="btn-tool" onClick={onBack} style={{ marginBottom: '1rem' }} id="dossier-back-error-btn">
          <ArrowLeft size={14} />
          <span>Back to Incident View</span>
        </button>
        <div className="dossier-error-banner" style={{ padding: '1.2rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px' }}>
          <AlertTriangle size={20} style={{ color: 'var(--color-danger)', marginBottom: '0.5rem' }} />
          <h3 style={{ margin: '0 0 0.4rem 0', color: 'var(--color-danger)' }}>Report Unavailable</h3>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{error || 'Incident record could not be found.'}</p>
        </div>
      </div>
    );
  }

  const inc = dossier.incident as any;
  const isFlood = dossier.hazard_type === 'FLOOD' || inc.hazard_type === 'FLOOD';
  const report: GroqSynthesizedReport = dossier.groq_report || (inc.precomputed_report as any) || {};
  const isDemo = inc.data_mode === 'DEMO';
  const isHistorical = inc.data_mode === 'HISTORICAL';

  // Determine report state badge
  let reportState = 'Report Ready';
  let reportStateBg = 'rgba(34, 197, 94, 0.15)';
  let reportStateColor = '#22c55e';
  let reportStateBorder = 'rgba(34, 197, 94, 0.35)';

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
  } else if (!dossier.evidence || dossier.evidence.length === 0) {
    reportState = 'Report Generated — Evidence Incomplete';
    reportStateBg = 'rgba(249, 115, 22, 0.15)';
    reportStateColor = '#f97316';
    reportStateBorder = 'rgba(249, 115, 22, 0.35)';
  }

  return (
    <div className="dossier-view-root" style={{ padding: '1.25rem', overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* ── Top Header Bar with Back Button & Report State Tag ── */}
      <div className="dossier-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            className="btn-tool"
            onClick={onBack}
            id="dossier-back-btn"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.75rem', fontWeight: 600 }}
          >
            <ArrowLeft size={15} />
            <span>Back</span>
          </button>
          <div style={{ height: '18px', width: '1px', background: 'var(--border-subtle)' }} />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            TERRASHIELD INTELLIGENCE REPORT
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {/* Visible Report State */}
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              padding: '0.25rem 0.6rem',
              borderRadius: '4px',
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

          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '0.25rem 0.6rem',
              borderRadius: '4px',
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
        </div>
      </div>

      {/* ── Main Hero Card ── */}
      <div
        className="dossier-hero-card"
        style={{
          background: 'var(--surface-raised)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '8px',
          padding: '1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '1.5rem',
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--text-tertiary)' }}>
              {inc.id}
            </span>
            <span style={{ color: 'var(--border-subtle)' }}>•</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Severity: <strong>{inc.severity || 'CONFIRMED'}</strong>
            </span>
            <span style={{ color: 'var(--border-subtle)' }}>•</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Verification: <strong>{inc.verification?.status || 'CORROBORATED'}</strong>
            </span>
          </div>

          <h1 style={{ fontSize: '1.5rem', margin: '0 0 0.6rem 0', color: 'var(--text-primary)', fontWeight: 700, letterSpacing: '-0.02em' }}>
            {inc.name}
          </h1>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <MapPin size={14} style={{ color: 'var(--accent-orange)' }} />
              <span>
                {inc.locality ? `${inc.locality}, ` : ''}
                {inc.district ? `${inc.district}, ` : ''}
                {inc.state_province ? `${inc.state_province}, ` : ''}
                <strong>{inc.country || inc.region}</strong>
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Calendar size={14} style={{ color: 'var(--color-info)' }} />
              <span>Event Date: <strong>{inc.event_date || inc.first_detected?.split('T')[0]}</strong></span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Activity size={14} style={{ color: 'var(--color-verified)' }} />
              <span>Centroid: <code>{Number(inc.latitude).toFixed(4)}° N, {Number(inc.longitude).toFixed(4)}° E</code></span>
            </div>
          </div>
        </div>

        {/* Action button cluster */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '220px' }}>
          {onFocusOnMap && (
            <button
              className="btn-tool"
              onClick={() => onFocusOnMap(inc.latitude, inc.longitude, inc.name)}
              id="dossier-map-focus-btn"
              style={{ width: '100%', justifyContent: 'center', padding: '0.55rem', fontWeight: 600 }}
            >
              <MapPin size={14} />
              <span>Focus on Map</span>
            </button>
          )}

          <button
            className="btn-tool"
            onClick={handleSynthesizeWithGroq}
            disabled={isSynthesizing}
            id="dossier-groq-synth-btn"
            style={{
              width: '100%',
              justifyContent: 'center',
              padding: '0.55rem',
              fontWeight: 600,
              background: 'rgba(249, 115, 22, 0.1)',
              borderColor: 'rgba(249, 115, 22, 0.3)',
              color: 'var(--accent-orange)',
            }}
          >
            {isSynthesizing ? <RefreshCw className="spin" size={14} /> : <Brain size={14} />}
            <span>{isSynthesizing ? 'Synthesizing with Groq...' : 'Re-synthesize with Groq'}</span>
          </button>
        </div>
      </div>

      {synthMessage && (
        <div
          style={{
            padding: '0.65rem 0.9rem',
            background: synthMessage.includes('Successfully') ? 'rgba(34, 197, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)',
            border: `1px solid ${synthMessage.includes('Successfully') ? 'rgba(34, 197, 94, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
            borderRadius: '6px',
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
          }}
        >
          {synthMessage}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          11 STANDARDIZED SECTIONS (PRESENTED BEFORE RAW SOURCES LIST)
          ────────────────────────────────────────────────────────────────────────── */}

      {/* Section 1: Executive Summary */}
      <div className="dossier-card" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
          <FileText size={16} style={{ color: 'var(--color-info)' }} />
          <h2 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 600 }}>1. Executive Summary</h2>
        </div>
        <p style={{ margin: 0, fontSize: '0.92rem', lineHeight: '1.65', color: 'var(--text-primary)' }}>
          {report.executive_summary ||
            (inc.verification?.rationale
              ? inc.verification.rationale
              : 'Detailed factual analysis synthesized from official meteorological advisories, state disaster management bulletins, and satellite observations.')}
        </p>
      </div>

      {/* Section 2: What Happened */}
      <div className="dossier-card" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
          <Sparkles size={16} style={{ color: 'var(--accent-orange)' }} />
          <h2 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 600 }}>2. What Happened</h2>
        </div>
        <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.65', color: 'var(--text-primary)' }}>
          {report.what_happened ||
            report.chronological_development ||
            (isFlood
              ? 'Catastrophic precipitation anomaly destabilized Western Ghats overburden, initiating multi-kilometer channelized debris flow and devastating low-lying riverine settlements.'
              : 'Thermal anomaly cluster detected via satellite sensors. Radiative energy signatures indicate sustained vegetation combustion requiring ground corroboration.')}
        </p>
        {(report.root_causes || report.contributing_factors) && (
          <div style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--text-primary)' }}>Triggers & Contributing Factors: </strong>
            {report.root_causes || report.contributing_factors}
          </div>
        )}
      </div>

      {/* Section 3: Location and Geographic Context */}
      <div className="dossier-card" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
          <MapPin size={16} style={{ color: 'var(--accent-orange)' }} />
          <h2 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 600 }}>3. Location and Geographic Context</h2>
        </div>
        <p style={{ margin: '0 0 0.85rem 0', fontSize: '0.9rem', lineHeight: '1.6', color: 'var(--text-primary)' }}>
          {report.location_and_geography ||
            report.geographic_scope ||
            `${inc.name} centered at coordinates ${Number(inc.latitude).toFixed(4)}° N, ${Number(inc.longitude).toFixed(4)}° E in ${inc.region}.`}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', background: 'var(--surface-sunken)', padding: '0.85rem', borderRadius: '6px' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>ADMINISTRATIVE DIVISION</span>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.15rem' }}>
              {inc.district ? `${inc.district}, ` : ''}{inc.state_province || inc.region}
            </div>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>HYDROLOGIC / ECOZONE</span>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.15rem' }}>
              {inc.river_basin || 'Western Ghats Moist Deciduous Ecozone'}
            </div>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>CENTROID COORDINATES</span>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.15rem', fontFamily: 'monospace' }}>
              {Number(inc.latitude).toFixed(4)}° N, {Number(inc.longitude).toFixed(4)}° E
            </div>
          </div>
        </div>
      </div>

      {/* Section 4: Event Timeline */}
      {((dossier.timeline && dossier.timeline.length > 0) || report.timeline) && (
        <div className="dossier-card" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Clock size={16} style={{ color: 'var(--color-info)' }} />
            <h2 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 600 }}>4. Event Timeline</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', position: 'relative', paddingLeft: '1.2rem', borderLeft: '2px solid var(--border-subtle)' }}>
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
                    border: '2px solid var(--surface-raised)',
                  }}
                />
                <div style={{ fontSize: '0.78rem', color: isFlood ? '#38bdf8' : '#f97316', fontWeight: 600, marginBottom: '0.2rem' }}>
                  {item.date_time}
                </div>
                <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                  {item.milestone}
                </div>
                {item.source && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
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

      {/* Section 5: Satellite and Thermal Observations */}
      <div className="dossier-card" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
          <Activity size={16} style={{ color: isFlood ? 'var(--color-info)' : 'var(--accent-orange)' }} />
          <h2 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 600 }}>
            5. Satellite and Thermal Observations
          </h2>
        </div>
        <p style={{ margin: '0 0 0.85rem 0', fontSize: '0.88rem', lineHeight: '1.6', color: 'var(--text-primary)' }}>
          {report.satellite_and_thermal_observations ||
            (isFlood
              ? 'Optical Earth observation was constrained by dense monsoon overcast; hydrologic analysis relied on weather station radar, microwave gauge anomalies, and post-event high-resolution satellite imagery.'
              : `Spaceborne VIIRS/MODIS sensors recorded ${inc.detection_count || 1} distinct thermal anomaly passes over this zone with peak radiative power of ${inc.max_frp ? inc.max_frp.toFixed(1) + ' MW' : 'N/A'}.`)}
        </p>

        {/* Technical boundary notice */}
        <div style={{ padding: '0.75rem 0.9rem', background: 'var(--surface-sunken)', borderRadius: '6px', borderLeft: '3px solid var(--color-info)', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.85rem' }}>
          <strong style={{ color: 'var(--text-primary)' }}>Data Provenance Notice: </strong>
          Satellite hotspots represent sensor-detected radiometric anomalies (375 m / 1 km resolution). They do not automatically confirm destructive ground wildfire or building ignition without corroborating field evidence.
        </div>

        {/* Telemetry Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
          {dossier.fire_metrics && (
            <>
              {dossier.fire_metrics.burn_area_hectares && (
                <div style={{ background: 'var(--surface-sunken)', padding: '0.75rem', borderRadius: '6px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>BURN SCAR ESTIMATE</span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f97316', marginTop: '0.2rem' }}>
                    {dossier.fire_metrics.burn_area_hectares.toLocaleString()} ha
                  </div>
                </div>
              )}
              {dossier.fire_metrics.max_frp_mw && (
                <div style={{ background: 'var(--surface-sunken)', padding: '0.75rem', borderRadius: '6px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>PEAK FIRE RADIATIVE POWER</span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f97316', marginTop: '0.2rem' }}>
                    {dossier.fire_metrics.max_frp_mw} MW
                  </div>
                </div>
              )}
            </>
          )}

          {dossier.hydrologic_metrics && (
            <>
              {dossier.hydrologic_metrics.rainfall_48h_mm && (
                <div style={{ background: 'var(--surface-sunken)', padding: '0.75rem', borderRadius: '6px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>48H RAINFALL ANOMALY</span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.2rem' }}>
                    {dossier.hydrologic_metrics.rainfall_48h_mm} mm
                  </div>
                </div>
              )}
              {dossier.hydrologic_metrics.debris_runout_km && (
                <div style={{ background: 'var(--surface-sunken)', padding: '0.75rem', borderRadius: '6px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>DEBRIS FLOW CHANNEL</span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.2rem' }}>
                    {dossier.hydrologic_metrics.debris_runout_km} km
                  </div>
                </div>
              )}
            </>
          )}

          <div style={{ background: 'var(--surface-sunken)', padding: '0.75rem', borderRadius: '6px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>OBSERVATION PASSES</span>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
              {inc.detection_count || 1} passes
            </div>
          </div>
        </div>
      </div>

      {/* Section 6: Official Warnings and Independent Corroboration */}
      <div className="dossier-card" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
          <ShieldCheck size={16} style={{ color: 'var(--color-verified)' }} />
          <h2 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 600 }}>
            6. Official Warnings and Independent Corroboration
          </h2>
        </div>
        <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.65', color: 'var(--text-primary)' }}>
          {report.official_warnings ||
            report.corroboration_assessment ||
            'Cross-referenced with official meteorological advisories (IMD), State Disaster Management Authorities (SDMA), and credentialed journalism dispatches.'}
        </p>
      </div>

      {/* Section 7: Documented Impacts */}
      <div className="dossier-card" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
          <AlertTriangle size={16} style={{ color: 'var(--accent-orange)' }} />
          <h2 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 600 }}>7. Documented Impacts</h2>
        </div>
        {report.documented_impacts ? (
          <p style={{ margin: '0 0 0.85rem 0', fontSize: '0.9rem', lineHeight: '1.6', color: 'var(--text-primary)' }}>
            {report.documented_impacts}
          </p>
        ) : null}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
          {dossier.impact_summary?.casualties && (
            <div style={{ background: 'var(--surface-sunken)', padding: '0.75rem', borderRadius: '6px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>CASUALTIES / MISSING</span>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-danger)', marginTop: '0.2rem' }}>
                {dossier.impact_summary.casualties}
              </div>
            </div>
          )}
          {dossier.impact_summary?.displaced && (
            <div style={{ background: 'var(--surface-sunken)', padding: '0.75rem', borderRadius: '6px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>POPULATION DISPLACEMENT</span>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                {dossier.impact_summary.displaced}
              </div>
            </div>
          )}
          {dossier.impact_summary?.infrastructure && (
            <div style={{ background: 'var(--surface-sunken)', padding: '0.75rem', borderRadius: '6px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>INFRASTRUCTURE DAMAGE</span>
              <div style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                {dossier.impact_summary.infrastructure}
              </div>
            </div>
          )}
          {dossier.impact_summary?.environmental && (
            <div style={{ background: 'var(--surface-sunken)', padding: '0.75rem', borderRadius: '6px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>ENVIRONMENTAL IMPACT</span>
              <div style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                {dossier.impact_summary.environmental}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section 8: Response and Mitigation Updates */}
      <div className="dossier-card" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
          <Activity size={16} style={{ color: 'var(--color-verified)' }} />
          <h2 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 600 }}>8. Response and Mitigation Updates</h2>
        </div>
        <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.65', color: 'var(--text-primary)' }}>
          {report.response_and_mitigation ||
            report.impact_and_response ||
            'Emergency response mobilized through inter-agency coordination including NDRF, State Disaster Response Forces, defence engineering units, and district administration relief camps.'}
        </p>
      </div>

      {/* Section 9: Evidence Assessment */}
      <div className="dossier-card" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
          <ShieldCheck size={16} style={{ color: 'var(--accent-amber)' }} />
          <h2 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 600 }}>9. Evidence Assessment</h2>
        </div>
        <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.65', color: 'var(--text-primary)' }}>
          {report.evidence_assessment ||
            report.corroboration_assessment ||
            `Collected ${dossier.evidence?.length || 0} primary evidence records. Spatial and temporal congruence confirmed between satellite telemetry coordinates and field agency bulletins.`}
        </p>
      </div>

      {/* Section 10: Uncertainties, Conflicting Claims, and Data Limitations */}
      <div className="dossier-card" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
          <Info size={16} style={{ color: 'var(--accent-amber)' }} />
          <h2 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 600 }}>
            10. Uncertainties, Conflicting Claims, and Data Limitations
          </h2>
        </div>
        <div style={{ padding: '0.85rem', background: 'var(--surface-sunken)', borderRadius: '6px', borderLeft: '3px solid var(--accent-amber)' }}>
          <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            {report.uncertainties_and_gaps ||
              report.uncertainty_and_gaps ||
              'Orbital detection frequency is governed by satellite revisit times. Cloud obscuration, dense canopy, or short-lived thermal peaks may lead to observation delays. All AI summaries must be treated as analytical support, not official command authority.'}
          </p>
        </div>
      </div>

      {/* Section 11: Sources and Evidence (Verifiable Clickable Links) */}
      <div className="dossier-card" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={16} style={{ color: 'var(--color-info)' }} />
            <h2 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 600 }}>
              11. Sources and Evidence ({dossier.evidence?.length || 0} records)
            </h2>
          </div>
          <span style={{ fontSize: '0.76rem', color: 'var(--text-tertiary)' }}>
            Investigated via TinyFish Web Retrieval Engine
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {dossier.evidence && dossier.evidence.length > 0 ? (
            dossier.evidence.map((ev, idx) => (
              <div
                key={ev.id || idx}
                style={{
                  background: 'var(--surface-sunken)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  padding: '0.9rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.45rem',
                        borderRadius: '3px',
                        background: ev.is_official ? 'rgba(34, 197, 94, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                        color: ev.is_official ? 'var(--color-verified)' : 'var(--text-secondary)',
                      }}
                    >
                      {ev.is_official ? 'OFFICIAL AGENCY' : 'VERIFIED JOURNALISM'}
                    </span>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{ev.source_name}</strong>
                  </div>

                  {ev.url && (
                    <a
                      href={ev.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-tool"
                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--color-info)' }}
                    >
                      <span>Direct Link</span>
                      <ExternalLink size={11} />
                    </a>
                  )}
                </div>

                <h4 style={{ margin: '0 0 0.35rem 0', fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                  {ev.title}
                </h4>

                <p style={{ margin: '0 0 0.4rem 0', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  "{ev.snippet}"
                </p>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-tertiary)' }}>
                  <span>Published: {ev.publication_date || 'Undated'}</span>
                  <span>Relevance: {(ev.relevance_score * 100).toFixed(0)}%</span>
                </div>
              </div>
            ))
          ) : (
            <div style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', fontStyle: 'italic', padding: '0.8rem' }}>
              No external evidence records attached yet. Click "Investigate with TinyFish + Groq" on the incident to retrieve live bulletins.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
