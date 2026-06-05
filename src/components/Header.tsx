import { StatsPopup } from './StatsPopup';
import { useState } from 'react';
import { AppStatsIcon } from '@/components/icons/MediaConvertIcons';

export const Header = () => {
  const [statsOpen, setStatsOpen] = useState(false);

  return (
    <header className="nav" id="nav">
      <div className="row spotlit">
        <div className="navactions">
          <button
            onClick={() => setStatsOpen(true)}
            className="navlink navlink-feature"
            title="Statistiken"
          >
            <AppStatsIcon className="h-4 w-4" />
            Statistiken
          </button>
          <span className="status">
            <span className="dot" aria-hidden="true" />
            Alles lokal
          </span>
          <a className="brand" href="/" aria-label="Maibach Convert Startseite">
            <img src="/assets/logo-mark-white.svg" alt="Maibach Systems" className="logo-mark" width="209" height="456" />
          </a>
        </div>
      </div>

      <StatsPopup open={statsOpen} onClose={() => setStatsOpen(false)} />
    </header>
  );
};
