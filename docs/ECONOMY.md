# Economy and job-local pacing

## Authoritative prices and compatibility

`src/game/economy.ts`, called by `GameSession.toolPrice/upgradePrice`, supplies both simulation and shop/notification prices. `src/game/content.ts` retains the old base definitions. Revision-1 saves keep their original prices, grids and targeted compaction. Only starting another/new job uses revision 2; an absent revision in old saves is revision 1, never guessed from array length.

New site counts: 11,712; 18,080; 26,776; 32,256; 42,380 valid pavers. Every unique valid stone earns 4/5/6/7/8 labor units respectively. Inventory material is free. Cash, leased tools and upgrades reset only on starting/replaying a job; tab closure retains them. Timed lease fees, debt, energy and material purchases are absent.

## Revised pacing curve

First clamp remains 60 stone wages, so a larger level does not turn the initial hand phase into a long grind. First comfort upgrades remain 12/30/45/40 stone wages for capacity/speed/logistics/reach. Prices are rounded to whole 4-unit increments.

Cumulative base tool investment is approximately 8.5% of total job income through the Row Layer and 40% through K-48. Utility upgrade tiers then scale with that job's gross income. All available purchases together cost approximately 80–95% of the job's total revenue; no hard percentage locks prevent a player prioritizing a tool earlier. Income from a finished site is not transferable to the next leased job. No premium currency or real-money changes are included.

These ratios describe money spent, not elapsed time or a forced purchase order. A person investing in comfort before tools reaches machines later. The test strategy retains early mobile supplies/capacity and reaches K-48 at approximately 40.2–40.6% paving completion. Human tests must still establish whether this is enjoyable, especially travel, aim fatigue and the enlarged later jobs.

## Work invariants

Each stable, reachable paving cycle performs at most one footprint. Merely sweeping targets cannot generate stones or earnings. Existing cells pay zero and do not consume material. New finishing contact follows the player's forward ground point with held input, never the distant crosshair; compaction grants no money and consumes no stones. Completed-site free roam does not advance economy or records.

## Signals, not extra economies

The next affordable equipment tier triggers one unobtrusive notice and soft chime per job. A saved acknowledgement prevents repeats after reload. Menus hide it; purchases invalidate stale notices. Reaching an upgrade threshold is not an automatic purchase. Motif/panel completion provides feedback only: no arbitrary money bonuses, new quests or pattern matching requirements.

## Test evidence versus human time

`tests/campaign.test.ts` still simulates the five original jobs. `tests/craft-polish.test.ts` additionally simulates all five revised jobs with earned income, no money injection, all required finishing patches and revision-specific records/save round trips. Simulation time excludes walking, camera targeting, player decision time and menus; it is neither retention evidence nor a playtime promise. Local playtest reports (F3, then P) include bounded milestone records alongside honest frame intervals and no network transmission.

No live ads, purchases, Steam services, public deployment or monetization claim is introduced by this balancing work.
