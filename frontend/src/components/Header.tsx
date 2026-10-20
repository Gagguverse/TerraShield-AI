import React from 'react';
import {
  ShieldAlert,
  Map,
  FileCheck2,
  Database,
  BarChart3,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { DataMode } from '../types';

interface HeaderProps {
  currentTab: 'overview' | 'verification' | 'evidence' | 'analytics';
  onTabChange: (tab: 'overview' | 'verification' | 'evidence' | 'analytics') => void;
  currentMode: DataMode;
  onModeChange: (mode: DataMode) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  isOnline: boolean;
  lastRefresh?: string;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
  currentMode,
  onModeChange,
  onRefresh,
  isRefreshing,
  isOnline,
  lastRefresh,
}) => {
  const formatTime = (iso?: string) => {
    if (!iso) return 'Just now';
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return iso;
    }
  };

  return (
    <header className="app-header">
      <div className="header-brand">
        <div className="brand-icon-wrapper">
          <ShieldAlert size={22} />
        </div>
        <div>
          <div className="brand-title">
            TerraShield AI
            <span className="brand-badge">Verification MVP</span>
          </div>
          <div className="brand-subtitle">
            Evidence-Driven Wildfire Intelligence Platform
          </div>
        </div>
      </div>

      <nav className="nav-tabs">
        <button
          className={`tab-btn ${currentTab === 'overview' ? 'active' : ''}`}
          onClick={() => onTabChange('overview')}
        >
          <Map size={16} />
          Intelligence Map
        </button>
        <button
          className={`tab-btn ${currentTab === 'verification' ? 'active' : ''}`}
          onClick={() => onTabChange('verification')}
        >
          <FileCheck2 size={16} />
          Incident Verification
        </button>
        <button
          className={`tab-btn ${currentTab === 'evidence' ? 'active' : ''}`}
          onClick={() => onTabChange('evidence')}
        >
          <Database size={16} />
          Evidence Explorer
        </button>
        <button
          className={`tab-btn ${currentTab === 'analytics' ? 'active' : ''}`}
          onClick={() => onTabChange('analytics')}
        >
          <BarChart3 size={16} />
          Analytics
        </button>
      </nav>

      <div className="header-actions">
        {/* Operating Data Mode Selector */}
        <div className="mode-selector" title="Select operational data source mode">
          <button
            className={`mode-btn ${currentMode === 'HISTORICAL_SAMPLE' ? 'active-HISTORICAL_SAMPLE' : ''}`}
            onClick={() => onModeChange('HISTORICAL_SAMPLE')}
          >
            HISTORICAL SAMPLE
          </button>
          <button
            className={`mode-btn ${currentMode === 'LIVE' ? 'active-LIVE' : ''}`}
            onClick={() => onModeChange('LIVE')}
          >
            LIVE
          </button>
          <button
            className={`mode-btn ${currentMode === 'DEMO' ? 'active-DEMO' : ''}`}
            onClick={() => onModeChange('DEMO')}
          >
            DEMO
          </button>
        </div>

        {/* Backend Online / Offline Indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: '0.75rem',
            color: isOnline ? '#10b981' : '#ef4444',
          }}
          title={isOnline ? 'Connected to FastAPI Backend' : 'Disconnected from Backend'}
        >
          {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
          <span style={{ display: 'inline-block' }}>{isOnline ? 'Online' : 'Offline'}</span>
        </div>

        {/* Refresh Action */}
        <button
          className="btn-secondary"
          onClick={onRefresh}
          disabled={isRefreshing}
          title={`Last refresh: ${formatTime(lastRefresh)}`}
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>
    </header>
  );
};
