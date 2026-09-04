import Phaser from "phaser";
import { crazyGamesPlatform } from "../../../platform/crazyGamesPlatform";
import {
  CheckoutSceneController,
  type CheckoutSceneCopy,
  type CheckoutSceneSnapshot,
  type CheckoutSceneStep
} from "../../application/CheckoutSceneController";
import type { NavigationPoint } from "../../application/PlayerNavigationController";
import { resolveLevelProgression } from "../../application/LevelProgression";
import { resolveCheckoutPatienceExperienceSpec } from "../../content/experience/CheckoutPatienceExperienceSpec";
import { gameDomainEvents } from "../../events/GameDomainEvents";
import { navigateToLevel } from "../../infrastructure/browser/BrowserLevelNavigator";
import { PlayerNavigationView } from "../actors/PlayerNavigationView";
import { prepareCheckoutActorTexture } from "../checkout/CheckoutMatteTexture";
import { CheckoutStationView } from "../checkout/CheckoutStationView";
import type { CheckoutStarterMarketPresentationContext } from "../context/StarterMarketPresentationContext";
import { playActionFeedback } from "../effects/ActionFeedback";
import { playRestockCompletionFeedback } from "../effects/RestockCompletionFeedback";
import { InteractionGate } from "../interactions/InteractionGate";
import { InteractionTargetView } from "../interactions/InteractionTargetView";
import { CheckoutTargetResolver } from "../interactions/CheckoutTargetResolver";
import { LevelCompleteOverlay } from "../ui/LevelCompleteOverlay";
import { ShiftHud } from "../ui/ShiftHud";
import { resolveLevelVisualPreset } from "../visual/LevelVisualPresetResolver";
import type { CheckoutLevelVisualPreset } from "../visual/MarketLevelVisualPreset";
import { StarterMarketEnvironmentView } from "../world/StarterMarketEnvironmentView";
import type { SceneCampaignSessionContext } from "./StarterMarketScene";

const authoredCheckoutScale = (
  visual: CheckoutLevelVisualPreset
): CheckoutLevelVisualPreset => Object.freeze({
  ...visual,
  actor: Object.freeze({
    ...visual.actor,
    idleSize: Object.freeze({ width: 210, height: 245 })
  }),
  station: Object.freeze({
    ...visual.station,
    counterSize: Object.freeze({ width: 310, height: 270 }),
    shadowSize: Object.freeze({ width: 220, height: 28 }),
    registerOffset: Object.freeze({ x: 34, y: -55 }),
    laneLightOffset: Object.freeze({ x: -52, y: -45 }),
    scanBeamOffset: Object.freeze({ x: -28, y: -26 }),
    scanBeamSize: Object.freeze({ width: 56, height: 5 })
  })
});

export class CheckoutMarketScene extends Phaser.Scene {
  readonly controller: CheckoutSceneController;

  private readonly interactionGate = new InteractionGate();
  private readonly targetResolver: CheckoutTargetResolver;
  private readonly visualPreset: CheckoutLevelVisualPreset;
  private readonly disposers: Array<() => void> = [];
  private hud?: ShiftHud;
  private station?: CheckoutStationView;
  private player?: PlayerNavigationView;
  private target?: InteractionTargetView;
  private completionOverlay?: LevelCompleteOverlay;
  private workerIdleTextureKey?: string;
  private workerScanTextureKey?: string;
  private previousStep?: CheckoutSceneStep;
  private previousProgress = -1;

  constructor(
    private readonly context: CheckoutStarterMarketPresentationContext,
    private readonly campaignSession?: SceneCampaignSessionContext
  ) {
    super(context.scene.key);
    this.visualPreset = resolveLevelVisualPreset(context.campaignLevel.level);
    const initialEconomy = campaignSession?.initialEconomy ?? {
      coins: context.campaignLevel.level.tuning.initialCoins,
      stars: 0,
      reputation: 0
    };
    this.controller = new CheckoutSceneController({
      runtime: context.runtime,
      initialCoins: initialEconomy.coins,
      initialStars: initialEconomy.stars,
      initialReputation: initialEconomy.reputation
    });
    this.targetResolver = new CheckoutTargetResolver(context.world.checkoutService);
  }

  preload(): void {
    this.context.levelAssets.preload.forEach((asset) => this.load.image(asset.key, asset.path));
  }

  create(): void {
    const context = this.context;
    const visual = authoredCheckoutScale(this.visualPreset);
    const basketAsset = context.levelAssets.equipment.find(
      (asset) => asset.key === "equipment-shopping-basket"
    );
    if (!basketAsset) throw new Error("Checkout scene requires the shopping basket asset");

    document.body.dataset.gameScene = context.scene.datasetName;
    document.body.dataset.gameArchitecture = context.scene.architecture;
    document.body.dataset.activeShift = context.runtime.shift.id;
    document.body.dataset.activeDay = String(context.campaignShift.dayNumber);
    document.body.dataset.activeLevel = context.campaignLevel.level.id;
    document.body.dataset.activeMode = context.mode;
    document.body.dataset.checkoutEnvironment = context.levelAssets.environment.key;
    this.cameras.main.setBackgroundColor("#171712");

    const workerIdleTexture = prepareCheckoutActorTexture(
      this,
      context.levelAssets.worker.key,
      "worker-idle"
    );
    const workerWalkTextures: readonly [string, string] = [
      prepareCheckoutActorTexture(this, context.levelAssets.workerWalk[0].key, "worker-walk-1"),
      prepareCheckoutActorTexture(this, context.levelAssets.workerWalk[1].key, "worker-walk-2")
    ];
    const workerScanTexture = prepareCheckoutActorTexture(
      this,
      context.levelAssets.workerScan.key,
      "worker-scan"
    );
    this.workerIdleTextureKey = workerIdleTexture;
    this.workerScanTextureKey = workerScanTexture;

    new StarterMarketEnvironmentView(this, context).create();
    this.station = new CheckoutStationView(this, {
      checkoutPosition: context.world.checkout,
      queueStart: context.world.customerQueueStart,
      checkoutAssetKey: context.levelAssets.fixture.key,
      basketAssetKey: basketAsset.key,
      customerAssetKeys: context.levelAssets.customers.map((asset) => asset.key),
      productAssetKeys: context.levelAssets.products.map((asset) => asset.key),
      customerCount: context.runtime.customerCount,
      scanDurationMs: context.campaignLevel.level.tuning.scanDurationMs,
      queueAdvanceDurationMs: context.campaignLevel.level.tuning.queueAdvanceDurationMs,
      panelColor: context.palette.hud,
      accentColor: context.palette.gold,
      visual
    });
    this.compactCheckoutCustomer();
    this.player = new PlayerNavigationView(this, {
      start: {
        x: context.world.checkout.x + visual.workerStartOffset.x,
        y: context.world.checkout.y + visual.workerStartOffset.y
      },
      bounds: context.visual.actor.navigationBounds,
      speed: context.campaignLevel.level.navigation.moveSpeed,
      assetKey: workerIdleTexture,
      walkAssetKeys: workerWalkTextures,
      displaySize: visual.actor.idleSize,
      shadowOffset: visual.actor.shadowOffset,
      name: "checkout-worker",
      baseDepth: 24,
      solidCutout: false
    });
    this.target = new InteractionTargetView(
      this,
      {
        color: context.visual.targeting.color,
        arrowOffsetY: context.visual.targeting.arrowOffsetY,
        name: "checkout-interaction-target"
      },
      () => this.performCurrentAction()
    );
    this.hud = new ShiftHud(
      this,
      {
        dayLabel: `${context.labels.day} · ${context.labels.level}`,
        timeLabel: `${context.runtime.shift.startTime} AM`,
        initialObjective: context.runtime.mission.title,
        modeLabel: "CHECKOUT",
        palette: context.palette
      },
      () => this.performCurrentAction()
    );

    this.disposers.push(
      this.interactionGate.subscribe(() => this.syncTarget(this.controller.snapshot())),
      this.controller.subscribe((snapshot, copy) => this.sync(snapshot, copy))
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.dispose());

    crazyGamesPlatform.loadingStop();
    crazyGamesPlatform.gameplayStart();
    crazyGamesPlatform.setGameContext({
      game: "supermarket-restock",
      version: context.scene.architecture,
      campaign: context.campaignShift.campaignId,
      day: String(context.campaignShift.dayNumber),
      level: context.campaignLevel.level.id,
      mode: context.mode,
      shift: context.runtime.shift.id,
      task: context.runtime.mission.id
    });
  }

  update(_time: number, delta: number): void {
    this.player?.update(delta);
    this.syncTarget(this.controller.snapshot());
  }

  isInteractionReady(): boolean {
    return this.canInteract(this.controller.snapshot());
  }

  playerPosition(): NavigationPoint | undefined {
    return this.player?.position();
  }

  /**
   * The DOM checkout owns scan/weight validation. Once that flow reaches READY,
   * payment must commit directly through the checkout controller instead of
   * re-emitting the Phaser HUD hit target (whose interactive state can change
   * during overlay and queue transitions).
   */
  confirmPatiencePayment(): boolean {
    if (
      this.controller.snapshot().step !== "serve" ||
      !resolveCheckoutPatienceExperienceSpec(this.context.campaignLevel.level)
    ) return false;
    return this.dispatchAction("SCAN_CUSTOMER");
  }

  private compactCheckoutCustomer(): void {
    const customer = this.children.getByName("checkout-active-customer") as Phaser.GameObjects.Image | null;
    customer?.setDisplaySize(140, 230);
    const shadow = this.children.getByName("checkout-customer-shadow") as Phaser.GameObjects.Ellipse | null;
    shadow?.setDisplaySize(86, 18);
    document.body.dataset.checkoutScale = "authored-background-compact-v3";
  }

  private performCurrentAction(): void {
    const snapshot = this.controller.snapshot();
    if (!this.canInteract(snapshot)) return;
    const action = this.controller.actionForCurrentStep();
    if (!action) return;

    this.dispatchAction(action);
  }

  private dispatchAction(action: "OPEN_REGISTER" | "SCAN_CUSTOMER"): boolean {
    const tuning = this.context.campaignLevel.level.tuning;
    const usesPatienceCheckout = Boolean(
      resolveCheckoutPatienceExperienceSpec(this.context.campaignLevel.level)
    );
    const lockDuration = action === "SCAN_CUSTOMER"
      ? (usesPatienceCheckout ? 0 : tuning.scanDurationMs + tuning.queueAdvanceDurationMs)
      : 280;
    this.interactionGate.lockFor(lockDuration);
    const accepted = this.controller.dispatch(action);
    if (!accepted) return false;

    gameDomainEvents.emit("task.action-accepted", {
      levelId: this.context.campaignLevel.level.id,
      mode: this.context.mode,
      action
    });

    if (action === "SCAN_CUSTOMER") {
      const actorSize = authoredCheckoutScale(this.visualPreset).actor.idleSize;
      this.player?.setTexture(this.workerScanTextureKey ?? this.context.levelAssets.workerScan.key);
      this.player?.setDisplaySize(actorSize.width, actorSize.height);
      this.time.delayedCall(
        Math.max(220, tuning.scanDurationMs),
        () => {
          this.player?.setTexture(this.workerIdleTextureKey ?? this.context.levelAssets.worker.key);
          this.player?.setDisplaySize(actorSize.width, actorSize.height);
        }
      );
    }

    const position = this.player?.position();
    if (position) {
      playActionFeedback(this, position, action === "SCAN_CUSTOMER" ? "scan" : "interact");
    }
    return true;
  }

  private sync(snapshot: CheckoutSceneSnapshot, copy: CheckoutSceneCopy): void {
    const context = this.context;
    this.hud?.update(
      {
        step: snapshot.step,
        stockedRows: snapshot.customersServed,
        totalRows: snapshot.totalCustomers,
        progressUnit: "ORDERS",
        coins: snapshot.coins,
        stars: snapshot.stars
      },
      copy
    );
    this.station?.sync(snapshot);
    this.syncTarget(snapshot);

    if (snapshot.customersServed !== this.previousProgress) {
      if (this.previousProgress >= 0) {
        gameDomainEvents.emit("task.progressed", {
          levelId: context.campaignLevel.level.id,
          mode: context.mode,
          progress: snapshot.customersServed,
          total: snapshot.totalCustomers
        });
      }
      this.previousProgress = snapshot.customersServed;
    }

    if (snapshot.step === "complete" && this.previousStep !== "complete") {
      gameDomainEvents.emit("task.completed", {
        levelId: context.campaignLevel.level.id,
        mode: context.mode,
        economy: {
          coins: snapshot.coins,
          stars: snapshot.stars,
          reputation: snapshot.reputation
        }
      });

      playRestockCompletionFeedback(this, {
        title: context.labels.completionTitle,
        coins: context.runtime.reward.totalCoins,
        stars: context.runtime.reward.totalStars,
        hudColor: context.palette.hud,
        accentColor: context.palette.gold,
        centreX: context.world.width / 2,
        centreY: 400,
        sparkleOriginX: context.world.checkout.x,
        sparkleOriginY: context.world.checkout.y - 70
      });

      this.campaignSession?.session.completeLevel(
        context.campaignLevel.level.id,
        context.campaignLevel.nextLevelId,
        {
          coins: snapshot.coins,
          stars: snapshot.stars,
          reputation: snapshot.reputation
        }
      );
      const progression = resolveLevelProgression(
        context.campaignLevel.level.id,
        context.campaignLevel.nextLevelId,
        this.campaignSession?.firstLevelId ?? context.campaignLevel.level.id
      );
      this.completionOverlay = new LevelCompleteOverlay(
        this,
        {
          worldWidth: context.world.width,
          worldHeight: context.world.height,
          centreX: context.world.width / 2,
          centreY: 505,
          statusLabel: progression.statusLabel,
          levelTitle: context.labels.levelTitle,
          rewardLabel: `+${context.runtime.reward.totalStars} STAR   +${context.runtime.reward.totalCoins} COINS   +${context.runtime.reward.totalReputation} REP`,
          actionLabel: progression.actionLabel,
          panelColor: context.palette.hud,
          accentColor: context.palette.gold
        },
        () => {
          if (progression.kind === "replay-campaign") {
            this.campaignSession?.session.reset();
          }
          navigateToLevel(progression.targetLevelId);
        }
      );
      this.completionOverlay.show();

      crazyGamesPlatform.reportProgress(
        Math.round((context.campaignLevel.levelNumber / context.campaignTotalLevels) * 100)
      );
      crazyGamesPlatform.gameplayStop();
    }

    this.previousStep = snapshot.step;
  }

  private syncTarget(snapshot: CheckoutSceneSnapshot): void {
    const enabled = this.canInteract(snapshot);
    this.target?.sync(this.targetResolver.resolve(snapshot), enabled);
    this.hud?.setActionEnabled(enabled);
  }

  private canInteract(snapshot: CheckoutSceneSnapshot): boolean {
    return Boolean(
      snapshot.step !== "complete" &&
      this.interactionGate.isReady() &&
      this.player?.isNear(
        this.context.world.checkoutService,
        this.context.campaignLevel.level.navigation.interactionRadius
      )
    );
  }

  private dispose(): void {
    this.disposers.splice(0).forEach((dispose) => dispose());
    this.completionOverlay?.destroy();
    this.player?.destroy();
    this.station?.destroy();
    this.target?.destroy();
    this.interactionGate.destroy();
  }
}
