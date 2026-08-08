import Phaser from "phaser";
import { crazyGamesPlatform } from "../../../platform/crazyGamesPlatform";
import { CampaignSession } from "../../application/CampaignSession";
import { STARTER_RUNTIME_ASSET_REGISTRY } from "../../assets/RuntimeAssetRegistry";
import { resolveCartCapacityExperienceSpec } from "../../content/experience/CartCapacityExperienceSpec";
import { resolveCheckoutPatienceExperienceSpec } from "../../content/experience/CheckoutPatienceExperienceSpec";
import { resolveMatureLevelExperienceSpec } from "../../content/experience/MatureLevelExperience";
import { gameDomainEvents } from "../../events/GameDomainEvents";
import {
  createStarterMarketPresentationContext,
  MAIN_LEVEL_CAMPAIGN_RUNTIME
} from "../../presentation/context/StarterMarketPresentationContext";
import { applyMarketUpgradesToPresentation } from "../../presentation/context/MarketUpgradePresentation";
import type { SceneCampaignSessionContext } from "../../presentation/scenes/StarterMarketScene";
import { mountCartCapacityLoadDom } from "../../presentation/ui/CartCapacityLoadDom";
import { mountCheckoutPatienceDom } from "../../presentation/ui/CheckoutPatienceDom";
import { mountCheckoutScanDom } from "../../presentation/ui/CheckoutScanDom";
import { mountCompactLevelChecklistDom } from "../../presentation/ui/CompactLevelChecklistDom";
import { mountGuidedDragActionDom } from "../../presentation/ui/GuidedDragActionDom";
import { mountGuidedLevelBriefingDomOverlay } from "../../presentation/ui/GuidedLevelBriefingDomOverlay";
import { mountHoldWorkDom } from "../../presentation/ui/HoldWorkDom";
import { mountLevelBriefingDomOverlay } from "../../presentation/ui/LevelBriefingDomOverlay";
import { BrowserCampaignSessionStore } from "../browser/BrowserCampaignSessionStore";
import { createGameplayScene } from "./GameplaySceneRegistry";
import { installSafeInteractiveGuard } from "./SafeInteractiveGuard";

export interface PhaserGameFactoryOptions {
  readonly parent?: string;
  readonly exposeTestBridge?: boolean;
  readonly levelId?: string;
  readonly shiftId?: string;
  readonly skipBriefing?: boolean;
  readonly skipGuidedInteractions?: boolean;
  readonly skipCartCapacity?: boolean;
  readonly skipCheckoutScan?: boolean;
  readonly skipCheckoutPatience?: boolean;
  readonly skipHoldWork?: boolean;
}

const locationParameters = (): URLSearchParams => new URLSearchParams(window.location.search);

const requestedLevelFromLocation = (): string | undefined => {
  const parameters = locationParameters();
  return parameters.get("level")?.trim() || parameters.get("shift")?.trim() || undefined;
};

const featureDisabledFromLocation = (parameterName: string): boolean => {
  const parameters = locationParameters();
  const explicitValue = parameters.get(parameterName);
  if (explicitValue === "1") return false;
  return explicitValue === "0" || parameters.get("test") === "1";
};

const briefingDisabledFromLocation = (): boolean => featureDisabledFromLocation("briefing");
const guidedInteractionsDisabledFromLocation = (): boolean => featureDisabledFromLocation("guided");
const cartCapacityDisabledFromLocation = (): boolean => featureDisabledFromLocation("cartload");
const checkoutScanDisabledFromLocation = (): boolean => featureDisabledFromLocation("checkout");
const checkoutPatienceDisabledFromLocation = (): boolean => featureDisabledFromLocation("patience");
const holdWorkDisabledFromLocation = (): boolean => featureDisabledFromLocation("hold");

export async function createPhaserGame(
  options: PhaserGameFactoryOptions = {}
): Promise<Phaser.Game> {
  installSafeInteractiveGuard();
  await crazyGamesPlatform.initialize();
  crazyGamesPlatform.loadingStart();

  const firstLevel = MAIN_LEVEL_CAMPAIGN_RUNTIME.levels[0];
  if (!firstLevel) throw new Error("Main campaign has no playable levels");
  const requestedId = options.levelId ?? options.shiftId ?? requestedLevelFromLocation();
  const levelId = requestedId ?? firstLevel.level.id;
  const basePresentation = createStarterMarketPresentationContext(levelId);
  const experience = resolveMatureLevelExperienceSpec(basePresentation.campaignLevel.level);
  const cartCapacity = resolveCartCapacityExperienceSpec(basePresentation.campaignLevel.level);
  const checkoutPatience = resolveCheckoutPatienceExperienceSpec(basePresentation.campaignLevel.level);

  const session = new CampaignSession(
    {
      campaignId: MAIN_LEVEL_CAMPAIGN_RUNTIME.campaign.id,
      firstLevelId: firstLevel.level.id,
      defaultEconomy: {
        coins: firstLevel.level.tuning.initialCoins,
        stars: 0,
        reputation: 0
      }
    },
    new BrowserCampaignSessionStore(),
    gameDomainEvents
  );
  const presentation = applyMarketUpgradesToPresentation(basePresentation, session);
  const campaignSession: SceneCampaignSessionContext = Object.freeze({
    session,
    initialEconomy: session.initialEconomyFor(
      presentation.campaignLevel.level.id,
      presentation.campaignLevel.level.tuning.initialCoins
    ),
    firstLevelId: firstLevel.level.id
  });

  document.body.dataset.activeShift = presentation.runtime.shift.id;
  document.body.dataset.activeDay = String(presentation.campaignShift.dayNumber);
  document.body.dataset.activeLevel = presentation.campaignLevel.level.id;
  document.body.dataset.activeMode = presentation.mode;
  document.body.dataset.levelExperience = experience.modeLabel;

  const activeScene = createGameplayScene(presentation, campaignSession);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: options.parent ?? "app",
    width: presentation.world.width,
    height: presentation.world.height,
    backgroundColor: "#171712",
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      expandParent: true
    },
    render: {
      antialias: true,
      roundPixels: false,
      pixelArt: false,
      powerPreference: "high-performance"
    },
    input: {
      activePointers: 3
    },
    scene: [activeScene]
  });
  game.registry.set("campaignSession", session);
  game.registry.set("levelExperience", experience);

  if (experience.checklist) {
    mountCompactLevelChecklistDom({
      levelId: presentation.campaignLevel.level.id,
      checklist: experience.checklist
    });
  } else {
    delete document.body.dataset.levelChecklist;
  }

  const skipGuidedInteractions = options.skipGuidedInteractions ?? guidedInteractionsDisabledFromLocation();
  if (
    experience.guidedDrag &&
    !skipGuidedInteractions &&
    "case" in presentation.levelAssets &&
    "cart" in presentation.levelAssets
  ) {
    mountGuidedDragActionDom({
      game,
      sceneKey: presentation.scene.key,
      levelId: presentation.campaignLevel.level.id,
      spec: experience.guidedDrag,
      sourceImagePath: presentation.levelAssets.case.path,
      targetImagePath: presentation.levelAssets.cart.path
    });
  } else {
    document.body.dataset.guidedDrag = experience.guidedDrag ? "skipped" : "none";
  }

  const skipCartCapacity = options.skipCartCapacity ?? cartCapacityDisabledFromLocation();
  if (
    cartCapacity &&
    !skipCartCapacity &&
    "cart" in presentation.levelAssets
  ) {
    mountCartCapacityLoadDom({
      game,
      sceneKey: presentation.scene.key,
      levelId: presentation.campaignLevel.level.id,
      spec: cartCapacity,
      options: cartCapacity.options.map((option) => ({
        spec: option,
        imagePath: STARTER_RUNTIME_ASSET_REGISTRY.require(option.assetKey).path
      })),
      targetImagePath: STARTER_RUNTIME_ASSET_REGISTRY.require(
        cartCapacity.targetAssetKey
      ).path,
      loadedTargetImagePath: STARTER_RUNTIME_ASSET_REGISTRY.require(
        cartCapacity.loadedTargetAssetKey
      ).path
    });
  } else {
    document.body.dataset.cartCapacityLoad = cartCapacity ? "skipped" : "none";
  }

  const checkoutEquipment = "equipment" in presentation.levelAssets
    ? presentation.levelAssets.equipment
    : undefined;
  const scannerAsset = checkoutEquipment?.find((asset) => (
    asset.key === "equipment-checkout-scanner" ||
    asset.key === "equipment-barcode-scanner"
  ));
  const posAsset = checkoutEquipment?.find((asset) => asset.key === "equipment-pos-terminal");

  const skipCheckoutScan = options.skipCheckoutScan ?? checkoutScanDisabledFromLocation();
  if (
    experience.checkoutScan &&
    !skipCheckoutScan &&
    "customerCount" in presentation.runtime &&
    checkoutEquipment
  ) {
    mountCheckoutScanDom({
      game,
      sceneKey: presentation.scene.key,
      levelId: presentation.campaignLevel.level.id,
      totalCustomers: presentation.runtime.customerCount,
      spec: experience.checkoutScan,
      productAssets: STARTER_RUNTIME_ASSET_REGISTRY.resolve(
        experience.checkoutScan.productAssetKeys
      ),
      scannerAsset,
      posAsset
    });
  } else {
    document.body.dataset.checkoutScan = experience.checkoutScan ? "skipped" : "none";
  }

  const skipCheckoutPatience = options.skipCheckoutPatience ?? checkoutPatienceDisabledFromLocation();
  if (
    checkoutPatience &&
    !skipCheckoutPatience &&
    "customerCount" in presentation.runtime &&
    checkoutEquipment
  ) {
    mountCheckoutPatienceDom({
      game,
      sceneKey: presentation.scene.key,
      levelId: presentation.campaignLevel.level.id,
      totalCustomers: presentation.runtime.customerCount,
      spec: checkoutPatience,
      standardProductAssets: STARTER_RUNTIME_ASSET_REGISTRY.resolve(
        checkoutPatience.standardProductAssetKeys
      ),
      weighedProductAsset: STARTER_RUNTIME_ASSET_REGISTRY.require(
        checkoutPatience.weighedProductAssetKey
      ),
      scannerAsset,
      posAsset
    });
  } else {
    document.body.dataset.checkoutPatience = checkoutPatience ? "skipped" : "none";
  }

  const skipHoldWork = options.skipHoldWork ?? holdWorkDisabledFromLocation();
  if (
    experience.holdWork &&
    !skipHoldWork &&
    "workerMop" in presentation.levelAssets
  ) {
    mountHoldWorkDom({
      game,
      sceneKey: presentation.scene.key,
      levelId: presentation.campaignLevel.level.id,
      spec: experience.holdWork,
      toolImagePath: presentation.levelAssets.workerMop.path
    });
  } else {
    document.body.dataset.holdWork = experience.holdWork ? "skipped" : "none";
  }

  const exposeTestBridge = options.exposeTestBridge ?? (locationParameters().get("test") === "1");
  if (exposeTestBridge) {
    const testWindow = window as Window & {
      __IMMERSIVE_GAME__?: Phaser.Game;
      __CAMPAIGN_SESSION__?: CampaignSession;
    };
    testWindow.__IMMERSIVE_GAME__ = game;
    testWindow.__CAMPAIGN_SESSION__ = session;
  }

  const skipBriefing = options.skipBriefing ?? briefingDisabledFromLocation();
  if (skipBriefing) {
    document.body.dataset.levelBriefing = "skipped";
  } else {
    let coreReady = false;
    let startRequested = false;

    const resumeShift = (): void => {
      if (!coreReady || !startRequested) return;
      game.scene.resume(presentation.scene.key);
      crazyGamesPlatform.gameplayStart();
      document.body.dataset.levelBriefing = "closed";
    };

    const onStart = (): void => {
      startRequested = true;
      resumeShift();
    };

    if (experience.checklist) {
      mountGuidedLevelBriefingDomOverlay(
        {
          levelLabel: presentation.campaignLevel.levelLabel,
          dayLabel: presentation.campaignShift.dayLabel,
          experience,
          checklist: experience.checklist
        },
        onStart
      );
    } else {
      mountLevelBriefingDomOverlay(
        {
          levelLabel: presentation.campaignLevel.levelLabel,
          dayLabel: presentation.campaignShift.dayLabel,
          startTime: presentation.runtime.shift.startTime,
          experience
        },
        onStart
      );
    }

    game.events.once(Phaser.Core.Events.READY, () => {
      coreReady = true;
      game.scene.pause(presentation.scene.key);
      crazyGamesPlatform.gameplayStop();
      resumeShift();
    });
  }

  crazyGamesPlatform.bindGame(game);
  return game;
}
