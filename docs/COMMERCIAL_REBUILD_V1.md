# Shelf Rush Market — Commercial Rebuild V1

## 1. Product decision

This repository is no longer treated as a collection of unrelated supermarket minigames.

The commercial product has one primary loop:

> Select the front product from one shelf bay, move it to an open bay, complete groups of three identical products, clear the shelf, earn rewards, and grow the store.

The working product name is **Shelf Rush Market**.

The old walking, checkout, cleaning, and item-hunt modes are legacy experiments. Their assets, platform adapter, navigation utilities, and storage code may be reused, but they cannot define the main player experience.

## 2. Target player experience

- Device target: desktop browser and mobile browser.
- Primary game canvas: portrait 750 × 1334 logical pixels.
- Session target: 5–15 minutes.
- First-day target: at least 20 minutes of meaningful play.
- Interaction: pointer/touch first; keyboard remains optional where useful.
- Tutorial: the first three levels teach selection, movement, group clearing, undo, failure, and rewards without a text wall.
- Difficulty: readable early levels, then controlled increases in product variety, filled bays, move limits, blockers, and special shelf rules.

## 3. Launch content contract

A production launch is not accepted until it contains:

- 60 authored and browser-completed campaign levels.
- 30 production product sprites.
- Five supported shelf layouts: 2×2, 3×2, 3×3, 4×3, and 3×5.
- Three tutorial levels.
- At least one daily challenge ruleset.
- Store upgrade progression with visible effects.
- Persistent settings and progression save.
- Sound effects, music, mute support, pause/resume handling, and offline-safe fallback.
- English copy reviewed for portal release; localization keys must be used instead of scene-owned strings before adding another language.

The first vertical slice contains ten typed levels and proves the complete shelf-sort loop before the remaining campaign is authored.

## 4. Core rules

Each shelf bay contains three visible product positions. The last configured item is the movable front product.

A valid move:

1. Starts from a non-empty, unlocked source bay.
2. Ends in a non-full, unlocked destination bay.
3. Moves exactly one front product.
4. Clears the destination when it contains three identical products.
5. Increments move count and score.
6. Completes only when the full product inventory is cleared and the target set count is reached.

A level definition must satisfy all of the following:

- Unique level ID and bay IDs.
- No bay exceeds three products.
- Product inventory for every product is divisible by three.
- At least one full bay of working space is available.
- Configured target set count matches the actual inventory.
- Move limit and rewards are valid.

## 5. Commercial progression

### Campaign

- Levels unlock in order.
- Stars are based on move efficiency.
- Coins buy store upgrades and optional cosmetic progression.
- Difficulty must be tuned from real completion data, not only generated board complexity.

### Store meta

The store is the long-term reward layer, not a second unrelated game.

Approved upgrade families:

- Shelf appearance and capacity presentation.
- Store lighting and decoration.
- Product category unlocks.
- Helper tools such as one undo, one temporary extra bay, or a hint.
- Daily challenge reward multiplier.

Upgrades must not make normal levels unwinnable without spending.

## 6. Monetization policy

Rewarded ads are opt-in and may be offered for:

- One revive after a failed level.
- Doubling a completed-level coin reward.
- Opening one bonus order or daily reward.

Interstitial rules:

- Never during active gameplay.
- Never after every level.
- At least two completed levels between eligible interstitials.
- At least 180 seconds between interstitials.
- No forced interstitial during the first tutorial session.

Purchases remain disabled for the initial CrazyGames release unless a supported platform and a real economy design are approved.

## 7. Required analytics

The platform boundary must support these events:

- `game_boot`
- `tutorial_start`
- `tutorial_complete`
- `level_start`
- `level_complete`
- `level_fail`
- `level_retry`
- `rewarded_offer`
- `rewarded_complete`
- `interstitial_shown`
- `upgrade_purchase`
- `session_end`

Every level event must include level ID, attempt number, moves, elapsed time, product count, layout ID, and result where applicable. No personally identifiable information belongs in game analytics.

## 8. Asset production contract

### Shelves

- Transparent PNG.
- Front or slight three-quarter view; no extreme perspective.
- No numbers, locks, ads, or mission text baked into artwork.
- Consistent safe border and inner shadow.
- Layout filenames remain stable and are referenced through an asset catalogue.

### Products

- Transparent PNG with tight crop.
- Bottom-aligned anchor.
- Consistent visual scale by product class.
- Production target: 30 unique products.
- Item art must remain readable in one-third of a shelf bay at mobile scale.

### Release payload

- Initial payload target: 15 MiB or less.
- Unused source images must not enter `dist`.
- Every registered runtime asset must exist and have a valid format signature.

## 9. Technical architecture

New commercial code follows this dependency direction:

```text
commercial level data
→ pure ShelfSortEngine
→ commercial scene/controller
→ Phaser view
→ platform, save, analytics adapters
```

Rules do not belong in Phaser pointer callbacks. Scenes translate input into engine actions and render the returned immutable state.

Legacy code remains available only behind explicit legacy level URLs while the new campaign replaces it.

## 10. Quality gates

A change is not commercially complete because TypeScript compiles.

Required gates:

- Strict TypeScript build.
- Pure rule validation for every level.
- Browser completion of at least ten representative levels.
- Pointer/touch verification at desktop and portrait mobile sizes.
- Save migration test.
- CrazyGames loading and gameplay lifecycle verification.
- No uncaught console errors.
- First interaction within four seconds on the release bundle.
- Desktop target at least 55 FPS and mobile target at least 30 FPS on representative hardware.
- Screenshot review for first frame, active play, failure, completion, reward, and store upgrade states.

## 11. Rebuild phases

### P0 — Playable commercial vertical slice

- New shelf-sort engine.
- Ten typed levels.
- Portrait playable scene.
- Undo, restart, move limit, score, stars, failure, and next-level loop.
- Existing CrazyGames lifecycle retained.

### P1 — Production gameplay

- Production shelf and product assets.
- Move animation, set-clear animation, audio, hints, blockers, locked bays, extra-bay tool, and tutorial hand guidance.
- Save schema and campaign map.
- Level authoring and solver-assisted validation.

### P2 — Retention and monetization

- Store upgrade screen.
- Daily challenge.
- Rewarded placements.
- Interstitial policy controller.
- Analytics funnel and balancing report.

### P3 — Release

- Sixty finished levels.
- Full browser regression.
- Performance and payload budgets.
- Portal metadata, thumbnails, screenshots, privacy text, and release package.

## 12. Definition of done

The project is commercially ready only when a new player can open the root URL, understand the first action without external instructions, complete ten levels, retain progress after refresh, see a meaningful store-growth reward, voluntarily use a rewarded placement, and continue without encountering placeholder art, debug UI, broken controls, or unrelated minigames.
