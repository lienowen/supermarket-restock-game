import Phaser from "phaser";
import { crazyGamesPlatform } from "../../../platform/crazyGamesPlatform";
import { CampaignSession } from "../../application/CampaignSession";
import { STARTER_RUNTIME_ASSET_REGISTRY } from "../../assets/RuntimeAssetRegistry";
import { resolveLevelExperienceSpec } from "../../content/experience/LevelExperienceSpec";
import { gameDomainEvents } from "../../events/GameDomainEvents";
import {
  createStarterMarketPresentationContext,
  MAIN_LEVEL_CAMPAIGN_RUNTIME
} from "../../presentation/context/StarterMarketPresentationContext";
import { applyMarketUpgradesToPresentation } from "../../presentation/context/MarketUpgradePresentation";
import type { SceneCampaignSessionContext } from "../../presentation/scenes/StarterMarketScene";
import { mountCheckoutScanDom } from "../../presentation/ui/CheckoutScanDom";
import { mountGuidedDragActionDom } from "../../presentation/ui/GuidedDragActionDom";
import { mountLevelBriefingDomOverlay } from "../../presentation/ui/LevelBriefingDomOverlay";
import { mountLevelChecklistDom } from "../../presentation/ui/LevelChecklistDom";
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
  readonly skipCheckoutScan?: boolean;
}

const locationParameters = (): URLSearchParams => new URLSearchParams(window.location.search);

const requestedLevelFromLocation = (): string | undefined => {
  const parameters = locationParameters();
  return parameters.get("level")?.trim() || parameters.get("shift")?.trim() || undefined;
};

const briefingDisabledFromLocation = (): boolean => {
  const parameters = locationParameters();
  const explicitBriefing = parameters.get("briefing");
  if (explicitBriefing === "1") return false;
  return explicitBriefing === "0" || parameters.get("test") === "1";
};

const guidedInteractionsDisabledFromLocation = (): boolean => {
  const parameters = locationParameters();
  const explicitGuided = parameters.get("guided");
  if (explicitGuided === "1") return false;
  return explicitGuided === "0" || parameters.get("test") === "1";
};

const checkoutScanDisabledFromLocation = (): boolean => {
  const parameters = locationParameters();
  const explicitCheckout = parameters.get("checkout");
  if (explicitCheckout === "1") return false;
  return explicitCheckout === "0" || parameters.get("test") === "1";
};

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
  const experience = resolveLevelExperienceSpec(basePresentation.campaignLevel.level);

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
    mountLevelChecklistDom({
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

  const skipCheckoutScan = options.skipCheckoutScan ?? checkoutScanDisabledFromLocation();
  if (
    experience.checkoutScan &&
    !skipCheckoutScan &&
    "customerCount" in presentation.runtime &&
    "equipment" in presentation.levelAssets
  ) {
    const scannerAsset = presentation.levelAssets.equipment.find(
      (asset) => asset.key === "equipment-barcode-scanner"
    );
    const posAsset = presentation.levelAssets.equipment.find(
      (asset) => asset.key === "equipment-pos-terminal"
    );
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

    mountLevelBriefingDomOverlay(
      {
        levelLabel: presentation.campaignLevel.levelLabel,
        dayLabel: presentation.campaignShift.dayLabel,
        startTime: presentation.runtime.shift.startTime,
        experience
      },
      () => {
        startRequested = true;
        resumeShift();
      }
    );

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
