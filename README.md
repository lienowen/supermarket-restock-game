# Shelf Rush Market

A portrait-first Phaser 3 + TypeScript shelf-sorting game being rebuilt as a commercial web product for portals such as CrazyGames.

The root URL now launches one clear core loop:

> Move the front product between shelf bays, complete groups of three identical products, clear the store, earn stars and coins, and buy permanent store upgrades.

The previous walking, checkout, cleaning, and item-hunt campaign is retained only as legacy reference content. It is not the commercial product direction.

## Run

```bash
npm install
npm run dev
npm run release:check
```

Open the normal root URL for the commercial game.

Useful development entries:

```text
?commercialLevel=1&test=1
?commercialLevel=10&test=1
?level=starter-level-001&test=1
?legacy=1&test=1
```

- `commercialLevel` opens a commercial level directly for testing.
- `starter-level-*` and `legacy=1` open the quarantined previous campaign for regression checks.

## Current commercial vertical slice

The branch `agent/commercial-rebuild-v1` contains:

- One immutable shelf-sort rules engine.
- Ten typed and validated levels.
- Five supported layouts: 2×2, 3×2, 3×3, 4×3, and 3×5.
- Real production product PNGs from the repository asset catalogue.
- Portrait touch and pointer controls at 750×1334 logical pixels.
- Move limits, score, stars, failure, retry, and next-level progression.
- Level select with locked, unlocked, and completed states.
- Versioned profile save with best moves, coins, stars, and unlocked levels.
- CrazyGames Data account storage with one-time migration from the previous local browser save.
- A persistent coin store with three upgrade lines:
  - Bigger Cart: more moves.
  - Smart Scanner: more undo charges.
  - Store Signage: increased coin rewards.
- CrazyGames loading, gameplay, progress, and audio-setting lifecycle integration.
- Unit, architecture, release-bundle, payload, and browser-completion gates.

## Commercial architecture

```text
commercial level data
→ pure ShelfSortEngine
→ versioned player profile and upgrade economy
→ CommercialShelfSortScene
→ Phaser rendering
→ CrazyGames platform/data adapters
```

Gameplay rules do not live in pointer callbacks. The scene translates input into immutable engine actions and renders the returned state.

Main commercial files:

```text
src/game/config/commercial.ts
src/game/systems/shelfSort/ShelfSortEngine.ts
src/game/content/commercial/commercialShelfSortLevels.ts
src/game/application/CommercialProfile.ts
src/game/application/CommercialUpgrades.ts
src/game/presentation/assets/CommercialProductAssets.ts
src/game/presentation/scenes/CommercialShelfSortScene.ts
src/game/infrastructure/browser/BrowserCommercialProfileStore.ts
```

## Level contract

Every commercial level must pass these rules before the game starts:

- Unique level and bay IDs.
- Maximum three products per bay.
- At least one complete bay of working space.
- Every product count divisible by three.
- Target set count equal to actual inventory.
- Valid move limit and rewards.
- A production sprite mapping for every product ID.

A level is not accepted only because its JSON or TypeScript parses. Representative levels must be completed through the real browser flow.

## Save behavior

The commercial profile uses schema migrations instead of silently discarding old progress.

On CrazyGames:

1. Initialize the SDK before gameplay.
2. Read and write through the SDK Data module.
3. If an older local browser profile exists and account data is empty, migrate it once.
4. Continue with in-memory fallback only if storage throws.

Outside CrazyGames, the same profile uses browser `localStorage` with an in-memory fallback.

## Release target

The current ten-level build is a commercial vertical slice, not the final production launch.

The production acceptance target is defined in:

```text
docs/COMMERCIAL_REBUILD_V1.md
```

Major launch requirements include:

- 60 authored and browser-validated levels.
- 30 production product sprites.
- Final shelf artwork, animation, sound effects, music, tutorial guidance, and accessibility polish.
- Daily challenge and retention loop.
- Rewarded and midgame ad implementation that follows portal policy.
- Analytics transport and balancing data review.
- Final portal metadata, screenshots, privacy text, and release package.

## Quality gates

```bash
npm run build
npm test
npm run verify:release
npm run release:check
```

The GitHub UI Audit additionally checks the production bundle in Chromium, measures loading under a mobile network profile, completes Commercial Level 1 through the actual game state, and preserves the legacy ten-level regression suite.
