import type { AssetDescriptor } from "./AssetDescriptor";

const BASE_PATH = "assets/game/missing-assets-batch-01";

const asset = (descriptor: AssetDescriptor): AssetDescriptor => descriptor;

const prop = (
  key: string,
  fileName: string,
  state: string,
  defaultScale: number
): AssetDescriptor => asset({
  key,
  path: `${BASE_PATH}/${fileName}`,
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
  fileName: string,
  state: string,
  defaultScale: number
): AssetDescriptor => asset({
  key,
  path: `${BASE_PATH}/${fileName}`,
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
  fileName: string,
  state: string
): AssetDescriptor => asset({
  key,
  path: `${BASE_PATH}/${fileName}`,
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
  prop("prop-delivery-box-small", "delivery-box-small.png", "closed-small", 0.28),
  prop("prop-delivery-box-medium", "delivery-box-medium.png", "closed-medium", 0.34),
  prop("prop-delivery-box-large", "delivery-box-large.png", "closed-large", 0.4),
  equipment(
    "equipment-capacity-cart-empty",
    "equipment-capacity-cart-empty.png",
    "empty",
    0.46
  ),
  equipment(
    "equipment-capacity-cart-loaded",
    "equipment-capacity-cart-loaded.png",
    "loaded",
    0.46
  ),
  equipment(
    "equipment-produce-scale",
    "equipment-produce-scale.png",
    "ready",
    0.4
  ),
  customer("customer-evening-happy", "customer-happy.png", "happy"),
  customer("customer-evening-impatient", "customer-impatient.png", "impatient")
]);
