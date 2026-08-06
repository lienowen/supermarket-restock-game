# Levels 3–10 Asset Audit

Status: pre-production asset gate  
Goal: identify what is production-ready, what can be reused, and what must be uploaded before gameplay implementation.

This audit is based on the current canonical catalogue in `src/game/assets/starterAssetCatalogue.ts` and the generated production path map in `src/game/assets/ProductionV1AssetPaths.ts`.

## Overall result

| Level | Planned gameplay | Asset readiness | Decision |
|---|---|---:|---|
| 3 | Basic checkout | ~80% | Build next; small upload pack required |
| 4 | Hold-to-clean spills | ~55% | Requires spill artwork before polish |
| 5 | Visual order hunt | ~85% | Mostly ready; wire existing clipboard |
| 6 | Cart capacity puzzle | ~35% | Major asset gap; upload or switch gameplay |
| 7 | Checkout with weighing/patience | ~50% | Requires produce scale and customer states |
| 8 | Route-based closing clean | ~75% after Level 4 pack | Reuses spill pack and cleaning assets |
| 9 | Similar-product priority order | ~40% | Product variants required; otherwise switch gameplay |
| 10 | Mixed-shift finale | ~80% after Levels 3–9 | Mostly reuses finished systems and assets |

Readiness percentages describe visual-production coverage, not completed gameplay.

---

## Confirmed production-ready assets

### Checkout

- checkout counter fixture;
- barcode scanner;
- POS terminal;
- empty shopping basket;
- worker scan-register pose;
- four usable customer presentations;
- multiple packaged and produce products.

### Cleaning

- mop;
- cleaning cart;
- wet-floor sign;
- worker mop-floor pose;
- cleaning-supplies fixture.

### Order picking

- milk, apple, cereal, oats, yogurt, chips, detergent, paper towels;
- cola, water, lemon-lime soda and orange soda;
- produce and dairy/breakfast fixtures;
- shopping basket;
- worker idle and thinking poses;
- a task clipboard file already exists in the production path map, but is not yet registered in the canonical catalogue.

### Delivery and carts

- empty restock cart;
- one generic loaded-restock-cart image;
- cola case closed/open assets;
- worker carry, push-cart, open-box and stock-shelf poses.

Important: the milk-case and water-case entries are currently marked `prototype`, not release-ready.

---

## Level 3 — Checkout Basics

### Ready

- checkout counter, scanner and POS;
- shopping basket;
- worker scan pose;
- customer lineup assets;
- enough products for three customers.

### Reusable with code/composition

- products can fly from basket through scanner to the bagging area;
- scanner beam, price pop-up, total display, combo labels, coin particles and receipt text can be procedural;
- customer smile can initially use a clean UI reaction above the existing customer.

### Missing upload — priority batch A

1. `equipment-checkout-bag-open.png`
   - transparent PNG;
   - three-quarter front view matching the checkout counter perspective;
   - open paper or reusable supermarket bag;
   - no products baked inside;
   - recommended canvas: 768 × 768;
   - object should occupy roughly 55–65% of canvas;
   - soft contact shadow allowed, no white background.

2. `prop-checkout-receipt.png`
   - transparent PNG;
   - short printed receipt, slightly curled;
   - no readable brand or copyrighted logo;
   - recommended canvas: 512 × 512;
   - object should occupy roughly 55% of canvas.

These two assets are enough to make Level 3 visually complete. Card/payment effects, prices and scanner light will be generated in code.

### Intended effect

- product follows pointer immediately;
- scanner beam flashes on a valid pass;
- price pops above the scanner;
- product snaps into the open bag;
- bag visibly fills using the real product sprites;
- payment prints the receipt and triggers customer reaction plus coin burst.

---

## Level 4 — Spill Patrol

### Ready

- cleaning cart, mop, sign and worker mop pose.

### Missing upload — priority batch B

Create three distinct transparent spill sprites:

1. `spill-water-large.png`
2. `spill-juice-large.png`
3. `spill-dirt-smear-large.png`

Shared specification:

- transparent PNG;
- viewed from the same fixed-third-person floor perspective;
- irregular silhouette, not a perfect circle;
- no bucket, mop or sign baked into the image;
- recommended canvas: 768 × 512;
- spill should occupy 70–80% of canvas;
- clean edge with no white halo.

Partial-clean states will be created in code with masking, scale and opacity, so separate 66% and 33% images are not required.

Optional polish asset:

4. `floor-shine-sweep.png`
   - transparent soft highlight streak;
   - 1024 × 256;
   - used for final clean completion.

### Intended effect

- holding fills a circular ring continuously;
- spill shrinks and fades through three visible stages;
- releasing pauses rather than resets;
- final clean creates a glossy floor sweep.

---

## Level 5 — Order Hunt

### Ready

- enough requested products and decoys;
- shelf fixtures and basket;
- worker thinking pose;
- task clipboard source already exists.

### No mandatory new upload

The order card can use the existing clipboard plus live product icons. Correct products can fly into the basket using current product sprites.

### Optional polish upload

- `equipment-order-bag-open.png` may reuse the Level 3 checkout bag.

### Intended effect

- three product pictures appear on the clipboard;
- correct products snap into basket and receive a checklist stamp;
- wrong products shake red but remain available;
- a mistake never changes the order.

---

## Level 6 — Cart Capacity

### Current gap

The current restock cart and case artwork was designed for fixed presentation, not a readable size-fitting puzzle. There are no production-ready small, medium and large shipping boxes with matching perspective.

### Required upload to keep the current design — priority batch C

1. `delivery-box-small.png`
2. `delivery-box-medium.png`
3. `delivery-box-large.png`
4. `equipment-capacity-cart-empty.png`

Box specification:

- transparent PNG;
- same box design and lighting, three clearly different sizes;
- fixed-third-person perspective;
- simple neutral supermarket delivery markings, no logos;
- recommended canvas: 768 × 768;
- contact shadow separated enough that snapping still looks clean.

Capacity-cart specification:

- transparent PNG;
- cart interior clearly visible;
- no boxes baked inside;
- three readable placement lanes;
- recommended canvas: 1024 × 768.

### Switch rule

If this pack is not supplied, Level 6 will switch away from box-capacity fitting. It should become a sorting or loading challenge built from existing product and basket/cart assets rather than using fake boxes.

---

## Level 7 — Evening Checkout

### Reused from Level 3

- checkout counter, scanner, POS, bag, receipt, products and customers.

### Missing upload — priority batch D

1. `equipment-produce-scale.png`
   - transparent PNG;
   - supermarket checkout produce scale with visible tray and display;
   - no fruit baked onto the tray;
   - fixed-third-person perspective;
   - recommended canvas: 768 × 768.

2. `customer-checkout-happy.png`
3. `customer-checkout-impatient.png`

Customer specification:

- transparent PNG;
- same overall art style, perspective, scale and lighting as current customers;
- checkout-facing pose;
- happy state should read through posture and expression;
- impatient state should read through posture without looking aggressive;
- recommended canvas: 768 × 768;
- clean alpha edge, no white matte.

### Intended effect

- produce snaps onto scale;
- player taps inside a large green weight zone;
- exact weight restores patience;
- happy customers leave hearts and a larger coin burst.

---

## Level 8 — Closing Clean-up

### Reused

- all Level 4 cleaning and spill assets.

### No mandatory new upload after Level 4

Route line, shine trail, multiplier and store-light shutdown can be procedural.

### Intended effect

- route preview connects six spots;
- correct cleaning sends a shine trail toward the next target;
- wrong order only resets multiplier;
- already cleaned areas stay clean.

---

## Level 9 — Priority Order

### Current gap

The catalogue has many distinct products, but only one strong similar-product family: cola, lemon-lime soda and orange soda. The planned exact-match gameplay needs several readable families of close variants.

### Required upload to keep the current design — priority batch E

At minimum, provide two additional three-product families:

**Cereal family**

1. `product-cereal-red.png`
2. `product-cereal-blue.png`
3. `product-cereal-yellow.png`

**Chips family**

4. `product-chips-red.png`
5. `product-chips-green.png`
6. `product-chips-blue.png`

Shared specification:

- transparent PNG;
- same family silhouette, clearly different dominant colour;
- no tiny-text-only distinction;
- no real brands or logos;
- product front angled consistently with existing product sprites;
- recommended canvas: 512 × 768;
- product occupies about 65–75% of canvas.

### Switch rule

If these variants are not supplied, Level 9 will switch from “find the near-identical product” to a different priority-picking rule that uses the existing distinct products. It must not become a simple repeat of Level 5.

---

## Level 10 — Mixed-shift Finale

### Reused

- Level 2 memory shelf;
- Level 3/7 checkout system;
- Level 4/8 cleaning system;
- Level 5/9 picking system.

### No mandatory unique gameplay upload

Store-wide lighting, shift meter, department completion and `READY FOR BUSINESS` banner can be procedural.

Optional final polish:

- `ui-ready-for-business-ribbon.png`, transparent 1024 × 512.

---

## Recommended upload order

Do not upload everything at once. Use these batches:

1. **Batch A — Level 3:** checkout bag + receipt.
2. **Batch B — Level 4:** three spill sprites; optional floor shine.
3. **Batch C decision — Level 6:** box/cart pack or approve gameplay switch.
4. **Batch D — Level 7:** produce scale + happy/impatient customer states.
5. **Batch E decision — Level 9:** six product variants or approve gameplay switch.

## Acceptance rules for every uploaded image

- transparent PNG or WebP with real alpha;
- no white or coloured matte around edges;
- no copyrighted store/product branding;
- consistent upper-left lighting;
- consistent fixed-third-person perspective;
- enough empty canvas around the object for cropping and animation;
- do not bake UI labels, prices or progress into the art;
- file name must match the requested name exactly.

## Immediate production decision

Level 3 can begin as soon as Batch A is uploaded. Level 5 can also be built mostly from current assets. Levels 6 and 9 remain design-switch candidates until their asset packs are approved.