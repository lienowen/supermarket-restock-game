import type { StoreWorldLayout } from "./WorldLayout";

/**
 * Shared 1600x900 market composition. Level-specific fixtures can reuse the
 * same store while placing their primary interaction zone where that gameplay
 * reads most clearly.
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
      bounds: { x: 545, y: 170, width: 430, height: 500 }
    },
    {
      id: "beverage-zone",
      kind: "beverage",
      label: "Beverages",
      bounds: { x: 975, y: 120, width: 625, height: 780 }
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
      position: { x: 760, y: 470 },
      anchor: [0.5, 0.92],
      depth: 18
    },
    {
      fixtureId: "beverage-cooler-a",
      position: { x: 1325, y: 500 },
      anchor: [0.5, 0.92],
      depth: 22
    },
    {
      fixtureId: "checkout-a",
      position: { x: 1140, y: 735 },
      anchor: [0.5, 0.92],
      depth: 26
    }
  ],
  interactions: [
    {
      id: "cola-case-pickup-point",
      targetId: "cola-case-a",
      actionGroup: "case",
      position: { x: 770, y: 510 },
      radius: 92
    },
    {
      id: "restock-cart-load-point",
      targetId: "restock-cart-a",
      actionGroup: "cart",
      position: { x: 825, y: 730 },
      radius: 120
    },
    {
      id: "beverage-restock-zone",
      targetId: "beverage-cooler-a",
      actionGroup: "parking-zone",
      position: { x: 1120, y: 725 },
      radius: 150
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
      position: { x: 890, y: 625 },
      facing: "back-right"
    },
    {
      id: "customer-queue-spawn",
      actorType: "customer",
      position: { x: 350, y: 710 },
      facing: "right"
    }
  ]
};
