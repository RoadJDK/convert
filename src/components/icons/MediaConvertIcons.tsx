import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

type IconBaseProps = IconProps & {
  children: ReactNode;
};

const IconBase = ({ children, className, ...props }: IconBaseProps) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.8"
    viewBox="0 0 24 24"
    {...props}
  >
    {children}
  </svg>
);

export const AppStatsIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M4.5 18.5h15" />
    <path d="M7 16V9.5" />
    <path d="M12 16V5.5" />
    <path d="M17 16v-8" />
    <path d="M5 5.5h4l2 2h4" />
  </IconBase>
);

export const ArchiveBoxIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M5 8h14v11.5H5z" />
    <path d="M7 4.5h10l2 3.5H5z" />
    <path d="M12 8v11.5" />
    <path d="M10 10.5h2" />
    <path d="M12 13h2" />
    <path d="M10 15.5h2" />
  </IconBase>
);

export const BatchFilesIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M6.5 7.5V5h8l3 3v10.5h-2.5" />
    <path d="M4 9.5h8l3 3V21H4z" />
    <path d="M12 9.5v3h3" />
    <path d="M7 16h6" />
    <path d="M7 18.5h4" />
  </IconBase>
);

export const ChevronDownIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M7.5 9.5 12 14l4.5-4.5" />
  </IconBase>
);

export const ChevronLeftIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M14.5 7.5 10 12l4.5 4.5" />
  </IconBase>
);

export const ChevronRightIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="m9.5 7.5 4.5 4.5-4.5 4.5" />
  </IconBase>
);

export const ChevronUpIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M7.5 14.5 12 10l4.5 4.5" />
  </IconBase>
);

export const CheckMarkIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="m5.5 12.5 4 4 9-9" />
  </IconBase>
);

export const CircleMarkIcon = (props: IconProps) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="7" />
  </IconBase>
);

export const CloseSelectionIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M7 7l10 10" />
    <path d="M17 7 7 17" />
    <path d="M4.5 12a7.5 7.5 0 0 0 15 0" />
  </IconBase>
);

export const ControlArrowLeftIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M19 12H6" />
    <path d="m11 7-5 5 5 5" />
  </IconBase>
);

export const ControlArrowRightIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M5 12h13" />
    <path d="m13 7 5 5-5 5" />
  </IconBase>
);

export const ConvertPlayIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M5 7.5h7" />
    <path d="M9.5 4.5 12 7.5 9.5 10.5" />
    <path d="M19 16.5h-7" />
    <path d="M14.5 13.5 12 16.5l2.5 3" />
    <path d="M9 13.5v-3l5 3-5 3z" fill="currentColor" stroke="none" />
  </IconBase>
);

export const ConversionDoneIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M5 6.5h8l3 3v8H5z" />
    <path d="M13 6.5v3h3" />
    <path d="m8 14 2 2 4.5-5" />
    <path d="M18 5v3" />
    <path d="M16.5 6.5h3" />
  </IconBase>
);

export const CropFrameIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M6 3.5v14.5h14" />
    <path d="M3.5 6h14.5v14" />
    <path d="M9 9h6v6H9z" />
    <path d="M12 9v6" />
    <path d="M9 12h6" />
  </IconBase>
);

export const DirectionDownIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M12 4.5v12" />
    <path d="m7.5 12.5 4.5 4.5 4.5-4.5" />
    <path d="M6 19.5h12" />
  </IconBase>
);

export const DirectionUpIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M12 19.5v-12" />
    <path d="M7.5 11.5 12 7l4.5 4.5" />
    <path d="M6 4.5h12" />
  </IconBase>
);

export const DotMarkIcon = (props: IconProps) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" />
  </IconBase>
);

export const DownloadTrayIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M12 4.5v9" />
    <path d="m8.5 10 3.5 3.5L15.5 10" />
    <path d="M5 14.5v4h14v-4" />
    <path d="M8 18h8" />
  </IconBase>
);

export const EraserMaskIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="m5 15 8.5-8.5a2.3 2.3 0 0 1 3.3 0l.7.7a2.3 2.3 0 0 1 0 3.3L10 18H6.5L5 15z" />
    <path d="m9.5 10.5 4 4" />
    <path d="M4.5 20h12" />
    <path d="M17.5 4.5h1.8" />
    <path d="M20 6.2v1.8" />
  </IconBase>
);

export const GripHandleIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M9 5.5h.1" />
    <path d="M15 5.5h.1" />
    <path d="M9 12h.1" />
    <path d="M15 12h.1" />
    <path d="M9 18.5h.1" />
    <path d="M15 18.5h.1" />
  </IconBase>
);

export const ImageFormatIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M5 5.5h14v13H5z" />
    <path d="m7.5 16 3.5-4 2.5 2.7 1.5-1.7 2.5 3" />
    <path d="M8.5 8.5h.1" />
    <path d="M16 5.5v3.5h3" />
  </IconBase>
);

export const ImportStackIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M7 17.5h10l2-3.5v5H5v-5z" />
    <path d="M12 4.5v9" />
    <path d="m8.5 8.5 3.5-4 3.5 4" />
    <path d="M8 13.5h8" />
    <path d="M6.5 6.5h2" />
    <path d="M15.5 6.5h2" />
  </IconBase>
);

export const LinkRatioIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M9.5 7.5h-1a4 4 0 0 0 0 8h3" />
    <path d="M14.5 7.5h1a4 4 0 0 1 0 8h-3" />
    <path d="M9.5 12h5" />
    <path d="M5 5.5h4" />
    <path d="M15 18.5h4" />
  </IconBase>
);

export const LoaderRingIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M12 4.5a7.5 7.5 0 0 1 7.5 7.5" />
    <path d="M12 19.5A7.5 7.5 0 0 1 4.5 12" />
    <path d="M12 7.5v4.5l3 2" />
  </IconBase>
);

export const MaxSizeIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M5 7.5h14v11H5z" />
    <path d="M8 7.5V5h8v2.5" />
    <path d="M8 11h8" />
    <path d="M8 14h5" />
    <path d="M17 15.5v-3" />
  </IconBase>
);

export const MoreDotsIcon = (props: IconProps) => (
  <IconBase {...props}>
    <circle cx="6.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="17.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </IconBase>
);

export const PanelLeftIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M5 5h14v14H5z" />
    <path d="M9 5v14" />
    <path d="M11.5 9.5h4" />
    <path d="M11.5 12h4" />
  </IconBase>
);

export const PauseFrameIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M7 5.5h3v13H7z" />
    <path d="M14 5.5h3v13h-3z" />
    <path d="M4.5 4.5h15v15h-15z" />
  </IconBase>
);

export const PencilTagIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M5 17.5 16.5 6a2.2 2.2 0 0 1 3.1 3.1L8.1 20.5H5z" />
    <path d="m14.5 8 3 3" />
    <path d="M4.5 6.5h5" />
    <path d="M4.5 10h3" />
  </IconBase>
);

export const PercentBadgeIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M5 7.5h14v11H5z" />
    <path d="M8 15.5 16 9.5" />
    <path d="M8.5 9.8h.1" />
    <path d="M15.5 15.2h.1" />
    <path d="M7 4.5h10" />
  </IconBase>
);

export const RemoveFileIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M7 6.5h10" />
    <path d="M9 6.5V4.5h6v2" />
    <path d="M8 9h8l-.7 10H8.7z" />
    <path d="M10.5 12.5v4" />
    <path d="M13.5 12.5v4" />
  </IconBase>
);

export const RenameSparkIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M5 7.5h9l4 4v8H5z" />
    <path d="M14 7.5v4h4" />
    <path d="M8 15h5" />
    <path d="M8 17.5h3" />
    <path d="M18.5 4.5v3" />
    <path d="M17 6h3" />
    <path d="M4 4.5l1 1 1-1" />
  </IconBase>
);

export const ResetFrameIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M8 7.5h8v8H8z" />
    <path d="M7 4.5h6a7 7 0 1 1-5.7 11" />
    <path d="M7 4.5v4h4" />
  </IconBase>
);

export const RotateLeftIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M8 7.5h8v8H8z" />
    <path d="M7 5.5h6a7 7 0 1 1-6.2 10.2" />
    <path d="M7 5.5v4h4" />
  </IconBase>
);

export const RotateRightIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M8 7.5h8v8H8z" />
    <path d="M17 5.5h-6a7 7 0 1 0 6.2 10.2" />
    <path d="M17 5.5v4h-4" />
  </IconBase>
);

export const SettingsSlidersIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M5 7h14" />
    <path d="M5 12h14" />
    <path d="M5 17h14" />
    <path d="M9 5.5v3" />
    <path d="M15 10.5v3" />
    <path d="M11.5 15.5v3" />
  </IconBase>
);

export const SearchInspectIcon = (props: IconProps) => (
  <IconBase {...props}>
    <circle cx="10.5" cy="10.5" r="5.5" />
    <path d="m15 15 4 4" />
    <path d="M8.5 10.5h4" />
    <path d="M10.5 8.5v4" />
  </IconBase>
);

export const TrendStatsIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M5 18.5h14" />
    <path d="M6.5 15.5 10 12l3 2 5-7" />
    <path d="M15 7h3v3" />
    <path d="M7 18.5v-3" />
    <path d="M12 18.5v-4.5" />
    <path d="M17 18.5v-8" />
  </IconBase>
);

export const UnlinkRatioIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M9.5 7.5h-1a4 4 0 0 0 0 8h2" />
    <path d="M14.5 7.5h1a4 4 0 0 1 0 8h-2" />
    <path d="m7 20 10-16" />
    <path d="M10.5 12h3" />
  </IconBase>
);

export const VideoTimelineIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M5 5.5h14v13H5z" />
    <path d="M8 5.5v13" />
    <path d="M16 5.5v13" />
    <path d="M5 9h14" />
    <path d="M5 15h14" />
    <path d="m10.5 10.2 4 2.3-4 2.3z" fill="currentColor" stroke="none" />
  </IconBase>
);

export const WaitingQueueIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M6.5 5h11v4.5l-3.5 2.5 3.5 2.5V19h-11v-4.5L10 12 6.5 9.5z" />
    <path d="M9 7.5h6" />
    <path d="M9 16.5h6" />
    <path d="M12 11.8v.2" />
  </IconBase>
);

export const WatermarkCleanIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M5 5.5h14v13H5z" />
    <path d="M8 15.5 15.5 8" />
    <path d="m8.5 9 2 2" />
    <path d="m13 14.5 2 2" />
    <path d="M18.5 4.5v3" />
    <path d="M17 6h3" />
  </IconBase>
);

export const AlertMarkIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M12 4.5 20 19H4z" />
    <path d="M12 9v5" />
    <path d="M12 17h.1" />
  </IconBase>
);
