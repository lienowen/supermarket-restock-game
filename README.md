# Supermarket Restock Game

A Phaser 3 + TypeScript supermarket work-simulation game targeting web portals such as CrazyGames.

## Commands

```bash
npm install
npm run dev
npm run release:check
```

`release:check` builds the game, runs the architecture and gameplay tests, verifies the release bundle, and executes the browser regression gate.

## Controls

- Click or tap the walkable floor to move.
- Use WASD or the arrow keys for direct movement.
- Walk into the configured interaction radius before clicking the highlighted world target or HUD action.
- Cooler stocking uses six explicit shelf hit areas arranged as two glass-door bays × three shelves.

The same navigation system is reused by every gameplay mode.

## Architecture

The active implementation lives under `src/game/` and follows one-directional dependencies:

- `content/` — products, fixtures, missions, shifts, levels, and campaigns
- `application/` — resolves content into validated runtime models, navigation, and controllers
- `systems/` — gameplay rules and state machines
- `presentation/` — Phaser views, mode-specific scenes, shared movement, HUD, and effects
- `assets/` — the canonical asset catalogue and runtime asset registry
- `infrastructure/` — Phaser, browser navigation, storage, and platform bootstrapping

The runtime path is:

```text
content configuration
→ validated mode-specific runtime
→ typed presentation context
→ reusable Phaser scene modules
```

Player movement follows a separate shared path:

```text
level navigation parameters
→ PlayerNavigationController
→ PlayerNavigationView
→ scene proximity gate
```

Scenes do not own level rules or asset paths. Each gameplay system stays isolated while sharing navigation, campaign economy, presentation infrastructure, and the same supermarket world.

## Dynamic levels

Playable levels are configured in `src/game/content/levels/starterMarketLevels.ts` as a typed union:

```ts
mode: "restock" | "checkout" | "clean" | "find-items"
```

Every level references one shift, one mission, a global asset pack, a reusable visual preset, starting economy values, navigation values, and mode-specific tuning.

Current ten-level campaign:

1. `starter-level-001` — First Delivery · cola restock tutorial
2. `starter-level-002` — Promotion Restock · faster water restock
3. `starter-level-003` — Checkout Rush · six customers
4. `starter-level-004` — Spill Patrol · four spills
5. `starter-level-005` — Order Hunt · milk, apple, and cereal
6. `starter-level-006` — Closing Stock Sprint · harder cola rush
7. `starter-level-007` — Evening Checkout · eight customers
8. `starter-level-008` — Closing Clean-up · six spills
9. `starter-level-009` — Priority Order · forty-second item hunt
10. `starter-level-010` — Final Cooler Rush · fastest water restock and two-star finale

The campaign carries coins, stars, reputation, and purchased store upgrades between levels. Replay begins only after Level 10.

Run a specific level locally with:

```text
?level=starter-level-010
```

The legacy `?shift=starter-shift-002` entry remains supported and deterministically selects the first level in that shift.

## Asset ownership

`src/game/assets/starterAssetCatalogue.ts` is the single source of truth for asset keys, paths, dimensions, anchors, depth groups, and production status.

Level configuration stores only asset-pack and visual-preset IDs. Runtime registries resolve those IDs into descriptors and validate that every configured asset exists. Do not place asset paths in scenes or level definitions.

Asset paths must remain under:

```text
public/assets/game/...
```

Reusable assets are action-, product-, fixture-, character-, or environment-owned. They must not be named after a specific day or level.

`src/game/presentation/visual/CoolerStockLayout.ts` is the single owner of cooler shelf positions, item count, bottle crop, and interaction bounds. Do not duplicate those coordinates in scenes or tests.

## Adding another level

1. Add or reuse product, fixture, mission, and shift definitions.
2. Add a typed `LevelDefinition` to `STARTER_MARKET_LEVELS`.
3. Reference registered asset-pack and visual-preset IDs only.
4. Configure movement, duration, quantity, penalties, and rewards in level tuning.
5. Add the level ID to the campaign `levelIds` sequence.
6. Use an existing mode runtime and scene when its rules fit.
7. Add a new mode only when the rule system is genuinely different; do not add level-specific scene copies.
8. Extend unit tests and `scripts/capture-release-regressions.mjs` so the new level is actually completed in a browser.
9. Review the generated initial and completion screenshots.
10. Run `npm run release:check`.

A new level is not accepted because its configuration parses. It must complete through the real browser flow and preserve campaign economy into the following level.
