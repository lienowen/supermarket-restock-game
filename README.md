# Supermarket Restock Game

A Phaser 3 + TypeScript supermarket work-simulation game targeting web portals such as CrazyGames.

## Commands

```bash
npm install
npm run dev
npm run release:check
```

`release:check` builds the game, runs the architecture and gameplay tests, and verifies the release bundle.

## Architecture

The active implementation lives under `src/game/` and follows one-directional dependencies:

- `content/` — products, fixtures, missions, shifts, levels, and campaigns
- `application/` — resolves content into validated runtime models and controllers
- `systems/` — gameplay rules and state machines
- `presentation/` — Phaser views, mode-specific scenes, shared HUD, and effects
- `assets/` — the canonical asset catalogue and runtime asset registry
- `infrastructure/` — Phaser, browser navigation, and platform bootstrapping

The runtime path is:

```text
content configuration
→ validated mode-specific runtime
→ typed presentation context
→ reusable Phaser scene modules
```

Scenes do not own level rules or asset paths. Restock and checkout rules stay in separate systems while sharing presentation infrastructure.

## Dynamic levels

Playable levels are configured in `src/game/content/starterMarket.ts` as a typed union:

```ts
mode: "restock" | "checkout"
```

Every level references one shift, one mission, canonical asset keys, starting economy values, and mode-specific tuning.

Current campaign sequence:

- `starter-level-001` — cola restock
- `starter-level-002` — water promotion restock
- `starter-level-003` — checkout rush

Run a specific level locally with:

```text
?level=starter-level-003
```

The older `?shift=starter-shift-002` entry remains supported and deterministically selects the first level in that shift.

## Asset ownership

`src/game/assets/starterAssetCatalogue.ts` is the single source of truth for asset keys, paths, dimensions, anchors, depth groups, and production status.

Level configuration stores only asset keys. `RuntimeAssetRegistry` resolves those keys into descriptors and validates that every configured asset exists. Do not place asset paths in scenes or level definitions.

Asset paths must remain under:

```text
public/assets/game/...
```

Reusable assets are action-, product-, fixture-, character-, or environment-owned. They must not be named after a specific day or level.

A procedural presentation component is allowed when production artwork is not ready, but it must remain isolated in a reusable view so it can later be replaced without changing gameplay rules.

## Adding another level

1. Add or reuse the product, fixture, mission, shift, and asset definitions.
2. Add a typed `LevelDefinition` to `STARTER_MARKET_LEVELS`.
3. Reference only keys already present in `STARTER_ASSET_CATALOGUE`.
4. Add the level ID to the campaign `levelIds` sequence.
5. Use an existing mode runtime and scene when its rules fit.
6. Add a new mode only when the rule system is genuinely different; do not add day-specific scene copies.
7. Run `npm run release:check`.

Another restock or checkout level should require content and tuning changes, not copied rules or copied scenes.
