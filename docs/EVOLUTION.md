# Craft, progression and clear upgrade signals

Implementation baseline: `ab1a015cb35e81befa9e914ff24261c78b1e41e8` on main.
Verified code/test checkpoint: `1c733eb9f8764247cbcc0d9d584c28d0ae6e73be`.

## Connected changes

- The next leased machine becoming affordable produces a small upper-center notification, outside the crosshair, with its actual price and B shortcut. A subtle sound accompanies it. It never buys, steals pointer lock or pauses the work. Per-job acknowledgement is saved; the same tier is not announced repeatedly on every frame or reload. Equipment takes priority over lower-priority craft feedback. Menus and purchases clear obsolete banners.
- Revision 2 separates an L-shaped sidewalk, open plaza, connected garden paths, promenade with lookout bays and courtyard with garden corners. Each remains one large connected job. Perimeter cuts and curbs, ground preview, actual paver rendering, valid finishing masks and supply-map locations follow the same layout.
- Job-relative prices keep early comforts accessible but distribute large machines through the job rather than exhausting them in the first fifth of later levels. The exact current equations are in ECONOMY.md and src/game/economy.ts.
- Hand/clamp/row-layer/K-48 have different short controlled landing profiles and synthesized impact/work sounds. No camera-attached bulky machine, rigid body per paver, shatter effect, blur or hidden resolution drop is introduced.
- Panel/motif completion supplies coalesced notification and a soft sound, not extra currency or artificial sub-missions. Its completion state is derived from placed stones on reload.
- In revised jobs the final pass follows a ground contact ahead of the player while holding work and walking; distant look direction does not compact distant patches. All actual valid finishing regions are still required; no void garden region can block completion or pay again.
- The final gaps activate the existing marker, which advances when its target is finished. It remains a hint, not auto-placement.
- A skippable camera overview compares before and after at a shared final framing. Reduce Motion uses a fixed after view instead. Results allow replaying the comparison and walking the finished site. Player pose/save data are not the reveal camera state. Free roam does not earn more money or rewrite records.
- F3/P exports bounded local-only milestone diagnostics (affordability, purchases, progress, motifs and completion) alongside frame timings. No identity or network analytics was added.

## Existing saves

Do not wipe a save just to update the game. A snapshot without jobRevision is revision 1. Legacy in-progress or completed jobs retain their exact grid and original price list; notices, presentation and tool feedback still work. New/replayed jobs use revision 2. New best times use id@2 keys so they cannot overwrite old-layout records. Unknown revisions or malformed notice masks are rejected during normal save validation. The envelope and storage key remain version 1.

## Verification completed

Runtime/graphics checkpoint: `c7eda8aa42217ee2bf590cce4697373a375ed695`.
Final code/test checkpoint: `1c733eb9f8764247cbcc0d9d584c28d0ae6e73be`.
Evidence: `docs/verification-evolution-2026-10-15.json`.

Local and GitHub Actions strict TypeScript, **83 unit tests in 17 files**, production build and postbuild checks pass. Both legacy (99,840 valid stones) and revised (131,204) earned-income campaign simulations pass; their timings exclude walking, targeting and human decisions. Separate actual Rapier movement tests verify finishing with upward, horizon and downward pitch and continued movement after completion.

Game quality-gate run **38662670646**, job **116187343436**, passed **all ten browser scenarios**, zero failures. Artifact **11939394520**. These cover the eight previous gameplay/pattern cases plus the earned-money notification, buying, saved acknowledgement, walk-to-compact, before/after, replay/skip, restored tour pose, real free-roam movement and saved completion. Advanced/final stages use explicit fixtures; earning the threshold, buying and moving still use real mouse/keyboard input.

Initial tests exposed a delayed cold-render HUD and a completion view using clamped physics time. Both production issues were fixed. A later dense-horizon SwiftShader test exceeded its movement wall-clock budget. The browser fixture now faces the working surface at the SAME 640x400 viewport; actual Rapier tests independently verify pitch independence. No game resolution was lowered and no requirement to finish the remaining patches was removed. The managed local browser blocked navigation; ordinary authorized repository CI was used without bypassing that policy.

Full-HD run **38661267681**, job **116182829607**, artifact **11939525485**, passed with zero JS/console errors. Seven actual engine captures at **1920x1080**, DPR 1 and antialiasing cover all five revised jobs, close-up paving and a legacy comparison. These use the actual WorldView and a development-only completed-job inspection fixture. All seven images, plus the functional notification and before/after captures, were opened and inspected. They are not generated concept art or a manual campaign playthrough.

The 75 relevant files from the final CI source snapshot match local files. All final browser-tested production files match the local release byte-for-byte. The release has seven assets, **2.75 MiB raw / 0.96 MiB gzip**, cache **d7d66d5de9f826c8**. The existing large Rapier-chunk warning remains; overall size and QA-stripping checks pass.

Remaining release gates: actual target-hardware sustained 60 FPS/frame pacing, human full-campaign pacing and final moving-image/art/audio approval, Safari/Firefox/touch and longer save/offline/context tests. Software rendering and static captures cannot certify hardware FPS or absence of temporal shimmer. No live deployment, store submission, ads or payment integration was performed.
