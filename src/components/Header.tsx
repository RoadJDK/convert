import { RefreshCw } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

export const Header = () => {
  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-sm">
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent">
            <RefreshCw className="h-5 w-5 text-accent-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">maibach-convert</h1>
            <p className="text-xs text-muted-foreground hidden sm:block">Bilder & Videos für das Web</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            Kostenlos
          </span>
        </div>
      </div>
    </header>
  );
};