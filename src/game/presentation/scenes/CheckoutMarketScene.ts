import Phaser from "phaser";
import { crazyGamesPlatform } from "../../../platform/crazyGamesPlatform";
import {
  CheckoutSceneController,
  type CheckoutSceneCopy,
  type CheckoutSceneSnapshot,
  type CheckoutSceneStep
} from "../../application/CheckoutSceneController";
import { resolveLevelProgression } from "../../application/LevelProgression";
import { navigateToLevel } from "../../infrastructure/browser/BrowserLevelNavigator";
import { CheckoutStationView } from "../checkout/CheckoutStationView";
import type { CheckoutStarterMarketPresentationContext } from "../context/StarterMarketPresentationContext";
import { playRestockCompletionFeedback } from "../effects/RestockCompletionFeedback";
import { InteractionGate } from "../interactions/InteractionGate";
import { InteractionTargetView } from "../interactions/InteractionTargetView";
import { CheckoutTargetResolver } from "../interactions/CheckoutTargetResolver";
import { LevelCompleteOverlay } from "../ui/LevelCompleteOverlay";
import { ShiftHud } from "../ui/ShiftHud";
import { StarterMarketEnvironmentView } from "../world/StarterMarketEnvironmentView";

export class CheckoutMarketScene extends Phaser.Scene {
  readonly controller: CheckoutSceneController;

  private readonly interactionGate = new InteractionGate();
  private readonly targetResolver: CheckoutTargetResolver;
  private readonly disposers: Array<() => void> = [];
  private hud?: ShiftHud;
  private station?: CheckoutStationView;
  private target?: InteractionTargetView;
  private completionOverlay?: LevelCompleteOverlay;
  private previousStep?: CheckoutSceneStep;

  constructor(private readonly context: CheckoutStarterMarketPresentationContext) {
    super(context.scene.key);
    this.controller = new CheckoutSceneController({
      runtime: context.runtime,
      initialCoins: context.campaignLevel.level.tuning.initialCoins
    });
    this.targetResolver = new CheckoutTargetResolver(context.world.checkoutService);
  }

  preload(): void {
    this.context.levelAssets.preload.forEach((asset) => this.load.image(asset.key, asset.path));
  }

  create(): void {
    const context = this.context;
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
      workerAssetKey: context.levelAssets.worker.key,
      customerAssetKeys: context.levelAssets.customers.map((asset) => asset.key),
      customerCount: context.runtime.customerCount,
      scanDurationMs: context.campaignLevel.level.tuning.scanDurationMs,
      queueAdvanceDurationMs: context.campaignLevel.level.tuning.queueAdvanceDurationMs,
      panelColor: context.palette.hud,
      accentColor: context.palette.gold
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

  private performCurrentAction(): void {
    if (!this.interactionGate.isReady()) return;
    const action = this.controller.actionForCurrentStep();
    if (!action) return;

    const tuning = this.context.campaignLevel.level.tuning;
    const lockDuration = action === "SCAN_CUSTOMER"
      ? tuning.scanDurationMs + tuning.queueAdvanceDurationMs
      : 280;
    this.interactionGate.lockFor(lockDuration);
    this.controller.dispatch(action);
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

      const progression = resolveLevelProgression(
        context.campaignLevel.level.id,
        context.campaignLevel.nextLevelId
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
        () => navigateToLevel(progression.targetLevelId)
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
    this.target?.sync(
      this.targetResolver.resolve(snapshot),
      this.interactionGate.isReady()
    );
  }

  private dispose(): void {
    this.disposers.splice(0).forEach((dispose) => dispose());
    this.completionOverlay?.destroy();
    this.station?.destroy();
    this.target?.destroy();
    this.interactionGate.destroy();
  }
}
