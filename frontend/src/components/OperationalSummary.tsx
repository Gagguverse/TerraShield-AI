import React from 'react';
import {
  Satellite,
  Flame,
  FileCheck,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';
import type { AnalyticsSummary } from '../types';

interface OperationalSummaryProps {
  analytics: AnalyticsSummary | null;
  totalDetectionsCount: number;
  totalIncidentsCount: number;
  onFilterByStatus?: (status: string) => void;
}

export const OperationalSummary: React.FC<OperationalSummaryProps> = ({
  analytics,
  totalDetectionsCount,
  totalIncidentsCount,
  onFilterByStatus,
}) => {
  return (
    <div className="operational-metrics-bar" aria-label="Operational Intelligence Metrics">
      {/* 1. Raw Satellite Hotspots */}
      <div className="metric-cell">
        <div className="metric-header">
          <span className="metric-label">Satellite Hotspots</span>
          <Satellite size={13} color="var(--accent-orange)" />
        </div>
        <div className="metric-value-row">
          <span className="metric-value" style={{ color: 'var(--accent-orange)' }}>
            {totalDetectionsCount.toLocaleString()}
          </span>
          <span className="metric-caption">detections</span>
        </div>
      </div>

      {/* 2. Grouped Incident Clusters */}
      <div className="metric-cell">
        <div className="metric-header">
          <span className="metric-label">Clustered Incidents</span>
          <Flame size={13} color="var(--accent-amber)" />
        </div>
        <div className="metric-value-row">
          <span className="metric-value">
            {totalIncidentsCount.toLocaleString()}
          </span>
          <span className="metric-caption">clusters</span>
        </div>
      </div>

      {/* 3. Corroborated Fires */}
      <div
        className="metric-cell"
        style={{ cursor: onFilterByStatus ? 'pointer' : 'default' }}
        onClick={() => onFilterByStatus && onFilterByStatus('CORROBORATED')}
        title="View Corroborated Incidents"
      >
        <div className="metric-header">
          <span className="metric-label">Corroborated</span>
          <ShieldCheck size={13} color="var(--color-verified)" />
        </div>
        <div className="metric-value-row">
          <span className="metric-value" style={{ color: 'var(--color-verified)' }}>
            {analytics ? analytics.corroborated_count : 0}
          </span>
          <span className="metric-caption">multi-source</span>
        </div>
      </div>

      {/* 4. Cases Needing Review */}
      <div
        className="metric-cell"
        style={{ cursor: onFilterByStatus ? 'pointer' : 'default' }}
        onClick={() => onFilterByStatus && onFilterByStatus('NEEDS_REVIEW')}
        title="View Incidents Needing Human Review"
      >
        <div className="metric-header">
          <span className="metric-label">Needs Review</span>
          <AlertTriangle size={13} color="var(--color-review)" />
        </div>
        <div className="metric-value-row">
          <span className="metric-value" style={{ color: 'var(--color-review)' }}>
            {analytics ? analytics.needs_review_count : 0}
          </span>
          <span className="metric-caption">partial evidence</span>
        </div>
      </div>

      {/* 5. Public Evidence Retrieved */}
      <div className="metric-cell">
        <div className="metric-header">
          <span className="metric-label">Evidence Retrieved</span>
          <FileCheck size={13} color="var(--color-info)" />
        </div>
        <div className="metric-value-row">
          <span className="metric-value" style={{ color: 'var(--color-info)' }}>
            {analytics ? analytics.total_evidence.toLocaleString() : 0}
          </span>
          <span className="metric-caption">advisories / news</span>
        </div>
      </div>
    </div>
  );
};
