import type { StoreWorldLayout } from "./WorldLayout";

/**
 * Shared 1600x900 market composition. Restock gameplay is aligned to the V2
 * project background: backroom access on the left, cart in the open foreground,
 * and the beverage coolers on the right. Dynamic props stay on the walkable
 * floor instead of inheriting coordinates from the retired salesfloor plate.
 */
export const STARTER_MARKET_LAYOUT: StoreWorldLayout = {
  id: "starter-market-layout",
  logicalSize: [1600, 900],
  camera: {
    mode: "fixed-third-person",
    viewport: { x: 0, y: 0, width: 1600, height: 900 }
  },
  zones: [
    {
      id: "produce-zone",
      kind: "produce",
      label: "Fruits & Vegetables",
      bounds: { x: 0, y: 155, width: 545, height: 745 }
    },
    {
      id: "staff-backroom",
      kind: "backroom",
      label: "Staff Only",
      bounds: { x: 245, y: 245, width: 360, height: 655 }
    },
    {
      id: "beverage-zone",
      kind: "beverage",
      label: "Beverages",
      bounds: { x: 650, y: 180, width: 950, height: 720 }
    },
    {
      id: "checkout-zone",
      kind: "checkout",
      label: "Checkout",
      bounds: { x: 300, y: 420, width: 1250, height: 480 }
    }
  ],
  fixtures: [
    {
      fixtureId: "produce-display-a",
      position: { x: 260, y: 575 },
      anchor: [0.5, 0.92],
      depth: 20
    },
    {
      fixtureId: "backroom-rack-a",
      position: { x: 455, y: 565 },
      anchor: [0.5, 0.92],
      depth: 18
    },
    {
      fixtureId: "beverage-cooler-a",
      position: { x: 1065, y: 500 },
      anchor: [0.5, 0.92],
      depth: 18
    },
    {
      fixtureId: "checkout-a",
      position: { x: 1080, y: 790 },
      anchor: [0.5, 0.92],
      depth: 26
    }
  ],
  interactions: [
    {
      id: "cola-case-pickup-point",
      targetId: "cola-case-a",
      actionGroup: "case",
      position: { x: 470, y: 790 },
      radius: 130
    },
    {
      id: "restock-cart-load-point",
      targetId: "restock-cart-a",
      actionGroup: "cart",
      position: { x: 610, y: 800 },
      radius: 145
    },
    {
      id: "beverage-restock-zone",
      targetId: "beverage-cooler-a",
      actionGroup: "parking-zone",
      position: { x: 830, y: 800 },
      radius: 175
    },
    {
      id: "checkout-service-point",
      targetId: "checkout-a",
      actionGroup: "checkout",
      position: { x: 1035, y: 690 },
      radius: 145
    }
  ],
  spawns: [
    {
      id: "worker-a-spawn",
      actorType: "worker",
      position: { x: 760, y: 790 },
      facing: "back-right"
    },
    {
      id: "customer-queue-spawn",
      actorType: "customer",
      position: { x: 800, y: 785 },
      facing: "right"
    }
  ]
};
