import { BarChart3, Shield, Infinity } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { StatsPopup } from './StatsPopup';
import { Greeting } from './Greeting';
import { useState } from 'react';
import logoImage from '@/assets/logo-original.png';

export const Header = () => {
  const [statsOpen, setStatsOpen] = useState(false);

  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-sm">
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl overflow-hidden">
            <img src={logoImage} alt="Maibach Convert Logo" className="h-10 w-10 object-cover" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Maibach Convert</h1>
            <p className="text-xs text-muted-foreground hidden sm:block">Bilder & Videos für das Web</p>
          </div>
        </div>

        <div className="hidden md:flex flex-1 justify-center">
          <Greeting />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setStatsOpen(true)}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            title="Statistiken"
          >
            <BarChart3 className="h-5 w-5 text-muted-foreground hover:text-foreground" />
          </button>
          <ThemeToggle />
          <span className="hidden sm:flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
            <Shield className="h-3 w-3" />
            100% Sicher lokal
            <Infinity className="h-3 w-3 ml-1" />
            unbegrenzt kostenlos
          </span>
          <span className="sm:hidden flex items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-xs font-medium text-success">
            <Shield className="h-3 w-3" />
            Lokal & Kostenlos
          </span>
        </div>
      </div>

      <StatsPopup open={statsOpen} onClose={() => setStatsOpen(false)} />
    </header>
  );
};