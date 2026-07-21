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
import type { CheckoutLevelRuntimeContent } from "../../application/CheckoutLevelRuntimeContent";
import {
  levelAssetKeys,
  resolveLevelCampaignRuntime,
  selectCampaignLevel,
  type CampaignLevelRuntime
} from "../../application/LevelRuntimeContent";
import type { RestockShiftRuntimeContent } from "../../application/ShiftRuntimeContent";
import type {
  CleanLevelRuntimeContent,
  FindItemsLevelRuntimeContent
} from "../../application/UtilityLevelRuntimeContent";
import type {
  CheckoutLevelDefinition,
  CleanLevelDefinition,
  FindItemsLevelDefinition,
  RestockLevelDefinition
} from "../../content/GameContent";
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
  readonly checkout: PresentationPoint;
  readonly checkoutService: PresentationPoint;
  readonly customerQueueStart: PresentationPoint;
}

interface BaseLevelAssets {
  readonly preload: readonly AssetDescriptor[];
  readonly environment: AssetDescriptor;
}

export interface RestockStarterMarketLevelAssets extends BaseLevelAssets {
  readonly fixture: AssetDescriptor;
  readonly workerIdle: AssetDescriptor;
  readonly workerPush: AssetDescriptor;
  readonly workerCarry: AssetDescriptor;
  readonly cart: AssetDescriptor;
  readonly case: AssetDescriptor;
  readonly product: AssetDescriptor;
  readonly ambientProducts: readonly AssetDescriptor[];
}

export interface CheckoutStarterMarketLevelAssets extends BaseLevelAssets {
  readonly worker: AssetDescriptor;
  readonly customers: readonly AssetDescriptor[];
}

export interface CleanStarterMarketLevelAssets extends BaseLevelAssets {
  readonly worker: AssetDescriptor;
  readonly workerMop: AssetDescriptor;
  readonly cleaningFixture: AssetDescriptor;
  readonly cleaningCart: AssetDescriptor;
  readonly wetFloorSign: AssetDescriptor;
}

export interface FindItemsStarterMarketLevelAssets extends BaseLevelAssets {
  readonly worker: AssetDescriptor;
  readonly workerThinking: AssetDescriptor;
  readonly fixture: AssetDescriptor;
  readonly items: readonly AssetDescriptor[];
}

interface BaseStarterMarketPresentationContext {
  readonly campaignShift: CampaignShiftRuntime;
  readonly campaignTotalShifts: number;
  readonly campaignTotalLevels: number;
  readonly scene: {
    readonly key: "starter-market-shift";
    readonly datasetName: "starter-market";
    readonly architecture: "architecture-v3";
  };
  readonly assets: RuntimeAssetRegistry;
  readonly layout: typeof STARTER_MARKET_LAYOUT;
  readonly visual: typeof STARTER_MARKET_VISUAL_SPEC;
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
    readonly checkoutDepartment: string;
    readonly completionTitle: string;
  };
  readonly world: StarterMarketWorldPresentation;
}

export interface RestockStarterMarketPresentationContext extends BaseStarterMarketPresentationContext {
  readonly mode: "restock";
  readonly campaignLevel: CampaignLevelRuntime & {
    readonly level: RestockLevelDefinition;
    readonly runtime: RestockShiftRuntimeContent;
  };
  readonly runtime: RestockShiftRuntimeContent;
  readonly levelAssets: RestockStarterMarketLevelAssets;
  readonly productAssets: { readonly restockProductKey: string };
}

export interface CheckoutStarterMarketPresentationContext extends BaseStarterMarketPresentationContext {
  readonly mode: "checkout";
  readonly campaignLevel: CampaignLevelRuntime & {
    readonly level: CheckoutLevelDefinition;
    readonly runtime: CheckoutLevelRuntimeContent;
  };
  readonly runtime: CheckoutLevelRuntimeContent;
  readonly levelAssets: CheckoutStarterMarketLevelAssets;
}

export interface CleanStarterMarketPresentationContext extends BaseStarterMarketPresentationContext {
  readonly mode: "clean";
  readonly campaignLevel: CampaignLevelRuntime & {
    readonly level: CleanLevelDefinition;
    readonly runtime: CleanLevelRuntimeContent;
  };
  readonly runtime: CleanLevelRuntimeContent;
  readonly levelAssets: CleanStarterMarketLevelAssets;
}

export interface FindItemsStarterMarketPresentationContext extends BaseStarterMarketPresentationContext {
  readonly mode: "find-items";
  readonly campaignLevel: CampaignLevelRuntime & {
    readonly level: FindItemsLevelDefinition;
    readonly runtime: FindItemsLevelRuntimeContent;
  };
  readonly runtime: FindItemsLevelRuntimeContent;
  readonly levelAssets: FindItemsStarterMarketLevelAssets;
}

export type StarterMarketPresentationContext =
  | RestockStarterMarketPresentationContext
  | CheckoutStarterMarketPresentationContext
  | CleanStarterMarketPresentationContext
  | FindItemsStarterMarketPresentationContext;

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

const spawnPosition = (id: string): PresentationPoint => {
  const spawn = STARTER_MARKET_LAYOUT.spawns.find((entry) => entry.id === id);
  if (!spawn) throw new Error(`Missing starter market spawn: ${id}`);
  return spawn.position;
};

const workerSpawnPosition = spawnPosition("worker-a-spawn");

export const MAIN_CAMPAIGN_RUNTIME = resolveCampaignRuntime(
  STARTER_MARKET_CONTENT,
  "main-campaign"
);

export const MAIN_LEVEL_CAMPAIGN_RUNTIME = resolveLevelCampaignRuntime(
  STARTER_MARKET_CONTENT,
  "main-campaign"
);

const preloadFor = (level: CampaignLevelRuntime["level"]): readonly AssetDescriptor[] => (
  STARTER_RUNTIME_ASSET_REGISTRY.resolve(levelAssetKeys(level))
);

const resolveRestockLevelAssets = (
  level: RestockLevelDefinition
): RestockStarterMarketLevelAssets => {
  const bindings = level.assetBindings;
  const registry = STARTER_RUNTIME_ASSET_REGISTRY;
  return Object.freeze({
    preload: preloadFor(level),
    environment: registry.require(bindings.environmentAssetKey),
    fixture: registry.require(bindings.fixtureAssetKey),
    workerIdle: registry.require(bindings.workerIdleAssetKey),
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

const resolveCheckoutLevelAssets = (
  level: CheckoutLevelDefinition
): CheckoutStarterMarketLevelAssets => {
  const bindings = level.assetBindings;
  const registry = STARTER_RUNTIME_ASSET_REGISTRY;
  return Object.freeze({
    preload: preloadFor(level),
    environment: registry.require(bindings.environmentAssetKey),
    worker: registry.require(bindings.workerAssetKey),
    customers: Object.freeze(
      bindings.customerAssetKeys.map((assetKey) => registry.require(assetKey))
    )
  });
};

const resolveCleanLevelAssets = (
  level: CleanLevelDefinition
): CleanStarterMarketLevelAssets => {
  const bindings = level.assetBindings;
  const registry = STARTER_RUNTIME_ASSET_REGISTRY;
  return Object.freeze({
    preload: preloadFor(level),
    environment: registry.require(bindings.environmentAssetKey),
    worker: registry.require(bindings.workerAssetKey),
    workerMop: registry.require(bindings.workerMopAssetKey),
    cleaningFixture: registry.require(bindings.cleaningFixtureAssetKey),
    cleaningCart: registry.require(bindings.cleaningCartAssetKey),
    wetFloorSign: registry.require(bindings.wetFloorSignAssetKey)
  });
};

const resolveFindItemsLevelAssets = (
  level: FindItemsLevelDefinition
): FindItemsStarterMarketLevelAssets => {
  const bindings = level.assetBindings;
  const registry = STARTER_RUNTIME_ASSET_REGISTRY;
  return Object.freeze({
    preload: preloadFor(level),
    environment: registry.require(bindings.environmentAssetKey),
    worker: registry.require(bindings.workerAssetKey),
    workerThinking: registry.require(bindings.workerThinkingAssetKey),
    fixture: registry.require(bindings.fixtureAssetKey),
    items: Object.freeze(bindings.itemAssetKeys.map((assetKey) => registry.require(assetKey)))
  });
};

const commonContext = (
  campaignLevel: CampaignLevelRuntime,
  campaignShift: CampaignShiftRuntime,
  completionTitle: string
): BaseStarterMarketPresentationContext => Object.freeze({
  campaignShift,
  campaignTotalShifts: MAIN_CAMPAIGN_RUNTIME.shifts.length,
  campaignTotalLevels: MAIN_LEVEL_CAMPAIGN_RUNTIME.levels.length,
  scene: Object.freeze({
    key: "starter-market-shift" as const,
    datasetName: "starter-market" as const,
    architecture: "architecture-v3" as const
  }),
  assets: STARTER_RUNTIME_ASSET_REGISTRY,
  layout: STARTER_MARKET_LAYOUT,
  visual: STARTER_MARKET_VISUAL_SPEC,
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
    checkoutDepartment: "CHECKOUT",
    completionTitle
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
    beverageCooler: fixturePosition("beverage-cooler-a"),
    checkout: fixturePosition("checkout-a"),
    checkoutService: interactionPosition("checkout-service-point"),
    customerQueueStart: spawnPosition("customer-queue-spawn")
  })
});

export function createStarterMarketPresentationContext(
  requestedLevelOrShiftId: string
): StarterMarketPresentationContext {
  const campaignLevel = selectCampaignLevel(MAIN_LEVEL_CAMPAIGN_RUNTIME, requestedLevelOrShiftId);
  const campaignShift = resolveCampaignShift(MAIN_CAMPAIGN_RUNTIME, campaignLevel.shift.id);

  if (campaignShift.store.id !== campaignLevel.runtime.store.id) {
    throw new Error(`Campaign and level runtime disagree about store for ${campaignLevel.level.id}`);
  }

  switch (campaignLevel.level.mode) {
    case "restock": {
      if (!("product" in campaignLevel.runtime)) {
        throw new Error(`Restock level ${campaignLevel.level.id} resolved the wrong runtime type`);
      }
      const levelAssets = resolveRestockLevelAssets(campaignLevel.level);
      return Object.freeze({
        ...commonContext(
          campaignLevel,
          campaignShift,
          `${campaignLevel.runtime.product.name.toUpperCase()} SECTION READY`
        ),
        mode: "restock" as const,
        campaignLevel: campaignLevel as RestockStarterMarketPresentationContext["campaignLevel"],
        runtime: campaignLevel.runtime,
        levelAssets,
        productAssets: Object.freeze({ restockProductKey: levelAssets.product.key })
      });
    }
    case "checkout":
      if (!("customerCount" in campaignLevel.runtime)) {
        throw new Error(`Checkout level ${campaignLevel.level.id} resolved the wrong runtime type`);
      }
      return Object.freeze({
        ...commonContext(campaignLevel, campaignShift, "CHECKOUT RUSH CLEARED"),
        mode: "checkout" as const,
        campaignLevel: campaignLevel as CheckoutStarterMarketPresentationContext["campaignLevel"],
        runtime: campaignLevel.runtime,
        levelAssets: resolveCheckoutLevelAssets(campaignLevel.level)
      });
    case "clean":
      if (!("spotCount" in campaignLevel.runtime)) {
        throw new Error(`Clean level ${campaignLevel.level.id} resolved the wrong runtime type`);
      }
      return Object.freeze({
        ...commonContext(campaignLevel, campaignShift, "STORE FLOOR SPOTLESS"),
        mode: "clean" as const,
        campaignLevel: campaignLevel as CleanStarterMarketPresentationContext["campaignLevel"],
        runtime: campaignLevel.runtime,
        levelAssets: resolveCleanLevelAssets(campaignLevel.level)
      });
    case "find-items":
      if (!("products" in campaignLevel.runtime)) {
        throw new Error(`Find-items level ${campaignLevel.level.id} resolved the wrong runtime type`);
      }
      return Object.freeze({
        ...commonContext(campaignLevel, campaignShift, "ORDER COMPLETE"),
        mode: "find-items" as const,
        campaignLevel: campaignLevel as FindItemsStarterMarketPresentationContext["campaignLevel"],
        runtime: campaignLevel.runtime,
        levelAssets: resolveFindItemsLevelAssets(campaignLevel.level)
      });
  }
}

export const STARTER_MARKET_PRESENTATION = createStarterMarketPresentationContext(
  "starter-level-001"
) as RestockStarterMarketPresentationContext;

export function validateStarterMarketPresentationContext(
  context: StarterMarketPresentationContext = STARTER_MARKET_PRESENTATION
): readonly string[] {
  const errors: string[] = [];
  if (context.runtime.store.worldLayoutId !== context.layout.id) {
    errors.push("Starter market runtime store does not reference the active world layout");
  }
  if (
    context.world.width !== context.layout.logicalSize[0] ||
    context.world.height !== context.layout.logicalSize[1]
  ) {
    errors.push("Presentation world size must match the world layout logical size");
  }
  if (context.campaignShift.shift.id !== context.runtime.shift.id) {
    errors.push("Presentation campaign shift and level runtime shift must be identical");
  }
  if (context.campaignLevel.level.missionId !== context.runtime.mission.id) {
    errors.push("Presentation level mission and runtime mission must be identical");
  }
  if (context.labels.level !== context.campaignLevel.levelLabel) {
    errors.push("Presentation level label must come from level campaign order");
  }
  if (context.campaignTotalLevels !== MAIN_LEVEL_CAMPAIGN_RUNTIME.levels.length) {
    errors.push("Presentation level count must match the level campaign runtime");
  }

  switch (context.mode) {
    case "restock":
      if (context.runtime.slotCount !== context.visual.cooler.rowYs.length) {
        errors.push("Content fixture slot count must match the visual cooler row count");
      }
      if (context.levelAssets.product.key !== context.runtime.product.assetKey) {
        errors.push("Level product asset must match the product catalogue");
      }
      break;
    case "checkout":
      if (context.levelAssets.customers.length === 0) {
        errors.push("Checkout presentation requires customer assets");
      }
      break;
    case "clean":
      if (context.runtime.spotPositions.length !== context.runtime.spotCount) {
        errors.push("Clean presentation spot positions must match objective count");
      }
      break;
    case "find-items":
      if (context.levelAssets.items.length !== context.runtime.products.length) {
        errors.push("Find-items presentation products must match item assets");
      }
      break;
  }

  return Object.freeze(errors);
}
