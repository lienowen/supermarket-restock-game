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
import { navigateToLevel } from "../../infrastructure/browser/BrowserLevelNavigator";
import { PlayerNavigationView } from "../actors/PlayerNavigationView";
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
  private previousStep?: CheckoutSceneStep;

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
    const visual = this.visualPreset;
    document.body.dataset.gameScene = context.scene.datasetName;
    document.body.dataset.gameArchitecture = context.scene.architecture;
    document.body.dataset.activeShift = context.runtime.shift.id;
    document.body.dataset.activeDay = String(context.campaignShift.dayNumber);
    document.body.dataset.activeLevel = context.campaignLevel.level.id;
    document.body.dataset.activeMode = context.mode;
    this.cameras.main.setBackgroundColor("#171712");

    new StarterMarketEnvironmentView(this, context).create();
    this.station = new CheckoutStationView(this, {
      checkoutPosition: context.world.checkout,
      queueStart: context.world.customerQueueStart,
      customerAssetKeys: context.levelAssets.customers.map((asset) => asset.key),
      customerCount: context.runtime.customerCount,
      scanDurationMs: context.campaignLevel.level.tuning.scanDurationMs,
      queueAdvanceDurationMs: context.campaignLevel.level.tuning.queueAdvanceDurationMs,
      panelColor: context.palette.hud,
      accentColor: context.palette.gold,
      visual
    });
    this.player = new PlayerNavigationView(this, {
      start: {
        x: context.world.checkout.x + visual.workerStartOffset.x,
        y: context.world.checkout.y + visual.workerStartOffset.y
      },
      bounds: context.visual.actor.navigationBounds,
      speed: context.campaignLevel.level.navigation.moveSpeed,
      assetKey: context.levelAssets.worker.key,
      displaySize: visual.actor.idleSize,
      shadowOffset: visual.actor.shadowOffset,
      name: "checkout-worker",
      baseDepth: 24
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

  private performCurrentAction(): void {
    const snapshot = this.controller.snapshot();
    if (!this.canInteract(snapshot)) return;
    const action = this.controller.actionForCurrentStep();
    if (!action) return;

    const tuning = this.context.campaignLevel.level.tuning;
    const lockDuration = action === "SCAN_CUSTOMER"
      ? tuning.scanDurationMs + tuning.queueAdvanceDurationMs
      : 280;
    this.interactionGate.lockFor(lockDuration);
    const accepted = this.controller.dispatch(action);
    if (!accepted) return;

    const position = this.player?.position();
    if (position) {
      playActionFeedback(this, position, action === "SCAN_CUSTOMER" ? "scan" : "interact");
    }
  }

  private sync(snapshot: CheckoutSceneSnapshot, copy: CheckoutSceneCopy): void {
    const context = this.context;
    this.hud?.update(
      {
        step: snapshot.step,
        stockedRows: snapshot.customersServed,
        totalRows: snapshot.totalCustomers,
        progressUnit: "CUSTOMERS",
        coins: snapshot.coins,
        stars: snapshot.stars
      },
      copy
    );
    this.station?.sync(snapshot);
    this.syncTarget(snapshot);

    if (snapshot.step === "complete" && this.previousStep !== "complete") {
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
