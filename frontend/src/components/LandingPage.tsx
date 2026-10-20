import React, { useState } from 'react';
import {
  ShieldAlert,
  Satellite,
  Flame,
  Droplets,
  Search,
  ChevronRight,
  CheckCircle2,
  ArrowRight,
  Globe,
  Brain,
  FileText,
  Info,
  X,
} from 'lucide-react';
import type { DataMode, HealthResponse } from '../types';

interface LandingPageProps {
  onLaunchDashboard?: () => void;
  onOpenFireDashboard?: () => void;
  onExploreFireIncidents?: () => void;
  onOpenFloodDashboard?: () => void;
  onExploreFloodIncidents?: () => void;
  onLaunchGuidedDemo?: () => void;
  onOpenGuide?: () => void;
  detectionsCount?: number;
  incidentsCount?: number;
  health?: HealthResponse | null;
  currentMode?: DataMode;
}

const WORKFLOW_STEPS = [
  {
    icon: Satellite,
    label: 'Step 1',
    title: 'Satellite Observation',
    desc: 'NASA FIRMS VIIRS & MODIS sensors detect thermal anomalies globally at 375 m resolution. Real-time and historical data streams feed directly into TerraShield.',
    color: 'var(--color-info)',
    colorSubtle: 'rgba(14,165,233,0.1)',
    colorBorder: 'rgba(14,165,233,0.25)',
  },
  {
    icon: Flame,
    label: 'Step 2',
    title: 'Hazard Detection',
    desc: 'Thermal hotspots are clustered by proximity and temporal overlap into actionable incident polygons. Fire Radiative Power and brightness temperatures establish severity bands.',
    color: 'var(--accent-orange)',
    colorSubtle: 'var(--accent-orange-subtle)',
    colorBorder: 'var(--accent-orange-border)',
  },
  {
    icon: Search,
    label: 'Step 3',
    title: 'TinyFish Evidence Investigation',
    desc: 'For each incident TinyFish performs targeted web crawls across official agency portals, emergency dispatch feeds, and news sources — extracting corroborating ground-truth evidence.',
    color: 'var(--accent-amber)',
    colorSubtle: 'var(--accent-amber-subtle)',
    colorBorder: 'var(--accent-amber-border)',
  },
  {
    icon: Brain,
    label: 'Step 4',
    title: 'Explainable Assessment',
    desc: 'A deterministic, rule-based verification engine evaluates all evidence. Every verdict — CORROBORATED, NEEDS REVIEW, or INSUFFICIENT — is fully traceable with an auditable rationale.',
    color: 'var(--color-verified)',
    colorSubtle: 'var(--color-verified-subtle)',
    colorBorder: 'var(--color-verified-border)',
  },
];

const FEATURE_BULLETS = [
  { icon: CheckCircle2, text: 'NASA FIRMS live & historical satellite fire data for India and global AOIs' },
  { icon: CheckCircle2, text: 'TinyFish autonomous web evidence crawler with authority-ranked results' },
  { icon: CheckCircle2, text: 'Deterministic, explainable verification — no black-box AI scores' },
  { icon: CheckCircle2, text: 'Interactive Leaflet satellite map with VIIRS thermal hotspot overlays' },
  { icon: CheckCircle2, text: 'Full incident queue with uncertainty scores and reversible re-verification' },
  { icon: CheckCircle2, text: 'Flood intelligence pipeline (in development — sensor integration roadmap)' },
];

export const LandingPage: React.FC<LandingPageProps> = ({
  onLaunchDashboard,
  onOpenFireDashboard,
}) => {
  const [floodNotice, setFloodNotice] = useState<boolean>(false);

  const handleLaunch = () => {
    if (onOpenFireDashboard) {
      onOpenFireDashboard();
    } else if (onLaunchDashboard) {
      onLaunchDashboard();
    }
  };

  const handleFloodClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFloodNotice(true);
  };

  return (
    <div className="landing-root">
      {/* ── Coming Soon Banner / Toast if clicked ── */}
      {floodNotice && (
        <div
          style={{
            position: 'fixed',
            top: '70px',
            right: '20px',
            zIndex: 1000,
            background: 'rgba(16, 22, 28, 0.96)',
            border: '1px solid rgba(14, 165, 233, 0.4)',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
            borderRadius: '8px',
            padding: '0.85rem 1.15rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            maxWidth: '380px',
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          <Info size={18} style={{ color: '#0ea5e9', flexShrink: 0 }} />
          <div style={{ flex: 1, fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
            <strong style={{ color: '#38bdf8' }}>COMING SOON:</strong> Flood monitoring is planned for a future release.
          </div>
          <button
            onClick={() => setFloodNotice(false)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              padding: '2px',
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Top Nav Bar ── */}
      <header className="landing-nav">
        <div className="landing-nav-brand">
          <div className="landing-nav-icon">
            <ShieldAlert size={18} />
          </div>
          <span className="landing-nav-wordmark">
            TerraShield<span style={{ color: 'var(--accent-amber)' }}>AI</span>
          </span>
          <span className="landing-nav-tag">BETA</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button className="btn-landing-launch" onClick={handleLaunch} id="landing-launch-top">
            <span>Launch Dashboard</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="landing-hero">
        <div className="landing-hero-bg">
          <img
            src="/hero_satellite.jpg"
            alt="Split view: wildfire thermal signatures left, flood inundation right"
            className="landing-hero-img"
          />
          <div className="landing-hero-gradient" />
        </div>

        <div className="landing-hero-content">
          <div className="landing-hero-eyebrow">
            <Globe size={12} />
            <span>GEOSPATIAL HAZARD INTELLIGENCE PLATFORM</span>
          </div>

          <h1 className="landing-hero-h1">
            Satellite-Powered<br />
            <span className="landing-hero-fire">Wildfire</span>{' '}
            <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>&amp;</span>{' '}
            <span className="landing-hero-flood">Flood</span>
            <br />Intelligence
          </h1>

          <p className="landing-hero-subtitle">
            TerraShield AI fuses NASA FIRMS satellite thermal detections with
            autonomous web evidence discovery to deliver verified, explainable
            hazard assessments for emergency responders and analysts.
          </p>

          <div className="landing-hero-actions">
            <button className="btn-hero-primary" onClick={handleLaunch} id="landing-launch-hero">
              <Satellite size={16} />
              <span>Launch Dashboard</span>
              <ArrowRight size={15} />
            </button>

            <a
              href="#workflow"
              className="btn-hero-secondary"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('workflow')?.scrollIntoView({ behavior: 'smooth' });
              }}
              id="landing-hero-workflow-link"
            >
              <span>How It Works</span>
              <ChevronRight size={14} />
            </a>
          </div>

          {/* Small telemetry pills */}
          <div className="landing-hero-pills">
            <div className="hero-pill fire">
              <Flame size={11} />
              <span>Wildfire Intelligence</span>
              <span className="hero-pill-badge active">Live</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Workflow Steps ── */}
      <section className="landing-section" id="workflow">
        <div className="landing-container">
          <div className="landing-section-header">
            <div className="landing-section-eyebrow">INTELLIGENCE PIPELINE</div>
            <h2 className="landing-section-h2">From Orbit to Verified Assessment</h2>
            <p className="landing-section-desc">
              A four-stage pipeline transforms raw thermal telemetry into explainable
              verdicts — every step is traceable and auditable.
            </p>
          </div>

          <div className="workflow-steps-grid">
            {WORKFLOW_STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.label}
                  className="workflow-step-card"
                  style={{ borderColor: step.colorBorder }}
                >
                  <div
                    className="workflow-step-icon"
                    style={{ background: step.colorSubtle, border: `1px solid ${step.colorBorder}` }}
                  >
                    <Icon size={20} style={{ color: step.color }} />
                  </div>
                  <div className="workflow-step-num" style={{ color: step.color }}>
                    {step.label}
                  </div>
                  <h3 className="workflow-step-title">{step.title}</h3>
                  <p className="workflow-step-desc">{step.desc}</p>
                  {i < WORKFLOW_STEPS.length - 1 && (
                    <div className="workflow-step-connector">
                      <ArrowRight size={14} color="var(--border-muted)" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Feature List + Hazards ── */}
      <section className="landing-section landing-section-alt">
        <div className="landing-container landing-two-col">
          {/* Left: capabilities */}
          <div className="landing-col">
            <div className="landing-section-eyebrow">CAPABILITIES</div>
            <h2 className="landing-section-h2" style={{ fontSize: '1.5rem' }}>
              Built for Operational Analysts
            </h2>
            <p className="landing-section-desc" style={{ marginBottom: '1.5rem' }}>
              Every feature is designed around real emergency-management workflows, not demo showcases.
            </p>
            <ul className="feature-bullet-list">
              {FEATURE_BULLETS.map((b) => {
                const Icon = b.icon;
                return (
                  <li key={b.text} className="feature-bullet-item">
                    <Icon size={14} color="var(--color-verified)" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>{b.text}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Right: hazard cards */}
          <div className="landing-col">
            {/* Wildfire card */}
            <div
              className="hazard-card hazard-fire"
              onClick={handleLaunch}
              style={{ cursor: 'pointer' }}
              title="Click to launch Fire Intelligence Dashboard"
            >
              <div className="hazard-card-header">
                <div className="hazard-icon-wrap fire">
                  <Flame size={22} />
                </div>
                <div>
                  <div className="hazard-card-label">HAZARD MODULE · ACTIVE</div>
                  <div className="hazard-card-title">Wildfire Intelligence</div>
                </div>
                <span className="hazard-status-pill active">LIVE</span>
              </div>
              <p className="hazard-card-desc">
                NASA VIIRS 375 m thermal detections clustered into verified fire incidents.
                TinyFish evidence search across official agencies, news, and emergency dispatch.
                Explainable CORROBORATED / NEEDS REVIEW / INSUFFICIENT verdicts.
              </p>
              <div className="hazard-card-tags">
                {['NASA FIRMS', 'VIIRS NRT', 'TinyFish', 'India First'].map(t => (
                  <span key={t} className="hazard-tag fire">{t}</span>
                ))}
              </div>
            </div>

            {/* Flood card - Coming Soon (Requirement 2) */}
            <div
              className="hazard-card hazard-flood"
              onClick={handleFloodClick}
              style={{ cursor: 'pointer', opacity: 0.88 }}
              title="Flood monitoring is planned for a future release."
            >
              <div className="hazard-card-header">
                <div className="hazard-icon-wrap flood">
                  <Droplets size={22} />
                </div>
                <div>
                  <div className="hazard-card-label">HAZARD MODULE · PLANNED</div>
                  <div className="hazard-card-title">Flood — COMING SOON</div>
                </div>
                <span className="hazard-status-pill roadmap">COMING SOON</span>
              </div>
              <p className="hazard-card-desc">
                Flood monitoring is planned for a future release.
              </p>
              <div className="hazard-card-tags">
                {['Sentinel-1 SAR', 'River Gauges', 'Coming Soon'].map(t => (
                  <span key={t} className="hazard-tag flood">{t}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Evidence Source Chain ── */}
      <section className="landing-section">
        <div className="landing-container">
          <div className="landing-section-header" style={{ marginBottom: '2rem' }}>
            <div className="landing-section-eyebrow">EVIDENCE PROVENANCE</div>
            <h2 className="landing-section-h2">Every Verdict is Traceable</h2>
          </div>
          <div className="provenance-chain">
            {[
              { label: 'OFFICIAL AGENCIES', color: 'var(--color-verified)', desc: 'NDMA, NRSC, State DMs, MoEFCC' },
              { label: 'EMERGENCY DISPATCH', color: 'var(--color-info)', desc: 'NDRF, SDRF, Fire Service alerts' },
              { label: 'NEWS MEDIA', color: '#C084FC', desc: 'Verified journalism & press releases' },
              { label: 'SATELLITE DATA', color: 'var(--accent-orange)', desc: 'NASA FIRMS raw orbital passes' },
            ].map((s, i) => (
              <React.Fragment key={s.label}>
                <div className="provenance-node" style={{ borderColor: s.color + '55' }}>
                  <div className="provenance-node-dot" style={{ background: s.color }} />
                  <div className="provenance-node-label" style={{ color: s.color }}>{s.label}</div>
                  <div className="provenance-node-desc">{s.desc}</div>
                </div>
                {i < 3 && <ArrowRight size={16} color="var(--border-muted)" style={{ flexShrink: 0 }} />}
              </React.Fragment>
            ))}
            <ArrowRight size={16} color="var(--border-muted)" style={{ flexShrink: 0 }} />
            <div className="provenance-node provenance-verdict">
              <div className="provenance-node-dot" style={{ background: 'var(--accent-amber)' }} />
              <div className="provenance-node-label" style={{ color: 'var(--accent-amber)' }}>VERDICT</div>
              <div className="provenance-node-desc">Deterministic rule-based assessment</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Footer ── */}
      <section className="landing-cta">
        <div className="landing-container landing-cta-inner">
          <FileText size={32} color="var(--accent-amber)" style={{ marginBottom: '1rem' }} />
          <h2 className="landing-cta-h2">Ready to investigate?</h2>
          <p className="landing-cta-desc">
            Open the operational dashboard to monitor live satellite fire detections,
            run evidence searches, and verify incidents across India.
          </p>
          <button className="btn-hero-primary" onClick={handleLaunch} id="landing-launch-cta">
            <Satellite size={16} />
            <span>Open TerraShield Dashboard</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <div className="landing-container landing-footer-inner">
          <div className="landing-footer-brand">
            <ShieldAlert size={14} color="var(--accent-orange)" />
            <span>TerraShield<span style={{ color: 'var(--accent-amber)' }}>AI</span></span>
            <span style={{ color: 'var(--text-disabled)' }}>—</span>
            <span style={{ color: 'var(--text-tertiary)' }}>Geospatial Hazard Intelligence</span>
          </div>
          <div className="landing-footer-links">
            <span style={{ color: 'var(--text-disabled)', fontSize: '11px' }}>
              Data: NASA FIRMS VIIRS NRT • Evidence: TinyFish • Classification: UNCLASSIFIED OPEN SOURCE
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
