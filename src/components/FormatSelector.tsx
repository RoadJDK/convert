import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  FileType, 
  OutputFormat, 
  IMAGE_OUTPUT_FORMATS, 
  VIDEO_OUTPUT_FORMATS,
  getOutputExtension
} from '@/types/converter';

interface FormatSelectorProps {
  fileType: FileType;
  currentFormat?: OutputFormat;
  onChange: (format: OutputFormat) => void;
  disabled?: boolean;
}

export const FormatSelector = ({ fileType, currentFormat, onChange, disabled }: FormatSelectorProps) => {
  const formatOptions = fileType === 'image' ? IMAGE_OUTPUT_FORMATS : VIDEO_OUTPUT_FORMATS;
  const defaultFormat = fileType === 'image' ? 'webp' : 'webm';
  const format = currentFormat || defaultFormat;
  const extension = getOutputExtension(fileType, format);

  return (
    <Select 
      value={format} 
      onValueChange={(val) => onChange(val as OutputFormat)}
      disabled={disabled}
    >
      <SelectTrigger className="h-8 w-[70px] px-2 text-xs bg-secondary/50 border-0 hover:bg-secondary">
        <SelectValue>
          <span className="font-mono">.{extension}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-popover border border-border shadow-lg z-50">
        {formatOptions.map((fmt) => (
          <SelectItem key={fmt.value} value={fmt.value} className="text-xs">
            <span className="font-mono">.{getOutputExtension(fileType, fmt.value)}</span>
            <span className="ml-2 text-muted-foreground">{fmt.label}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
