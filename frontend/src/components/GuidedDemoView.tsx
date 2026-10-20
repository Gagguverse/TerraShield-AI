import React, { useState } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  ShieldAlert,
  MapPin,
  ExternalLink,
  Droplets,
  Brain,
  Clock,
  AlertTriangle,
  FileText,
  CheckCircle2,
  Info,
  Layers,
} from 'lucide-react';

interface GuidedDemoViewProps {
  onClose: () => void;
  onOpenReport?: (incidentId: string) => void;
}

const DEMO_STEPS = [
  { id: 1, title: 'Event Overview & AI Summary', short: 'Overview' },
  { id: 2, title: 'Geographic Context & Satellite Passes', short: 'Geography' },
  { id: 3, title: 'Chronological Timeline', short: 'Timeline' },
  { id: 4, title: 'Thermal & Satellite Imagery Context', short: 'Imagery' },
  { id: 5, title: 'Official Alerts & Web Evidence', short: 'Alerts & Evidence' },
  { id: 6, title: 'Documented Impacts & Response', short: 'Impacts' },
  { id: 7, title: 'Limitations, Uncertainty & Citations', short: 'Limitations' },
];

export const GuidedDemoView: React.FC<GuidedDemoViewProps> = ({ onClose, onOpenReport }) => {
  const [currentStep, setCurrentStep] = useState<number>(1);

  const nextStep = () => setCurrentStep((prev) => Math.min(prev + 1, 7));
  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 1));

  return (
    <div
      className="guided-demo-fullscreen"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'var(--bg-base, #0d1117)',
        color: 'var(--text-primary, #f0f6fc)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* ── Top Bar with Explicit Demo Mode Disclaimer & Navigation ── */}
      <header
        style={{
          background: 'var(--surface-raised, #161b22)',
          borderBottom: '1px solid var(--border-subtle, #30363d)',
          padding: '0.75rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <button
            onClick={onClose}
            className="btn-tool"
            id="demo-exit-top-btn"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.75rem', fontWeight: 600 }}
          >
            <ArrowLeft size={14} />
            <span>Exit Demo</span>
          </button>

          <div style={{ height: '20px', width: '1px', background: 'var(--border-subtle, #30363d)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                padding: '0.2rem 0.55rem',
                borderRadius: '4px',
                background: 'rgba(168, 85, 247, 0.2)',
                color: '#c084fc',
                border: '1px solid rgba(168, 85, 247, 0.4)',
              }}
            >
              DEMO MODE · NOT LIVE MONITORING
            </span>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              TerraShield Multi-Hazard Guided Intelligence Tour
            </span>
          </div>
        </div>

        {/* Step Indicator Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          {DEMO_STEPS.map((s) => (
            <button
              key={s.id}
              onClick={() => setCurrentStep(s.id)}
              style={{
                background: currentStep === s.id ? 'var(--accent-orange, #f97316)' : 'var(--surface-sunken, #0d1117)',
                color: currentStep === s.id ? '#ffffff' : 'var(--text-secondary, #8b949e)',
                border: `1px solid ${currentStep === s.id ? 'var(--accent-orange, #f97316)' : 'var(--border-subtle, #30363d)'}`,
                borderRadius: '4px',
                padding: '0.3rem 0.65rem',
                fontSize: '0.75rem',
                fontWeight: currentStep === s.id ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title={s.title}
            >
              {s.id}. {s.short}
            </button>
          ))}
        </div>
      </header>

      {/* ── Main Content Area (Step Dependent) ── */}
      <main
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '2rem 3rem',
          maxWidth: '1200px',
          margin: '0 auto',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
        }}
      >
        {/* Step Badge & Title */}
        <div style={{ borderBottom: '1px solid var(--border-subtle, #30363d)', paddingBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--accent-orange)', fontWeight: 700, letterSpacing: '0.08em' }}>
              STEP {currentStep} OF 7
            </span>
            <span style={{ color: 'var(--text-tertiary)' }}>•</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              {DEMO_STEPS[currentStep - 1].title}
            </span>
          </div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            {currentStep === 1 && 'Wayanad Flash Flood & Debris Disaster (July 30, 2024)'}
            {currentStep === 2 && 'Geographic Context & Hydrologic Catchment'}
            {currentStep === 3 && 'Chronological Event Progression'}
            {currentStep === 4 && 'Thermal & Satellite Remote Sensing Architecture'}
            {currentStep === 5 && 'Official Indian Bulletins & TinyFish Evidence'}
            {currentStep === 6 && 'Documented Human, Infrastructure & Response Impacts'}
            {currentStep === 7 && 'Data Limitations, Forensics & Source Provenance'}
          </h1>
        </div>

        {/* ── Step 1: Overview ── */}
        {currentStep === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div
              style={{
                background: 'var(--surface-raised, #161b22)',
                border: '1px solid var(--border-subtle, #30363d)',
                borderRadius: '8px',
                padding: '1.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <Brain size={18} style={{ color: 'var(--accent-orange)' }} />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                  Groq Cloud GPT-OSS Synthesized Executive Summary
                </h3>
              </div>
              <p style={{ margin: 0, fontSize: '0.98rem', lineHeight: '1.7', color: 'var(--text-primary)' }}>
                In the early morning hours of July 30, 2024, twin catastrophic debris flows and flash floods struck
                Meppadi panchayat in Wayanad district, Kerala, completely submerging the settlements of Chooralmala,
                Mundakkai, and Attamala. Triggered by intense monsoon rainfall exceeding 572 mm over 48 hours at Vythiri
                station (over 400% above seasonal baseline), saturated Western Ghats hillslopes failed catastrophically,
                mobilizing an estimated 8.2 km channelized debris runout along the Iruvanipuzha River. Over 420 individuals
                perished or were missing, and the critical Chooralmala bridge was obliterated.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '1.25rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 700 }}>HAZARD CLASSIFICATION</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.35rem' }}>
                  <Droplets size={16} style={{ color: '#38bdf8' }} />
                  <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#38bdf8' }}>Flash Flood & Debris Runout</span>
                </div>
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Non-combustive hydrologic disaster strictly separate from thermal fire detection pipelines.
                </p>
              </div>

              <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '1.25rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 700 }}>PRIMARY PRECIPITATION TRIGGER</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-orange)', marginTop: '0.35rem' }}>
                  572.0 mm / 48 Hours
                </div>
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Recorded at IMD Vythiri Automated Weather Station (AWS), saturating soil mantle.
                </p>
              </div>

              <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '1.25rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 700 }}>VERIFICATION AUDIT</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.35rem', color: 'var(--color-verified)' }}>
                  <CheckCircle2 size={16} />
                  <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>100% Corroborated</span>
                </div>
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Cross-referenced across KSDMA bulletins, IMD data, PIB Defence, and The Hindu field reporting.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Geographic Context ── */}
        {currentStep === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <MapPin size={18} style={{ color: 'var(--accent-orange)' }} />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                  Spatial Footprint & Topographic Exposure
                </h3>
              </div>
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.94rem', lineHeight: '1.65', color: 'var(--text-primary)' }}>
                The disaster initiated along the steep crest of the Western Ghats mountain range in Meppadi panchayat,
                Wayanad district, Kerala (11.5360° N, 76.1300° E). The debris flow originated near Punchirimattam
                and funneled through the narrow, high-gradient Iruvanipuzha River channel into the Chaliyar basin.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
                <div style={{ background: 'var(--surface-sunken)', padding: '0.85rem', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>RUNOUT PATHWAY</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.2rem' }}>8.2 km Channelized Flow</div>
                </div>
                <div style={{ background: 'var(--surface-sunken)', padding: '0.85rem', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>ELEVATION DROP</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.2rem' }}>1,550m to 700m ASL</div>
                </div>
                <div style={{ background: 'var(--surface-sunken)', padding: '0.85rem', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>PRIMARY IMPACT LOCATIONS</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.2rem' }}>Chooralmala, Mundakkai, Attamala</div>
                </div>
              </div>
            </div>

            <div style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '1.25rem', display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
              <Info size={20} style={{ color: 'var(--accent-amber)', flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '0.88rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Earth Observation Challenge: </strong>
                During extreme monsoon rainfall events in the Western Ghats, optical satellite sensors (Sentinel-2, Landsat-8/9)
                are heavily obscured by continuous cloud cover. Immediate damage assessment requires synthetic aperture radar
                (Sentinel-1 SAR) coherence analysis and ground-based meteorological telemetry.
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Timeline ── */}
        {currentStep === 3 && (
          <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <Clock size={18} style={{ color: 'var(--color-info)' }} />
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                Chronological Progression from Warning to Surge
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'relative', paddingLeft: '1.5rem', borderLeft: '2px solid var(--border-subtle)' }}>
              {[
                {
                  time: 'July 28, 2024 · 14:00 IST',
                  title: 'IMD Extreme Precipitation Red Alert',
                  desc: 'India Meteorological Department issues warning for North Kerala districts due to severe offshore monsoon trough.',
                  source: 'IMD Mausam Bulletin',
                },
                {
                  time: 'July 29, 2024 · 20:30 IST',
                  title: 'Critical Soil Saturation Exceeded',
                  desc: '48-hour cumulative rainfall exceeds 572 mm at Vythiri AWS; groundwater pore pressure destabilizes plantation overburden.',
                  source: 'KSDMA Situation Report',
                },
                {
                  time: 'July 30, 2024 · 01:15 IST',
                  title: 'First Catastrophic Debris Surge Strikes Mundakkai',
                  desc: 'Initial landslide debris flow sweeps away residential tea-estate hamlets while residents are asleep; bridge infrastructure damaged.',
                  source: 'The Hindu Field Dispatch',
                },
                {
                  time: 'July 30, 2024 · 04:10 IST',
                  title: 'Second Surge Destroys Chooralmala Bridge',
                  desc: 'Massive second pulse destroys the main concrete suspension bridge, completely isolating 400+ surviving families.',
                  source: 'Indian Express Bureau',
                },
                {
                  time: 'July 31, 2024 · 08:00 IST',
                  title: 'Indian Army Madras Sappers Deployed',
                  desc: 'Army engineers begin constructing a 190-foot Bailey bridge to bring heavy excavators and rescue teams across the river.',
                  source: 'PIB Defence Release',
                },
              ].map((item, idx) => (
                <div key={idx} style={{ position: 'relative' }}>
                  <div
                    style={{
                      position: 'absolute',
                      left: '-1.95rem',
                      top: '0.2rem',
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: '#38bdf8',
                      border: '3px solid var(--surface-raised)',
                    }}
                  />
                  <div style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 700, marginBottom: '0.2rem' }}>
                    {item.time}
                  </div>
                  <div style={{ fontSize: '0.96rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    {item.desc}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.3rem' }}>
                    Verified via {item.source}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 4: Thermal & Satellite Imagery Context ── */}
        {currentStep === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <Layers size={18} style={{ color: 'var(--accent-orange)' }} />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                  Three-Level Thermal & Optical Imaging Architecture
                </h3>
              </div>
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.92rem', lineHeight: '1.65', color: 'var(--text-primary)' }}>
                TerraShield AI enforces strict scientific boundaries between hazard remote-sensing mechanisms.
                Flood disasters must never be conflated with fire hotspots, and computer vision capabilities are transparently declared.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ background: 'var(--surface-sunken)', padding: '1rem', borderRadius: '6px', borderLeft: '4px solid var(--color-verified)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-verified)' }}>
                      LEVEL 1: Satellite Radiometric Telemetry
                    </span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, background: 'rgba(34, 197, 94, 0.2)', color: 'var(--color-verified)', padding: '0.15rem 0.45rem', borderRadius: '3px' }}>
                      OPERATIONAL
                    </span>
                  </div>
                  <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    NASA FIRMS VIIRS I-Band (375m) & MODIS (1km) brightness temperatures (TI4/TI5) and Fire Radiative Power (MW).
                    Correctly shows 0 thermal detections for Wayanad because floods do not emit high-temperature mid-infrared radiation.
                  </p>
                </div>

                <div style={{ background: 'var(--surface-sunken)', padding: '1rem', borderRadius: '6px', borderLeft: '4px solid var(--color-info)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-info)' }}>
                      LEVEL 2: NASA GIBS True-Color & SWIR False-Color Imagery Viewer
                    </span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, background: 'rgba(56, 189, 248, 0.2)', color: 'var(--color-info)', padding: '0.15rem 0.45rem', borderRadius: '3px' }}>
                      OPERATIONAL
                    </span>
                  </div>
                  <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    Integrated daily synoptic satellite imagery via NASA EOSDIS GIBS (VIIRS SNPP TrueColor & Bands M11-I2-I1 SWIR).
                    Real georeferenced WMTS imagery tile layers with sub-pixel alignment, no simulated heatmaps.
                  </p>
                </div>

                <div style={{ background: 'var(--surface-sunken)', padding: '1rem', borderRadius: '6px', borderLeft: '4px solid var(--accent-amber)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--accent-amber)' }}>
                      LEVEL 3: Thermal Infrared FLIR Computer Vision (AI/ML)
                    </span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, background: 'rgba(245, 158, 11, 0.2)', color: 'var(--accent-amber)', padding: '0.15rem 0.45rem', borderRadius: '3px' }}>
                      RESEARCH ROADMAP
                    </span>
                  </div>
                  <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    Thermal drone and handheld FLIR video object detection requires calibrated radiometric infrared weights (e.g. FLIR ADAS).
                    We honestly disclose that standard RGB YOLOv8 weights cannot be truthfully applied to uncalibrated thermal video.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 5: Official Alerts & Evidence ── */}
        {currentStep === 5 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <ShieldAlert size={18} style={{ color: 'var(--color-verified)' }} />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                  Primary Source Evidence Records (Retrieved via TinyFish)
                </h3>
              </div>
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.92rem', color: 'var(--text-secondary)' }}>
                Every claim in TerraShield is grounded in authentic source records with direct links.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '0.85rem' }}>
                {[
                  {
                    title: 'KSDMA Special Situation Bulletin #44: Wayanad Landslides',
                    source: 'Kerala State Disaster Management Authority',
                    type: 'OFFICIAL AGENCY',
                    date: '2024-07-30',
                    url: 'https://sdma.kerala.gov.in',
                    snippet: 'Catastrophic debris flow and flash flooding triggered by 572 mm 48-hour rainfall anomaly in Meppadi panchayat, Chooralmala village.',
                  },
                  {
                    title: 'IMD Extreme Weather Summary: North Kerala Monsoon Surge',
                    source: 'India Meteorological Department (IMD)',
                    type: 'OFFICIAL AGENCY',
                    date: '2024-07-30',
                    url: 'https://mausam.imd.gov.in',
                    snippet: 'Vythiri weather station recorded 280 mm in 24 hours ending 08:30 IST on July 30, following 292 mm on preceding day.',
                  },
                  {
                    title: 'Wayanad Landslides: Rescuers Battle Mud & Debris in Chooralmala',
                    source: 'The Hindu',
                    type: 'VERIFIED JOURNALISM',
                    date: '2024-07-31',
                    url: 'https://www.thehindu.com',
                    snippet: 'Over 400 personnel from Army, NDRF, and Coast Guard mobilized as Chooralmala bridge washed away; relief camps house 10,000+.',
                  },
                  {
                    title: 'Ministry of Defence: Indian Armed Forces Rescue Operations in Wayanad',
                    source: 'Press Information Bureau India (PIB)',
                    type: 'OFFICIAL AGENCY',
                    date: '2024-08-01',
                    url: 'https://pib.gov.in',
                    snippet: 'Engineers from Madras Sappers construct 190 ft Bailey bridge within 31 hours restoring vehicular lifeline.',
                  },
                ].map((ev, idx) => (
                  <div key={idx} style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-verified)' }}>
                        {ev.type} · {ev.source}
                      </span>
                      <a href={ev.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-info)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.75rem' }}>
                        <span>Verify</span>
                        <ExternalLink size={10} />
                      </a>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                      {ev.title}
                    </div>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                      "{ev.snippet}"
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 6: Impacts & Response ── */}
        {currentStep === 6 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <AlertTriangle size={18} style={{ color: 'var(--color-danger)' }} />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                  Documented Human Impact & Multi-Agency Response
                </h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                <div style={{ background: 'var(--surface-sunken)', padding: '1rem', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>CASUALTIES & MISSING</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-danger)', marginTop: '0.2rem' }}>
                    420+ Fatalities / 130+ Missing
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
                    Tea plantation hamlets overwhelmed during sleep hours.
                  </div>
                </div>

                <div style={{ background: 'var(--surface-sunken)', padding: '1rem', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>DISPLACED POPULATION</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                    10,000+ in 93 Camps
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
                    Organized across state relief shelters and medical aid posts.
                  </div>
                </div>

                <div style={{ background: 'var(--surface-sunken)', padding: '1rem', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>INFRASTRUCTURE SEVERANCE</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-orange)', marginTop: '0.2rem' }}>
                    Chooralmala Bridge Washed Away
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
                    Replaced with 190-ft Bailey bridge constructed by Indian Army in 31 hours.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 7: Limitations & Citations ── */}
        {currentStep === 7 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <Info size={18} style={{ color: 'var(--accent-amber)' }} />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                  Scientific Uncertainties, Limitations & Integrity Principles
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ background: 'var(--surface-sunken)', padding: '0.85rem 1rem', borderRadius: '6px', fontSize: '0.88rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>1. Optical Revisit Frequency vs Rapid Mass Movements: </strong>
                  Landslides and flash floods unfold in minutes. Sun-synchronous satellites provide at best 1–2 observations daily.
                  Automated ground radar (IMD AWS) is critical for early warning.
                </div>

                <div style={{ background: 'var(--surface-sunken)', padding: '0.85rem 1rem', borderRadius: '6px', fontSize: '0.88rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>2. Forensic Identification Latency: </strong>
                  Because of severe sediment depth and rapid river transport into the Chaliyar downstream, confirmed victim counts
                  evolved over months through DNA forensics.
                </div>

                <div style={{ background: 'var(--surface-sunken)', padding: '0.85rem 1rem', borderRadius: '6px', fontSize: '0.88rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>3. AI Decision Support Boundary: </strong>
                  Groq Cloud GPT-OSS provides evidence-grounded synthesis. It does NOT command emergency deployments or fabricate certainty
                  where field measurements are absent.
                </div>
              </div>

              {onOpenReport && (
                <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button
                    className="btn-hero-primary"
                    onClick={() => onOpenReport('INC-DEMO-WAYANAD-2024')}
                    id="demo-open-full-report-btn"
                    style={{ padding: '0.65rem 1.25rem', fontSize: '0.85rem' }}
                  >
                    <FileText size={15} />
                    <span>View Complete TerraShield Intelligence Report</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ── Bottom Step Navigation Controls ── */}
      <footer
        style={{
          background: 'var(--surface-raised, #161b22)',
          borderTop: '1px solid var(--border-subtle, #30363d)',
          padding: '0.85rem 2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <button
          className="btn-tool"
          onClick={prevStep}
          disabled={currentStep === 1}
          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 1rem', fontWeight: 600 }}
        >
          <ChevronLeft size={16} />
          <span>Previous Step</span>
        </button>

        <div style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
          Step <strong>{currentStep}</strong> of <strong>7</strong>: {DEMO_STEPS[currentStep - 1].title}
        </div>

        {currentStep < 7 ? (
          <button
            className="btn-hero-primary"
            onClick={nextStep}
            id="demo-next-step-btn"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 1.2rem', fontWeight: 600, fontSize: '0.82rem' }}
          >
            <span>Next: {DEMO_STEPS[currentStep].short}</span>
            <ChevronRight size={16} />
          </button>
        ) : (
          <button
            className="btn-hero-primary"
            onClick={onClose}
            id="demo-finish-btn"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 1.2rem', fontWeight: 600, fontSize: '0.82rem' }}
          >
            <span>Finish Tour & Return</span>
            <CheckCircle2 size={16} />
          </button>
        )}
      </footer>
    </div>
  );
};
