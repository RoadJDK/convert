# Local Removal Support Matrix

Last verified: 2026-06-08.

Maibach Convert treats background, object, and watermark work as local edits for user-owned or authorized media. The original upload stays in app state and conversions render into a new output blob, so reset/download retry can return to the source file.

## Verified Behaviors

| Target | Current tier | Outcome | Evidence |
| --- | --- | --- | --- |
| Static lower-corner image watermark | `mask-cleanup` | Degraded pass: local copy/blur repair changes the masked pixels, but is not guaranteed to reconstruct the original background | `src/test/watermarkCleanup.test.ts`, Playwright `watermark cleanup` pixel smoke |
| Image background | `background-model` | Pass/degraded depending on device and image size; runs in browser via installed `@imgly/background-removal` package | `src/test/localRemovalPlan.test.ts`, `src/test/backgroundRemoval.test.ts` |
| Low-end or very large background job | `background-model` | Degraded: allowed, but expected to be slow or visibly imperfect | `src/test/localRemovalPlan.test.ts` |
| Moving logo / moving watermark | `manual-export` | Fail for automatic removal in this slice; must not be marketed as supported | `src/test/localRemovalPlan.test.ts` |

## Product Boundaries

- UI labels use "bereinigen" for watermarks because the current algorithm is not real generative inpainting.
- The app requires an owned/authorized-media assumption in the quality popover copy.
- Private source files are not uploaded by the conversion path.
- The package code for background removal is bundled from the installed npm dependency. Model and WASM assets are still fetched from the configured `publicPath` on first use, then browser-cached; self-hosting those assets remains a release-hardening task.

## Known Gaps

- No freehand object mask UI exists yet.
- No video watermark/object removal exists yet.
- No LaMa/BiRefNet/SAM-style inpainting upgrade has been selected or licensed in this slice.
- Mobile/low-end behavior is capability-labeled but still needs visual device QA before any premium-quality claim.
