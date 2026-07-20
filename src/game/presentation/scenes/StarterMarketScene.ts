import Phaser from "phaser";
import { crazyGamesPlatform } from "../../../platform/crazyGamesPlatform";
import { resolveLevelProgression } from "../../application/LevelProgression";
import {
  RestockSceneController,
  type RestockSceneCopy,
  type RestockSceneSnapshot,
  type RestockSceneStep
} from "../../application/RestockSceneController";
import { navigateToLevel } from "../../infrastructure/browser/BrowserLevelNavigator";
import { RestockActorView } from "../actors/RestockActorView";
import {
  STARTER_MARKET_PRESENTATION,
  type StarterMarketPresentationContext
} from "../context/StarterMarketPresentationContext";
import { playRestockCompletionFeedback } from "../effects/RestockCompletionFeedback";
import { BeverageCoolerView } from "../fixtures/BeverageCoolerView";
import { InteractionGate } from "../interactions/InteractionGate";
import { InteractionTargetView } from "../interactions/InteractionTargetView";
import { RestockTargetResolver } from "../interactions/RestockTargetResolver";
import { LevelCompleteOverlay } from "../ui/LevelCompleteOverlay";
import { ShiftHud } from "../ui/ShiftHud";
import { StarterMarketEnvironmentView } from "../world/StarterMarketEnvironmentView";

export class StarterMarketScene extends Phaser.Scene {
  readonly controller: RestockSceneController;

  private readonly interactionGate = new InteractionGate();
  private readonly targetResolver: RestockTargetResolver;
  private readonly disposers: Array<() => void> = [];
  private hud?: ShiftHud;
  private actors?: RestockActorView;
  private cooler?: BeverageCoolerView;
  private target?: InteractionTargetView;
  private completionOverlay?: LevelCompleteOverlay;
  private previousStep?: RestockSceneStep;

  constructor(
    private readonly context: StarterMarketPresentationContext = STARTER_MARKET_PRESENTATION
  ) {
    super(context.scene.key);
    this.controller = new RestockSceneController({
      runtime: context.runtime,
      initialCoins: context.campaignLevel.level.tuning.initialCoins,
      sourceLocationId: "staff-backroom",
      destinationLocationId: "beverage-restock-zone"
    });
    this.targetResolver = new RestockTargetResolver({
      backroomBox: context.world.backroomBox,
      cartStart: context.world.cartStart,
      cartDestination: context.world.cartCooler,
      coolerCentreX: context.visual.cooler.centre.x,
      coolerRowYs: context.visual.cooler.rowYs,
      coolerTargetWidth: context.visual.cooler.activeStockBounds.width
    });
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
    this.cameras.main.setBackgroundColor("#171712");

    new StarterMarketEnvironmentView(this, context).create();
    this.cooler = this.createCooler();
    this.actors = this.createActors();
    this.target = new InteractionTargetView(
      this,
      {
        color: context.visual.targeting.color,
        arrowOffsetY: context.visual.targeting.arrowOffsetY,
        name: "starter-market-interaction-target"
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
      shift: context.runtime.shift.id,
      task: context.runtime.mission.id
    });
  }

  isInteractionReady(): boolean {
    return this.interactionGate.isReady();
  }

  private createCooler(): BeverageCoolerView {
    const context = this.context;
    const cooler = new BeverageCoolerView(this, {
      centreX: context.world.beverageCooler.x,
      baseY: 495,
      backgroundY: 487,
      frameWidth: 555,
      frameHeight: 660,
      displayWidth: context.visual.cooler.displaySize.width,
      displayHeight: context.visual.cooler.displaySize.height,
      departmentLabel: context.labels.beverageDepartment,
      subtitleLabel: context.labels.beverageSubtitle,
      rowYs: context.visual.cooler.rowYs,
      ambientPositions: [
        ...context.visual.cooler.ambientLeftXs,
        ...context.visual.cooler.ambientRightXs
      ],
      restockStartX: context.visual.cooler.restockStartX,
      restockStepX: context.visual.cooler.restockStepX,
      restockItemCount: context.visual.cooler.restockItemCount,
      coolerAssetKey: context.levelAssets.fixture.key,
      ambientProductKeys: context.levelAssets.ambientProducts.map((asset) => asset.key),
      restockProductKey: context.levelAssets.product.key
    });
    cooler.create();
    return cooler;
  }

  private createActors(): RestockActorView {
    const context = this.context;
    const tuning = context.campaignLevel.level.tuning;
    return new RestockActorView(this, {
      workerStart: context.world.workerStart,
      workerDestination: context.world.workerCooler,
      caseStart: context.world.backroomBox,
      cartStart: context.world.cartStart,
      cartDestination: context.world.cartCooler,
      workerPushAssetKey: context.levelAssets.workerPush.key,
      workerCarryAssetKey: context.levelAssets.workerCarry.key,
      cartAssetKey: context.levelAssets.cart.key,
      caseAssetKey: context.levelAssets.case.key,
      travelDurationMs: tuning.travelDurationMs,
      travelLockBufferMs: tuning.travelLockBufferMs ?? 200,
      pushSize: context.visual.actor.pushSize,
      carrySize: context.visual.actor.carrySize,
      shadowOffset: context.visual.actor.shadowOffset
    });
  }

  private performCurrentAction(): void {
    if (!this.interactionGate.isReady()) return;
    const action = this.controller.actionForCurrentStep();
    if (action) this.controller.dispatch(action);
  }

  private sync(snapshot: RestockSceneSnapshot, copy: RestockSceneCopy): void {
    const context = this.context;
    this.hud?.update(snapshot, copy);
    this.actors?.sync(snapshot, {
      onTravelStart: (maxDurationMs) => this.interactionGate.lockFor(maxDurationMs),
      onTravelComplete: () => this.interactionGate.unlock()
    });
    this.cooler?.sync(snapshot.stockedRows);
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
        sparkleOriginX: context.world.beverageCooler.x,
        sparkleOriginY: 490
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
          rewardLabel: `+${context.runtime.reward.totalStars} STAR   +${context.runtime.reward.totalCoins} COINS`,
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

  private syncTarget(snapshot: RestockSceneSnapshot): void {
    this.target?.sync(
      this.targetResolver.resolve(snapshot),
      this.interactionGate.isReady()
    );
  }

  private dispose(): void {
    this.disposers.splice(0).forEach((dispose) => dispose());
    this.completionOverlay?.destroy();
    this.target?.destroy();
    this.interactionGate.destroy();
  }
}
