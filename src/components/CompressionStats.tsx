import { cn } from '@/lib/utils';
import { formatFileSize, calculateSizeChange } from '@/types/converter';
import { DirectionDownIcon, DirectionUpIcon } from '@/components/icons/MediaConvertIcons';

interface CompressionStatsProps {
  originalSize: number;
  convertedSize: number;
}

export const CompressionStats = ({ originalSize, convertedSize }: CompressionStatsProps) => {
  const { percentage, isSmaller } = calculateSizeChange(originalSize, convertedSize);
  
  return (
    <div className={cn(
      'inline-flex items-center gap-1.5 rounded-[var(--ms-radius-chip)] border px-2 py-1 text-xs font-medium',
      isSmaller 
        ? 'border-border bg-card text-foreground' 
        : 'border-destructive/30 bg-card text-destructive'
    )}>
      {isSmaller ? (
        <DirectionDownIcon className="h-3 w-3" />
      ) : (
        <DirectionUpIcon className="h-3 w-3" />
      )}
      <span>{percentage.toFixed(1)}%</span>
      <span className="text-muted-foreground">
        ({formatFileSize(originalSize)} zu {formatFileSize(convertedSize)})
      </span>
    </div>
  );
};
