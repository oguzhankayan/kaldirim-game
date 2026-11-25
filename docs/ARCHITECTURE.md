# Architecture and maintenance

## Runtime

`src/main.ts` owns the application lifecycle. `GameSession` is authoritative for money, inventory, upgrades and phase transitions. `PavingGrid` owns stable row-major cell IDs, valid-cell masks, footprints and final-compaction patches. Neither imports Three.js or the DOM. Do not grant money in rendering callbacks.

The simulation runs fixed 1/60-second steps with bounded catch-up. Each work cycle requires a stable, reachable target. `Player` uses Rapier's kinematic character controller. The camera interpolates fixed-step translation and applies current look angles on display frames. Frame presentation metrics use the UNCLAMPED requestAnimationFrame interval, independently of simulation catch-up.

## Rendering

All scene geometry and textures are authored in code. `models.ts` defines the prop/tool vocabulary. `materials.ts` owns cached materials, deterministic texture generation and signage textures. Mipmapped linear filtering and hardware-bounded anisotropy are used. `WorldView` owns a job's props, hints, previews and finishing overlays.

`StoneField` divides the job into 16x16-cell instance batches. Each batch has a fixed spatial bound and at most 256 stones. Only changed matrices/colors are marked for upload. Paving is immutable after placement except for a short vertical landing animation. No rigid body per stone is created. Cell colors are seeded by stable ID, not placement order; loading a save cannot recolor the job.

Static props are merged by material. Sun shadows are soft PCF and cached. Invalidate `renderer.shadowMap.needsUpdate` whenever the job, shadow-casting prop visibility, lighting or graphics quality changes. Animated foliage or moving world machines cannot be added without revisiting this cache policy. Ground pavers receive shadows but do not cast a second full-scene shadow pass.

The first-person tool is a separate render pass with an independent camera, so it does not clip into the ground. Materials are shared; generated geometries and per-job instances are disposed when the job changes. `WorksiteMap` rasterizes grid state only after a cell/patch mutation and then draws a player marker on the cached map.

## Input and menus

Only active gameplay captures gameplay keys. Menus retain Tab, Enter, Space, arrow keys and standard browser shortcuts. The overlay traps focus and returns to the originating menu. Focus loss, pointer-lock loss and hidden tabs clear held input. Settings rerenders restore the active setting's focus.

## Persistence

`SaveStore` reads a versioned, checksummed envelope. It validates the complete payload before it becomes a session. A previous valid save is retained as a best-effort backup. Settings have a separate storage key so changing preferences at the title screen works without creating a campaign save.

Ordinary stale-tab writes are rejected when the stored primary differs from the value last observed by that SaveStore. This is not an atomic cross-tab transaction protocol; simultaneous adversarial writes are out of scope. Never describe checksum/localStorage as anti-cheat or server backup. Periodic saves are scheduled for an idle opportunity; pause/pagehide saves flush synchronously. Save failure is visible and export remains available.

## Verification and release

`npm run check` runs strict types, unit tests, full-economy simulation and the production build. The postbuild step checks size and rejects leaked development mutation helpers. `npm run test:e2e` checks real key/mouse input plus explicitly labeled fixture-based setup. CI defaults to CPU-rendered Chromium for functionality; this cannot certify 60 FPS on a real GPU.

During local play, F3 displays rolling average FPS, P95/P99 frame interval, worst interval, >33ms intervals, CPU submit time, draw calls and render scale. Press P while that panel is enabled to export diagnostics. There is no dynamic-resolution controller or sub-CSS-pixel scale hidden behind a performance target.

`src/dev/qa.ts` is imported only under DEV with `?qa=1`. Production has no global campaign mutation helper. Standalone has no live ads or payment processing. Portal lifecycle support is isolated under `src/platform`; store submission, paid services and deployment need explicit authorization.

See RELEASE.md for the remaining acceptance process and STATUS.md for the exact verified commit/results. Preserve the recovery branch; commit small coherent changes directly to the implementation branch.
