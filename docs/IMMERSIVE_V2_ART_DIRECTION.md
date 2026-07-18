# Immersive V2 Art Direction

## Product target

Build a polished third-person supermarket restocking game that immediately communicates a real work shift rather than a collection of UI panels. Day 1 must match the composition and clarity of the approved reference:

- employee and restock cart in the foreground
- backroom and staff aisle in the center
- produce department on the left
- beverage cooler on the right
- one clearly highlighted empty cooler bay
- compact English HUD that does not cover the playable scene
- realistic supermarket lighting with readable, slightly stylized forms

The final game is English-only. Chinese text must not be baked into any production image.

## Visual style

- **Camera:** fixed third-person, slightly elevated, 35–45 mm equivalent lens
- **Composition:** foreground character, strong center aisle, playable fixture on the right third
- **Rendering:** realistic materials with controlled stylization; no photoreal faces and no toy-like mobile-game proportions
- **Lighting:** warm ceiling lights, cool refrigerator lights, soft floor reflections
- **Color hierarchy:** green store identity, yellow guidance, neutral architecture, product color only where useful
- **Readability:** interactive objects remain recognizable at 1280×720 and on mobile landscape

## Asset boundaries

Never bake gameplay UI, task arrows, counters, or completion states into environment art.

### Environment

```text
public/assets/v2/environment/day01/
  supermarket_shell.webp
  floor_reflection.webp
  ceiling_lights.webp
  backroom_interior.webp
```

The environment contains only architecture, distant shelves, static signs, and non-interactive dressing.

### Fixtures

```text
public/assets/v2/fixtures/day01/
  produce_island.webp
  beverage_cooler_empty.webp
  beverage_cooler_row_01.webp
  beverage_cooler_row_02.webp
  beverage_cooler_row_03.webp
  beverage_cooler_row_04.webp
  beverage_cooler_row_05.webp
  beverage_cooler_row_06.webp
  backroom_rack.webp
```

Cooler rows must be independently switchable so stock state comes from game state rather than a full-scene replacement image.

### Characters

```text
public/assets/v2/characters/employee-a/
  idle.webp
  walk.webp
  carry_case.webp
  push_cart.webp
  open_case.webp
  restock_low.webp
  restock_mid.webp
  restock_high.webp
```

All character frames share one camera angle, body scale, floor contact point, and lighting direction.

### Props and products

```text
public/assets/v2/props/day01/
  restock_cart_empty.webp
  restock_cart_loaded.webp
  cola_case_closed.webp
  cola_case_open.webp

public/assets/v2/products/beverages/
  cola_bottle.webp
  orange_soda_bottle.webp
  water_bottle.webp
```

Product images use transparent backgrounds and consistent shelf-bottom anchors.

### UI

The HUD is rendered dynamically in Phaser. Only icons may be raster assets:

```text
public/assets/v2/ui/
  icon_star.svg
  icon_coin.svg
  icon_sun.svg
  icon_check.svg
```

## Required production sizes

| Asset | Working size | Runtime format |
|---|---:|---|
| Environment shell | 3072×2048 | WebP |
| Large fixture | 1600 px maximum side | WebP |
| Character action | 700×1000 canvas | WebP |
| Cart | 900×900 canvas | WebP |
| Product bottle | 160×320 canvas | WebP |
| UI icon | 96×96 | SVG |

Export at approximately 2× runtime resolution. Transparent assets must be tightly cropped while retaining a 16–24 px safety margin.

## Anchor rules

- Characters: bottom-center at the shoe contact point
- Carts: bottom-center between rear wheels
- Cases: bottom-center of the cardboard box
- Bottles: bottom-center of the bottle base
- Fixtures: bottom-center of the floor footprint

Anchor metadata belongs in the asset manifest and must not be guessed inside a scene.

## Interaction language

Yellow is reserved for the next valid action:

- arrow above the target
- thin target outline
- floor route or parking marker
- brief success flash after a valid action

Do not show multiple competing arrows. The current task state determines exactly one primary target.

## Day 1 vertical slice

The first production slice contains only:

1. pick up one cola case in the backroom
2. load it onto the restock cart
3. push the cart through the staff aisle
4. park beside the beverage cooler
5. open the case
6. fill six cooler rows from left to right
7. show one completion reward

Produce is environmental context only in this slice. It becomes interactive after the beverage workflow is polished and verified.

## Acceptance criteria

- No imports from legacy `*Integration.ts` files
- No game rules inside Phaser display code
- No UI text baked into environment images
- No Chinese text in production assets
- One asset manifest is the source of truth for paths, dimensions, anchors, and production status
- Every interaction is playable with pointer or touch
- 1536×1024, 1280×720, and mobile landscape remain readable
- Initial transfer stays below the release budget
