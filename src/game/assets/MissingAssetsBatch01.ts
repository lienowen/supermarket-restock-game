import type { AssetDescriptor } from "./AssetDescriptor";

const asset = (descriptor: AssetDescriptor): AssetDescriptor => descriptor;

const prop = (
  key: string,
  path: string,
  state: string,
  defaultScale: number
): AssetDescriptor => asset({
  key,
  path,
  category: "prop",
  canvasSize: [1536, 1024],
  anchor: [0.5, 0.94],
  defaultScale,
  depthGroup: "props",
  preloadGroup: "starter-market-levels-6-7",
  perspective: "fixed-third-person",
  lightDirection: "upper-left",
  state,
  status: "production"
});

const equipment = (
  key: string,
  path: string,
  state: string,
  defaultScale: number
): AssetDescriptor => asset({
  key,
  path,
  category: "equipment",
  canvasSize: [1536, 1024],
  anchor: [0.5, 0.96],
  defaultScale,
  depthGroup: "props",
  preloadGroup: "starter-market-levels-6-7",
  perspective: "fixed-third-person",
  lightDirection: "upper-left",
  state,
  status: "production"
});

const customer = (
  key: string,
  path: string,
  state: string
): AssetDescriptor => asset({
  key,
  path,
  category: "character",
  canvasSize: [1024, 1536],
  anchor: [0.5, 0.98],
  defaultScale: 0.36,
  depthGroup: "actors",
  preloadGroup: "starter-market-levels-6-7",
  perspective: "fixed-third-person",
  lightDirection: "upper-left",
  state,
  status: "production"
});

export const MISSING_ASSETS_BATCH_01: readonly AssetDescriptor[] = Object.freeze([
  prop(
    "prop-delivery-box-small",
    "assets/game/missing-assets-batch-01/delivery-box-small.png",
    "closed-small",
    0.28
  ),
  prop(
    "prop-delivery-box-medium",
    "assets/game/missing-assets-batch-01/delivery-box-medium.png",
    "closed-medium",
    0.34
  ),
  prop(
    "prop-delivery-box-large",
    "assets/game/missing-assets-batch-01/delivery-box-large.png",
    "closed-large",
    0.4
  ),
  equipment(
    "equipment-capacity-cart-empty",
    "assets/game/missing-assets-batch-01/equipment-capacity-cart-empty.png",
    "empty",
    0.46
  ),
  equipment(
    "equipment-capacity-cart-loaded",
    "assets/game/missing-assets-batch-01/equipment-capacity-cart-loaded.png",
    "loaded",
    0.46
  ),
  equipment(
    "equipment-produce-scale",
    "assets/game/missing-assets-batch-01/equipment-produce-scale.png",
    "ready",
    0.4
  ),
  customer(
    "customer-evening-happy",
    "assets/game/missing-assets-batch-01/customer-happy.png",
    "happy"
  ),
  customer(
    "customer-evening-impatient",
    "assets/game/missing-assets-batch-01/customer-impatient.png",
    "impatient"
  )
]);
