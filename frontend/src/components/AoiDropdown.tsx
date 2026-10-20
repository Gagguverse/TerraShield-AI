import React, { useState, useRef, useEffect } from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';
import type { FirmsRegion } from '../types';

interface AoiDropdownProps {
  regions: FirmsRegion[];
  selectedRegionId: string;
  onRegionChange: (regionId: string) => void;
  title?: string;
  compact?: boolean;
}

export const AoiDropdown: React.FC<AoiDropdownProps> = ({
  regions,
  selectedRegionId,
  onRegionChange,
  title = 'Area of Interest',
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentRegion = regions.find((r) => r.id === selectedRegionId) || {
    id: selectedRegionId,
    name: selectedRegionId,
    country: selectedRegionId.startsWith('INDIA') ? 'India' : 'Global',
  };

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const indiaRegions = regions.filter((r) => r.country === 'India');
  const globalRegions = regions.filter((r) => r.country !== 'India');

  const handleSelect = (regId: string) => {
    onRegionChange(regId);
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className="rocket-aoi-dropdown-container"
      style={{ position: 'relative', display: 'inline-block' }}
    >
      <button
        type="button"
        className="rocket-aoi-pill"
        onClick={() => setIsOpen(!isOpen)}
        title={title}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: isOpen ? 'var(--bg-active)' : 'rgba(255, 255, 255, 0.04)',
          border: isOpen ? '1px solid var(--accent-orange)' : '1px solid var(--border-subtle)',
          borderRadius: '20px',
          padding: compact ? '2px 8px' : '4px 10px',
          cursor: 'pointer',
          color: 'var(--text-primary)',
          fontSize: '11.5px',
          transition: 'all 0.15s ease',
        }}
      >
        <Globe size={12} color="var(--accent-orange)" />
        <span style={{ color: 'var(--text-tertiary)', fontSize: '11px', fontWeight: 500 }}>AOI:</span>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentRegion.name.split(' (')[0]}
        </span>
        <span>{currentRegion.country === 'India' ? '🇮🇳' : '🌐'}</span>
        <ChevronDown
          size={11}
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s ease',
            color: 'var(--text-tertiary)',
          }}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="rocket-aoi-dropdown-menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 2500,
            minWidth: '260px',
            maxWidth: '320px',
            maxHeight: '360px',
            overflowY: 'auto',
            background: 'rgba(22, 27, 34, 0.98)',
            border: '1px solid var(--border-muted)',
            borderRadius: '8px',
            padding: '6px',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(16px)',
          }}
        >
          {/* Header Note */}
          <div
            style={{
              padding: '4px 8px 6px',
              fontSize: '10px',
              color: 'var(--text-tertiary)',
              borderBottom: '1px solid var(--border-subtle)',
              marginBottom: '4px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>SELECT MONITORING REGION</span>
            <span style={{ fontSize: '9px', opacity: 0.7 }}>ESC to close</span>
          </div>

          {/* India Regions */}
          {indiaRegions.length > 0 && (
            <div style={{ marginBottom: '6px' }}>
              <div
                style={{
                  padding: '4px 8px',
                  fontSize: '9.5px',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  color: 'var(--accent-orange)',
                  textTransform: 'uppercase',
                }}
              >
                India Monitoring Zones 🇮🇳
              </div>
              {indiaRegions.map((reg) => {
                const isSelected = reg.id === selectedRegionId;
                return (
                  <div
                    key={reg.id}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(reg.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      background: isSelected ? 'var(--bg-active)' : 'transparent',
                      color: isSelected ? 'var(--accent-orange)' : 'var(--text-secondary)',
                      fontWeight: isSelected ? 600 : 400,
                      transition: 'background 0.12s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                  >
                    <span>{reg.name}</span>
                    {isSelected && <Check size={12} color="var(--accent-orange)" />}
                  </div>
                );
              })}
            </div>
          )}

          {/* Global / International AOIs */}
          {globalRegions.length > 0 && (
            <div>
              <div
                style={{
                  padding: '4px 8px',
                  fontSize: '9.5px',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: '6px',
                  marginTop: '4px',
                }}
              >
                International AOIs 🌐
              </div>
              {globalRegions.map((reg) => {
                const isSelected = reg.id === selectedRegionId;
                return (
                  <div
                    key={reg.id}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(reg.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      background: isSelected ? 'var(--bg-active)' : 'transparent',
                      color: isSelected ? 'var(--accent-orange)' : 'var(--text-secondary)',
                      fontWeight: isSelected ? 600 : 400,
                      transition: 'background 0.12s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                  >
                    <span>{reg.name}</span>
                    {isSelected && <Check size={12} color="var(--accent-orange)" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
