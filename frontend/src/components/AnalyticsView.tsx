import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import type { AnalyticsSummary } from '../types';
import { Database, ShieldCheck, Flame, PieChart as PieIcon, ChevronLeft, BarChart2 } from 'lucide-react';

interface AnalyticsViewProps {
  analytics: AnalyticsSummary | null;
  onBack?: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  CORROBORATED: '#10B981',
  NEEDS_REVIEW: '#F59E0B',
  INSUFFICIENT_EVIDENCE: '#67727E',
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: '#EF4444',
  nominal: '#F97316',
  low: '#67727E',
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-muted)',
          padding: '0.45rem 0.65rem',
          borderRadius: 'var(--radius-xs)',
          fontSize: '0.725rem',
          boxShadow: 'var(--shadow-panel)',
        }}
      >
        <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{label || payload[0].name}</div>
        <div style={{ color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>
          {payload[0].value.toLocaleString()} records
        </div>
      </div>
    );
  }
  return null;
};

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ analytics, onBack }) => {
  if (!analytics) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {onBack && (
          <div className="view-section-header">
            <button className="btn-tool" onClick={onBack} title="Back to Map" id="analytics-back-btn">
              <ChevronLeft size={13} />
              <span>Map</span>
            </button>
          </div>
        )}
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-tertiary)', fontSize: '0.8125rem' }}>
          No analytics data available. Connect to backend to load telemetry charts.
        </div>
      </div>
    );
  }

  // Format Status data for PieChart
  const statusChartData = Object.entries(analytics.status_distribution).map(
    ([name, value]) => ({
      name: name.replace('_', ' '),
      key: name,
      value: value,
    })
  );

  // Format Confidence data for BarChart
  const confidenceChartData = Object.entries(analytics.confidence_distribution).map(
    ([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      count: value,
      key: name,
    })
  );

  // Format Source Type data
  const sourceChartData = Object.entries(analytics.source_type_distribution).map(
    ([name, value]) => ({
      name: name.replace('_', ' '),
      count: value,
    })
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {/* View Header */}
      <div className="view-section-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {onBack && (
            <button className="btn-tool" onClick={onBack} title="Back to Map View" id="analytics-back-btn">
              <ChevronLeft size={13} />
              <span>Map</span>
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <BarChart2 size={14} color="var(--accent-amber)" />
            <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>Telemetry &amp; Verification Analytics</span>
          </div>
        </div>
      </div>
      {/* Dataset Provenance Header */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.85rem 1.15rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
            <Database size={14} color="var(--accent-orange)" />
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Telemetry Provenance & Ingestion Context
            </span>
          </div>
          <div style={{ fontSize: '0.725rem', color: 'var(--text-secondary)' }}>
            Instrument: <strong>{analytics.dataset_info.source || 'NASA FIRMS VIIRS (375m)'}</strong> &bull; Period:{' '}
            <strong>{analytics.dataset_info.period || '2023-07-12 Ingestion'}</strong> &bull; Spatial Coverage:{' '}
            <strong>{analytics.dataset_info.spatial_coverage || 'North America / Global AOI'}</strong>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1.25rem' }}>
          <div>
            <div style={{ fontSize: '0.625rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Operating Mode</div>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#38BDF8', fontFamily: 'var(--font-mono)' }}>
              {analytics.data_mode}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.625rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Processed Hotspots</div>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              {analytics.total_detections.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="analytics-grid">
        {/* Verification Status Distribution */}
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <div className="chart-title">Incident Verification Distribution</div>
              <div className="chart-subtitle">Explainable deterministic status breakdown</div>
            </div>
            <ShieldCheck size={16} color="var(--color-verified)" />
          </div>

          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={statusChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {statusChartData.map((entry) => (
                    <Cell
                      key={`cell-${entry.key}`}
                      fill={STATUS_COLORS[entry.key] || '#67727e'}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}
                  formatter={(val) => <span style={{ color: 'var(--text-primary)' }}>{val}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Observations by Confidence Band */}
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <div className="chart-title">Thermal Hotspots by Confidence</div>
              <div className="chart-subtitle">VIIRS radiometer confidence bands</div>
            </div>
            <Flame size={16} color="var(--accent-orange)" />
          </div>

          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={confidenceChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <XAxis dataKey="name" stroke="var(--text-tertiary)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--text-tertiary)" fontSize={11} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {confidenceChartData.map((entry) => (
                    <Cell
                      key={`cell-${entry.key}`}
                      fill={CONFIDENCE_COLORS[entry.key] || '#38BDF8'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Detections by Day Time Series */}
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <div className="chart-title">Temporal Observation Distribution</div>
              <div className="chart-subtitle">Hotspot observations grouped by date</div>
            </div>
            <PieIcon size={16} color="var(--color-info)" />
          </div>

          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={analytics.detections_by_day} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <XAxis dataKey="date" stroke="var(--text-tertiary)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--text-tertiary)" fontSize={11} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" fill="#0EA5E9" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Evidence Source Authority Breakdown */}
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <div className="chart-title">Evidence Sources by Authority</div>
              <div className="chart-subtitle">Discovered public reports by provenance tier</div>
            </div>
            <Database size={16} color="var(--color-verified)" />
          </div>

          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={sourceChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <XAxis dataKey="name" stroke="var(--text-tertiary)" fontSize={10} tickLine={false} />
                <YAxis stroke="var(--text-tertiary)" fontSize={11} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" fill="#10B981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
