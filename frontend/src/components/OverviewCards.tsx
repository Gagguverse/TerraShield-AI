import React from 'react';
import {
  Flame,
  FileText,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Activity,
} from 'lucide-react';
import type { AnalyticsSummary } from '../types';

interface OverviewCardsProps {
  analytics?: AnalyticsSummary | null;
  totalDetections: number;
}

export const OverviewCards: React.FC<OverviewCardsProps> = ({
  analytics,
  totalDetections,
}) => {
  return (
    <div className="kpi-grid">
      <div className="kpi-card">
        <div>
          <div className="kpi-label">Satellite Hotspots</div>
          <div className="kpi-value">{totalDetections.toLocaleString()}</div>
        </div>
        <div className="kpi-icon">
          <Flame size={20} color="#f97316" />
        </div>
      </div>

      <div className="kpi-card">
        <div>
          <div className="kpi-label">Evidence Reports</div>
          <div className="kpi-value">
            {analytics ? analytics.total_evidence.toLocaleString() : '0'}
          </div>
        </div>
        <div className="kpi-icon">
          <FileText size={20} color="#38bdf8" />
        </div>
      </div>

      <div className="kpi-card corroborated">
        <div>
          <div className="kpi-label">Corroborated Incidents</div>
          <div className="kpi-value" style={{ color: '#10b981' }}>
            {analytics ? analytics.corroborated_count : '0'}
          </div>
        </div>
        <div className="kpi-icon">
          <CheckCircle2 size={20} />
        </div>
      </div>

      <div className="kpi-card review">
        <div>
          <div className="kpi-label">Needs Human Review</div>
          <div className="kpi-value" style={{ color: '#f59e0b' }}>
            {analytics ? analytics.needs_review_count : '0'}
          </div>
        </div>
        <div className="kpi-icon">
          <AlertCircle size={20} />
        </div>
      </div>

      <div className="kpi-card insufficient">
        <div>
          <div className="kpi-label">Insufficient Evidence</div>
          <div className="kpi-value" style={{ color: '#94a3b8' }}>
            {analytics ? analytics.insufficient_evidence_count : '0'}
          </div>
        </div>
        <div className="kpi-icon">
          <HelpCircle size={20} />
        </div>
      </div>

      <div className="kpi-card">
        <div>
          <div className="kpi-label">Mean Uncertainty</div>
          <div className="kpi-value" style={{ color: '#a78bfa' }}>
            {analytics ? `${Math.round(analytics.average_uncertainty * 100)}%` : '0%'}
          </div>
        </div>
        <div className="kpi-icon">
          <Activity size={20} color="#a78bfa" />
        </div>
      </div>
    </div>
  );
};
