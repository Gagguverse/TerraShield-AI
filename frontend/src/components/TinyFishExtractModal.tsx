import React, { useEffect, useRef } from 'react';
import { X, ExternalLink, FileText, ShieldCheck, AlertTriangle, Copy, Check, Calendar, Clock, Globe } from 'lucide-react';
import type { EvidenceRecord } from '../types';

interface TinyFishExtractModalProps {
  isOpen: boolean;
  evidence: EvidenceRecord | null;
  onClose: () => void;
}

export const TinyFishExtractModal: React.FC<TinyFishExtractModalProps> = ({
  isOpen,
  evidence,
  onClose,
}) => {
  const [copied, setCopied] = React.useState(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

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
    setTimeout(() => closeBtnRef.current?.focus(), 50);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !evidence) return null;

  const handleCopy = () => {
    const textToCopy = evidence.full_text || evidence.snippet || '';
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const relevanceLabel = evidence.relevance_label || (
    evidence.relevance_score >= 0.7 ? 'Relevant' : evidence.relevance_score >= 0.4 ? 'Partial match' : 'Needs review'
  );

  const relevanceColor = relevanceLabel === 'Relevant'
    ? '#10b981'
    : relevanceLabel === 'Partial match'
    ? '#f59e0b'
    : '#94a3b8';

  const relevanceBg = relevanceLabel === 'Relevant'
    ? 'rgba(16, 185, 129, 0.12)'
    : relevanceLabel === 'Partial match'
    ? 'rgba(245, 158, 11, 0.12)'
    : 'rgba(148, 163, 184, 0.12)';

  const provenanceLabel = evidence.provenance_origin === 'CURRENT_SESSION'
    ? 'Current Session Retrieval'
    : evidence.provenance_origin === 'HISTORICAL_ARCHIVE'
    ? 'Historical Disaster Archive'
    : 'Previously Saved Evidence';

  return (
    <div
      className="extract-modal-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1400,
        backgroundColor: 'rgba(4, 7, 14, 0.85)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
        animation: 'extractModalFade 0.18s ease-out',
      }}
      role="presentation"
    >
      <div
        className="extract-modal-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="extract-modal-title"
        style={{
          width: '100%',
          maxWidth: '780px',
          maxHeight: '88vh',
          backgroundColor: '#0c1017',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '14px',
          boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            padding: '1.1rem 1.4rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0) 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileText size={17} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }} id="extract-modal-title">
                  TinyFish Page Extract
                </span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                    background: relevanceBg,
                    color: relevanceColor,
                    border: `1px solid ${relevanceColor}44`,
                  }}
                >
                  {relevanceLabel.toUpperCase()}
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '0.15rem' }}>
                {provenanceLabel} • Source ID: <code>{evidence.id}</code>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginRight: '0.25rem' }}>
              ESC to close
            </span>
            <button
              ref={closeBtnRef}
              onClick={onClose}
              id="extract-modal-close-btn"
              title="Close extract (Esc)"
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
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div
          style={{
            padding: '1.3rem 1.4rem',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          {/* Source Overview Card */}
          <div
            style={{
              padding: '1rem',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: '10px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.45rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.45rem',
                    borderRadius: '4px',
                    background: evidence.is_official ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                    color: evidence.is_official ? 'var(--color-verified)' : 'var(--text-secondary)',
                    border: `1px solid ${evidence.is_official ? 'rgba(16, 185, 129, 0.3)' : 'rgba(148, 163, 184, 0.25)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  {evidence.is_official && <ShieldCheck size={11} />}
                  <span>{evidence.is_official ? 'OFFICIAL AGENCY' : 'VERIFIED JOURNALISM'}</span>
                </span>
                <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{evidence.source_name}</strong>
              </div>

              {evidence.url && (
                <a
                  href={evidence.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-tool"
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', color: 'var(--color-info)' }}
                >
                  <span>Open Original Source</span>
                  <ExternalLink size={11} />
                </a>
              )}
            </div>

            <h3 style={{ margin: '0.35rem 0 0.5rem 0', fontSize: '0.98rem', color: '#38bdf8', fontWeight: 600 }}>
              {evidence.title}
            </h3>

            {/* Structured Timestamps clearly distinguished */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '0.5rem',
                marginTop: '0.65rem',
                paddingTop: '0.65rem',
                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                fontSize: '0.74rem',
                color: 'var(--text-tertiary)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Calendar size={13} style={{ color: 'var(--accent-amber)' }} />
                <span>
                  <strong>Source Publication: </strong>
                  {evidence.publication_date ? new Date(evidence.publication_date).toLocaleDateString() : 'Historical archive'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Clock size={13} style={{ color: 'var(--color-info)' }} />
                <span>
                  <strong>Retrieved at: </strong>
                  {evidence.fetched_at ? new Date(evidence.fetched_at).toLocaleString() : 'N/A'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Globe size={13} style={{ color: 'var(--text-secondary)' }} />
                <span>
                  <strong>Domain: </strong>
                  <code>{evidence.domain || 'web source'}</code>
                </span>
              </div>
            </div>
          </div>

          {/* Finding & What this supports */}
          <div
            style={{
              padding: '0.85rem 1rem',
              background: 'rgba(249, 115, 22, 0.06)',
              borderLeft: '3px solid var(--accent-orange)',
              borderRadius: '6px',
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
              lineHeight: '1.55',
            }}
          >
            <div style={{ marginBottom: '0.35rem' }}>
              <strong style={{ color: 'var(--text-primary)' }}>Concise Grounded Finding: </strong>
              {evidence.finding || evidence.snippet}
            </div>
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>Specific Aspect Supported: </strong>
              <span style={{ color: 'var(--accent-orange)' }}>
                {evidence.supports_aspect || 'General incident chronology & situational context'}
              </span>
            </div>
            {evidence.relevance_explanation && (
              <div style={{ marginTop: '0.35rem', fontSize: '0.76rem', color: 'var(--text-tertiary)' }}>
                <strong>Relevance Criteria: </strong>{evidence.relevance_explanation}
              </div>
            )}
          </div>

          {/* Full Extracted Markdown Text Container */}
          <div
            style={{
              background: '#070a10',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <FileText size={14} style={{ color: 'var(--color-info)' }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {evidence.full_text ? 'Full Extracted Text (Markdown/HTML Parsed)' : 'Search Excerpt'}
                </span>
              </div>

              {evidence.full_text && (
                <button
                  className="btn-tool"
                  onClick={handleCopy}
                  style={{ fontSize: '0.72rem', padding: '0.25rem 0.55rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  {copied ? <Check size={11} color="var(--color-verified)" /> : <Copy size={11} />}
                  <span>{copied ? 'Copied' : 'Copy Text'}</span>
                </button>
              )}
            </div>

            {evidence.full_text ? (
              <div
                style={{
                  maxHeight: '340px',
                  overflowY: 'auto',
                  fontSize: '0.78rem',
                  lineHeight: '1.65',
                  color: 'var(--text-secondary)',
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'var(--font-mono)',
                  background: 'rgba(0, 0, 0, 0.4)',
                  padding: '0.85rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.04)',
                }}
              >
                {evidence.full_text}
              </div>
            ) : evidence.fetch_error ? (
              <div
                style={{
                  padding: '1rem',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  lineHeight: '1.6',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-danger)', fontWeight: 600, marginBottom: '0.35rem' }}>
                  <AlertTriangle size={15} />
                  <span>Page Extract Unavailable from Provider</span>
                </div>
                <div><strong>Failure reason: </strong><code>{evidence.fetch_error}</code></div>
                <div style={{ marginTop: '0.45rem', fontSize: '0.74rem', color: 'var(--text-tertiary)' }}>
                  The source headline and search snippet were successfully discovered, but full markdown extraction was blocked by origin paywall, connection timeout, or robots restriction. TerraShield AI preserves the authentic failure reason rather than fabricating fake excerpts.
                </div>
              </div>
            ) : (
              <div
                style={{
                  padding: '0.85rem',
                  background: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  lineHeight: '1.6',
                  color: 'var(--text-secondary)',
                  fontStyle: 'italic',
                }}
              >
                "{evidence.snippet}"
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
