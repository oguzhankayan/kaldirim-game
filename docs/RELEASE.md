# Release acceptance — not a claim that these checks already passed

## Non-negotiable graphics goal

The requested target is sustained 60 FPS during ordinary gameplay without visible texture pixelation, shadow flicker, z-fighting or perceptible frame hitches. Hardware, browser, resolution and graphics preset must accompany any performance claim. A successful build, a screenshot or software-rendered CI run does not establish this.

Start with desktop at 1920x1080, browser zoom 100%, hardware acceleration enabled, High preset, AC power, foreground tab and a display running at least 60 Hz. Record the exact machine/GPU, OS/browser versions, devicePixelRatio and actual drawing-buffer size. This is a test configuration, NOT a verified minimum-system specification.

For each scene: warm up, record at least 60 seconds, then repeat after ten minutes of play. Cover the first job with hand placement; a nearly completed fifth job with the K-48; walking while turning; refill, purchase and automatic save; final compaction; job transition; returning after focus loss. Loading screens/transitions must be measured separately and never silently removed from reports.

Use F3 and P in the game for a rolling raw frame-interval report. Also capture a browser performance trace for a longer record. The strict presentation budget is 1000/60 ms; report actual percentiles, worst interval and >33ms hitches. Account for small timer/vsync measurement jitter explicitly rather than labelling 59.9 or a good average as a hard 60-minimum pass. Do not certify from fewer than 120 samples or from SwiftShader/llvmpipe. CPU submit time is not GPU execution time.

No automatic below-native-CSS resolution or blur is used to conceal a failure. High uses up to DPR 2, Medium up to 1.5, Low up to 1. Native physical-pixel matching on higher-DPR displays is not promised. Antialiasing is requested and the actual context attribute is reported; it is not universally guaranteed by every browser/driver.

## Visual inspection

Check High at 1080p and on a Retina display, still and while moving. Inspect near stone bevels, oblique road textures, distant thin objects, shop signs, shadow edges, tool/ground separation and completing a dense area. Reload the same save and verify colors are stable. Move between all five jobs and watch for disappearing chunks or stale shadows. Inspect at 16:9, 16:10 and ultrawide; verify menu scrolling and readable text at 1280x720.

Inspect actual output, not only screenshot file existence. Static screenshots cannot prove the absence of shimmer or stutter. Current artwork is procedural/stylized; photorealism is not an acceptance claim. No shatter/destruction effect is part of paving gameplay.

## Functionality and durability

- Run `npm ci`, `npm run check`, `npx playwright install --with-deps chromium`, `npm run test:e2e`.
- The E2E functional preset is Low on CPU-rendered CI; the separate high-quality test checks real context AA, render scale and captures High screenshots. Use `GPU_MODE=hardware npm run test:e2e` only on an actual accelerated test machine, and still perform the longer performance trace.
- Manually finish a complete job, without fixtures, and verify progression pacing and job-local resets. The economy simulation excludes walking, aiming and player decisions.
- Check import/export, corrupt primary with valid backup, quota errors and two open tabs. Export before deleting or replacing a save.
- Check actual touch devices, audio, Safari/Firefox, resize and WebGL context restoration. Desktop is the primary target; untested mobile hardware is not covered by a performance promise.
- Verify service-worker first-load/offline/update behavior and actual portal lifecycle before any public release.

## Commercial work still separate

No real ad inventory, payment flow, Steamworks/App ID, store page, achievements service or revenue measurement is configured. A browser build is not a portal acceptance or Steam release. Choose distribution terms, complete the relevant SDK review, and produce approved store screenshots/trailer before launch. Do not publish the private repository or deploy a paid/public service without approval.
