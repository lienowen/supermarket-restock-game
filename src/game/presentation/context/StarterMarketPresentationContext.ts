import type { AssetDescriptor } from "../../assets/AssetDescriptor";
import {
  STARTER_RUNTIME_ASSET_REGISTRY,
  type RuntimeAssetRegistry
} from "../../assets/RuntimeAssetRegistry";
import {
  resolveCampaignRuntime,
  resolveCampaignShift,
  type CampaignShiftRuntime
} from "../../application/CampaignRuntime";
import {
  levelAssetKeys,
  resolveLevelCampaignRuntime,
  selectCampaignLevel,
  type CampaignLevelRuntime
} from "../../application/LevelRuntimeContent";
import type { RestockShiftRuntimeContent } from "../../application/ShiftRuntimeContent";
import { STARTER_MARKET_CONTENT } from "../../content/starterMarket";
import { STARTER_MARKET_LAYOUT } from "../../world/starterMarketLayout";
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

export interface StarterMarketLevelAssets {
  readonly preload: readonly AssetDescriptor[];
  readonly environment: AssetDescriptor;
  readonly fixture: AssetDescriptor;
  readonly workerPush: AssetDescriptor;
  readonly workerCarry: AssetDescriptor;
  readonly cart: AssetDescriptor;
  readonly case: AssetDescriptor;
  readonly product: AssetDescriptor;
  readonly ambientProducts: readonly AssetDescriptor[];
}

export interface StarterMarketPresentationContext {
  readonly campaignShift: CampaignShiftRuntime;
  readonly campaignLevel: CampaignLevelRuntime;
  readonly campaignTotalShifts: number;
  readonly campaignTotalLevels: number;
  readonly scene: {
    readonly key: "starter-market-shift";
    readonly datasetName: "starter-market";
    readonly architecture: "architecture-v3";
  };
  readonly runtime: RestockShiftRuntimeContent;
  readonly assets: RuntimeAssetRegistry;
  readonly levelAssets: StarterMarketLevelAssets;
  readonly layout: typeof STARTER_MARKET_LAYOUT;
  readonly visual: typeof STARTER_MARKET_VISUAL_SPEC;
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
    readonly level: string;
    readonly levelTitle: string;
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
const workerSpawnPosition: PresentationPoint = workerSpawn.position;

export const MAIN_CAMPAIGN_RUNTIME = resolveCampaignRuntime(
  STARTER_MARKET_CONTENT,
  "main-campaign"
);

export const MAIN_LEVEL_CAMPAIGN_RUNTIME = resolveLevelCampaignRuntime(
  STARTER_MARKET_CONTENT,
  "main-campaign"
);

const resolveLevelAssets = (
  campaignLevel: CampaignLevelRuntime
): StarterMarketLevelAssets => {
  const bindings = campaignLevel.level.assetBindings;
  const registry = STARTER_RUNTIME_ASSET_REGISTRY;

  return Object.freeze({
    preload: registry.resolve(levelAssetKeys(campaignLevel.level)),
    environment: registry.require(bindings.environmentAssetKey),
    fixture: registry.require(bindings.fixtureAssetKey),
    workerPush: registry.require(bindings.workerPushAssetKey),
    workerCarry: registry.require(bindings.workerCarryAssetKey),
    cart: registry.require(bindings.cartAssetKey),
    case: registry.require(bindings.caseAssetKey),
    product: registry.require(bindings.productAssetKey),
    ambientProducts: Object.freeze(
      bindings.ambientProductAssetKeys.map((assetKey) => registry.require(assetKey))
    )
  });
};

export function createStarterMarketPresentationContext(
  requestedLevelOrShiftId: string
): StarterMarketPresentationContext {
  const campaignLevel = selectCampaignLevel(
    MAIN_LEVEL_CAMPAIGN_RUNTIME,
    requestedLevelOrShiftId
  );
  const campaignShift = resolveCampaignShift(
    MAIN_CAMPAIGN_RUNTIME,
    campaignLevel.shift.id
  );
  const runtime = campaignLevel.runtime;
  const levelAssets = resolveLevelAssets(campaignLevel);

  if (campaignShift.store.id !== runtime.store.id) {
    throw new Error(`Campaign and level runtime disagree about store for ${campaignLevel.level.id}`);
  }

  return Object.freeze({
    campaignShift,
    campaignLevel,
    campaignTotalShifts: MAIN_CAMPAIGN_RUNTIME.shifts.length,
    campaignTotalLevels: MAIN_LEVEL_CAMPAIGN_RUNTIME.levels.length,
    scene: Object.freeze({
      key: "starter-market-shift" as const,
      datasetName: "starter-market" as const,
      architecture: "architecture-v3" as const
    }),
    runtime,
    assets: STARTER_RUNTIME_ASSET_REGISTRY,
    levelAssets,
    layout: STARTER_MARKET_LAYOUT,
    visual: STARTER_MARKET_VISUAL_SPEC,
    productAssets: Object.freeze({
      restockProductKey: levelAssets.product.key
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
      level: campaignLevel.levelLabel,
      levelTitle: campaignLevel.level.title,
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
      workerStart: workerSpawnPosition,
      workerCooler: STARTER_MARKET_VISUAL_SPEC.actor.coolerPosition,
      backroomFixture: fixturePosition("backroom-rack-a"),
      beverageCooler: fixturePosition("beverage-cooler-a")
    })
  });
}

export const STARTER_MARKET_PRESENTATION = createStarterMarketPresentationContext(
  "starter-level-001"
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
    errors.push("Presentation campaign shift and level runtime shift must be identical");
  }

  if (context.campaignLevel.level.missionId !== context.runtime.mission.id) {
    errors.push("Presentation level mission and runtime mission must be identical");
  }

  if (context.labels.day !== context.campaignShift.dayLabel) {
    errors.push("Presentation day label must come from campaign order");
  }

  if (context.labels.level !== context.campaignLevel.levelLabel) {
    errors.push("Presentation level label must come from level campaign order");
  }

  if (context.campaignTotalShifts !== MAIN_CAMPAIGN_RUNTIME.shifts.length) {
    errors.push("Presentation campaign size must match the shared campaign runtime");
  }

  if (context.campaignTotalLevels !== MAIN_LEVEL_CAMPAIGN_RUNTIME.levels.length) {
    errors.push("Presentation level count must match the level campaign runtime");
  }

  if (context.levelAssets.product.key !== context.runtime.product.assetKey) {
    errors.push("Level product asset must match the product catalogue");
  }

  if (context.levelAssets.fixture.key !== context.runtime.fixture.assetKey) {
    errors.push("Level fixture asset must match the fixture catalogue");
  }

  errors.push(...context.assets.validateKeys(levelAssetKeys(context.campaignLevel.level)));

  return Object.freeze(errors);
}
