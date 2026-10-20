import React, { useState } from 'react';
import { Search, ExternalLink, Filter, ShieldCheck, FileText, ChevronLeft } from 'lucide-react';
import type { EvidenceRecord } from '../types';
import { TinyFishExtractModal } from './TinyFishExtractModal';

interface EvidenceExplorerProps {
  evidenceList: EvidenceRecord[];
  onBack?: () => void;
}

export const EvidenceExplorer: React.FC<EvidenceExplorerProps> = ({ evidenceList, onBack }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceRecord | null>(null);

  const filteredEvidence = evidenceList.filter((ev) => {
    if (typeFilter !== 'ALL' && ev.source_type !== typeFilter) {
      return false;
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchTitle = ev.title.toLowerCase().includes(q);
      const matchSnippet = ev.snippet.toLowerCase().includes(q);
      const matchSource = ev.source_name.toLowerCase().includes(q);
      const matchLoc = ev.extracted_location?.toLowerCase().includes(q);
      if (!matchTitle && !matchSnippet && !matchSource && !matchLoc) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="data-table-container">
      {/* View Header */}
      <div className="view-section-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {onBack && (
            <button className="btn-tool" onClick={onBack} title="Back to Map View" id="evidence-back-btn">
              <ChevronLeft size={13} />
              <span>Map</span>
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <FileText size={14} color="var(--color-info)" />
            <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>Public Evidence &amp; Advisories</span>
          </div>
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
            {evidenceList.length} records
          </span>
        </div>
      </div>
      {/* Controls Bar */}
      <div className="data-table-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Search
              size={12}
              style={{
                position: 'absolute',
                left: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-tertiary)',
              }}
            />
            <input
              type="text"
              className="input-search-compact"
              placeholder="Search evidence by title, keyword, or source..."
              style={{ minWidth: '280px' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Filter size={12} color="var(--text-tertiary)" />
            <select
              className="select-filter-compact"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="ALL">All Source Types</option>
              <option value="OFFICIAL_AGENCY">Official Agencies</option>
              <option value="EMERGENCY_DISPATCH">Emergency Dispatch</option>
              <option value="NEWS_MEDIA">News Media</option>
              <option value="UNVERIFIED">Unverified / Other</option>
            </select>
          </div>
        </div>

        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
          Showing <strong>{filteredEvidence.length}</strong> of {evidenceList.length} sources
        </div>
      </div>

      {/* Table Content */}
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '18%' }}>Source &amp; Authority</th>
              <th style={{ width: '32%' }}>Title &amp; Evidence Finding</th>
              <th style={{ width: '18%' }}>Location &amp; Observation Date</th>
              <th style={{ width: '20%' }}>Relevance &amp; Provenance</th>
              <th style={{ width: '12%', textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredEvidence.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-tertiary)' }}>
                  No evidence records match the current filters.
                </td>
              </tr>
            ) : (
              filteredEvidence.map((ev) => {
                const relLabel = ev.relevance_label || (ev.relevance_score >= 0.75 ? 'Relevant' : ev.relevance_score >= 0.45 ? 'Partial match' : 'Needs review');
                const relColor = relLabel === 'Relevant' ? 'var(--color-verified)' : relLabel === 'Partial match' ? 'var(--accent-amber)' : 'var(--text-tertiary)';
                const relBg = relLabel === 'Relevant' ? 'rgba(16, 185, 129, 0.12)' : relLabel === 'Partial match' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(148, 163, 184, 0.12)';
                const relBorder = relLabel === 'Relevant' ? 'rgba(16, 185, 129, 0.3)' : relLabel === 'Partial match' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(148, 163, 184, 0.2)';

                const provLabel = ev.provenance_origin === 'CURRENT_SESSION' ? 'Live Retrieval' : ev.provenance_origin === 'SAVED_EVIDENCE' ? 'Saved Evidence' : 'Historical Demo Archive';
                const provColor = ev.provenance_origin === 'CURRENT_SESSION' ? '#38bdf8' : ev.provenance_origin === 'SAVED_EVIDENCE' ? '#c084fc' : '#94a3b8';
                const provBg = ev.provenance_origin === 'CURRENT_SESSION' ? 'rgba(56, 189, 248, 0.1)' : ev.provenance_origin === 'SAVED_EVIDENCE' ? 'rgba(192, 132, 252, 0.1)' : 'rgba(148, 163, 184, 0.08)';

                return (
                  <tr key={ev.id}>
                    {/* Source & Authority */}
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                        {ev.source_name}
                      </div>
                      <span className={`source-badge ${ev.source_type}`}>
                        {ev.is_official ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <ShieldCheck size={10} /> Official Agency
                          </span>
                        ) : (
                          ev.source_type.replace('_', ' ')
                        )}
                      </span>
                      {ev.domain && (
                        <div style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', marginTop: '0.25rem', fontFamily: 'var(--font-mono)' }}>
                          {ev.domain}
                        </div>
                      )}
                    </td>

                    {/* Title & Evidence Finding */}
                    <td>
                      <div style={{ fontWeight: 600, color: '#38BDF8', marginBottom: '0.25rem', fontSize: '0.8125rem' }}>
                        {ev.title}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.45, marginBottom: '0.35rem' }}>
                        {ev.finding || ev.snippet}
                      </div>
                      <div>
                        <button
                          onClick={() => setSelectedEvidence(ev)}
                          style={{
                            background: 'rgba(56, 189, 248, 0.08)',
                            border: '1px solid rgba(56, 189, 248, 0.25)',
                            borderRadius: '4px',
                            color: '#38bdf8',
                            fontSize: '0.7rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            padding: '0.2rem 0.5rem',
                          }}
                        >
                          <FileText size={11} />
                          <span>View TinyFish Page Extract</span>
                        </button>
                      </div>
                    </td>

                    {/* Location & Dates */}
                    <td>
                      <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                        {ev.extracted_location || 'Coordinates-matched region'}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', marginTop: '0.25rem', fontFamily: 'var(--font-mono)' }}>
                        Published: {ev.publication_date ? new Date(ev.publication_date).toLocaleDateString() : 'Historical Period'}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--text-disabled)', fontFamily: 'var(--font-mono)' }}>
                        Retrieved: {new Date(ev.fetched_at).toLocaleDateString()}
                      </div>
                    </td>

                    {/* Relevance & Provenance */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                        {/* Qualitative Relevance Label backed by criteria */}
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            background: relBg,
                            color: relColor,
                            border: `1px solid ${relBorder}`,
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {relLabel}
                        </span>

                        {/* Provenance Origin Badge */}
                        <span
                          style={{
                            fontSize: '0.66rem',
                            fontWeight: 600,
                            padding: '0.15rem 0.4rem',
                            borderRadius: '4px',
                            background: provBg,
                            color: provColor,
                            border: `1px solid ${provColor}40`,
                          }}
                        >
                          {provLabel}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.725rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        {ev.supports_aspect || ev.relevance_explanation}
                      </div>
                    </td>

                    {/* Action Link */}
                    <td style={{ textAlign: 'right' }}>
                      <a
                        href={ev.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary"
                        style={{
                          padding: '0.25rem 0.55rem',
                          fontSize: '0.725rem',
                          textDecoration: 'none',
                        }}
                        title="Open original public source website"
                      >
                        <span>Visit</span>
                        <ExternalLink size={11} />
                      </a>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* TinyFish Extract Modal */}
      <TinyFishExtractModal
        isOpen={!!selectedEvidence}
        evidence={selectedEvidence}
        onClose={() => setSelectedEvidence(null)}
      />
    </div>
  );
};
