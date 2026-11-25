# Clear first-person aiming

Implemented on `main` from origin `2b4ba16bca6e7726fef08fd27894efd8150e8b84`.
The current shifted interlocking pavers and kerb cuts are preserved.

## Presentation rules

- The clamp, row attachment, K-48 and final-pass compactor do not have camera-attached machine models. Only the small hand tool remains, lower and smaller on the right; an empty hand is hidden.
- The selected equipment remains identified by its HUD name and icon. Leasing, capacity, reach, placement timing, rotation and job-local resets are unchanged.
- The crosshair has a transparent center, a contrasting dot and an actual work/refill progress ring. Ready, working/partial, blocked, refilling and completed targets have distinct states and localized explanatory text.
- Ground ghosts use `paverPieces` and `paverGeometry`, just like the actual field. They show only the empty cells the next placement can fill with the current inventory, including staggered courses and cut boundary pieces.
- An elevated thin outline shows the working footprint. Final compaction uses the outline only, rather than duplicate stone surfaces which could overlap the completed paving.
- No snapping to another target, automatic placement or money generation was added. Aiming feedback reads the simulation; it never advances it.
- Preview geometry is cached by piece shape, instance uploads occur only when the target/inventory/job changes, and progress only updates appearance. No blur, resolution reduction or postprocessing was introduced.

## Small commits

- `882b08a`: remove obstructing machine viewmodels, retain the hand outside the aim corridor; visibility and projection tests.
- `a3c0ad3`: add read-only work feedback, cached ground preview, reticle and regression tests.
- `4d48f61`: connect the presentation to the existing world/HUD and add an advanced-equipment browser scenario.
- `2360dd7`: update the non-shipping QA aim helper for the newly staggered stone interiors. The old helper targeted a logical-cell boundary on odd courses, and the previous origin already failed its sequential placement browser test. No production aiming rules or test outcome assertions were relaxed.

## Verification

The local strict TypeScript check, 59 tests in 11 files, campaign economy simulations, production build and postbuild checks passed. The production output after the QA-only update is unchanged (cache `088fec91828e37c8`); QA mutation helpers do not ship.

Unit coverage includes visibility for every tool/phase, projected hand bounds, exact preview pieces for all equipment/rotation/stock combinations, no ghost updates on stable frames, empty/refill states, compaction outlines, read-only feedback and stable QA aiming on all grid IDs.

GitHub Actions run `38647676571`, job `116138480481`, completed successfully at tested commit `2360dd742438270ddee5689d1425eedf5c537ea8`. The full seven-scenario browser suite passed, including the new advanced-equipment scenario and the existing placement/shop/refill/save/reload, final compaction/reset, menus and production checks. Verification artifact: `11932339563`. All CI release files match the locally checked build byte-for-byte.

Actual machine and compactor screenshots were downloaded and opened for inspection; the camera-attached bars/bodies no longer cover the target and the ground preview is visible. These are engine captures, not generated concept pictures. The local browser attempt was blocked by the managed execution environment; normal project CI was used for browser tests instead.

The functional browser viewport is 640x400 with SwiftShader software rendering, with a separate High-preset check. Advanced tools and final compaction use explicitly documented save/QA fixtures; placement still uses real mouse input. These tests are not a manual campaign playthrough or a 60 FPS certification.

The procedural mesh generators, grid IDs, economy, save schema, camera movement, textures and rendering resolution settings remain unchanged from the origin snapshot. Existing saves can continue after pulling main and restarting Vite.
