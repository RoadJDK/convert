import { StatsPopup } from './StatsPopup';
import { useState } from 'react';
import { AppStatsIcon } from '@/components/icons/MediaConvertIcons';

export const Header = () => {
  const [statsOpen, setStatsOpen] = useState(false);

  return (
    <header className="ms-nav" id="nav">
      <div className="ms-rail ms-nav-inner">
        <a className="inline-flex min-h-11 items-center" href="/" aria-label="Maibach Convert Startseite">
          <img src="/assets/logo-full.svg" alt="Maibach Systems" className="h-8 w-auto" width="360" height="112" />
        </a>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setStatsOpen(true)}
            className="ms-icon-button inline-flex h-11 w-11 items-center justify-center p-0"
            aria-label="Lokale Nutzung öffnen"
            title="Lokale Nutzung"
          >
            <AppStatsIcon className="h-4 w-4" />
          </button>
          <span className="ms-status-pill">
            <span className="ms-status-dot" aria-hidden="true" />
            Alles lokal
          </span>
        </div>
      </div>

      <StatsPopup open={statsOpen} onClose={() => setStatsOpen(false)} />
    </header>
  );
};
