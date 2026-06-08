# Video Browser Support Matrix

Last verified: 2026-06-08.

This app keeps private media local in the browser. Video editing therefore depends on browser media APIs instead of server-side FFmpeg. Support must be capability-gated at runtime, not inferred from user-agent strings.

## Runtime Dependencies

- WebCodecs provides low-level browser encode/decode primitives. MDN marks `VideoEncoder` as limited availability and secure-context-only, so the app must keep degraded paths for browsers or devices without the required encoder/decoder.
- WebCodecs does not read containers or write playable files by itself. The app uses Mediabunny for demuxing, muxing, conversion, trim, crop, resize, rotation, progress, and track decisions.
- `MediaRecorder` is the deliberate degraded fallback. It is broadly available, but MIME support still has to be checked with `MediaRecorder.isTypeSupported(...)`, and recording can still fail under resource pressure.

## Verified Matrix

| Browser target | Verified in this repo | Primary path | Fallback path | Evidence |
| --- | --- | --- | --- | --- |
| Chromium desktop via Playwright | WebM resize, WebM crop+trim, WebM crop+trim with audio, WebM to MP4 with audio, 90-degree rotation, MP4 input fallback | Remotion WebCodecs for resize-only; Mediabunny conversion for edited video | MediaRecorder canvas/captureStream fallback | `bun run test:e2e -- --project=desktop`, focused `MP4 input` smoke |
| Chromium mobile emulation via Playwright | General UI and supported light flows; heavy desktop-only video edit smokes are skipped intentionally | Capability-gated desktop-grade paths when supported | Degraded/unsupported messaging and MediaRecorder where available | `bun run test:e2e` mobile project skips heavy video edit cases |
| Safari / WebKit | Not locally verified in this thread | Only if required WebCodecs/Mediabunny codec capabilities are available | MediaRecorder or unsupported-state UI | Must be tested on a real Safari/WebKit runtime before claiming support |
| Firefox / Gecko | Not locally verified in this thread | Only if required WebCodecs/Mediabunny codec capabilities are available | MediaRecorder or unsupported-state UI | Must be tested on a real Firefox runtime before claiming support |

## Current Video Behavior

- Unedited or resize-only video conversion uses the faster WebCodecs path when supported.
- Edited video with crop, trim, rotation, format change, or audio preservation uses Mediabunny first.
- Audio preservation is covered by E2E for edited WebM input and MP4 output.
- Rotation is baked into the output frames by disabling rotation metadata where Mediabunny supports that option.
- MP4 input is accepted, but in the current headless Chromium fixture the Mediabunny edit path can reject the source video track as `undecodable_source_codec`; the app then falls back cleanly to WebM output through MediaRecorder.

## Known Gaps

- Safari and Firefox are documented as unverified, not passing.
- Codec support varies by browser, operating system, hardware, and precise codec string. MP4 as a container does not guarantee that the contained codec is decodable or encodable by WebCodecs.
- The MediaRecorder fallback is best-effort and degraded. It can be slower, less exact, and more dependent on real-time playback/capture behavior than the Mediabunny/WebCodecs path.
- `caniuse-lite` is stale in local build output; this does not invalidate runtime capability checks, but it should be refreshed separately before release packaging.

## Sources

- MDN WebCodecs API: https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API
- MDN VideoEncoder: https://developer.mozilla.org/en-US/docs/Web/API/VideoEncoder
- MDN MediaRecorder: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder
- MDN MediaRecorder.isTypeSupported: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static
- Mediabunny converting media files: https://mediabunny.dev/guide/converting-media-files
- Mediabunny ConversionVideoOptions: https://mediabunny.dev/api/ConversionVideoOptions
