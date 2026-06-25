import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  FileType, 
  OutputFormat, 
  getOutputFormatOptions,
  getDefaultOutputFormat,
  getOutputExtension
} from '@/types/converter';

interface FormatSelectorProps {
  fileType: FileType;
  currentFormat?: OutputFormat;
  onChange: (format: OutputFormat) => void;
  disabled?: boolean;
}

export const FormatSelector = ({ fileType, currentFormat, onChange, disabled }: FormatSelectorProps) => {
  const formatOptions = getOutputFormatOptions(fileType);
  const defaultFormat = getDefaultOutputFormat(fileType);
  const format = currentFormat || defaultFormat;
  const extension = getOutputExtension(fileType, format);

  return (
    <Select 
      value={format} 
      onValueChange={(val) => onChange(val as OutputFormat)}
      disabled={disabled}
    >
      <SelectTrigger
        aria-label="Format ändern"
        className="h-11 w-[74px] border-input bg-card px-2 text-xs hover:border-ring sm:h-[39px] sm:w-[76px]"
      >
        <SelectValue>
          <span className="font-mono">.{extension}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="z-50 border border-border bg-popover shadow-[var(--ms-shadow-panel)]">
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
