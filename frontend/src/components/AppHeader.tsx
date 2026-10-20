import React from 'react';
import {
  RefreshCw,
  Settings,
  Radio,
  Map,
  Flame,
  FileText,
  BarChart2,
  Archive,
  ShieldAlert,
} from 'lucide-react';
import type { DataMode, FirmsRegion, HealthResponse } from '../types';
import type { NavTab } from './AppSidebar';
import { AoiDropdown } from './AoiDropdown';

interface AppHeaderProps {
  currentTab: NavTab;
  currentMode: DataMode;
  onModeChange: (mode: DataMode) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  isOnline: boolean;
  health: HealthResponse | null;
  regions: FirmsRegion[];
  selectedRegionId: string;
  onRegionChange: (regionId: string) => void;
  onOpenSettings: () => void;
  onNavigateHome?: () => void;
  onTabChange?: (tab: NavTab) => void;
  currentRoute?: string;
  onNavigateRoute?: (route: string) => void;
}

const TAB_META: Record<NavTab, { section: string; title: string; icon: React.ElementType }> = {
  map: { section: 'FIRE INTELLIGENCE', title: 'GEOSPATIAL THERMAL MAP', icon: Map },
  incidents: { section: 'FIRE INVESTIGATION', title: 'INCIDENTS QUEUE', icon: Flame },
  history: { section: 'DISASTER ARCHIVE', title: 'HISTORICAL INCIDENTS', icon: Archive },
  evidence: { section: 'PROVENANCE', title: 'PUBLIC EVIDENCE & ADVISORIES', icon: FileText },
  analytics: { section: 'INTELLIGENCE', title: 'TELEMETRY & VERIFICATION ANALYTICS', icon: BarChart2 },
};

const SECONDARY_TABS: NavTab[] = ['incidents', 'history', 'evidence', 'analytics'];

export const AppHeader: React.FC<AppHeaderProps> = ({
  currentTab,
  currentMode,
  onModeChange,
  onRefresh,
  isRefreshing,
  isOnline,
  health,
  regions,
  selectedRegionId,
  onRegionChange,
  onOpenSettings,
  onNavigateHome,
  onTabChange,
  onNavigateRoute,
}) => {
  const meta = TAB_META[currentTab] ?? { section: 'FIRE INTELLIGENCE', title: 'GEOSPATIAL THERMAL MAP', icon: Map };

  const formatRefreshTime = (iso?: string) => {
    if (!iso) return 'Syncing...';
    try {
      const dt = new Date(iso);
      return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return iso;
    }
  };

  const selectedRegion = regions.find((r) => r.id === selectedRegionId);
  const isIndia = selectedRegion?.country === 'India' || selectedRegionId.startsWith('INDIA');

  return (
    <header className="app-header rocket-header">
      {/* Left: Brand / Home + Distinct Page Title */}
      <div className="header-left-cluster">
        {/* Brand Home Button */}
        <button
          className="header-brand-btn"
          onClick={onNavigateHome}
          title="Return to TerraShield AI Homepage"
          id="header-home-btn"
        >
          <div className="header-brand-icon">
            <ShieldAlert size={14} />
          </div>
          <span className="header-brand-text">
            TERRASHIELD<span style={{ color: 'var(--accent-amber)' }}>AI</span>
          </span>
        </button>

        <div className="header-brand-divider" aria-hidden="true" />

        {/* Page Title: appears once, clearly separated from brand */}
        <div className="header-page-title-group">
          <span className="header-page-title">Fire Intelligence</span>
          {currentTab !== 'map' && (
            <span className="header-page-subtitle">
              <span className="header-breadcrumb-slash">/</span>
              {meta.title}
            </span>
          )}
          {isIndia && <span className="header-country-badge" title="Active Region: India">🇮🇳</span>}
        </div>
      </div>

      {/* Center: Unified Navigation for Thermal Map & Sub-views */}
      <nav className="header-center-nav" aria-label="Fire intelligence views">
        <div className="header-tab-nav">
          <button
            className={`header-tab-btn ${currentTab === 'map' ? 'active' : ''}`}
            onClick={() => {
              if (onNavigateRoute) onNavigateRoute('fire');
              else if (onTabChange) onTabChange('map');
            }}
            id="nav-link-fire-dashboard"
            title="NASA FIRMS Thermal Satellite Map"
          >
            <Map size={12} style={{ color: 'var(--accent-orange)' }} />
            <span>Thermal Map</span>
          </button>

          {/* Secondary Sub-View Pills */}
          {onTabChange &&
            SECONDARY_TABS.map((tab) => {
              const TabIcon = TAB_META[tab].icon;
              const isActive = currentTab === tab;
              return (
                <button
                  key={tab}
                  className={`header-tab-btn ${isActive ? 'active' : ''}`}
                  onClick={() => onTabChange(tab)}
                  id={`header-tab-${tab}`}
                  title={TAB_META[tab].title}
                >
                  <TabIcon size={12} />
                  <span>{tab === 'history' ? 'History Archive' : tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
                </button>
              );
            })}
        </div>
      </nav>

      {/* Right Actions: AOI, Mode, Refresh, Settings */}
      <div className="header-actions">
        {/* Accessible AOI Region Selector */}
        <AoiDropdown
          regions={regions}
          selectedRegionId={selectedRegionId}
          onRegionChange={onRegionChange}
        />

        {/* Data Mode Toggle */}
        <div className="mode-toggle-group" title="Select operating dataset stream">
          <button
            className={`mode-toggle-btn ${currentMode === 'LIVE' ? 'active-LIVE' : ''}`}
            onClick={() => onModeChange('LIVE')}
            title="Query real-time satellite fire detections via NASA FIRMS API"
          >
            <Radio size={11} className={currentMode === 'LIVE' ? 'animate-pulse' : ''} />
            <span>LIVE</span>
          </button>
          <button
            className={`mode-toggle-btn ${currentMode === 'HISTORICAL_SAMPLE' ? 'active-HISTORICAL_SAMPLE' : ''}`}
            onClick={() => onModeChange('HISTORICAL_SAMPLE')}
            title="View official verified satellite historical archive"
          >
            HISTORICAL
          </button>
          <button
            className={`mode-toggle-btn ${currentMode === 'DEMO' ? 'active-DEMO' : ''}`}
            onClick={() => onModeChange('DEMO')}
            title="Load curated test benchmarks"
          >
            DEMO
          </button>
        </div>

        {/* Refresh Action */}
        <button
          className="btn-tool"
          onClick={onRefresh}
          disabled={isRefreshing}
          title={`Backend ${isOnline ? 'Online' : 'Offline'} | Last refresh: ${formatRefreshTime(health?.last_refresh)}`}
          id="header-refresh-btn"
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: isOnline ? '#10b981' : '#ef4444',
              display: 'inline-block',
            }}
          />
          <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
            {formatRefreshTime(health?.last_refresh)}
          </span>
        </button>

        {/* Settings */}
        <button
          className="btn-tool"
          onClick={onOpenSettings}
          title="System Settings, API Credentials & Thresholds"
          id="header-settings-btn"
        >
          <Settings size={13} />
        </button>
      </div>
    </header>
  );
};
