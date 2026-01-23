import { Sparkles } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface RenameToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  disabled?: boolean;
}

export const RenameToggle = ({ enabled, onToggle, disabled }: RenameToggleProps) => {
  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-xl border p-4 transition-all',
        enabled ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
            enabled ? 'bg-primary/20' : 'bg-secondary'
          )}
        >
          <Sparkles
            className={cn(
              'h-5 w-5 transition-colors',
              enabled ? 'text-primary' : 'text-muted-foreground'
            )}
          />
        </div>
        <div>
          <h4 className="font-medium text-foreground">AI Rename Helper</h4>
          <p className="text-sm text-muted-foreground">
            {disabled 
              ? 'Verbinde Cloud für AI-Funktionen'
              : 'Intelligente Dateinamen basierend auf Inhalt'}
          </p>
        </div>
      </div>

      <Switch
        checked={enabled}
        onCheckedChange={onToggle}
        disabled={disabled}
      />
    </div>
  );
};
