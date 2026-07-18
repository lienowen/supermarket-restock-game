# Supermarket Restock Game — Asset Pipeline V3

## 1. Visual target

The uploaded supermarket reference image is the production quality target:

- fixed third-person, back-facing worker camera;
- worker and restock cart in the foreground;
- dense produce area on the left;
- backroom and staff route in the visual centre;
- beverage cooler on the right;
- realistic retail lighting, materials, product density, floor reflection, and depth;
- a single yellow active-target indicator;
- English-only HUD and in-world signs.

The image is not used as one flattened gameplay background. It is decomposed into reusable environment, fixture, character, prop, product, effect, and UI assets.

## 2. Asset ownership

Assets are organised by reusable type, never by day or shift.

```text
public/assets/game/
  environments/
    stores/
    floors/
    walls/
    ceilings/
    lighting/
  fixtures/
    shelves/
    coolers/
    produce-displays/
    checkouts/
    backroom-racks/
  characters/
    workers/
    customers/
  equipment/
    restock-carts/
    pallet-jacks/
  products/
    beverages/
    produce/
    snacks/
    frozen/
    household/
  props/
    cases/
    pallets/
    signs/
    cleaning-tools/
  effects/
    highlights/
    arrows/
    particles/
  ui/
    hud/
    icons/
    panels/
```

Runtime paths omit `public/` and begin with `assets/game/...`.

## 3. Required catalogue metadata

Every production asset is registered with:

- stable key;
- runtime path;
- category;
- canvas dimensions;
- anchor point;
- default display scale;
- default depth group;
- preload group;
- visual perspective;
- light direction;
- state or action represented;
- status: `concept`, `prototype`, `production`, or `deprecated`;
- optional replacement key.

Example:

```ts
{
  key: "worker-a-push-restock-cart",
  path: "assets/game/characters/workers/worker-a/push-restock-cart.webp",
  category: "character",
  canvasSize: [700, 1000],
  anchor: [0.5, 0.94],
  defaultScale: 0.42,
  depthGroup: "actors",
  preloadGroup: "starter-store",
  perspective: "fixed-third-person",
  lightDirection: "upper-left",
  state: "push-cart",
  status: "production"
}
```

## 4. Camera and composition lock

The production logical canvas is 1600 × 900 landscape.

Composition anchors:

- produce zone: left 0–34%;
- staff/backroom route: centre 34–62%;
- beverage fixture: right 62–100%;
- actor/cart foreground: lower centre-right;
- HUD safe area: top 8% and outer margins;
- interaction prompts: lower safe area, never covering the actor or active fixture.

The camera is fixed for the initial store layout. World interaction may animate actors and objects, but must not change the approved perspective.

## 5. Layer model

```text
0  far environment and ceiling
10 walls and permanent architecture
20 fixed fixtures
30 fixture contents and product rows
40 props and equipment
50 workers and customers
60 target outlines and world effects
90 HUD and interaction UI
```

Assets that need independent gameplay state must be independent layers. In particular:

- cooler base and each stock row are separate;
- closed and opened cases are separate states;
- empty and loaded cart states are separate;
- worker actions are separate animation states;
- target arrows/highlights are effects, never baked into environment art;
- English signs are separate where localisation or store variants may change them.

## 6. Worker action set

The common worker set is action-oriented, not mission-oriented:

```text
idle
walk
carry-small
carry-medium
carry-large
push-cart
pull-cart
pick-up-low
pick-up-middle
place-low
place-middle
place-high
load-cart
open-case
scan-item
clean-floor
```

The first production batch requires:

- idle back/three-quarter view;
- walk back/three-quarter view;
- carry medium case;
- push restock cart;
- load cart;
- open case;
- place low, middle, and high.

All worker assets share the same character design, scale, floor contact, perspective, and upper-left light direction.

## 7. Fixture state model

The beverage cooler is built as:

```text
cooler-base
cooler-door-reflection
cooler-row-01
cooler-row-02
cooler-row-03
cooler-row-04
cooler-row-05
cooler-row-06
```

The product rows may be hidden, revealed, or swapped independently. A full-cooler image is allowed only for promotional art, not gameplay state.

## 8. Production sequence

### Gate A — composition prototype

Use non-production shapes only to validate camera, safe areas, actor route, fixture placement, and interaction reach.

### Gate B — visual benchmark

Produce one coherent sample containing:

- environment without HUD, worker, cart, target arrows, or mission text;
- one beverage cooler base;
- one worker pushing one restock cart;
- one beverage row;
- English sign treatment.

No full asset batch proceeds until this benchmark matches the reference image's perspective and quality.

### Gate C — reusable first asset pack

Complete the common worker action set, cart states, case states, cooler rows, target effects, and HUD components.

### Gate D — integration and validation

Register every asset in the catalogue, validate anchors and dimensions, run build tests, capture browser screenshots, and compare against the visual target.

## 9. Rejection criteria

An asset must not enter production when it has any of the following:

- baked Chinese text;
- baked HUD, target arrow, or reward effects;
- mismatched camera angle or light direction;
- unexplained transparent margins;
- inconsistent foot/floor contact;
- front-facing worker where a back-facing action is required;
- flattened fixture states that prevent interaction;
- copied branding or copyrighted product packaging;
- geometric placeholder quality presented as final;
- day-specific naming or folder ownership.

## 10. Upload and versioning

Generated images are never committed directly as unreviewed final assets.

1. Generate concept candidates.
2. Select and clean a benchmark.
3. Export WebP for opaque art, PNG for transparency, SVG for vector UI where appropriate.
4. Add catalogue metadata.
5. Commit source asset plus catalogue entry in the same change.
6. Capture an in-game screenshot from CI.
7. Promote status from `concept` to `prototype` or `production` only after visual review.
