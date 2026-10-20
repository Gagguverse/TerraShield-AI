import { useEffect, useState, useCallback } from 'react';
import { AppSidebar, type NavTab } from './components/AppSidebar';
import { AppHeader } from './components/AppHeader';
import { IntelligenceMap } from './components/IntelligenceMap';
import { FloatingIncidentDetail } from './components/FloatingIncidentDetail';
import { ContextualEvidenceDrawer } from './components/ContextualEvidenceDrawer';
import { IncidentVerificationList } from './components/IncidentVerificationList';
import { EvidenceExplorer } from './components/EvidenceExplorer';
import { AnalyticsView } from './components/AnalyticsView';
import { SettingsModal } from './components/SettingsModal';
import { LandingPage } from './components/LandingPage';
import { TerraShieldReportModal } from './components/TerraShieldReportModal';
import { HistoryLibraryView } from './components/HistoryLibraryView';
import { NotFoundView } from './components/NotFoundView';
import { HowItWorksGuide } from './components/HowItWorksGuide';
import { api } from './services/api';
import type {
  AnalyticsSummary,
  DataMode,
  EvidenceRecord,
  FirmsRegion,
  HealthResponse,
  Incident,
  SatelliteDetection,
} from './types';

// ── Hash-based and URL routing helpers ────────────────────────────────────────
export type AppRoute =
  | 'home'
  | 'fire'
  | 'map'
  | 'incidents'
  | 'history'
  | 'evidence'
  | 'analytics'
  | 'dossier'
  | 'guide'
  | 'not-found';

export interface RouteState {
  route: AppRoute;
  param?: string;
}

// Valid tab routes that map to NavTab
const TAB_ROUTES: NavTab[] = ['map', 'incidents', 'history', 'evidence', 'analytics'];

function parseHash(): RouteState {
  let raw = window.location.hash.replace('#', '').trim();
  if (!raw) {
    const path = window.location.pathname.replace(/^\//, '').trim();
    if (path === 'fire' || path === 'flood' || path === 'home' || path === 'map' || path === 'guide') {
      raw = path;
    }
  }

  if (!raw || raw === 'home') return { route: 'home' };
  if (raw === 'fire') return { route: 'fire' };
  if (raw === 'flood') return { route: 'home' };
  if (raw === 'guide') return { route: 'guide' };

  if (raw.startsWith('dossier/')) {
    const id = raw.replace('dossier/', '').trim();
    return { route: 'dossier', param: id };
  }

  if (raw === 'demo') {
    return { route: 'fire' };
  }

  if (TAB_ROUTES.includes(raw as NavTab)) {
    return { route: raw as AppRoute };
  }

  return { route: 'not-found', param: raw };
}

export function App() {
  // ── Routing ──────────────────────────────────────────────────────────────
  const [routeInfo, setRouteInfo] = useState<RouteState>(parseHash);
  const [previousRoute, setPreviousRoute] = useState<AppRoute>('fire');

  // Sync state when hash changes (browser Back/Forward)
  useEffect(() => {
    const onHashChange = () => {
      const parsed = parseHash();
      setRouteInfo(parsed);
      if (parsed.route === 'fire' || parsed.route === 'map') {
        setCurrentTab('map');
      } else if (TAB_ROUTES.includes(parsed.route as NavTab)) {
        setCurrentTab(parsed.route as NavTab);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    // On first load: if hash is empty, set hash to home
    if (!window.location.hash) {
      window.location.hash = 'home';
    }
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigateTo = useCallback((route: AppRoute, param?: string) => {
    setPreviousRoute((prev) => (routeInfo.route !== 'not-found' && routeInfo.route !== 'dossier' ? routeInfo.route : prev));
    setRouteInfo({ route, param });

    if (route === 'dossier' && param) {
      window.location.hash = `dossier/${param}`;
    } else {
      window.location.hash = route;
    }

    if (route === 'fire' || route === 'map') {
      setCurrentTab('map');
    } else if (TAB_ROUTES.includes(route as NavTab)) {
      setCurrentTab(route as NavTab);
    }
  }, [routeInfo.route]);

  // ── Navigation & Shell State ─────────────────────────────────────────────
  const [currentTab, setCurrentTab] = useState<NavTab>(() => {
    const parsed = parseHash();
    return TAB_ROUTES.includes(parsed.route as NavTab) ? (parsed.route as NavTab) : 'map';
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // ── Operational State ────────────────────────────────────────────────────
  const [currentMode, setCurrentMode] = useState<DataMode>('HISTORICAL_SAMPLE');
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  // ── Data State — India First Default ────────────────────────────────────
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [regions, setRegions] = useState<FirmsRegion[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState<string>('INDIA_ALL');
  const [detections, setDetections] = useState<SatelliteDetection[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [evidenceList, setEvidenceList] = useState<EvidenceRecord[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);

  // ── Selection & Contextual Drawer State ─────────────────────────────────
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [selectedDetection, setSelectedDetection] = useState<SatelliteDetection | null>(null);
  const [isEvidenceDrawerOpen, setIsEvidenceDrawerOpen] = useState<boolean>(false);
  const [incidentStatusFilter, setIncidentStatusFilter] = useState<string>('ALL');
  const [activeReportIncidentId, setActiveReportIncidentId] = useState<string | null>(null);
  const [mapFocusTarget, setMapFocusTarget] = useState<{ lat: number; lon: number; zoom?: number; timestamp: number } | null>(null);

  // Load Regions metadata on mount (Defaults to India)
  useEffect(() => {
    api.getFirmsRegions()
      .then((res) => {
        if (res.regions && res.regions.length > 0) {
          setRegions(res.regions);
          if (res.default_region) {
            setSelectedRegionId(res.default_region);
          }
        }
      })
      .catch((err) => {
        console.warn('Could not load FIRMS regions:', err);
      });
  }, []);

  // Central Data Loader
  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [healthData, detData, incData, evidData, anaData] = await Promise.all([
        api.getHealth(),
        api.getDetections(1500),
        api.getIncidents(),
        api.getEvidence(undefined, undefined, 200),
        api.getAnalytics(),
      ]);

      setHealth(healthData);
      setCurrentMode(healthData.current_mode);
      setDetections(detData);
      setIncidents(incData);
      setEvidenceList(evidData);
      setAnalytics(anaData);
      setIsOnline(true);

      // Preserve selected incident only if it still exists in incData; otherwise clear it
      setSelectedIncident((prev) => {
        if (!prev) return null;
        return incData.find((i) => i.id === prev.id) || null;
      });

      // Preserve selected detection only if it still exists in detData; otherwise clear it
      setSelectedDetection((prev) => {
        if (!prev) return null;
        return detData.find((d) => d.id === prev.id) || null;
      });
    } catch (err) {
      console.error('Failed to load TerraShield backend telemetry:', err);
      setIsOnline(false);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Mode Switcher (HISTORICAL_SAMPLE, LIVE, DEMO)
  const handleModeChange = async (mode: DataMode) => {
    if (mode === currentMode) return;
    setSelectedIncident(null);
    setSelectedDetection(null);
    setIsRefreshing(true);
    try {
      await api.switchMode(mode);
      setCurrentMode(mode);
      if (mode === 'LIVE') {
        try {
          await api.fetchLiveFirms({
            region: selectedRegionId || 'INDIA_ALL',
            source: 'VIIRS_SNPP_NRT',
            day_range: 1,
          });
        } catch (firmsErr) {
          console.warn('Live FIRMS initial query:', firmsErr);
        }
      }
      await loadData();
    } catch (err) {
      console.error('Failed to switch data mode:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Region change handler
  const handleRegionChange = async (regionId: string) => {
    setSelectedRegionId(regionId);
    setSelectedIncident(null);
    setSelectedDetection(null);
    if (currentMode === 'LIVE') {
      setIsRefreshing(true);
      try {
        await api.fetchLiveFirms({
          region: regionId,
          source: 'VIIRS_SNPP_NRT',
          day_range: 1,
        });
        await loadData();
      } catch (err) {
        console.warn('Failed to fetch live FIRMS for region change:', err);
      } finally {
        setIsRefreshing(false);
      }
    }
  };

  // Re-verify incident on demand
  const handleReverify = async (incidentId: string) => {
    setIsVerifying(true);
    try {
      const newReport = await api.verifyIncident(incidentId);
      setIncidents((prev) =>
        prev.map((inc) => (inc.id === incidentId ? { ...inc, verification: newReport } : inc))
      );
      if (selectedIncident && selectedIncident.id === incidentId) {
        setSelectedIncident((prev) => (prev ? { ...prev, verification: newReport } : null));
      }
      const updatedAnalytics = await api.getAnalytics();
      setAnalytics(updatedAnalytics);
    } catch (err) {
      console.error('Failed to reverify incident:', err);
    } finally {
      setIsVerifying(false);
    }
  };

  // Tab change: also updates the route
  const handleTabChange = useCallback((tab: NavTab) => {
    setCurrentTab(tab);
    navigateTo(tab === 'map' ? 'fire' : (tab as AppRoute));
  }, [navigateTo]);

  const handleFocusOnMap = useCallback((lat: number, lon: number, name: string) => {
    navigateTo('fire');
    setCurrentTab('map');
    const match = incidents.find(
      (i) => i.name === name || (Math.abs(i.latitude - lat) < 0.1 && Math.abs(i.longitude - lon) < 0.1)
    );
    if (match) {
      setSelectedIncident(match);
      setSelectedDetection(match.primary_detection || null);
    }
    setMapFocusTarget({ lat, lon, zoom: 10, timestamp: Date.now() });
  }, [incidents, navigateTo]);

  // ── Route: HOME (Landing Page) ──────────────────────────────────────────
  if (routeInfo.route === 'home') {
    return (
      <>
        <LandingPage
          onLaunchDashboard={() => navigateTo('fire')}
          onOpenFireDashboard={() => navigateTo('fire')}
        />
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          health={health}
        />
      </>
    );
  }

  // ── Dashboard shell ──────────────────────────────────────────────────────
  const isFireView = (routeInfo.route === 'fire' || routeInfo.route === 'map' || currentTab === 'map') && routeInfo.route !== 'incidents' && routeInfo.route !== 'history' && routeInfo.route !== 'evidence' && routeInfo.route !== 'analytics';

  return (
    <div className="app-shell" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Top Navigation Header */}
      <AppHeader
        currentTab={currentTab}
        currentMode={currentMode}
        onModeChange={handleModeChange}
        onRefresh={loadData}
        isRefreshing={isRefreshing}
        isOnline={isOnline}
        health={health}
        regions={regions}
        selectedRegionId={selectedRegionId}
        onRegionChange={handleRegionChange}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onNavigateHome={() => navigateTo('home')}
        onTabChange={handleTabChange}
        currentRoute={routeInfo.route}
        onNavigateRoute={(r) => navigateTo(r as AppRoute)}
      />

      {/* VIEW: FIRE INTELLIGENCE DASHBOARD (/fire or /map) */}
      {isFireView && (
        <div className="rocket-viewport">
          <AppSidebar
            currentTab={currentTab}
            onTabChange={handleTabChange}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            health={health}
            totalDetectionsCount={detections.length}
            incidents={incidents}
            selectedIncident={selectedIncident}
            onSelectIncident={(inc) => {
              setSelectedIncident(inc);
              setSelectedDetection(inc.primary_detection || null);
            }}
            regions={regions}
            selectedRegionId={selectedRegionId}
            onRegionChange={handleRegionChange}
            currentMode={currentMode}
          />

          <IntelligenceMap
            incidents={incidents}
            detections={detections}
            selectedIncident={selectedIncident}
            selectedDetection={selectedDetection}
            onSelectIncident={(inc) => {
              setSelectedIncident(inc);
              if (inc) {
                setSelectedDetection(inc.primary_detection || null);
              }
            }}
            onSelectDetection={setSelectedDetection}
            onRefreshData={loadData}
            selectedRegionId={selectedRegionId}
            onRegionChange={handleRegionChange}
            regions={regions}
            currentMode={currentMode}
            health={health}
            mapFocusTarget={mapFocusTarget}
          />

          {(selectedIncident || selectedDetection) && (
            <FloatingIncidentDetail
              incident={selectedIncident}
              selectedDetection={selectedDetection}
              onClose={() => {
                setSelectedIncident(null);
                setSelectedDetection(null);
              }}
              onOpenEvidence={(inc) => {
                setSelectedIncident(inc);
                setIsEvidenceDrawerOpen(true);
              }}
              onReverify={handleReverify}
              isVerifying={isVerifying}
              onOpenDossier={(incId) => setActiveReportIncidentId(incId)}
              onInvestigateComplete={loadData}
              onZoomToIncident={(lat, lon) => handleFocusOnMap(lat, lon, selectedIncident?.name || 'Incident')}
            />
          )}

          <ContextualEvidenceDrawer
            isOpen={isEvidenceDrawerOpen}
            onClose={() => setIsEvidenceDrawerOpen(false)}
            incident={selectedIncident}
            onEvidenceAttached={loadData}
            tinyfishConfigured={health?.tinyfish_configured ?? false}
          />
        </div>
      )}

      {/* VIEW: INCIDENTS QUEUE */}
      {currentTab === 'incidents' && routeInfo.route !== 'dossier' && (
        <div className="rocket-viewport" style={{ padding: '0.85rem', gap: '0.85rem', display: 'flex', overflow: 'hidden' }}>
          <div className="data-table-container" style={{ flex: 1, minWidth: 0, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <IncidentVerificationList
              incidents={incidents}
              selectedIncident={selectedIncident}
              onSelectIncident={(inc) => {
                setSelectedIncident(inc);
                setSelectedDetection(inc.primary_detection || null);
              }}
              statusFilter={incidentStatusFilter}
              onStatusFilterChange={setIncidentStatusFilter}
              onBack={() => navigateTo('fire')}
            />
          </div>

          {(selectedIncident || selectedDetection) && (
            <div className="rocket-incidents-sidebar">
              <FloatingIncidentDetail
                layoutMode="docked"
                incident={selectedIncident}
                selectedDetection={selectedDetection}
                onClose={() => {
                  setSelectedIncident(null);
                  setSelectedDetection(null);
                }}
                onOpenEvidence={(inc) => {
                  setSelectedIncident(inc);
                  setIsEvidenceDrawerOpen(true);
                }}
                onReverify={handleReverify}
                isVerifying={isVerifying}
                onOpenDossier={(incId) => setActiveReportIncidentId(incId)}
                onInvestigateComplete={loadData}
                onZoomToIncident={(lat, lon) => handleFocusOnMap(lat, lon, selectedIncident?.name || 'Incident')}
              />
            </div>
          )}

          <ContextualEvidenceDrawer
            isOpen={isEvidenceDrawerOpen}
            onClose={() => setIsEvidenceDrawerOpen(false)}
            incident={selectedIncident}
            onEvidenceAttached={loadData}
            tinyfishConfigured={health?.tinyfish_configured ?? false}
          />
        </div>
      )}

      {/* VIEW: HISTORICAL DISASTERS ARCHIVE */}
      {currentTab === 'history' && routeInfo.route !== 'dossier' && (
        <div className="rocket-viewport" style={{ padding: '0.85rem', overflow: 'hidden' }}>
          <HistoryLibraryView
            onBack={() => navigateTo('fire')}
            onOpenDossier={(incId) => setActiveReportIncidentId(incId)}
            onFocusMap={handleFocusOnMap}
          />
        </div>
      )}

      {/* VIEW: EVIDENCE EXPLORER */}
      {currentTab === 'evidence' && routeInfo.route !== 'dossier' && (
        <div className="rocket-viewport" style={{ padding: '0.85rem', flexDirection: 'column', gap: '0.65rem' }}>
          <EvidenceExplorer
            evidenceList={evidenceList}
            onBack={() => navigateTo('fire')}
          />
        </div>
      )}

      {/* VIEW: ANALYTICS */}
      {currentTab === 'analytics' && routeInfo.route !== 'dossier' && (
        <div className="rocket-viewport" style={{ padding: '0.85rem', overflowY: 'auto', flexDirection: 'column', gap: '0.65rem' }}>
          <AnalyticsView
            analytics={analytics}
            onBack={() => navigateTo('fire')}
          />
        </div>
      )}

      {/* VIEW: HOW IT WORKS WALKTHROUGH GUIDE */}
      {routeInfo.route === 'guide' && (
        <HowItWorksGuide
          onBack={() => {
            if (previousRoute && previousRoute !== 'guide' && previousRoute !== 'not-found') {
              navigateTo(previousRoute);
            } else {
              navigateTo('home');
            }
          }}
          onNavigateFire={() => navigateTo('fire')}
          onNavigateFlood={() => alert('Flood monitoring is planned for a future release.')}
          onOpenReport={(incId) => setActiveReportIncidentId(incId)}
        />
      )}

      {/* VIEW: NOT FOUND 404 */}
      {routeInfo.route === 'not-found' && (
        <div className="rocket-viewport" style={{ padding: '0.85rem', overflow: 'hidden' }}>
          <NotFoundView
            attemptedRoute={routeInfo.param}
            onGoToMap={() => navigateTo('fire')}
            onGoHome={() => navigateTo('home')}
          />
        </div>
      )}

      {/* Premium Centered Floating Report Modal (Accessible from both Fire & Flood dashboards) */}
      <TerraShieldReportModal
        isOpen={Boolean(activeReportIncidentId || (routeInfo.route === 'dossier' && (routeInfo.param || selectedIncident?.id)))}
        incidentId={activeReportIncidentId || (routeInfo.route === 'dossier' ? (routeInfo.param || selectedIncident?.id || 'INC-HIST-IND-001') : null)}
        onClose={() => {
          setActiveReportIncidentId(null);
          if (routeInfo.route === 'dossier') {
            if (previousRoute && previousRoute !== 'dossier' && previousRoute !== 'not-found') {
              navigateTo(previousRoute);
            } else {
              navigateTo('fire');
            }
          }
        }}
        onFocusOnMap={handleFocusOnMap}
        onInvestigateComplete={loadData}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        health={health}
      />
    </div>
  );
}

export default App;
