import React from 'react';
import { Info, AlertTriangle, Sparkles } from 'lucide-react';
import type { DataMode } from '../types';

interface DataModeBannerProps {
  mode: DataMode;
  tinyfishConfigured: boolean;
  firmsConfigured: boolean;
  lastRefresh?: string;
}

export const DataModeBanner: React.FC<DataModeBannerProps> = ({
  mode,
  tinyfishConfigured,
  firmsConfigured,
  lastRefresh,
}) => {
  const formatTime = (iso?: string) => {
    if (!iso) return 'Synchronized';
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  return (
    <div className={`mode-banner ${mode}`} role="status">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {mode === 'HISTORICAL_SAMPLE' && (
          <>
            <Info size={14} color="#38BDF8" style={{ flexShrink: 0 }} />
            <div>
              <strong>HISTORICAL SAMPLE STREAM:</strong> NASA FIRMS VIIRS (Suomi-NPP) 375m thermal detections from 2023-07-12 archive. Observations reflect verified fire season activity.
            </div>
          </>
        )}

        {mode === 'LIVE' && (
          <>
            <AlertTriangle size={14} color="var(--color-danger)" style={{ flexShrink: 0 }} />
            <div>
              <strong>LIVE STREAM MODE:</strong>{' '}
              {firmsConfigured
                ? 'Streaming real-time satellite telemetry directly from NASA FIRMS API.'
                : 'FIRMS_MAP_KEY is unconfigured in backend .env. Live external queries are paused.'}
              {!tinyfishConfigured && ' TinyFish web search is running in unconfigured mode.'}
            </div>
          </>
        )}

        {mode === 'DEMO' && (
          <>
            <Sparkles size={14} color="#C084FC" style={{ flexShrink: 0 }} />
            <div>
              <strong>DEMO BENCHMARK:</strong> Curated benchmark incidents from the Canadian & PNW fire seasons with authentic BC Wildfire advisories and CBC reports.
            </div>
          </>
        )}

        {mode === 'CACHED' && (
          <>
            <AlertTriangle size={14} color="#F59E0B" style={{ flexShrink: 0 }} />
            <div>
              <strong>CACHED SATELLITE TELEMETRY (STALE):</strong> Upstream NASA FIRMS API is currently degraded. Displaying last verified satellite observations (Offline / Cached).
            </div>
          </>
        )}
      </div>

      <div style={{ fontSize: '0.6875rem', opacity: 0.85, whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>
        Refreshed: {formatTime(lastRefresh)}
      </div>
    </div>
  );
};
