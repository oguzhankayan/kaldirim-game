# Paving color patterns

Implemented on main from origin `5ece3273e7b656a13283c34bc0071d1b8c5913f4`.
Verified code/test commit: `533b5bf60c8c33458e1f79954a60e7f292c2ed2a`.
Evidence: `docs/verification-patterns-2026-10-15.json`.

## Design research and scope

The user's request was to replace the border-only result with deliberately patterned paving, without changing the simple placement game. The structural Double-T bond is not the color design: the existing half-shifted courses, joining heads/pockets and kerb cuts stay intact. These are color inlays built from individual pavers, not an image/decal stretched across the finished ground.

Primary references consulted on 15 October 2026:

- Marshalls Keyblok: its official installation gallery describes buff diamonds with charcoal bands, contrasting triangular bands, circular layouts and geometric panel designs. This informed contrasting inlay motifs and framing. https://www.marshalls.co.uk/landscaping/commercial-paving/products/keyblok-paving
- Tobermore mixed-product constellations: the official design guidance describes light/dark gray combinations and mixing colors/finishes within a stretcher bond. This informed tonal separation without replacing the existing bond. https://www.tobermore.co.uk/professional/constellations/mixed-product-constellations/
- Three.js InstancedMesh documentation: per-instance color is supported independently of the shared material. https://threejs.org/docs/pages/InstancedMesh.html

No manufacturer images, models or copyrighted catalogue layouts are shipped. Our meter-space motif rules are authored for these particular game fields. A chevron color inlay is not represented as a structurally rotated herringbone installation, and this remains a game rather than an engineering installation guide.

## Five fixed plans

| Job | Pattern | Interior design |
|---|---|---|
| Sahil Sokağı | Baklava şeritleri / Diamond bands | Complete repeating terracotta diamonds, charcoal contours, buff centers and linking bands |
| Pazar Meydanı | Meydan göbeği / Plaza medallion | Nested diamonds around the actual fountain island; framed outer panels |
| Çınar Parkı | Park panoları / Garden panels | Natural/buff panels, small terracotta centers and contrasting collars around the actual tree islands |
| Kıyı Yolu | Kıyı zikzağı / Coastal chevrons | Broad repeating charcoal, buff and terracotta chevron bands along the field |
| Eski Mahalle | Sekizgen halı / Octagon carpet | Repeating nested octagonal medallions and a larger central fountain motif |

Natural gray, charcoal, terracotta and buff form the common palette. Small deterministic shade variation preserves stone character without scrambling the motif. Pattern coordinates use meters, including the actual half-course offset, so rectangular cells do not turn equal-sided diamonds into stretched shapes. Island collars use the authoritative grid's actual hole rectangles.

## Gameplay and compatibility

- Colors appear as stones are laid. No manual pigment selection, inventory color puzzle, auto-placement, extra payment or paid unlock is introduced.
- Existing IDs, masks, geometry, physics, dwell timing, reach, economy, capacity, equipment, job resets and save format remain unchanged.
- Existing partial AND completed saves display the new fixed plan on their already placed stones. Their old border-only appearance changes intentionally; their progress does not reset. New and old stones share one plan.
- The ground ghost uses the same planned pigments. Ready/working/blocked status is carried by the outline and reticle, rather than tinting the entire preview green or red.
- Tab opens the work map. Progress shows what is laid; Finished pattern shows the full read-only plan. Both views use the same data. The minimap remains progress-only.
- The completion panel shows the finished pattern card; the next-job buttons name their patterns. TR and EN are supported.
- The map is a schematic. Tree/fountain exclusions stay marked as obstacles. The final-pass sheen is lighter so it does not wash out the finished pigments.

## Implementation and cost

`src/game/patterns.ts` owns the fixed catalogue and cached per-cell tone/shade arrays. It has no renderer or DOM dependency. `src/render/paver-color.ts` supplies cached palette colors to the existing StoneField instance-color buffer and the preview. Colors do not allocate one material/mesh per pigment and do not change spatial chunk keys. Tests count the expected original shape/chunk groups for all five jobs.

Plans are built once per immutable LevelSpec, cached by weak reference. Pattern selection is a constant-time lookup at placement/load, not a per-frame trigonometric field scan. Ghost uploads remain dirty-only. Map rasterization is keyed by grid/placement/compaction/mode. No new external texture, model, shader postprocess, reduced resolution or AI runtime call is required.

## Verification

Local and GitHub Actions `npm run check` pass: strict TypeScript, **67 tests in 13 files**, all five campaign economy simulations and production/postbuild validation. The release is **2.73 MiB raw / 0.96 MiB gzip**, seven shipping assets; the existing Rapier chunk-size warning remains. Release cache: `3220c24165fcf472`.

Main quality-gate run **38652708573**, job **116155090067**: **eight browser tests passed, zero failed**, in 6.3 minutes. This includes the existing seven gameplay scenarios plus the new pattern test: real placement, read-only Progress/Finished pattern toggles, saved gameplay preservation, stable pattern raster after reload and TR/EN labels. The map comparison deliberately excludes only the tiny subpixel player-arrow area; unit tests independently cover every saved cell and border. Functional CI viewport is 640x400 with software rendering, not a GPU benchmark.

Full-HD inspection run **38651354136**, artifact **11934823156**: all five completed jobs and one close-up captured at native **1920x1080**, DPR 1, antialiasing enabled, with zero JavaScript/console errors. All six images were opened and inspected. The development-only fixture uses the actual WorldView, StoneField, paver geometry and procedural materials with completed-job state and an inspection camera. It is deliberately outside the production entry graph, and its global was checked absent from release chunks.

These are engine renders, not concept art, but they are not evidence of a manual campaign playthrough or hardware 60 FPS. No new hardware-performance or temporal-artifact certification is claimed. No live deployment, advertising or store submission was performed.
