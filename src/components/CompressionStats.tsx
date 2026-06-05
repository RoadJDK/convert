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
      'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium',
      isSmaller 
        ? 'bg-success/20 text-success' 
        : 'bg-destructive/20 text-destructive'
    )}>
      {isSmaller ? (
        <DirectionDownIcon className="h-3 w-3" />
      ) : (
        <DirectionUpIcon className="h-3 w-3" />
      )}
      <span>{percentage.toFixed(1)}%</span>
      <span className="text-muted-foreground">
        ({formatFileSize(originalSize)} → {formatFileSize(convertedSize)})
      </span>
    </div>
  );
};
