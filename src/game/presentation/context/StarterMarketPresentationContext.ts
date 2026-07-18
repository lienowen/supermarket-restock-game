import { resolveRestockShiftRuntime } from "../../application/ShiftRuntimeContent";
import { STARTER_MARKET_CONTENT } from "../../content/starterMarket";
import { STARTER_MARKET_LAYOUT } from "../../world/starterMarketLayout";
import { RETAINED_RUNTIME_ASSETS } from "../assets/RetainedAssetManifest";
import { STARTER_MARKET_VISUAL_SPEC } from "../visual/StarterMarketVisualSpec";

export interface PresentationPoint {
  readonly x: number;
  readonly y: number;
}

export interface StarterMarketWorldPresentation {
  readonly width: number;
  readonly height: number;
  readonly backroomBox: PresentationPoint;
  readonly cartStart: PresentationPoint;
  readonly cartCooler: PresentationPoint;
  readonly workerStart: PresentationPoint;
  readonly workerCooler: PresentationPoint;
  readonly backroomFixture: PresentationPoint;
  readonly beverageCooler: PresentationPoint;
}

const interactionPosition = (id: string): PresentationPoint => {
  const point = STARTER_MARKET_LAYOUT.interactions.find((entry) => entry.id === id);
  if (!point) throw new Error(`Missing starter market interaction point: ${id}`);
  return point.position;
};

const fixturePosition = (fixtureId: string): PresentationPoint => {
  const fixture = STARTER_MARKET_LAYOUT.fixtures.find((entry) => entry.fixtureId === fixtureId);
  if (!fixture) throw new Error(`Missing starter market fixture placement: ${fixtureId}`);
  return fixture.position;
};

const workerSpawn = STARTER_MARKET_LAYOUT.spawns.find((entry) => entry.id === "worker-a-spawn");
if (!workerSpawn) throw new Error("Missing worker-a-spawn in starter market layout");

export const STARTER_MARKET_PRESENTATION = Object.freeze({
  scene: Object.freeze({
    key: "immersive-day-one",
    datasetName: "starter-market",
    architecture: "architecture-v3"
  }),
  runtime: resolveRestockShiftRuntime(STARTER_MARKET_CONTENT, "starter-shift-001"),
  layout: STARTER_MARKET_LAYOUT,
  visual: STARTER_MARKET_VISUAL_SPEC,
  assets: RETAINED_RUNTIME_ASSETS,
  palette: Object.freeze({
    hud: 0x09100c,
    green: 0x315f38,
    greenBright: 0x56894d,
    gold: STARTER_MARKET_VISUAL_SPEC.targeting.color,
    floor: 0xaaa295,
    aisle: 0xd8d0c2
  }),
  labels: Object.freeze({
    day: "DAY 1",
    produceDepartment: "FRUITS & VEGETABLES",
    produceSubtitle: "FRESH MARKET",
    backroom: "STAFF ONLY",
    beverageDepartment: "BEVERAGES",
    beverageSubtitle: "COLD DRINKS",
    completionTitle: "COOLER FULLY STOCKED"
  }),
  world: Object.freeze<StarterMarketWorldPresentation>({
    width: STARTER_MARKET_VISUAL_SPEC.logicalSize.width,
    height: STARTER_MARKET_VISUAL_SPEC.logicalSize.height,
    backroomBox: interactionPosition("cola-case-pickup-point"),
    cartStart: interactionPosition("restock-cart-load-point"),
    cartCooler: interactionPosition("beverage-restock-zone"),
    workerStart: workerSpawn.position,
    workerCooler: STARTER_MARKET_VISUAL_SPEC.actor.coolerPosition,
    backroomFixture: fixturePosition("backroom-rack-a"),
    beverageCooler: fixturePosition("beverage-cooler-a")
  })
});

export type StarterMarketPresentationContext = typeof STARTER_MARKET_PRESENTATION;

export function validateStarterMarketPresentationContext(): readonly string[] {
  const context = STARTER_MARKET_PRESENTATION;
  const errors: string[] = [];

  if (context.runtime.store.worldLayoutId !== context.layout.id) {
    errors.push("Starter market runtime store does not reference the active world layout");
  }

  if (context.runtime.fixture.id !== "beverage-cooler-a") {
    errors.push("Starter market vertical slice must resolve the beverage cooler fixture");
  }

  if (context.runtime.slotCount !== context.visual.cooler.rowYs.length) {
    errors.push("Content fixture slot count must match the visual cooler row count");
  }

  if (
    context.world.width !== context.layout.logicalSize[0] ||
    context.world.height !== context.layout.logicalSize[1]
  ) {
    errors.push("Presentation world size must match the world layout logical size");
  }

  if (
    context.world.workerStart.x !== context.visual.actor.spawn.x ||
    context.world.workerStart.y !== context.visual.actor.spawn.y
  ) {
    errors.push("Presentation worker start must match the locked visual composition");
  }

  if (!context.runtime.store.fixtureIds.includes(context.runtime.fixture.id)) {
    errors.push("Resolved task fixture must belong to the active store");
  }

  return Object.freeze(errors);
}
