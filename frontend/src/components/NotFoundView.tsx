import React from 'react';
import { ShieldAlert, Home, Map } from 'lucide-react';

interface NotFoundViewProps {
  attemptedRoute?: string;
  onGoToMap: () => void;
  onGoHome: () => void;
}

export const NotFoundView: React.FC<NotFoundViewProps> = ({
  attemptedRoute,
  onGoToMap,
  onGoHome,
}) => {
  return (
    <div
      className="not-found-root"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1.25rem',
          color: 'var(--color-danger)',
        }}
      >
        <ShieldAlert size={28} />
      </div>

      <div style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--color-danger)', marginBottom: '0.4rem' }}>
        ERROR 404 · ROUTE NOT FOUND
      </div>

      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0 0 0.6rem 0', color: 'var(--text-primary)' }}>
        No Disaster Intelligence at this Location
      </h1>

      <p style={{ maxWidth: '440px', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.6', margin: '0 0 1.5rem 0' }}>
        The route <code>{attemptedRoute ? `#${attemptedRoute}` : window.location.hash || '#unknown'}</code> does not match any valid TerraShield application view or dossier record.
      </p>

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button
          className="btn-hero-primary"
          onClick={onGoToMap}
          id="notfound-map-btn"
          style={{ padding: '0.55rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
        >
          <Map size={15} />
          <span>Go to Map Dashboard</span>
        </button>

        <button
          className="btn-tool"
          onClick={onGoHome}
          id="notfound-home-btn"
          style={{ padding: '0.55rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
        >
          <Home size={15} />
          <span>TerraShield Homepage</span>
        </button>
      </div>
    </div>
  );
};
