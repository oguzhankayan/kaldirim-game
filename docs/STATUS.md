# KALDIRIM — current main checkpoint

Updated: 2026-11-25. Branch: **main**.
Baseline: `ab1a015cb35e81befa9e914ff24261c78b1e41e8`.
Runtime/graphics: `c7eda8aa42217ee2bf590cce4697373a375ed695`.
Verified code/test: `1c733eb9f8764247cbcc0d9d584c28d0ae6e73be`.
Details: `docs/EVOLUTION.md`, `docs/ECONOMY.md`, `docs/verification-evolution-2026-10-15.json`.

## Implemented and connected

- A small passive upper-center banner and short chime announce the next affordable machine, with its actual price and B shortcut. Once per equipment per job, acknowledged in the save; not an automatic purchase. It clears on menus/purchases and does not block the crosshair or capture input.
- New jobs keep the first clamp at 60 stone wages and early comfort upgrades accessible. Bigger machines and later upgrades scale with job income. The earned-income test strategy reaches K-48 at about 40.2–40.6% paving completion, not in the first few percent. These are placement percentages, not human playtime.
- Five revised connected large jobs: L-shaped sidewalk (11,712), open plaza (18,080), garden paths (26,776), promenade with bays (32,256), courtyard with garden corners (42,380 valid stones). Surfaces, kerbs, boundary cuts, preview and supply markers follow the same masks.
- Distinct short tool landing motions, synthesized impact/work sounds, bounded motif/panel completion feedback and an advancing last-gap hint. No bulky camera-mounted machines, shatter effects, extra currencies or automatic paving were added.
- Revision-2 compaction follows the contact just ahead of a walking player holding work, not a remote crosshair. Only actual valid finishing patches count; every required patch must be done and compaction pays nothing.
- Skippable before/after overview, fixed reduced-motion after view, results and free roam. The reveal cannot overwrite player pose; finished-site exploration cannot earn extra money or rewrite recorded time.
- Local-only, bounded milestone diagnostics in the existing F3/P report. No identity, network telemetry or runtime AI.

## Existing saves are preserved

A missing jobRevision means revision 1. Existing jobs keep their exact layouts, old prices and targeted compaction, with new notification/audio/presentation features. Starting the next or replayed job uses revision 2. New best-time keys use id@2; unknown revisions and malformed notification masks are rejected. The save envelope and storage key remain version 1. Do not wipe an existing save to install this update.

Earlier interlocking pavers, five patterns, clear machine aiming, stable hold-to-work, earned income, job-local resets, TR/EN, pause, portable saves, cached batches/shadows and reduced motion are retained. No hidden resolution drop or distant automatic target selection was introduced.

## Verified

Local check and Actions **38662670646**, job **116187343436**, passed strict TypeScript, **83 unit tests in 17 files**, production/postbuild and **all ten browser scenarios**, zero failed. Artifact **11939394520**. Legacy and revised campaign simulations use earned money; actual Rapier tests separately check walking/finishing at multiple pitches. Functional browser tests use 640x400 Chromium/SwiftShader and explicit advanced/final fixtures, not a manually played campaign. Actual notification and before/after screenshots were inspected.

HD inspection **38661267681**, job **116182829607**, artifact **11939525485**, passed: seven real engine captures at 1920x1080, DPR 1, antialiasing and zero JS/console errors. Five new layouts, close-up pavers and a legacy comparison were inspected. Completed WorldView fixtures are development-only. No concept picture replaces engine evidence.

75 relevant source files match the final downloaded CI snapshot. Every browser-tested release file matches the local build. Budget: seven assets, **2.75 MiB raw / 0.96 MiB gzip**, cache **d7d66d5de9f826c8**. The existing Rapier chunk warning remains; total-size and debug-stripping checks pass. The initial cold-HUD and reveal-clock fixes and the software-renderer test adjustment are documented in EVOLUTION.md.

## Still open before commercial release

1. Actual supported hardware sustained 60 FPS, frame pacing and temporal artifacts at named presets/resolutions. SwiftShader was slow facing a complete dense site; software timing cannot certify or refute target-GPU performance.
2. Human full-campaign balance, repetition, enlarged late jobs, continuous finishing and final moving-image/art/audio approval. Local logs are a test aid, not already collected human retention evidence.
3. Safari/Firefox/touch and extended save/offline/update/context-restoration testing. The stale-tab guard remains optimistic, not an atomic multi-tab transaction.
4. Real distribution/commercial acceptance, ads/purchases, Steamworks and store configuration. The standalone Spacefast deployment is live, but no store or commercial submission was performed.

## Local handoff

Preserve local edits before pulling; never force-reset another agent's changes.

```sh
git pull --ff-only origin main
npm ci
npm run dev
```

Continue the existing job to see the new HUD/audio. The next job uses the new layout, prices and walking final pass. Tab switches Progress / Finished pattern. Completion offers before/after and free roam. F3 then P exports frame timings and local progress milestones. Validate the production preset on actual hardware with npm run check and npm run preview before certifying 60 FPS.

AIMING.md, PATTERNS.md and earlier verification JSON files describe their historical checkpoints. Recovery branches are preserved. Continue small commits and report exact evidence, not a claim that passing tests alone make a commercially finished game.

## CrazyGames release track — 2026-11-14

Decided with the owner: free browser release on CrazyGames to measure, Steam premium later if Basic Launch metrics pass (avg playtime 15+ min, D1 15%+, first-job completion 25%+). Desktop only. All five jobs free.

Implemented (`npm run build:crazygames`, `.env.crazygames`):
- Midgame ad only when moving to another job. CrazyGames forbids ads on navigation (menu, settings, shop, resume), and the SDK enforces its own 3-minute interval. No rewarded ads. Standalone build loads no SDK.
- SDK `muteAudio` overrides in-game volume. P pauses alongside Esc (Escape also leaves portal fullscreen).
- Anonymous funnel counter `services/events` (Cloudflare Worker + D1, `kaldirim-events.creativefactory.tr`): daily counts of first-open, job-start, job-complete, tool-leased; each event once per device; no identifiers or IPs. Privacy page at `/privacy`, linked from the home screen in the portal build.
- English is the default language (CrazyGames requires English); Turkish in Settings. Name: Kaldırım: Paving Simulator.
- Web Locks: only one tab owns the save; a second tab cannot play or write.
- Store covers in `marketing/crazygames/` (1920x1080, 800x1200, 800x800; title only).

Verified here: strict TypeScript, 83 unit tests (with `--testTimeout=30000` because the machine was under heavy unrelated load), production and portal builds (0.97 MiB gzip). Counter endpoint tested live (204 / 400 / privacy 200).

Not verified: browser E2E on this machine (Playwright browser download stalled), real-hardware 60 FPS, Safari/Firefox, the portal SDK inside CrazyGames' QA tool, and the 15–20 s preview videos (still to record).

## Standalone Spacefast deployment - 2026-11-25

Deployed the standalone build at owner request. Live: https://kaldirim.space.fast/ . Space `spc_358afb66fa474b819b393dc97bfa3343`, live version `ver_5777ff18e58c494ebd34eabe1c036bc3` (`v2`), immutable URL https://kaldirim--v2.space.fast/ . Source commit `10cc472f2b97121b4d53769d0742d483da1fd82c`; the working tree also contained untracked CrazyGames preview videos that are not part of the web build. No Spacefast credential is stored in this repository.

Verified before upload: `npm run check` passed strict TypeScript, 83 unit tests in 17 files, production build and postbuild. Output: seven assets, 2.75 MiB raw / 0.97 MiB gzip, cache `7d81f2738a725168`.

Verified after upload: Spacefast API reports version `v2` ready and the live channel pointing at it. Keyless HTTPS returned 200 for `/`, the hashed entry JavaScript, manifest and service worker. The first version exposed Spacefast's default client-side platform beacon; version 2 republished the same files with `superpowers.enabled=false` and `disable_all_injection=true`. The root HTML is again byte-identical in size to `dist/index.html` and contains no Spacefast injection marker. A fresh headless Chrome/SwiftShader pass at 1280x800 rendered the home screen, loaded two canvases and the service worker, and reported no page errors, failed requests or bad responses. Clicking Start paving reached the designed pause fallback because headless Chrome blocks pointer lock. Remaining browser warnings are the platform's deprecated `document-domain` Permissions-Policy feature, Three.js initialization deprecation, and SwiftShader ReadPixels performance notices.

Not verified here: real-hardware 60 FPS, Safari/Firefox/touch, long offline/update behavior, human campaign balance, and store/commercial acceptance.

## Standalone Turkish default and Birdoku invitation - 2026-11-25

Deployed at owner request as Spacefast version `ver_70da4baf8e484573bcb5b84a17fba068` (`v3`), immutable URL https://kaldirim--v3.space.fast/ . Live remains https://kaldirim.space.fast/ . Spacefast still publishes with `superpowers.enabled=false` and `disable_all_injection=true`; no credential is stored in this repository.

Implemented: standalone first-open defaults to Turkish while the CrazyGames mode keeps English as its default. Static standalone metadata and boot copy are Turkish, with a Vite HTML transform preserving the portal build's English metadata. Production standalone sessions show a once-per-browser Birdoku invitation with the real app icon, Turkish or English copy, a close button and the App Store link `id6834830537`. The invitation is compiled out of the CrazyGames bundle.

Verified before upload: `npm run check` passed strict TypeScript, **86 unit tests in 18 files**, production build and postbuild. Output: eight assets, **2.76 MiB raw / 0.97 MiB gzip**, cache `cb56359db39a5e59`. `npm run build:crazygames` also passed; its HTML remained English and the Birdoku invitation was absent from the portal bundle.

Verified after upload: the publish receipt reported `activation.outcome=activated` for v3. Keyless HTTPS returned 200 for `/`, `/birdoku-icon.webp`, `/manifest.webmanifest`, `/sw.js` and the hashed entry JavaScript. Live root HTML is Turkish and no Spacefast injection marker was present. A fresh headless Chrome pass at 1280x800 rendered and visually inspected `artifacts/live-birdoku-popup.png`: the Turkish dialog, real 256 px icon, close button and `Hemen indir` link to the Turkish App Store URL were present. There were no page errors or failed requests. Clicking close hid the dialog (`display: none`).

Not verified here: the full ten-scenario browser E2E suite. It was first blocked by the missing Playwright Chromium binary, then stopped at the owner's instruction after slow local software-renderer attempts. Real-hardware 60 FPS, Safari/Firefox/touch, long offline/update behavior, human campaign balance, and store/commercial acceptance remain open.
