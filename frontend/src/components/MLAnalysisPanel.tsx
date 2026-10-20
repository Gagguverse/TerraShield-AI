import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Cpu,
  X,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Layers,
  Flame,
  Maximize2,
  Minimize2,
  ZoomIn,
  Download,
  Info,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { api } from '../services/api';
import type {
  ThermalAnalyzeResponse,
  FireDetectResponse,
  ThermalStatusResponse,
  FireDetection,
} from '../types';

interface MLAnalysisPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ExpandedImageState {
  url: string;
  title: string;
  subtitle?: string;
  detections?: FireDetection[];
  imageDims?: { width: number; height: number };
}

export const MLAnalysisPanel: React.FC<MLAnalysisPanelProps> = ({ isOpen, onClose }) => {
  // Tab state: 'unet' (Thermal Segmentation) | 'yolo' (Fire & Smoke Detection)
  const [activeTab, setActiveTab] = useState<'unet' | 'yolo'>('unet');

  // Fullscreen modal toggle state
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Input configuration
  const [imageSource] = useState<string>('sample_lwir');
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.25);

  // Model status from backend
  const [thermalStatus, setThermalStatus] = useState<ThermalStatusResponse | null>(null);

  // U-Net state
  const [isUnetRunning, setIsUnetRunning] = useState<boolean>(false);
  const [unetResult, setUnetResult] = useState<ThermalAnalyzeResponse | null>(null);
  const [unetError, setUnetError] = useState<string | null>(null);

  // YOLO state
  const [isYoloRunning, setIsYoloRunning] = useState<boolean>(false);
  const [yoloResult, setYoloResult] = useState<FireDetectResponse | null>(null);
  const [yoloError, setYoloError] = useState<string | null>(null);
  const [yoloRunCount, setYoloRunCount] = useState<number>(0);
  const [hoveredDetIdx, setHoveredDetIdx] = useState<number | null>(null);
  const [yoloImageLoading, setYoloImageLoading] = useState<boolean>(false);
  const [yoloImageError, setYoloImageError] = useState<string | null>(null);
  const [yoloImageDims, setYoloImageDims] = useState<{ width: number; height: number }>({ width: 1200, height: 896 });
  const [showBoxHud, setShowBoxHud] = useState<boolean>(true);

  // Fullscreen image lightbox modal
  const [expandedImage, setExpandedImage] = useState<ExpandedImageState | null>(null);

  // Load thermal status on mount
  useEffect(() => {
    if (isOpen && !thermalStatus) {
      api.getThermalStatus()
        .then((res) => setThermalStatus(res))
        .catch((err) => console.error('Failed to load thermal status:', err));
    }
  }, [isOpen, thermalStatus]);

  // Global Escape key listener to close image lightbox first, or panel if no lightbox
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (expandedImage) {
          setExpandedImage(null);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, expandedImage, onClose]);

  // Action 1: Run Thermal Segmentation (U-Net)
  const handleRunThermalSegmentation = useCallback(async () => {
    setIsUnetRunning(true);
    setUnetError(null);
    try {
      const res = await api.analyzeThermalImage({
        image_source: imageSource,
        confidence_threshold: Math.max(0.1, confidenceThreshold),
      });
      setUnetResult(res);
      setActiveTab('unet');
      if (res.model_status === 'model_unavailable' || res.status === 'error') {
        setUnetError(res.disclaimer || 'Model unavailable or execution failed.');
      }
    } catch (err: any) {
      setUnetError(err.message || 'Failed to execute thermal segmentation inference.');
    } finally {
      setIsUnetRunning(false);
    }
  }, [imageSource, confidenceThreshold]);

  // Action 2: Run Fire & Smoke Detection (YOLOv8n)
  const handleRunFireSmokeDetection = useCallback(async () => {
    setIsYoloRunning(true);
    setYoloError(null);
    setYoloImageLoading(true);
    setYoloImageError(null);
    setYoloRunCount((prev) => prev + 1);

    try {
      const res = await api.detectFireSmoke({
        image_source: imageSource,
        confidence_threshold: confidenceThreshold,
      });

      setYoloResult(res);
      setActiveTab('yolo');

      if (res.model_status === 'model_unavailable' || res.status === 'error') {
        setYoloError(res.disclaimer || 'Model unavailable or execution failed.');
        setYoloImageLoading(false);
      }
    } catch (err: any) {
      setYoloError(err.message || 'Failed to execute fire & smoke detection inference.');
      setYoloImageLoading(false);
    } finally {
      setIsYoloRunning(false);
    }
  }, [imageSource, confidenceThreshold]);

  if (!isOpen) return null;

  const panelContent = (
    <div
      className="ml-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(3, 7, 18, 0.78)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 9200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isFullscreen ? '0' : '20px',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !expandedImage) {
          onClose();
        }
      }}
    >
      <div
        id="ml-analysis-panel"
        className="ml-analysis-panel"
        style={{
          position: 'relative',
          width: isFullscreen ? '100vw' : '1140px',
          maxWidth: isFullscreen ? '100vw' : 'calc(100vw - 32px)',
          height: isFullscreen ? '100vh' : '88vh',
          maxHeight: isFullscreen ? '100vh' : '920px',
          backgroundColor: '#0F172A',
          border: isFullscreen ? 'none' : '1px solid rgba(249, 115, 22, 0.45)',
          borderRadius: isFullscreen ? '0' : '12px',
          boxShadow: isFullscreen ? 'none' : '0 25px 60px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#F1F5F9',
          fontSize: '12px',
          transition: 'width 0.2s ease, height 0.2s ease, border-radius 0.2s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Header Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(249, 115, 22, 0.2)',
                border: '1px solid rgba(249, 115, 22, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 12px rgba(249, 115, 22, 0.25)',
              }}
            >
              <Cpu size={18} color="#F97316" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 800, fontSize: '14px', color: '#F8FAFC', letterSpacing: '0.03em' }}>
                  ML ANALYSIS SUITE
                </span>
                <span
                  style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(249, 115, 22, 0.25)',
                    color: '#FB923C',
                    border: '1px solid rgba(249, 115, 22, 0.45)',
                    letterSpacing: '0.04em',
                  }}
                >
                  LIVE VERIFICATION
                </span>
              </div>
              <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '1px' }}>
                Thermal Radiance Segmentation (U-Net) & Fire/Smoke Bounding Boxes (YOLOv8n)
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Fullscreen Toggle Button */}
            <button
              id="btn-toggle-fullscreen"
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              style={{
                background: 'rgba(51, 65, 85, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#CBD5E1',
                cursor: 'pointer',
                padding: '6px 10px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11px',
                fontWeight: 600,
                transition: 'all 0.15s ease',
              }}
              title={isFullscreen ? 'Exit Fullscreen Mode' : 'Expand to Fullscreen View'}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 size={13} color="#CBD5E1" />
                  <span>Exit Fullscreen</span>
                </>
              ) : (
                <>
                  <Maximize2 size={13} color="#CBD5E1" />
                  <span>Fullscreen</span>
                </>
              )}
            </button>

            {/* Close Button */}
            <button
              id="btn-close-ml-panel"
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#F87171',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
              title="Close ML Analysis Suite (Esc)"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* 2. Mandatory Operational Notice Banner */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '7px 16px',
            backgroundColor: 'rgba(234, 88, 12, 0.12)',
            borderBottom: '1px solid rgba(234, 88, 12, 0.28)',
            fontSize: '11px',
            color: '#FED7AA',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={14} style={{ flexShrink: 0, color: '#FB923C' }} />
            <span>
              <strong>Operational Separation:</strong> Model predictions are visual diagnostic aids, <em>NOT</em> confirmed wildfire alerts, and remain strictly separated from official NASA FIRMS satellite radiometry.
            </span>
          </div>
          <span style={{ fontSize: '10px', color: '#CBD5E1', opacity: 0.85, flexShrink: 0, marginLeft: '12px' }}>
            Press <kbd style={{ background: 'rgba(0,0,0,0.4)', padding: '1px 4px', borderRadius: '3px', border: '1px solid #475569' }}>Esc</kbd> to exit
          </span>
        </div>

        {/* 3. Main 2-Column Split Workspace */}
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: '370px 1fr',
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {/* LEFT COLUMN: Controls, Benchmarks & Specifications */}
          <div
            style={{
              padding: '16px',
              borderRight: '1px solid rgba(255, 255, 255, 0.08)',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
            }}
          >
            {/* Input Benchmark Section */}
            <div
              style={{
                backgroundColor: 'rgba(30, 41, 59, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '12px',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#E2E8F0', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ letterSpacing: '0.04em' }}>INPUT TEST TARGET</span>
                <span style={{ color: '#10B981', fontSize: '10px', fontWeight: 600 }}>● Calibrated LWIR</span>
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div
                  id="btn-expand-image-input"
                  style={{
                    width: '90px',
                    height: '65px',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    border: '1px solid rgba(249, 115, 22, 0.4)',
                    position: 'relative',
                    flexShrink: 0,
                    cursor: 'pointer',
                    backgroundColor: '#000',
                  }}
                  onClick={() => setExpandedImage({
                    url: '/thermal_sample_lwir.jpg',
                    title: 'Calibrated Aerial Thermal LWIR Frame (sample_lwir)',
                    subtitle: '1024 × 768 px | 14-bit Radiometric | Uncooled Microbolometer',
                  })}
                  title="Click to view full-resolution input frame"
                >
                  <img
                    src="/thermal_sample_lwir.jpg"
                    alt="Calibrated LWIR Sample Frame"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      backgroundColor: 'rgba(0,0,0,0.75)',
                      padding: '2px 4px',
                      fontSize: '8px',
                      color: '#F8FAFC',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2px',
                    }}
                  >
                    <ZoomIn size={9} /> Expand
                  </div>
                </div>

                <div style={{ flex: 1, fontSize: '11px', color: '#94A3B8', lineHeight: 1.4 }}>
                  <div><strong>Frame ID:</strong> <code style={{ color: '#F8FAFC', background: 'rgba(0,0,0,0.3)', padding: '1px 4px', borderRadius: '3px' }}>sample_lwir</code></div>
                  <div><strong>Sensor:</strong> LWIR (8–14 µm) Microbolometer</div>
                  <div><strong>Resolution:</strong> 1200 × 896 px (Calibrated)</div>
                  <div><strong>Palette:</strong> Ironbow Radiometric</div>
                </div>
              </div>

              {/* Confidence Threshold Slider */}
              <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                  <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 500 }}>Confidence Threshold:</span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#FB923C', fontFamily: 'monospace' }}>
                    {(confidenceThreshold * 100).toFixed(0)}% ({confidenceThreshold.toFixed(2)})
                  </span>
                </div>
                <input
                  type="range"
                  min="0.10"
                  max="0.80"
                  step="0.05"
                  value={confidenceThreshold}
                  onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: '#F97316', cursor: 'pointer', height: '5px' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#64748B', marginTop: '3px' }}>
                  <span
                    style={{ cursor: 'pointer', textDecoration: confidenceThreshold === 0.10 ? 'underline' : 'none', color: confidenceThreshold === 0.10 ? '#FB923C' : undefined }}
                    onClick={() => setConfidenceThreshold(0.10)}
                  >
                    10% (Sensitive)
                  </span>
                  <span
                    style={{ cursor: 'pointer', textDecoration: confidenceThreshold === 0.25 ? 'underline' : 'none', color: confidenceThreshold === 0.25 ? '#FB923C' : undefined }}
                    onClick={() => setConfidenceThreshold(0.25)}
                  >
                    25% (Standard)
                  </span>
                  <span
                    style={{ cursor: 'pointer', textDecoration: confidenceThreshold === 0.80 ? 'underline' : 'none', color: confidenceThreshold === 0.80 ? '#FB923C' : undefined }}
                    onClick={() => setConfidenceThreshold(0.80)}
                  >
                    80% (Strict)
                  </span>
                </div>
              </div>
            </div>

            {/* Inference Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', letterSpacing: '0.04em' }}>
                RUN LIVE INFERENCE
              </div>

              {/* Action 1: Run Thermal Segmentation */}
              <button
                id="btn-run-thermal-segmentation"
                type="button"
                onClick={handleRunThermalSegmentation}
                disabled={isUnetRunning}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  backgroundColor: activeTab === 'unet' && unetResult ? 'rgba(234, 88, 12, 0.22)' : 'rgba(30, 41, 59, 0.85)',
                  border: '1px solid',
                  borderColor: activeTab === 'unet' && unetResult ? '#EA580C' : 'rgba(249, 115, 22, 0.45)',
                  borderRadius: '8px',
                  color: '#F8FAFC',
                  cursor: isUnetRunning ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: '12px',
                  transition: 'all 0.15s ease',
                  boxShadow: activeTab === 'unet' && unetResult ? '0 0 12px rgba(234, 88, 12, 0.2)' : 'none',
                }}
                title="Execute U-Net hot-region segmentation model trained on IGNITE-fire-dataset"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={16} color="#FB923C" />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 700 }}>
                      {isUnetRunning ? 'Segmenting Hot Regions...' : 'Run Thermal Segmentation'}
                    </div>
                    <div style={{ fontSize: '9.5px', color: '#94A3B8', fontWeight: 400 }}>
                      U-Net Radiance Mask (≥ 80°C)
                    </div>
                  </div>
                </div>
                {unetResult && <span style={{ fontSize: '9px', background: '#10B981', color: '#fff', padding: '1px 6px', borderRadius: '10px', fontWeight: 700 }}>READY</span>}
              </button>

              {/* Action 2: Run Fire & Smoke Detection */}
              <button
                id="btn-run-fire-smoke-detect"
                type="button"
                onClick={handleRunFireSmokeDetection}
                disabled={isYoloRunning}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  backgroundColor: activeTab === 'yolo' && yoloResult ? 'rgba(239, 68, 68, 0.22)' : 'rgba(30, 41, 59, 0.85)',
                  border: '1px solid',
                  borderColor: activeTab === 'yolo' && yoloResult ? '#EF4444' : 'rgba(239, 68, 68, 0.45)',
                  borderRadius: '8px',
                  color: '#F8FAFC',
                  cursor: isYoloRunning ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: '12px',
                  transition: 'all 0.15s ease',
                  boxShadow: activeTab === 'yolo' && yoloResult ? '0 0 12px rgba(239, 68, 68, 0.2)' : 'none',
                }}
                title="Execute pretrained YOLOv8n model for fire and smoke bounding box detection"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Flame size={16} color="#F87171" />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 700 }}>
                      {isYoloRunning ? 'Detecting Fire & Smoke...' : 'Run Fire & Smoke Detection'}
                    </div>
                    <div style={{ fontSize: '9.5px', color: '#94A3B8', fontWeight: 400 }}>
                      YOLOv8n Pretrained Box Detector
                    </div>
                  </div>
                </div>
                {yoloResult && (
                  <span
                    style={{
                      fontSize: '9px',
                      background: yoloResult.detection_count > 0 ? '#EF4444' : '#64748B',
                      color: '#fff',
                      padding: '1px 6px',
                      borderRadius: '10px',
                      fontWeight: 700,
                    }}
                  >
                    {yoloResult.detection_count} BOXES
                  </span>
                )}
              </button>
            </div>

            {/* Model Architecture & Provenance Cards */}
            <div
              style={{
                backgroundColor: 'rgba(30, 41, 59, 0.45)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '11px',
                lineHeight: 1.45,
                color: '#94A3B8',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#E2E8F0', fontWeight: 700, marginBottom: '6px' }}>
                <Info size={13} color="#60A5FA" />
                <span>MODEL PROVENANCE & DISCLOSURES</span>
              </div>
              <div style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <strong style={{ color: '#F8FAFC' }}>U-Net Thermal Segmenter:</strong>
                <div>• Architecture: PyTorch U-Net (bilinear, 4.3M params)</div>
                <div>• Dataset: IGNITE-fire-dataset (Kyoma001, CC BY 4.0)</div>
                <div>• <span style={{ color: '#FCD34D', fontWeight: 600 }}>Baseline Disclosure:</span> Held-out Test Dice ~0.276 / IoU ~0.194. Experimental baseline, not production-ready.</div>
              </div>
              <div>
                <strong style={{ color: '#F8FAFC' }}>YOLOv8n Detector:</strong>
                <div>• Architecture: Ultralytics YOLOv8n (3.2M params)</div>
                <div>• Checkpoint: <span style={{ color: '#93C5FD' }}>rahabdev/fire-smoke-yolov8n</span> via Hugging Face (AGPL-3.0)</div>
                <div>• <span style={{ color: '#93C5FD', fontWeight: 600 }}>Notice:</span> Pretrained checkpoint externally trained — NOT trained by TerraShield.</div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Live Telemetry, Visualizations, Detections Table */}
          <div
            style={{
              padding: '16px 20px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              backgroundColor: '#0F172A',
            }}
          >
            {/* Tab Selector Navigation */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '10px' }}>
              <button
                type="button"
                onClick={() => setActiveTab('unet')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  backgroundColor: activeTab === 'unet' ? 'rgba(249, 115, 22, 0.18)' : 'rgba(30, 41, 59, 0.5)',
                  border: '1px solid',
                  borderColor: activeTab === 'unet' ? '#F97316' : 'rgba(255, 255, 255, 0.08)',
                  borderRadius: '6px',
                  color: activeTab === 'unet' ? '#FB923C' : '#94A3B8',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
              >
                <Layers size={14} />
                <span>U-Net Thermal Segmentation</span>
                {unetResult && <span style={{ fontSize: '9px', background: '#10B981', color: '#fff', padding: '1px 6px', borderRadius: '10px' }}>OK</span>}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('yolo')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  backgroundColor: activeTab === 'yolo' ? 'rgba(239, 68, 68, 0.18)' : 'rgba(30, 41, 59, 0.5)',
                  border: '1px solid',
                  borderColor: activeTab === 'yolo' ? '#EF4444' : 'rgba(255, 255, 255, 0.08)',
                  borderRadius: '6px',
                  color: activeTab === 'yolo' ? '#F87171' : '#94A3B8',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
              >
                <Flame size={14} />
                <span>YOLOv8n Fire & Smoke Detection</span>
                {yoloResult && (
                  <span
                    style={{
                      fontSize: '9px',
                      background: yoloResult.detection_count > 0 ? '#EF4444' : '#64748B',
                      color: '#fff',
                      padding: '1px 6px',
                      borderRadius: '10px',
                    }}
                  >
                    {yoloResult.detection_count}
                  </span>
                )}
              </button>
            </div>

            {/* TAB 1: U-NET SEGMENTATION RESULTS */}
            {activeTab === 'unet' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {isUnetRunning && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      padding: '40px',
                      backgroundColor: 'rgba(30, 41, 59, 0.4)',
                      borderRadius: '8px',
                      border: '1px dashed rgba(249, 115, 22, 0.5)',
                    }}
                  >
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        border: '3px solid rgba(249, 115, 22, 0.3)',
                        borderTopColor: '#F97316',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                      }}
                    />
                    <span style={{ fontSize: '13px', color: '#FB923C', fontWeight: 600 }}>
                      Executing U-Net forward pass & generating radiometric mask...
                    </span>
                  </div>
                )}

                {unetError && !isUnetRunning && (
                  <div
                    style={{
                      padding: '12px 14px',
                      backgroundColor: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      borderRadius: '8px',
                      color: '#FCA5A5',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                    }}
                  >
                    <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px', color: '#EF4444' }} />
                    <div>
                      <strong>Model Status:</strong> {unetResult?.model_status || 'Error'}
                      <div style={{ marginTop: '3px', color: '#FECACA' }}>{unetError}</div>
                    </div>
                  </div>
                )}

                {unetResult && !isUnetRunning && unetResult.status === 'inference_completed' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Telemetry Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                      <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.7)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600 }}>INFERENCE STATUS</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#10B981', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          <CheckCircle2 size={13} /> Completed
                        </div>
                      </div>
                      <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.7)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600 }}>LATENCY</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#60A5FA', fontFamily: 'monospace', marginTop: '2px' }}>
                          {unetResult.inference_latency_ms.toFixed(1)} ms
                        </div>
                      </div>
                      <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.7)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600 }}>HOT FRACTION</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#F59E0B', fontFamily: 'monospace', marginTop: '2px' }}>
                          {unetResult.hot_pixel_fraction !== undefined && unetResult.hot_pixel_fraction !== null
                            ? `${(unetResult.hot_pixel_fraction * 100).toFixed(2)}%`
                            : '0.00%'}
                        </div>
                      </div>
                      <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.7)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600 }}>HOT PIXELS (≥80°C)</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#F8FAFC', fontFamily: 'monospace', marginTop: '2px' }}>
                          {unetResult.hot_pixel_count?.toLocaleString() ?? 0} px
                        </div>
                      </div>
                    </div>

                    {/* High-Resolution Visualization View */}
                    {unetResult.mask_url && (
                      <div
                        style={{
                          backgroundColor: 'rgba(30, 41, 59, 0.55)',
                          borderRadius: '8px',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          padding: '12px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#E2E8F0' }}>
                            U-Net 3-Panel Segmentation Output (Input / Probability / Binary Mask)
                          </span>
                          <button
                            id="btn-expand-image-unet"
                            type="button"
                            onClick={() => setExpandedImage({
                              url: unetResult.mask_url!,
                              title: 'U-Net Thermal Segmentation (Input / Probability / Binary Mask)',
                              subtitle: `Threshold: ${(confidenceThreshold * 100).toFixed(0)}% | Hot Pixels: ${unetResult.hot_pixel_count?.toLocaleString()} px (${((unetResult.hot_pixel_fraction || 0) * 100).toFixed(2)}%)`,
                            })}
                            style={{
                              background: 'rgba(51, 65, 85, 0.6)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              color: '#60A5FA',
                              cursor: 'pointer',
                              fontSize: '11px',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 8px',
                              borderRadius: '4px',
                            }}
                          >
                            <Maximize2 size={11} /> Expand / Fullscreen
                          </button>
                        </div>
                        <div
                          style={{
                            borderRadius: '6px',
                            overflow: 'hidden',
                            cursor: 'pointer',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            backgroundColor: '#000',
                          }}
                          onClick={() => setExpandedImage({
                            url: unetResult.mask_url!,
                            title: 'U-Net Thermal Segmentation (Input / Probability / Binary Mask)',
                            subtitle: `Threshold: ${(confidenceThreshold * 100).toFixed(0)}% | Hot Pixels: ${unetResult.hot_pixel_count?.toLocaleString()} px (${((unetResult.hot_pixel_fraction || 0) * 100).toFixed(2)}%)`,
                          })}
                          title="Click to view full-resolution visualization in fullscreen"
                        >
                          <img
                            src={unetResult.mask_url}
                            alt="U-Net Thermal Mask Visualization"
                            style={{ width: '100%', display: 'block', maxHeight: '280px', objectFit: 'contain', backgroundColor: '#000' }}
                          />
                        </div>
                        <div style={{ fontSize: '10.5px', color: '#94A3B8', marginTop: '6px', textAlign: 'center' }}>
                          Left: Thermal Input Frame | Middle: Sigmoid Probability Map | Right: Binary Mask (threshold ≥ {unetResult.confidence_threshold})
                        </div>
                      </div>
                    )}

                    {/* Verbatim Disclaimer */}
                    <div style={{ fontSize: '10.5px', color: '#94A3B8', fontStyle: 'italic', lineHeight: 1.4, padding: '8px 10px', backgroundColor: 'rgba(30, 41, 59, 0.35)', borderRadius: '6px' }}>
                      {unetResult.disclaimer}
                    </div>
                  </div>
                )}

                {!unetResult && !isUnetRunning && !unetError && (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748B', fontSize: '12px' }}>
                    Click <strong>"Run Thermal Segmentation"</strong> to infer radiant thermal regions on the input test frame using the PyTorch U-Net checkpoint.
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: YOLOv8n FIRE & SMOKE RESULTS */}
            {activeTab === 'yolo' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {isYoloRunning && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      padding: '40px',
                      backgroundColor: 'rgba(30, 41, 59, 0.4)',
                      borderRadius: '8px',
                      border: '1px dashed rgba(239, 68, 68, 0.5)',
                    }}
                  >
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        border: '3px solid rgba(239, 68, 68, 0.3)',
                        borderTopColor: '#EF4444',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                      }}
                    />
                    <span style={{ fontSize: '13px', color: '#F87171', fontWeight: 600 }}>
                      Running YOLOv8n object detector & rendering bounding boxes...
                    </span>
                  </div>
                )}

                {yoloError && !isYoloRunning && (
                  <div
                    style={{
                      padding: '12px 14px',
                      backgroundColor: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      borderRadius: '8px',
                      color: '#FCA5A5',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                    }}
                  >
                    <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px', color: '#EF4444' }} />
                    <div>
                      <strong>Model Status:</strong> {yoloResult?.model_status || 'Error'}
                      <div style={{ marginTop: '3px', color: '#FECACA' }}>{yoloError}</div>
                    </div>
                  </div>
                )}

                {yoloResult && !isYoloRunning && yoloResult.status === 'inference_completed' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Telemetry Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                      <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.7)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600 }}>INFERENCE STATUS</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#10B981', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          <CheckCircle2 size={13} /> Completed
                        </div>
                      </div>
                      <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.7)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600 }}>LATENCY</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#60A5FA', fontFamily: 'monospace', marginTop: '2px' }}>
                          {yoloResult.inference_latency_ms.toFixed(1)} ms
                        </div>
                      </div>
                      <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.7)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600 }}>DETECTIONS FOUND</div>
                        <div
                          style={{
                            fontSize: '13px',
                            fontWeight: 700,
                            color: yoloResult.detection_count > 0 ? '#EF4444' : '#F59E0B',
                            fontFamily: 'monospace',
                            marginTop: '2px',
                          }}
                        >
                          {yoloResult.detection_count} bounding boxes
                        </div>
                      </div>
                    </div>

                    {/* Threshold 80% zero-detection notice if applicable */}
                    {yoloResult.detection_count === 0 && (
                      <div
                        style={{
                          padding: '10px 12px',
                          backgroundColor: 'rgba(245, 158, 11, 0.1)',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                          borderRadius: '6px',
                          fontSize: '11px',
                          color: '#FCD34D',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Info size={14} style={{ flexShrink: 0 }} />
                          <span>
                            <strong>0 detections at {(confidenceThreshold * 100).toFixed(0)}% threshold.</strong> Model predictions on this frame have a max confidence of ~72.7%.
                          </span>
                        </div>
                        {confidenceThreshold > 0.25 && (
                          <button
                            type="button"
                            onClick={() => {
                              setConfidenceThreshold(0.25);
                              setTimeout(() => handleRunFireSmokeDetection(), 50);
                            }}
                            style={{
                              background: '#F59E0B',
                              color: '#000',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '4px 8px',
                              fontSize: '10.5px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Set to 25% (Standard) & Re-run
                          </button>
                        )}
                      </div>
                    )}

                    {/* Dual-Layer Annotated Visualization with High-Contrast Vector Boxes */}
                    <div
                      style={{
                        backgroundColor: 'rgba(30, 41, 59, 0.55)',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        padding: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#E2E8F0' }}>
                            YOLOv8n Detections ({yoloResult.detection_count} bounding boxes)
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowBoxHud(!showBoxHud)}
                            style={{
                              background: showBoxHud ? 'rgba(239, 68, 68, 0.2)' : 'rgba(51, 65, 85, 0.5)',
                              border: '1px solid',
                              borderColor: showBoxHud ? '#EF4444' : 'rgba(255, 255, 255, 0.1)',
                              color: showBoxHud ? '#FCA5A5' : '#94A3B8',
                              fontSize: '10px',
                              fontWeight: 600,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                            title="Toggle High-Contrast Vector Box HUD"
                          >
                            <Eye size={10} />
                            <span>Vector HUD: {showBoxHud ? 'ON' : 'OFF'}</span>
                          </button>
                        </div>

                        <button
                          id="btn-expand-image-yolo"
                          type="button"
                          onClick={() => setExpandedImage({
                            url: yoloResult.annotated_image_url || '/thermal_sample_lwir.jpg',
                            title: 'YOLOv8n Fire & Smoke Bounding Box Annotations',
                            subtitle: `Detected: ${yoloResult.detection_count} objects | Threshold: ${(confidenceThreshold * 100).toFixed(0)}%`,
                            detections: yoloResult.detections,
                            imageDims: yoloImageDims,
                          })}
                          style={{
                            background: 'rgba(51, 65, 85, 0.6)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            color: '#60A5FA',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            borderRadius: '4px',
                          }}
                        >
                          <Maximize2 size={11} /> Expand / Fullscreen
                        </button>
                      </div>

                      {/* Image + SVG Overlay Container */}
                      <div
                        style={{
                          borderRadius: '6px',
                          overflow: 'hidden',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          backgroundColor: '#000',
                          position: 'relative',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          minHeight: '200px',
                        }}
                      >
                        {yoloImageLoading && (
                          <div
                            style={{
                              position: 'absolute',
                              inset: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: 'rgba(0,0,0,0.6)',
                              zIndex: 10,
                            }}
                          >
                            <RefreshCw size={20} color="#F97316" className="animate-spin" />
                          </div>
                        )}

                        {yoloImageError && (
                          <div style={{ color: '#F87171', fontSize: '11px', padding: '20px', textAlign: 'center' }}>
                            {yoloImageError}
                          </div>
                        )}

                        {/* Interactive Image with Overlay */}
                        <div
                          style={{
                            position: 'relative',
                            display: 'inline-block',
                            maxWidth: '100%',
                            lineHeight: 0,
                          }}
                        >
                          <img
                            key={`yolo-img-${yoloRunCount}`}
                            src={yoloResult.annotated_image_url || '/thermal_sample_lwir.jpg'}
                            alt="YOLO Detection Annotated Image"
                            onLoad={(e) => {
                              const img = e.currentTarget;
                              if (img.naturalWidth && img.naturalHeight) {
                                setYoloImageDims({ width: img.naturalWidth, height: img.naturalHeight });
                              }
                              setYoloImageLoading(false);
                            }}
                            onError={() => {
                              setYoloImageLoading(false);
                              setYoloImageError('Failed to load annotated image visualization.');
                            }}
                            style={{
                              display: 'block',
                              maxWidth: '100%',
                              maxHeight: '320px',
                              width: 'auto',
                              height: 'auto',
                              objectFit: 'contain',
                            }}
                          />

                          {/* High-Contrast Vector SVG Bounding Boxes Overlay */}
                          {showBoxHud && yoloResult.detections.length > 0 && (
                            <svg
                              viewBox={`0 0 ${yoloImageDims.width} ${yoloImageDims.height}`}
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                pointerEvents: 'none',
                              }}
                            >
                              <defs>
                                <filter id="fire-glow" x="-20%" y="-20%" width="140%" height="140%">
                                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#EF4444" floodOpacity="0.8" />
                                </filter>
                                <filter id="smoke-glow" x="-20%" y="-20%" width="140%" height="140%">
                                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#38BDF8" floodOpacity="0.8" />
                                </filter>
                              </defs>

                              {yoloResult.detections.map((det, idx) => {
                                const [rawX1, rawY1, rawX2, rawY2] = det.box;
                                const x1 = Math.min(rawX1, rawX2);
                                const y1 = Math.min(rawY1, rawY2);
                                const w = Math.max(1, Math.abs(rawX2 - rawX1));
                                const h = Math.max(1, Math.abs(rawY2 - rawY1));

                                const isFire = det.label.toLowerCase() === 'fire';
                                const color = isFire ? '#EF4444' : '#38BDF8';
                                const glowFilter = isFire ? 'url(#fire-glow)' : 'url(#smoke-glow)';
                                const isHovered = hoveredDetIdx === idx;

                                const labelText = `${det.label.toUpperCase()} ${(det.confidence * 100).toFixed(1)}%`;
                                const tagWidth = Math.max(80, labelText.length * 9.5);
                                const tagY = y1 >= 22 ? y1 - 22 : y1 + 4;

                                return (
                                  <g key={`box-${idx}`} style={{ transition: 'all 0.15s ease' }}>
                                    {/* Bounding Rectangle */}
                                    <rect
                                      x={x1}
                                      y={y1}
                                      width={w}
                                      height={h}
                                      fill={isHovered ? (isFire ? 'rgba(239, 68, 68, 0.35)' : 'rgba(56, 189, 248, 0.35)') : (isFire ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.15)')}
                                      stroke={color}
                                      strokeWidth={isHovered ? 5 : 3.5}
                                      filter={glowFilter}
                                    />

                                    {/* Corner Accents */}
                                    <line x1={x1} y1={y1} x2={x1 + 12} y2={y1} stroke="#FFFFFF" strokeWidth={isHovered ? 5 : 3.5} />
                                    <line x1={x1} y1={y1} x2={x1} y2={y1 + 12} stroke="#FFFFFF" strokeWidth={isHovered ? 5 : 3.5} />
                                    <line x1={x1 + w} y1={y1 + h} x2={x1 + w - 12} y2={y1 + h} stroke="#FFFFFF" strokeWidth={isHovered ? 5 : 3.5} />
                                    <line x1={x1 + w} y1={y1 + h} x2={x1 + w} y2={y1 + h - 12} stroke="#FFFFFF" strokeWidth={isHovered ? 5 : 3.5} />

                                    {/* Label Pill */}
                                    <rect
                                      x={x1}
                                      y={tagY}
                                      width={tagWidth}
                                      height={20}
                                      fill={color}
                                      rx={4}
                                      filter={glowFilter}
                                    />
                                    <text
                                      x={x1 + 6}
                                      y={tagY + 14}
                                      fill="#FFFFFF"
                                      fontSize="11.5"
                                      fontWeight="bold"
                                      fontFamily="monospace"
                                    >
                                      {labelText}
                                    </text>
                                  </g>
                                );
                              })}
                            </svg>
                          )}
                        </div>
                      </div>

                      <div style={{ fontSize: '10.5px', color: '#94A3B8', marginTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>
                          {yoloResult.detection_count > 0
                            ? `Showing ${yoloResult.detection_count} bounding boxes (hover row below to highlight).`
                            : '0 bounding boxes above threshold.'}
                        </span>
                        <span style={{ color: '#F87171' }}>● Fire (Red)</span>
                        <span style={{ color: '#38BDF8' }}>● Smoke (Cyan)</span>
                      </div>
                    </div>

                    {/* Detections Breakdown Table */}
                    <div
                      style={{
                        backgroundColor: 'rgba(30, 41, 59, 0.55)',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        padding: '12px',
                      }}
                    >
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#E2E8F0', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Detected Objects ({yoloResult.detections.length}):</span>
                        <span style={{ color: '#94A3B8', fontSize: '10px' }}>Hover to highlight box on frame</span>
                      </div>
                      {yoloResult.detections.length === 0 ? (
                        <div style={{ fontSize: '11px', color: '#94A3B8', fontStyle: 'italic', padding: '6px 0' }}>
                          No objects met the current {(confidenceThreshold * 100).toFixed(0)}% confidence threshold.
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
                          {yoloResult.detections.map((det, idx) => {
                            const isFire = det.label.toLowerCase() === 'fire';
                            const isHovered = hoveredDetIdx === idx;
                            return (
                              <div
                                key={idx}
                                onMouseEnter={() => setHoveredDetIdx(idx)}
                                onMouseLeave={() => setHoveredDetIdx(null)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '6px 10px',
                                  backgroundColor: isHovered
                                    ? (isFire ? 'rgba(239, 68, 68, 0.25)' : 'rgba(56, 189, 248, 0.25)')
                                    : 'rgba(15, 23, 42, 0.75)',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  border: '1px solid',
                                  borderColor: isHovered
                                    ? (isFire ? '#EF4444' : '#38BDF8')
                                    : 'rgba(255, 255, 255, 0.05)',
                                  cursor: 'pointer',
                                  transition: 'all 0.1s ease',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span
                                    style={{
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      fontWeight: 700,
                                      fontSize: '10px',
                                      backgroundColor: isFire ? 'rgba(239, 68, 68, 0.25)' : 'rgba(56, 189, 248, 0.25)',
                                      color: isFire ? '#F87171' : '#38BDF8',
                                      border: `1px solid ${isFire ? 'rgba(239, 68, 68, 0.5)' : 'rgba(56, 189, 248, 0.5)'}`,
                                    }}
                                  >
                                    {det.label.toUpperCase()}
                                  </span>
                                  <span style={{ color: '#F8FAFC', fontWeight: 700 }}>
                                    {(det.confidence * 100).toFixed(1)}%
                                  </span>
                                </div>
                                <div style={{ color: '#94A3B8', fontFamily: 'monospace', fontSize: '10px' }}>
                                  [{det.box.map((v) => Math.round(v)).join(', ')}]
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Verbatim Disclaimer */}
                    <div style={{ fontSize: '10.5px', color: '#94A3B8', fontStyle: 'italic', lineHeight: 1.4, padding: '8px 10px', backgroundColor: 'rgba(30, 41, 59, 0.35)', borderRadius: '6px' }}>
                      {yoloResult.disclaimer}
                    </div>
                  </div>
                )}

                {!yoloResult && !isYoloRunning && !yoloError && (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748B', fontSize: '12px' }}>
                    Click <strong>"Run Fire & Smoke Detection"</strong> to identify active flames and smoke bounding boxes on the test frame.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 4. Glitch-Free Image Lightbox / Fullscreen Modal (Portaled) */}
        {expandedImage &&
          createPortal(
            <div
              className="ml-expanded-image-backdrop"
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                backgroundColor: 'rgba(0, 0, 0, 0.94)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                zIndex: 99999,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px',
                animation: 'fadeIn 0.15s ease-out',
              }}
              onClick={() => setExpandedImage(null)}
            >
              <div
                style={{
                  position: 'relative',
                  maxWidth: '92vw',
                  maxHeight: '92vh',
                  backgroundColor: '#0F172A',
                  border: '1px solid rgba(249, 115, 22, 0.5)',
                  borderRadius: '10px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: '0 25px 70px rgba(0, 0, 0, 0.95)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header in Lightbox */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#F8FAFC' }}>
                      {expandedImage.title}
                    </div>
                    {expandedImage.subtitle && (
                      <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                        {expandedImage.subtitle}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <a
                      href={expandedImage.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      style={{
                        background: 'rgba(51, 65, 85, 0.6)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: '#CBD5E1',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        textDecoration: 'none',
                        fontSize: '11px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                      title="Open full resolution in new tab"
                    >
                      <Download size={13} /> Open Raw
                    </a>
                    <button
                      id="btn-close-expanded-image"
                      type="button"
                      onClick={() => setExpandedImage(null)}
                      style={{
                        background: 'rgba(239, 68, 68, 0.2)',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        color: '#F87171',
                        cursor: 'pointer',
                        padding: '6px',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title="Close Preview (Esc)"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* High Resolution Image View with Vector Boxes in Fullscreen */}
                <div
                  style={{
                    backgroundColor: '#000',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    maxWidth: '88vw',
                    maxHeight: '78vh',
                    position: 'relative',
                  }}
                >
                  <div style={{ position: 'relative', display: 'inline-block', lineHeight: 0 }}>
                    <img
                      src={expandedImage.url}
                      alt={expandedImage.title}
                      style={{
                        maxWidth: '86vw',
                        maxHeight: '76vh',
                        width: 'auto',
                        height: 'auto',
                        objectFit: 'contain',
                        display: 'block',
                      }}
                    />

                    {/* Vector Overlay in Fullscreen */}
                    {expandedImage.detections && expandedImage.detections.length > 0 && (
                      <svg
                        viewBox={`0 0 ${expandedImage.imageDims?.width || 1200} ${expandedImage.imageDims?.height || 896}`}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          pointerEvents: 'none',
                        }}
                      >
                        {expandedImage.detections.map((det, idx) => {
                          const [rawX1, rawY1, rawX2, rawY2] = det.box;
                          const x1 = Math.min(rawX1, rawX2);
                          const y1 = Math.min(rawY1, rawY2);
                          const w = Math.max(1, Math.abs(rawX2 - rawX1));
                          const h = Math.max(1, Math.abs(rawY2 - rawY1));
                          const isFire = det.label.toLowerCase() === 'fire';
                          const color = isFire ? '#EF4444' : '#38BDF8';
                          const labelText = `${det.label.toUpperCase()} ${(det.confidence * 100).toFixed(1)}%`;
                          const tagWidth = Math.max(80, labelText.length * 9.5);
                          const tagY = y1 >= 22 ? y1 - 22 : y1 + 4;

                          return (
                            <g key={`fs-box-${idx}`}>
                              <rect
                                x={x1}
                                y={y1}
                                width={w}
                                height={h}
                                fill={isFire ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.15)'}
                                stroke={color}
                                strokeWidth={3.5}
                              />
                              <rect
                                x={x1}
                                y={tagY}
                                width={tagWidth}
                                height={20}
                                fill={color}
                                rx={4}
                              />
                              <text
                                x={x1 + 6}
                                y={tagY + 14}
                                fill="#FFFFFF"
                                fontSize="11.5"
                                fontWeight="bold"
                                fontFamily="monospace"
                              >
                                {labelText}
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                    )}
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )}
      </div>
    </div>
  );

  return createPortal(panelContent, document.body);
};
