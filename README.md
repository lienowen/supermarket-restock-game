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
- `application/` — resolves content into validated runtime models
- `systems/` — gameplay rules and state machines
- `presentation/` — Phaser views, scenes, HUD, and effects
- `assets/` — the canonical asset catalogue and runtime asset registry
- `infrastructure/` — Phaser and platform bootstrapping

Scenes do not own level rules or asset paths. They consume a validated presentation context.

## Dynamic levels

Playable levels are configured in `src/game/content/starterMarket.ts`.

Each level references:

- one shift and one mission
- canonical asset keys
- initial coins
- fixture slot count
- reward progression ratio
- movement and interaction timing

Example level IDs:

- `starter-level-001`
- `starter-level-002`

Run a specific level locally with:

```text
?level=starter-level-002
```

The older `?shift=starter-shift-002` entry remains supported for compatibility.

## Asset ownership

`src/game/assets/starterAssetCatalogue.ts` is the single source of truth for asset keys, paths, dimensions, anchors, depth groups, and production status.

Level configuration stores only asset keys. `RuntimeAssetRegistry` resolves those keys into descriptors and validates that every configured asset exists. Do not place asset paths in scenes or level definitions.

Asset paths must remain under:

```text
public/assets/game/...
```

Reusable assets are action-, product-, fixture-, or environment-owned. They must not be named after a specific day or level.

## Adding a restock level

1. Add or reuse product, fixture, and mission definitions.
2. Add a `LevelDefinition` to `STARTER_MARKET_LEVELS`.
3. Reference only keys already present in `STARTER_ASSET_CATALOGUE`.
4. Add the level ID to the campaign `levelIds` sequence.
5. Run `npm run release:check`.

No scene changes should be required for another restock level using the same presentation modules.
