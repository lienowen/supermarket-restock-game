# Supermarket Restock Game

A brand-new H5 prototype for a static-scene + dynamic-object supermarket management game.

## Stack

- Phaser 3
- TypeScript
- Vite

## Current playable loop

1. Tap a box in the backroom.
2. Tap the replenishment cart to load it.
3. Load all 6 boxes.
4. Tap the cart to move it to the sales floor.
5. Tap a visible `MISSING` shelf slot.
6. Product flies into that exact slot.
7. When the shelf is filled, the store opens.
8. Customers buy products automatically.
9. Sold slots become `MISSING` again.
10. Player keeps restocking while money increases.

## Run

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

## Build

```bash
npm run build
```

## Asset plan

Final art should go under:

```text
public/assets/day01/
```

Recommended first batch:

- `backroom_bg.webp`
- `salesfloor_bg.webp`
- `cart.png`
- `box_cola.png`
- `box_water.png`
- `box_milk.png`
- `shelf_frame.png` (without products)
- `product_cola.png`
- `product_water.png`
- `product_milk.png`
- `customer_01.png`
- `customer_02.png`

The prototype currently uses runtime-drawn placeholders so gameplay can be tested before final art arrives.
