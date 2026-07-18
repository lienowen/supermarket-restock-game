import Phaser from "phaser";
import { crazyGamesPlatform } from "../../../platform/crazyGamesPlatform";
import {
  RestockSceneController,
  type RestockSceneCopy,
  type RestockSceneSnapshot,
  type RestockSceneStep
} from "../../application/RestockSceneController";
import { RETAINED_RUNTIME_ASSET_LIST } from "../assets/RetainedAssetManifest";
import { RestockActorView } from "../actors/RestockActorView";
import { STARTER_MARKET_PRESENTATION } from "../context/StarterMarketPresentationContext";
import { playRestockCompletionFeedback } from "../effects/RestockCompletionFeedback";
import { BeverageCoolerView } from "../fixtures/BeverageCoolerView";
import { InteractionGate } from "../interactions/InteractionGate";
import { InteractionTargetView } from "../interactions/InteractionTargetView";
import { RestockTargetResolver } from "../interactions/RestockTargetResolver";
import { ShiftHud } from "../ui/ShiftHud";
import { StarterMarketEnvironmentView } from "../world/StarterMarketEnvironmentView";

const CONTEXT = STARTER_MARKET_PRESENTATION;

export class StarterMarketScene extends Phaser.Scene {
  readonly controller = new RestockSceneController({
    runtime: CONTEXT.runtime,
    initialCoins: 100,
    sourceLocationId: "staff-backroom",
    destinationLocationId: "beverage-restock-zone"
  });

  private readonly interactionGate = new InteractionGate();
  private readonly targetResolver = new RestockTargetResolver({
    backroomBox: CONTEXT.world.backroomBox,
    cartStart: CONTEXT.world.cartStart,
    cartDestination: CONTEXT.world.cartCooler,
    coolerCentreX: CONTEXT.visual.cooler.centre.x,
    coolerRowYs: CONTEXT.visual.cooler.rowYs,
    coolerTargetWidth: CONTEXT.visual.cooler.activeStockBounds.width
  });
  private readonly disposers: Array<() => void> = [];
  private hud?: ShiftHud;
  private actors?: RestockActorView;
  private cooler?: BeverageCoolerView;
  private target?: InteractionTargetView;
  private previousStep?: RestockSceneStep;

  constructor() {
    super(CONTEXT.scene.key);
  }

  preload(): void {
    RETAINED_RUNTIME_ASSET_LIST.forEach((asset) => this.load.image(asset.key, asset.path));
  }

  create(): void {
    document.body.dataset.gameScene = CONTEXT.scene.datasetName;
    document.body.dataset.gameArchitecture = CONTEXT.scene.architecture;
    document.body.dataset.activeShift = CONTEXT.runtime.shift.id;
    this.cameras.main.setBackgroundColor("#171712");

    new StarterMarketEnvironmentView(this, CONTEXT).create();
    this.cooler = this.createCooler();
    this.actors = this.createActors();
    this.target = new InteractionTargetView(
      this,
      {
        color: CONTEXT.visual.targeting.color,
        arrowOffsetY: CONTEXT.visual.targeting.arrowOffsetY,
        name: "starter-market-interaction-target"
      },
      () => this.performCurrentAction()
    );
    this.hud = new ShiftHud(
      this,
      {
        dayLabel: CONTEXT.labels.day,
        timeLabel: `${CONTEXT.runtime.shift.startTime} AM`,
        initialObjective: CONTEXT.runtime.mission.title,
        palette: CONTEXT.palette
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
      version: CONTEXT.scene.architecture,
      shift: CONTEXT.runtime.shift.id,
      task: CONTEXT.runtime.mission.id
    });
  }

  isInteractionReady(): boolean {
    return this.interactionGate.isReady();
  }

  private createCooler(): BeverageCoolerView {
    const cooler = new BeverageCoolerView(this, {
      centreX: CONTEXT.world.beverageCooler.x,
      baseY: 495,
      backgroundY: 487,
      frameWidth: 555,
      frameHeight: 660,
      displayWidth: CONTEXT.visual.cooler.displaySize.width,
      displayHeight: CONTEXT.visual.cooler.displaySize.height,
      departmentLabel: CONTEXT.labels.beverageDepartment,
      subtitleLabel: CONTEXT.labels.beverageSubtitle,
      rowYs: CONTEXT.visual.cooler.rowYs,
      ambientPositions: [
        ...CONTEXT.visual.cooler.ambientLeftXs,
        ...CONTEXT.visual.cooler.ambientRightXs
      ],
      restockStartX: CONTEXT.visual.cooler.restockStartX,
      restockStepX: CONTEXT.visual.cooler.restockStepX,
      restockItemCount: CONTEXT.visual.cooler.restockItemCount,
      coolerAssetKey: CONTEXT.assets.fixtures.beverageCooler.key,
      ambientProductKeys: [
        CONTEXT.assets.products.colaBottle.key,
        CONTEXT.assets.products.milkBottle.key,
        CONTEXT.assets.products.waterBottle.key
      ],
      restockProductKey: CONTEXT.assets.products.colaBottle.key
    });
    cooler.create();
    return cooler;
  }

  private createActors(): RestockActorView {
    return new RestockActorView(this, {
      workerStart: CONTEXT.world.workerStart,
      workerDestination: CONTEXT.world.workerCooler,
      caseStart: CONTEXT.world.backroomBox,
      cartStart: CONTEXT.world.cartStart,
      cartDestination: CONTEXT.world.cartCooler,
      workerPushAssetKey: CONTEXT.assets.characters.workerPush.key,
      workerCarryAssetKey: CONTEXT.assets.characters.workerCarry.key,
      cartAssetKey: CONTEXT.assets.props.cart.key,
      caseAssetKey: CONTEXT.assets.props.colaCase.key,
      pushSize: CONTEXT.visual.actor.pushSize,
      carrySize: CONTEXT.visual.actor.carrySize,
      shadowOffset: CONTEXT.visual.actor.shadowOffset
    });
  }

  private performCurrentAction(): void {
    if (!this.interactionGate.isReady()) return;
    const action = this.controller.actionForCurrentStep();
    if (action) this.controller.dispatch(action);
  }

  private sync(snapshot: RestockSceneSnapshot, copy: RestockSceneCopy): void {
    this.hud?.update(snapshot, copy);
    this.actors?.sync(snapshot, {
      onTravelStart: (maxDurationMs) => this.interactionGate.lockFor(maxDurationMs),
      onTravelComplete: () => this.interactionGate.unlock()
    });
    this.cooler?.sync(snapshot.stockedRows);
    this.syncTarget(snapshot);

    if (snapshot.step === "complete" && this.previousStep !== "complete") {
      playRestockCompletionFeedback(this, {
        title: CONTEXT.labels.completionTitle,
        coins: CONTEXT.runtime.reward.totalCoins,
        stars: CONTEXT.runtime.reward.totalStars,
        hudColor: CONTEXT.palette.hud,
        accentColor: CONTEXT.palette.gold,
        centreX: CONTEXT.world.width / 2,
        centreY: 430,
        sparkleOriginX: CONTEXT.world.beverageCooler.x,
        sparkleOriginY: 490
      });
      crazyGamesPlatform.reportProgress(20);
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
    this.target?.destroy();
    this.interactionGate.destroy();
  }
}
