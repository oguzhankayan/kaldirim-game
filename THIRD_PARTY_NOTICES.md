# Third-party notices and reference research

## Runtime dependencies
- Three.js 0.180.0 — MIT, mrdoob and contributors. Includes imported official add-ons (RoundedBoxGeometry, BufferGeometryUtils, RoomEnvironment). License is included in `public/legal/THREE-LICENSE.txt` and the built game.
- Rapier 3D compatibility package 0.19.0 — Apache-2.0, Dimforge. License text is included in `public/legal/RAPIER-LICENSE.txt` and the built game.
- Vite/TypeScript, Vitest and Playwright are build/test tools, governed by their respective MIT/Apache licenses. Exact transitive package versions are in package-lock.json.

## GitHub examples inspected
- https://github.com/mrdoob/three.js/blob/dev/examples/games_fps.html — official first-person interaction example and rendering structure (MIT).
- https://github.com/mrdoob/three.js — instancing, environment and geometry utilities (MIT).
- https://github.com/rushindrasinha/operation-blackout — procedural Three.js/Rapier first-person project and architecture. Studied as a code-only art/system reference; no gameplay files or military assets copied into KALDIRIM.
- https://github.com/dimforge/rapier.js — JavaScript/WASM physics integration (Apache-2.0).

Documentation used: https://threejs.org/docs/ , https://rapier.rs/docs/user_guides/javascript/character_controller/ , https://docs.crazygames.com/sdk/ . Repository code is not automatically reusable just because it is public. No proprietary game models, textures, music, levels or extracted commercial assets are included. KALDIRIM-specific models, UI, audio and simulation were authored for this project.
