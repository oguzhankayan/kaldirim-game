# KALDIRIM — accepted game design

## Promise
A familiar everyday job, not a fantasy world: a whole paving site, huge from minute one. One stone becomes a group, then a machine-scale operation. The satisfying loop is a correct physical placement, a growing finished surface, and a capability upgrade earned while still inside the same job.

## Campaign
New revision-2 jobs grow from 11,712 to 42,380 valid cells with an elbow sidewalk, open plaza, connected park paths, promenade lookouts and a clipped-corner courtyard. Revision-1 saves retain their original 10,000–32,280-cell jobs and price list. A single active job is retained. No artificial mission boundaries inside it. Every unique stone pays its posted unit labor value. All stones are provided by the job; no inventory bankruptcy. Final compaction is free and grants no duplicate paving income. Every valid finishing patch must be covered. Completion records mastery and time, then offers a new, larger site. Replaying or moving on creates a fresh job with starting inventory, zero money, hand tool, zero upgrades. Meta progress persists. Closing the browser never triggers that reset.

## Placement contract
The center of the camera selects a nearby ground cell. Small alignment differences snap to its grid slot. There is no search for distant empty cells and no income on merely crossing a target. Continuous input must remain on the same footprint for the tool's dwell duration. Release, lost reach, pause, tool/rotation changes or targeting a different footprint cancel accumulated work. One cycle processes one footprint, limited by carried inventory. Already occupied cells cannot consume inventory or pay again. Empty/edge fragments stay repairable by smaller tools or partial larger groups; the job cannot become unwinnable.

## Progression
Hand -> 3x2 clamp -> 6x3 row layer -> 8x6 K-48. Tool changes are meaningful increases in area, not just numeric speed bonuses. Optional upgrades: capacity, mechanism speed, mobile supplies/refill speed, working reach, powered footprint guide. Equipment is job-local leased equipment, not a permanent personal garage. No maintenance bills or timer-based rent. No premium currency, lives, energy, runtime AI, business staff or logistics spreadsheet.

## Controls and comfort
Hold-to-work reduces repetitive clicking without auto-targeting. First-person camera has no mandatory head bob; subtle camera motion can be toggled. No forced time pressure. Pause on Escape, focus loss or document visibility change. FOV, sensitivity, vertical inversion, volume, ambient audio and quality settings persist. Help points to the nearest actual remaining work and never silently finishes it.

## World and ending
Keep the street familiar: warm neighborhood façades, shop awnings, curbs, roadside supply pallets, greenery and familiar municipal equipment. Jobs vary in overall size, border/pattern treatment, tree islands and coastal setting. The last job completes the campaign; previously unlocked jobs remain replayable and recorded achievements stay in the craft journal.

## Out of scope for this code version
Business management, NPC economies, multiplayer, live leaderboard, payment processing, Steamworks, and fake live ad rewards. Preparation is a pre-graded site, not a separate earthworks/minute-by-minute construction certification simulator. All 3D visuals remain procedural Three.js rather than external AI-generated meshes.

## October 2026 craft and pacing pass

`GameSession.newJob` is the only factory for new campaign jobs; the legacy constructor defaults to revision 1 for old fixtures and explicit compatibility. Snapshots carry optional `jobRevision` (missing means 1) and a validated job-local equipment notice mask. Never silently regenerate an existing site. Price lookup is centralized in `src/game/economy.ts`, and new shop prices scale with job income rather than finishing all upgrades in the first fifth of later jobs.

Affordable-next-tool notifications are passive, once per equipment per job, saved across reloads and shown only during active paving. They never buy equipment, capture the pointer or cover the aiming corridor. Craft panels issue bounded/coalesced feedback without extra currency or sub-missions. Tools use distinct bounded landing motions and synthesized audio; the camera remains clear.

In revision 2 the final pass is driven by the contact point immediately in front of the player, independent of vertical aim. Continuous work can carry between adjacent finishing patches; paving still requires a stable footprint. Empty landscape patches cannot block completion. The last-gap marker follows the next unfinished location; it never completes work.

Completion has a skippable before/after overview. Reduced-motion mode uses a static after view. Saved progress and player pose are independent of the reveal camera. Free roaming the finished site permits walking/photos but grants no more money, stones or records. Per-layout best-time keys avoid comparing legacy and modern jobs. Local F3/P playtest milestones are bounded RAM diagnostics, not uploaded analytics or representative human playtesting.
