import React, { useState } from 'react';
import {
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Flame,
  MapPin,
  Search,
  Brain,
  Layers,
  Home,
  CheckCircle2,
  ExternalLink,
  LocateFixed,
  Database,
  Radio,
} from 'lucide-react';

interface HowItWorksGuideProps {
  onBack: () => void;
  onNavigateFire: () => void;
  onNavigateFlood?: () => void;
  onOpenReport?: (incidentId: string) => void;
}

interface GuideStep {
  stepNumber: number;
  badge: string;
  title: string;
  subtitle: string;
  instructions: string[];
  systemWorkflow: string[];
  keyTakeaway: string;
  icon: React.ElementType;
  accentColor: string;
  actionText?: string;
  onAction?: () => void;
}

export const HowItWorksGuide: React.FC<HowItWorksGuideProps> = ({
  onBack,
  onNavigateFire,
  onOpenReport,
}) => {
  const [activeStep, setActiveStep] = useState<number>(1);

  const steps: GuideStep[] = [
    {
      stepNumber: 1,
      badge: 'STEP 1 OF 7 • PLATFORM SCOPE',
      title: 'Wildfire Intelligence Focus',
      subtitle: 'Operational satellite thermal monitoring for emergency response',
      instructions: [
        'TerraShield AI focuses on operational Wildfire Intelligence for its immediate mission scope.',
        'The platform ingests real-time and historical satellite thermal anomaly data directly from NASA FIRMS sensors (VIIRS 375m and MODIS 1km).',
        'Flood monitoring is explicitly reserved for a future release, preserving data integrity without fabricated flood feeds.',
      ],
      systemWorkflow: [
        'Ingests NASA EOSDIS FIRMS VIIRS & MODIS active fire detections via API and verified archive.',
        'Filters by Area of Interest (AOI) with India First national prioritization.',
        'Clusters contiguous satellite thermal detections into verified ground incident candidates.',
      ],
      keyTakeaway: 'The platform concentrates on satellite thermal radiometry and wildfire corroboration with authentic evidence.',
      icon: Flame,
      accentColor: 'var(--accent-amber)',
      actionText: 'Open Fire Dashboard',
      onAction: onNavigateFire,
    },
    {
      stepNumber: 2,
      badge: 'STEP 2 OF 7 • SATELLITE MAP',
      title: 'Interactive Geospatial Map & Basemaps',
      subtitle: 'Real-time thermal detections overlaid on specialized cartography',
      instructions: [
        'The Fire Dashboard map visualizes raw orbital thermal detections from NASA FIRMS VIIRS/MODIS across India and global Areas of Interest.',
        'Switch between 3 distinct functional basemap modes: Dark Street (CARTO Dark Matter for high thermal contrast), Satellite Imagery (Esri World Imagery orthoimagery & NASA GIBS daily true-color passes), and Streets & Geography (CARTO Voyager with topography & road networks).',
        'Hotspots are color-coded by detection confidence (Red = High, Orange = Nominal, Grey = Low) and scaled by Fire Radiative Power (MW).',
      ],
      systemWorkflow: [
        'Renders coordinate-accurate Leaflet cartography anchored to authentic satellite coordinates.',
        'Supports live NASA FIRMS API queries with configurable lookback windows (1 to 10 days).',
        'Provides instant camera panning and extent framing per selected Area of Interest.',
      ],
      keyTakeaway: 'The map preserves genuine satellite sensor coordinates without synthetic interpolation or cosmetic fake fires.',
      icon: Layers,
      accentColor: 'var(--color-info)',
      actionText: 'Open Live Map',
      onAction: onNavigateFire,
    },
    {
      stepNumber: 3,
      badge: 'STEP 3 OF 7 • INCIDENT SELECTION',
      title: 'Hotspot & Incident Selection',
      subtitle: 'Instant access to radiative power, brightness temp, and spatial coordinates',
      instructions: [
        'Clicking any hotspot detection or clustered incident immediately displays the Incident Detail Card.',
        'Only one detail popup is active at a time; selecting a new hotspot immediately replaces the previous card.',
        'Review critical sensor radiometry: Peak Fire Radiative Power (MW), Brightness Temperature (Kelvin), detection timestamps, and exact geographic coordinates.',
      ],
      systemWorkflow: [
        'Extracts true sensor observation metadata from the selected record (latitude, longitude, FRP, brightness, acquisition date/time).',
        'Maintains deterministic record identity across both raw NASA FIRMS detections and clustered incidents.',
        'Evaluates deterministic uncertainty scores based on sensor confidence and spatial clustering.',
      ],
      keyTakeaway: 'Every popup is anchored to its authentic observation metadata with strict replacement logic and zero lingering stale records.',
      icon: MapPin,
      accentColor: 'var(--accent-orange)',
    },
    {
      stepNumber: 4,
      badge: 'STEP 4 OF 7 • AUTONOMOUS INVESTIGATION',
      title: 'Investigate with TinyFish + Groq',
      subtitle: 'Autonomous web crawler retrieves official advisories and regional news',
      instructions: [
        'Click "Investigate with TinyFish + Groq" on ANY selectable record (raw hotspot detection, candidate cluster, historical incident, or demo event).',
        'TinyFish executes targeted geospatial queries to discover official state disaster management bulletins (NDMA, FSI, Forest Depts), emergency dispatches, and local journalism.',
        'Retrieved web pages are fetched, parsed, and checked for geographic and temporal relevance. All sources retain authentic URLs and publication timestamps.',
      ],
      systemWorkflow: [
        'Constructs targeted search queries combining geographic location, observation date, and hazard context.',
        'Executes autonomous web search and page content extraction via TinyFish APIs.',
        'Assesses geographic and temporal relevance against satellite observation bounds.',
      ],
      keyTakeaway: 'TinyFish does not invent evidence. If no public news or agency reports exist for a remote sensor anomaly, the system states that evidence is insufficient.',
      icon: Search,
      accentColor: 'var(--accent-amber)',
    },
    {
      stepNumber: 5,
      badge: 'STEP 5 OF 7 • AI SYNTHESIS',
      title: 'Review the Grounded Intelligence Report',
      subtitle: 'Groq Cloud GPT-OSS generates evidence-grounded incident dossiers',
      instructions: [
        'Retrieved evidence records and incident metadata are fed into Groq Cloud high-speed inference running GPT-OSS models.',
        'The AI generates a structured, evidence-grounded Intelligence Dossier containing an Executive Summary, What Happened narrative, Chronological Timeline, and Ground Impacts.',
        'Crucially, the dossier highlights "Remaining Uncertainties & Information Gaps" to explain missing or contradictory claims, and provides clickable Direct Links to all cited sources.',
      ],
      systemWorkflow: [
        'Synthesizes plain-English incident narrative strictly grounded in retrieved evidence excerpts.',
        'Distinguishes between satellite physical observations, external news, and AI synthesis.',
        'Refuses to claim unverified fire causes or fabricated casualty figures.',
      ],
      keyTakeaway: 'Groq synthesizes strictly from retrieved evidence and sensor facts. The AI never fabricates source URLs or claims ground certainty without evidence.',
      icon: Brain,
      accentColor: 'var(--color-verified)',
      actionText: 'View Sample Report',
      onAction: () => {
        if (onOpenReport) onOpenReport('INC-HIST-001');
      },
    },
    {
      stepNumber: 6,
      badge: 'STEP 6 OF 7 • CAMERA OPERATIONS',
      title: 'Focus on Map from Anywhere',
      subtitle: 'Seamless camera transitions between reports and geographic coordinates',
      instructions: [
        'Whenever you view an incident card or the full intelligence dossier, click "Focus on Map" to fly the map camera directly to the incident coordinates.',
        'The camera centers smoothly at an incident-focused zoom level (zoom 10) and automatically invalidates the map viewport size so the view never clips.',
        'Focus on Map works reliably after zooming out, switching filter tabs, re-investigating, or closing the dossier modal.',
      ],
      systemWorkflow: [
        'Calculates incident centroid or detection coordinates.',
        'Switches active tab to Map and executes Leaflet flyTo with smooth animation easing.',
        'Triggers map container resize invalidation to ensure full tile rendering without blank edges.',
      ],
      keyTakeaway: 'You never lose spatial orientation when transitioning between analytical reports and tactical satellite map views.',
      icon: LocateFixed,
      accentColor: 'var(--color-info)',
      actionText: 'Test Map Focus',
      onAction: onNavigateFire,
    },
    {
      stepNumber: 7,
      badge: 'STEP 7 OF 7 • DATA MODES',
      title: 'Operating Data Modes & Provenance',
      subtitle: 'Live Satellite Passes, Historical Ground Truth, and Guided Demo Walkthroughs',
      instructions: [
        'LIVE Mode: Ingests real-time satellite fire detections from NASA FIRMS with custom day ranges (1 to 10 days). Requires a valid NASA FIRMS map key in backend environment.',
        'HISTORICAL Mode: Explores genuine archived satellite detections from NASA FIRMS global archive, preserving coordinate accuracy across major fire events.',
        'DEMO Mode: A guided, isolated simulation walkthrough featuring verified Indian historical wildfire events (Uttarakhand May 2024, Similipal March 2021, and Bandipur February 2019) with genuine coordinates and official source links.',
      ],
      systemWorkflow: [
        'Maintains strict isolation between Live telemetry, Historical archive, and Demo fixtures.',
        'Prevents test demo records from contaminating live operational fire queues.',
        'Clearly labels data provenance on every screen, card, and report.',
      ],
      keyTakeaway: 'TerraShield AI provides three distinct operating modes to accommodate live operations, historical analysis, and offline demonstrations.',
      icon: Database,
      accentColor: 'var(--accent-amber)',
      actionText: 'Explore Fire Intelligence',
      onAction: onNavigateFire,
    },
  ];

  const current = steps.find((s) => s.stepNumber === activeStep) || steps[0];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        overflowY: 'auto',
      }}
    >
      {/* ── Top Bar ── */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.85rem 1.75rem',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'rgba(12, 16, 23, 0.95)',
          backdropFilter: 'blur(12px)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <button
            onClick={onBack}
            className="btn-tool"
            id="guide-btn-back-home"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.85rem', fontSize: '0.82rem', fontWeight: 600 }}
          >
            <Home size={14} />
            <span>Home</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-amber)' }}>
              <ShieldAlert size={16} />
            </div>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, letterSpacing: '-0.01em' }}>
                How TerraShield AI Works
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-tertiary)' }}>
                7-Step Text Walkthrough & Technical Guide
              </div>
            </div>
          </div>
        </div>

        {/* Operational Link */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <button
            onClick={onNavigateFire}
            className="btn-tool"
            id="guide-jump-fire"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.85rem', fontSize: '0.8rem', color: 'var(--accent-orange)' }}
          >
            <Flame size={13} />
            <span>Fire Dashboard</span>
          </button>
        </div>
      </header>

      {/* ── Step Indicator Ribbon ── */}
      <nav
        aria-label="Walkthrough Steps"
        style={{
          display: 'flex',
          overflowX: 'auto',
          padding: '0.65rem 1.75rem',
          background: 'rgba(18, 22, 31, 0.6)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          gap: '0.5rem',
        }}
      >
        {steps.map((st) => {
          const isActive = st.stepNumber === activeStep;
          const StepIcon = st.icon;
          return (
            <button
              key={st.stepNumber}
              onClick={() => setActiveStep(st.stepNumber)}
              id={`guide-step-tab-${st.stepNumber}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                border: `1px solid ${isActive ? st.accentColor : 'rgba(255, 255, 255, 0.08)'}`,
                background: isActive ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: '0.8rem',
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <span
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  background: isActive ? st.accentColor : 'rgba(255, 255, 255, 0.1)',
                  color: isActive ? '#000' : 'var(--text-tertiary)',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {st.stepNumber}
              </span>
              <StepIcon size={13} style={{ color: isActive ? st.accentColor : 'var(--text-tertiary)' }} />
              <span>{st.title}</span>
            </button>
          );
        })}
      </nav>

      {/* ── Main Step Content Area (Clean Text Walkthrough) ── */}
      <main style={{ flex: 1, padding: '2rem 1.75rem', maxWidth: '1080px', margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>
          {/* Left Column: Instructions & Walkthrough */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  color: current.accentColor,
                  background: 'rgba(255, 255, 255, 0.05)',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '4px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  display: 'inline-block',
                  marginBottom: '0.65rem',
                }}
              >
                {current.badge}
              </span>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0 0 0.45rem 0', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                {current.title}
              </h1>
              <h2 style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                {current.subtitle}
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.92rem', lineHeight: 1.65, color: 'var(--text-secondary)' }}>
              {current.instructions.map((para, i) => (
                <p key={i} style={{ margin: 0 }}>
                  {para}
                </p>
              ))}
            </div>

            {/* Key Takeaway Box */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                borderLeft: `3px solid ${current.accentColor}`,
                padding: '0.85rem 1.1rem',
                borderRadius: '0 8px 8px 0',
                fontSize: '0.86rem',
                color: 'var(--text-primary)',
              }}
            >
              <strong style={{ color: current.accentColor }}>Core Geospatial Takeaway: </strong>
              {current.keyTakeaway}
            </div>

            {/* Navigation & Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setActiveStep((prev) => Math.max(1, prev - 1))}
                  disabled={activeStep === 1}
                  className="btn-tool"
                  id="guide-btn-prev"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.5rem 0.85rem', fontSize: '0.82rem' }}
                >
                  <ChevronLeft size={14} />
                  <span>Previous</span>
                </button>

                <button
                  onClick={() => setActiveStep((prev) => Math.min(steps.length, prev + 1))}
                  disabled={activeStep === steps.length}
                  className="btn-tool"
                  id="guide-btn-next"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.5rem 0.85rem', fontSize: '0.82rem' }}
                >
                  <span>Next Step</span>
                  <ChevronRight size={14} />
                </button>
              </div>

              {current.actionText && current.onAction && (
                <button
                  onClick={current.onAction}
                  className="btn-tool"
                  id={`guide-step-action-${current.stepNumber}`}
                  style={{
                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(249, 115, 22, 0.25))',
                    borderColor: current.accentColor,
                    color: current.accentColor,
                    fontWeight: 600,
                    padding: '0.5rem 1rem',
                    fontSize: '0.82rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <span>{current.actionText}</span>
                  <ExternalLink size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Architectural & Technical Workflow Breakdown (Text-only) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div
              style={{
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                background: '#0c1017',
                padding: '1.25rem',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.75rem' }}>
                <Radio size={14} style={{ color: current.accentColor }} />
                <span style={{ fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-primary)' }}>
                  SYSTEM PIPELINE OPERATIONS
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginLeft: 'auto', fontFamily: 'monospace' }}>
                  STEP {current.stepNumber} / 7
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {current.systemWorkflow.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '4px',
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: current.accentColor,
                        flexShrink: 0,
                        marginTop: '2px',
                      }}
                    >
                      {idx + 1}
                    </div>
                    <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                      {item}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Verification Standard Banner */}
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '8px',
                padding: '0.85rem 1rem',
                fontSize: '0.78rem',
                color: 'var(--text-tertiary)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: 'var(--color-verified)' }}>
                <CheckCircle2 size={13} />
                <span>Text-Only Operational Reference</span>
              </div>
              <div>
                All operations described are implemented directly in the TerraShield AI runtime.
                No screenshots, mockups, or fabricated datasets are used.
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
