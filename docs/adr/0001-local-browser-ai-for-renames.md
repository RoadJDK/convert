# ADR 0001: Use Local Browser AI For Rename Suggestions

## Status

Accepted

## Context

Maibach Convert handles private image and video files. Rename suggestions need visual context, including video frames, but sending files or frames to a hosted model would create token-abuse, rate-limit, privacy, and provider-lock concerns.

Cloudflare Workers AI was considered because the app is moving to Cloudflare Workers. A hosted model would be easier to centrally rate-limit, but it would still require uploading user file-derived content and would make the rename feature dependent on server capacity and provider availability.

## Decision

Rename suggestions use browser-local AI. The browser downloads and caches the model/runtime, then analyzes local image data or local video frames client-side.

The Cloudflare Worker remains the static app host and security boundary for delivery, not a proxy for source file analysis.

## Consequences

- Source files, video frames, and image previews stay in the browser for rename analysis.
- Token abuse risk is minimized because the hosted Worker does not expose an AI inference endpoint for user file contents.
- First rename can be slower because the browser needs to download model/runtime assets.
- Model quality and device support vary by browser hardware, WebGPU support, and WASM fallback performance.
- Future hosted AI can be revisited only with an explicit privacy/rate-limit design and a clear user opt-in.
