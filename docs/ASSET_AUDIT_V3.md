# Asset Audit V3

## Decision standard

The approved visual target is the uploaded fixed-camera, third-person supermarket reference. All retained assets must be reusable across missions and shifts, use English or no baked text, and live under `public/assets/game/`.

`prototype` means the asset is useful for gameplay and architecture validation but is not yet approved as final production art.

## Migration status

The first asset clean-up pass has been applied to `main`.

- retained semi-realistic assets were physically moved into `public/assets/game/`;
- conflicting cartoon duplicates and the Day 1 delivery art pack were deleted;
- the compatibility scene no longer references `assets/day01`;
- the current cooler, beverage products, worker, cart, and case load through canonical V3 paths;
- catalogue tests prevent day-owned runtime paths from being reintroduced;
- deleted files remain recoverable from `archive/pre-immersive-v2` and Git history.

## Retained and migrated

### Worker A — prototype

Retained because the green uniform, transparent background, proportions, and supermarket role are reusable.

- `idle.png`
- `carry-medium.png`
- `push-cart.png`
- `place-low.png`

Limitations:

- perspective is not consistently back-facing;
- open-case, place-middle, and place-high are still missing;
- final lighting and floor contact need a unified production redraw.

### Restock cart A — prototype

Retained because the cart has useful independent load states and a transparent background.

- `cart-a-empty.png`
- `cart-a-loaded.png`
- `cart-a-ready.png`
- `cart-a-full.png`

The duplicate `cart.png` and duplicate cartoon cart set were removed.

### Product cases — prototype

Retained because cola, milk, and water cases are clean reusable props with no mission-specific ownership.

- `cola-case-closed.png`
- `milk-case-closed.png`
- `water-case-closed.png`

Open-case states still need to be produced.

### Beverage products — prototype

Retained as reusable single-product images:

- `cola-bottle.png`
- `milk-bottle.png`
- `water-bottle.png`

These can support cooler stocking, promotional displays, inventory, ordering, and checkout. Branded packaging must remain fictional.

### Beverage cooler — prototype

The existing empty cooler frame was retained as `fixtures/coolers/beverage-cooler-a/base.png` because its transparent structure can support independent product rows.

The current scene now renders this retained cooler and the migrated beverage product images instead of geometric bottle placeholders.

It is not final because its perspective and lighting must be matched to the approved supermarket environment.

### Customers — prototype

Two semi-realistic customer sets were retained for later customer-system validation:

- customer A: idle and carry-basket;
- customer B: idle and carry-basket.

They are not loaded by the first restocking scenario.

### Environment plates — temporary prototype

The existing sales-floor and backroom plates were retained only to avoid breaking the playable build during visual replacement.

They are explicitly not production quality.

## Rejected and removed

### Duplicate cartoon Day 1 set

Removed because it conflicted with the semi-realistic target and duplicated the retained worker, cart, box, product, customer, and cooler roles.

### Day 1 delivery art pack

Removed because the entire pack used a separate cartoon illustration style. Keeping it would create a second visual language and encourage day-owned assets, both of which violate the V3 architecture.

The old files remain recoverable from `archive/pre-immersive-v2` and Git history.

### Exact duplicates

Removed:

- `props/cart.png`, which was byte-identical to `props/cart_ready.png`;
- `products/product_cola_alt.png`, which duplicated the product role with a conflicting canvas and style.

## Not deleted in this pass

Day 2, storefront, common supermarket fixtures, and common UI were not bulk-deleted yet. They contain a mixture of useful fixtures and incompatible presentation art. They will be audited by reusable category before migration:

1. fixtures and checkout equipment;
2. supermarket environment plates;
3. UI icons and panels;
4. storefront/campaign presentation;
5. remaining day-owned duplicates.

This prevents accidental deletion of useful future systems while still stopping new code from referencing day-owned paths.

## Canonical path policy

```text
public/assets/game/
  environments/
  fixtures/
  characters/
  equipment/
  products/
  props/
  effects/
  ui/
```

No new production or prototype asset may be added under `assets/day01`, `assets/day02`, or any other day-owned directory.
