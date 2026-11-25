# Art direction

Warm, grounded, quiet craftsmanship. A Turkish neighborhood without third-party brand marks: cream/plaster façades, timber shutters, subdued terracotta roofs, striped canvas awnings, modest shop signage and mature green trees. Equipment is ochre/orange and worn dark green. Stone surfaces are tactile gray/sand with terracotta accents. No neon, science fiction, confetti per click or generic placeholder cubes in place of the actual tools.

All models are authored as Three.js geometry in `src/render/models.ts`: beveled double-T pavers, banded multi-layer pallets, cones, barriers, benches, lights, carts, tracked K-48 machine, building trim, shutters, glazing, planter boxes and roof shapes. Material maps are deterministic generated data textures with albedo/bump/roughness variation, not flat-color-only materials. Static material batches and instancing control rendering cost.

Lighting: hemispheric sky, a warm directional sun, tone mapping, local procedural environment contribution and atmospheric distance. Ground textures must remain visible; avoid crushed shadows and washed-out whites. HUD: deep pine panels, cream lettering, amber accents; relatively quiet while placing. TR/EN text should be readable at 1280x720 and 1440x900. No bundled font assets. Reduced motion is respected by CSS; camera bob is opt-in.

Inspect actual browser screenshots at the start, with early paving, with advanced tooling, in the shop, in each level and at job completion. Software-renderer output can validate layout and material errors, not hardware FPS claims. Do not label screenshots as hand-played campaign completion when generated with a development fixture.
