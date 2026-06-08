# Local Removal Support Matrix

Last verified: 2026-06-08.

Maibach Convert treats background, object, and watermark work as local edits for user-owned or authorized media. The original upload stays in app state and conversions render into a new output blob, so reset/download retry can return to the source file.

## Verified Behaviors

| Target | Current tier | Outcome | Evidence |
| --- | --- | --- | --- |
| Static lower-corner image watermark | `local-inpaint` | Degraded pass: deterministic local diffusion inpainting changes the masked pixels, but is not guaranteed to reconstruct the original background | `src/test/localInpainting.test.ts`, `src/test/watermarkCleanup.test.ts`, Playwright `watermark cleanup` pixel smoke |
| Manually selected image cleanup area | `local-inpaint` | Degraded pass: user-selected source area is mapped into the rendered output canvas and inpainted locally | `src/test/localInpainting.test.ts`, `src/test/imageRenderPlan.test.ts`, `src/test/watermarkCleanup.test.ts`, Playwright `watermark cleanup` dialog smoke |
| Freehand image cleanup mask | `local-inpaint` | Degraded pass: user-drawn strokes are rasterized into a brush mask, mapped through crop/resize rendering, and inpainted locally | `src/test/localInpainting.test.ts`, `src/test/imageRenderPlan.test.ts`, `src/test/watermarkCleanup.test.ts`, Playwright `freehand image cleanup` smoke |
| Manually selected video cleanup area | `mask-cleanup` | Degraded pass: selected source area is mapped into the rendered frame and processed through the local frame-render fallback; not a generative moving-logo removal | `src/test/videoConversionPlan.test.ts`, Playwright `video cleanup` smoke |
| Image background | `background-model` | Pass/degraded depending on device and image size; runs in browser via installed `@imgly/background-removal` package and prefers self-hosted model assets | `src/test/localRemovalPlan.test.ts`, `src/test/backgroundRemoval.test.ts`, `src/test/backgroundRemovalAssets.test.ts` |
| Low-end or very large background job | `background-model` | Degraded: allowed, but expected to be slow or visibly imperfect | `src/test/localRemovalPlan.test.ts` |
| Moving logo / moving watermark | `manual-export` | Fail for automatic removal in this slice; must not be marketed as supported | `src/test/localRemovalPlan.test.ts` |

## Product Boundaries

- UI labels use "bereinigen" for watermarks because the current algorithm is deterministic local inpainting, not generative reconstruction or guaranteed removal.
- The app requires an owned/authorized-media assumption in the quality popover copy.
- Private source files are not uploaded by the conversion path.
- The package code for background removal is bundled from the installed npm dependency. Model and WASM assets are expected at `/vendor/background-removal/1.7.0/dist/` and can be installed with `bun run assets:bg-removal`.
- The versioned upstream asset package is `https://staticimgly.com/@imgly/background-removal-data/1.7.0/package.tgz` and was last checked at 284,706,412 bytes. The installed files are intentionally ignored by Git because they are large runtime assets.
- If self-hosted assets are missing, the app falls back to `https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/`. This fallback downloads model/runtime assets only; private source images still stay in the browser conversion path.

## Known Gaps

- Manual object/watermark cleanup exists for images as rectangle and freehand mask modes, both using the local inpainting stage.
- Manual video object/watermark cleanup exists as a rectangle mask in the degraded frame-render export path.
- Automatic tracking/removal for moving video logos does not exist yet.
- No LaMa/BiRefNet/SAM-style model inpainting upgrade has been selected or licensed in this slice.
- Self-hosted background assets are reproducible but not committed; release packaging must run `bun run assets:bg-removal` before claiming offline/warm-cache behavior.
- Mobile/low-end behavior is capability-labeled but still needs visual device QA before any premium-quality claim.
