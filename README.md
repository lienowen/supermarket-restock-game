# Supermarket Restock Game

A Phaser 3 + TypeScript H5 game prototype focused on a fast backroom-to-sales-floor restocking loop.

## Stack

- Phaser 3
- TypeScript
- Vite

## Current playable loop

1. Drag matching product boxes from the backroom onto the replenishment cart.
2. The first Day 1 trip can leave after 3 boxes, so the core loop starts quickly.
3. Drag the loaded cart through the doorway to the sales floor.
4. Tap a matching `MISSING` shelf slot.
5. The worker restocks that exact slot and the cart count updates.
6. Fill the remaining slots with additional trips as needed.
7. When all initial shelf slots are filled, the store opens.
8. Customers buy products and sold slots become `MISSING` again.
9. Return the cart to the backroom for matching stock and keep shelves available.
10. Day 2 adds waiting customers with patience bars; restock in time to save the sale.

## Controls

- **Boxes:** drag onto the cart.
- **Cart:** drag between backroom and sales floor.
- **Shelf slots:** tap the matching `MISSING` slot to restock.
- **Waiting customers:** tap once to ask them to wait and extend patience.
- **Pause:** freezes the main shift and Day 2 customer waiting timers.

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

## Assets

Runtime art is loaded from:

```text
public/assets/day01/
public/assets/ui/
```

Core Day 1 assets include:

- `backroom_bg.png`
- `salesfloor_bg.png`
- `cart.png`
- `box_cola.png`
- `box_water.png`
- `box_milk.png`
- `shelf_frame.png`
- `product_cola.png`
- `product_water.png`
- `product_milk.png`
- worker action sprites
- customer idle/basket sprites

Keep replacement files on transparent backgrounds and preserve filenames so the runtime asset map does not need to change.
