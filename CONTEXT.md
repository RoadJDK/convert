# Maibach Convert Context

## Glossary

### Conversion File
A single user-selected image, video, or PDF that can be previewed, configured, converted, renamed when supported, reset, removed, and downloaded.

### Displayable Image
An image blob that browser image and canvas APIs can load directly. HEIC, HEIF, and TIFF inputs become displayable images by local browser-side decoding to PNG before preview, crop, conversion, or local rename analysis.

### Local Rename
A filename suggestion generated in the browser from local image data or local video frames. Local rename does not upload source files, frames, captions, or converted assets to a server.

### File Override
A file-specific edit that intentionally diverges from the current selection settings while remaining part of the same batch.
_Avoid_: Detached file

### Rename Ledger
The visible relationship between an original filename, a Local Rename suggestion, an accepted name, and the final exported filename.
_Avoid_: AI name as source of truth

### Media Type Tab
A Workspace tab that groups files by type so image, video, and PDF actions remain understandable while mixed imports stay possible.
_Avoid_: Hidden queue

### Selection Panel
The action panel shown when pending files of one media type are selected. It applies shared settings, local rename, image PDF actions, or PDF operations without changing unselected files.
_Avoid_: Global preset

### Export Panel
The compact status and download area for pending and completed files.
_Avoid_: Separate manifest panel

### Workspace
The main interactive app area where users add files, configure conversion settings, run exports, and download outputs.
