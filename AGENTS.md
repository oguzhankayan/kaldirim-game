# KALDIRIM — agent contract

Read README.md, GAME_DESIGN.md, ART_DIRECTION.md, docs/ARCHITECTURE.md and docs/STATUS.md before changing the product. Project direction is already decided; do not replace it with a small demo or a business-management simulator.

## Non-negotiable product rules
- Large job from the first minute. Five complete jobs, never a sequence of tiny training levels.
- Money is earned per unique stone during the job. Leased equipment and upgrades reset ONLY when a different/replayed job is started after completion. Closing the page must retain the job.
- Hold-to-work requires a stable reachable footprint and a timed cycle. Sweeping over targets must not paint the ground or grant income. Snap alignment is not auto-targeting.
- All geometry, material maps, environment and tool models are generated with Three.js. All sound is synthesized. No external model/texture/music assets, runtime AI requests or speculative APIs.
- No fake purchases, reward ads, multiplayer, Steam integration or server-side anti-cheat claims.
- Preserve bilingual TR/EN UI, exportable validated saves, pause behavior, keyboard access and reduced-motion settings.

## Engineering
TypeScript strict; game simulation must remain independent of DOM, Three.js and rendering. Rendering may consume simulation results; it cannot mint money. Stable integer grid IDs are the save schema. Do not change IDs or semantics without an explicit migration.

Test changes with `npm run check` and `npm run test:e2e`. The latter requires `npx playwright install --with-deps chromium`; optional `CHROMIUM_PATH` selects a system browser. Inspect generated screenshots, not only exit codes. Distinguish a browser's software-renderer metrics from target hardware performance.

The debug module is dynamically imported only in development with `?qa=1`. It must not appear in any release chunk. `scripts/postbuild.mjs` checks this. E2E setup fixtures are not evidence that an entire campaign was manually played. `tests/campaign.test.ts` exercises the complete economy without injecting money but excludes walking, aiming and decision time.

## Ownership boundaries
`src/game`: authoritative grid/economy/saves. `src/render`: procedural models, renderer views, KCC/input. `src/ui`: DOM interface and translation. `src/audio`: synthesis. `src/platform`: optional portal lifecycle. `src/dev`: non-shipping QA. Prefer separate worktrees for parallel writers. Never let two agents alter save schema or the tick contract independently.

## Verification and honesty
Do not label code "production ready" solely because a build passes. Preserve dependency lockfile and legal notices. Record exact tests run and open release-validation items in docs/STATUS.md. Do not publish this private repo, add billing credentials, insert ad SDKs into the standalone build, or deploy to a paid/public service without an explicit request.
