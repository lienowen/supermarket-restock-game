import {
  resolveCampaignRuntime,
  resolveCampaignShift,
  type CampaignShiftRuntime
} from "../../application/CampaignRuntime";
import {
  resolveRestockShiftRuntime,
  type RestockShiftRuntimeContent
} from "../../application/ShiftRuntimeContent";
import { STARTER_MARKET_CONTENT } from "../../content/starterMarket";
import { STARTER_MARKET_LAYOUT } from "../../world/starterMarketLayout";
import { resolveProductAssetKey } from "../assets/ProductAssetResolver";
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

export interface StarterMarketPresentationContext {
  readonly campaignShift: CampaignShiftRuntime;
  readonly campaignTotalShifts: number;
  readonly scene: {
    readonly key: "starter-market-shift";
    readonly datasetName: "starter-market";
    readonly architecture: "architecture-v3";
  };
  readonly runtime: RestockShiftRuntimeContent;
  readonly layout: typeof STARTER_MARKET_LAYOUT;
  readonly visual: typeof STARTER_MARKET_VISUAL_SPEC;
  readonly assets: typeof RETAINED_RUNTIME_ASSETS;
  readonly productAssets: {
    readonly restockProductKey: string;
  };
  readonly palette: {
    readonly hud: number;
    readonly green: number;
    readonly greenBright: number;
    readonly gold: number;
    readonly floor: number;
    readonly aisle: number;
  };
  readonly labels: {
    readonly day: string;
    readonly produceDepartment: string;
    readonly produceSubtitle: string;
    readonly backroom: string;
    readonly beverageDepartment: string;
    readonly beverageSubtitle: string;
    readonly completionTitle: string;
  };
  readonly world: StarterMarketWorldPresentation;
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

export const MAIN_CAMPAIGN_RUNTIME = resolveCampaignRuntime(
  STARTER_MARKET_CONTENT,
  "main-campaign"
);

export function createStarterMarketPresentationContext(
  shiftId: string
): StarterMarketPresentationContext {
  const campaignShift = resolveCampaignShift(MAIN_CAMPAIGN_RUNTIME, shiftId);
  const runtime = resolveRestockShiftRuntime(STARTER_MARKET_CONTENT, shiftId);

  if (campaignShift.store.id !== runtime.store.id) {
    throw new Error(`Campaign and restock runtime disagree about store for shift ${shiftId}`);
  }

  return Object.freeze({
    campaignShift,
    campaignTotalShifts: MAIN_CAMPAIGN_RUNTIME.shifts.length,
    scene: Object.freeze({
      key: "starter-market-shift" as const,
      datasetName: "starter-market" as const,
      architecture: "architecture-v3" as const
    }),
    runtime,
    layout: STARTER_MARKET_LAYOUT,
    visual: STARTER_MARKET_VISUAL_SPEC,
    assets: RETAINED_RUNTIME_ASSETS,
    productAssets: Object.freeze({
      restockProductKey: resolveProductAssetKey(runtime.product.id)
    }),
    palette: Object.freeze({
      hud: 0x09100c,
      green: 0x315f38,
      greenBright: 0x56894d,
      gold: STARTER_MARKET_VISUAL_SPEC.targeting.color,
      floor: 0xaaa295,
      aisle: 0xd8d0c2
    }),
    labels: Object.freeze({
      day: campaignShift.dayLabel,
      produceDepartment: "FRUITS & VEGETABLES",
      produceSubtitle: "FRESH MARKET",
      backroom: "STAFF ONLY",
      beverageDepartment: "BEVERAGES",
      beverageSubtitle: "COLD DRINKS",
      completionTitle: `${runtime.product.name.toUpperCase()} SECTION READY`
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
}

export const STARTER_MARKET_PRESENTATION = createStarterMarketPresentationContext(
  "starter-shift-001"
);

export function validateStarterMarketPresentationContext(
  context: StarterMarketPresentationContext = STARTER_MARKET_PRESENTATION
): readonly string[] {
  const errors: string[] = [];

  if (context.runtime.store.worldLayoutId !== context.layout.id) {
    errors.push("Starter market runtime store does not reference the active world layout");
  }

  if (context.runtime.fixture.id !== "beverage-cooler-a") {
    errors.push("Starter market restock mission must resolve the shared beverage cooler fixture");
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

  if (context.campaignShift.shift.id !== context.runtime.shift.id) {
    errors.push("Presentation campaign shift and restock runtime shift must be identical");
  }

  if (context.labels.day !== context.campaignShift.dayLabel) {
    errors.push("Presentation day label must come from campaign order");
  }

  if (context.campaignTotalShifts !== MAIN_CAMPAIGN_RUNTIME.shifts.length) {
    errors.push("Presentation campaign size must match the shared campaign runtime");
  }

  return Object.freeze(errors);
}
