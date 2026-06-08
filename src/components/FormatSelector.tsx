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
        aria-label="Zielformat"
        className="h-11 w-[74px] border-0 bg-secondary/50 px-2 text-xs hover:bg-secondary sm:h-8 sm:w-[70px]"
      >
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
