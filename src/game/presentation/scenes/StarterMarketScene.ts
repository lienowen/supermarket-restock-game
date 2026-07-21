import Phaser from "phaser";
import { crazyGamesPlatform } from "../../../platform/crazyGamesPlatform";
import type {
  CampaignEconomy,
  CampaignSession
} from "../../application/CampaignSession";
import type { NavigationPoint } from "../../application/PlayerNavigationController";
import { resolveLevelProgression } from "../../application/LevelProgression";
import {
  RestockRushController,
  type RestockRushSnapshot
} from "../../application/RestockRushController";
import {
  RestockSceneController,
  type RestockSceneAction,
  type RestockSceneCopy,
  type RestockSceneSnapshot,
  type RestockSceneStep
} from "../../application/RestockSceneController";
import { gameDomainEvents } from "../../events/GameDomainEvents";
import { navigateToLevel } from "../../infrastructure/browser/BrowserLevelNavigator";
import { RestockActorView } from "../actors/RestockActorView";
import {
  STARTER_MARKET_PRESENTATION,
  type RestockStarterMarketPresentationContext
} from "../context/StarterMarketPresentationContext";
import { playActionFeedback } from "../effects/ActionFeedback";
import { playRestockCompletionFeedback } from "../effects/RestockCompletionFeedback";
import { BeverageCoolerView } from "../fixtures/BeverageCoolerView";
import { InteractionGate } from "../interactions/InteractionGate";
import { InteractionTargetView } from "../interactions/InteractionTargetView";
import { RestockTargetResolver } from "../interactions/RestockTargetResolver";
import { LevelCompleteOverlay } from "../ui/LevelCompleteOverlay";
import { RestockRushMeter } from "../ui/RestockRushMeter";
import { ShiftHud } from "../ui/ShiftHud";
import { resolveLevelVisualPreset } from "../visual/LevelVisualPresetResolver";
import type { RestockLevelVisualPreset } from "../visual/MarketLevelVisualPreset";
import { StarterMarketEnvironmentView } from "../world/StarterMarketEnvironmentView";

export interface SceneCampaignSessionContext {
  readonly session: CampaignSession;
  readonly initialEconomy: CampaignEconomy;
  readonly firstLevelId: string;
}

export class StarterMarketScene extends Phaser.Scene {
  readonly controller: RestockSceneController;

  private readonly interactionGate = new InteractionGate();
  private readonly targetResolver: RestockTargetResolver;
  private readonly visualPreset: RestockLevelVisualPreset;
  private readonly rush: RestockRushController;
  private readonly disposers: Array<() => void> = [];
  private hud?: ShiftHud;
  private actors?: RestockActorView;
  private cooler?: BeverageCoolerView;
  private target?: InteractionTargetView;
  private rushMeter?: RestockRushMeter;
  private completionOverlay?: LevelCompleteOverlay;
  private previousStep?: RestockSceneStep;
  private previousProgress = -1;
  private pendingAction = false;

  constructor(
    private readonly context: RestockStarterMarketPresentationContext = STARTER_MARKET_PRESENTATION,
    private readonly campaignSession?: SceneCampaignSessionContext
  ) {
    super(context.scene.key);
    this.visualPreset = resolveLevelVisualPreset(context.campaignLevel.level);
    const initialEconomy = campaignSession?.initialEconomy ?? {
      coins: context.campaignLevel.level.tuning.initialCoins,
      stars: 0,
      reputation: 0
    };
    this.controller = new RestockSceneController({
      runtime: context.runtime,
      initialCoins: initialEconomy.coins,
      initialStars: initialEconomy.stars,
      sourceLocationId: "staff-backroom",
      destinationLocationId: "beverage-restock-zone"
    });
    this.targetResolver = new RestockTargetResolver({
      backroomBox: context.world.backroomBox,
      cartStart: context.world.cartStart,
      cartDestination: context.world.cartCooler,
      coolerCentreX: context.world.beverageCooler.x,
      coolerRowYs: this.visualPreset.cooler.rowYs,
      coolerTargetWidth: this.visualPreset.cooler.activeStockWidth
    });
    this.rush = new RestockRushController({
      rowCount: this.visualPreset.cooler.rowYs.length,
      randomSeed: context.campaignLevel.level.randomSeed,
      ...(context.campaignLevel.level.tuning.rush ?? {})
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
    document.body.dataset.activeMode = context.mode;
    this.cameras.main.setBackgroundColor("#171712");

    new StarterMarketEnvironmentView(this, context).create();
    this.cooler = this.createCooler();
    this.rushMeter = new RestockRushMeter(this, {
      x: context.world.beverageCooler.x,
      y: 770,
      accentColor: context.palette.gold
    });
    this.actors = this.createActors();
    this.target = new InteractionTargetView(
      this,
      {
        color: context.visual.targeting.color,
        arrowOffsetY: context.visual.targeting.arrowOffsetY,
        name: "starter-market-interaction-target"
      },
      () => this.requestCurrentAction()
    );
    this.hud = new ShiftHud(
      this,
      {
        dayLabel: `${context.labels.day} · ${context.labels.level}`,
        timeLabel: `${context.runtime.shift.startTime} AM`,
        initialObjective: context.runtime.mission.title,
        modeLabel: "RESTOCK",
        palette: context.palette
      },
      () => this.requestCurrentAction()
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
    this.actors?.update(delta);
    this.advancePendingAction();
    const snapshot = this.controller.snapshot();
    if (snapshot.step === "restock") this.updateRush();
    this.syncTarget(snapshot);
  }

  isInteractionReady(): boolean {
    const snapshot = this.controller.snapshot();
    return snapshot.step === "restock"
      ? this.interactionGate.isReady()
      : this.canInteract(snapshot);
  }

  playerPosition(): NavigationPoint | undefined {
    return this.actors?.position();
  }

  private createCooler(): BeverageCoolerView {
    const context = this.context;
    const preset = this.visualPreset.cooler;
    const cooler = new BeverageCoolerView(this, {
      centreX: context.world.beverageCooler.x,
      baseY: preset.baseY,
      backgroundY: preset.backgroundY,
      frameWidth: preset.frameSize.width,
      frameHeight: preset.frameSize.height,
      displayWidth: preset.displaySize.width,
      displayHeight: preset.displaySize.height,
      departmentLabel: context.labels.beverageDepartment,
      subtitleLabel: context.labels.beverageSubtitle,
      rowYs: preset.rowYs,
      ambientPositions: [
        ...context.visual.cooler.ambientLeftXs,
        ...context.visual.cooler.ambientRightXs
      ],
      restockStartX: context.visual.cooler.restockStartX,
      restockStepX: context.visual.cooler.restockStepX,
      restockItemCount: preset.restockItemCount,
      coolerAssetKey: context.levelAssets.fixture.key,
      ambientProductKeys: context.levelAssets.ambientProducts.map((asset) => asset.key),
      restockProductKey: context.levelAssets.product.key,
      onRowSelected: (rowIndex) => this.selectRushRow(rowIndex)
    });
    cooler.create();
    return cooler;
  }

  private createActors(): RestockActorView {
    const context = this.context;
    const preset = this.visualPreset;
    return new RestockActorView(this, {
      workerStart: context.world.workerStart,
      navigationBounds: context.visual.actor.navigationBounds,
      moveSpeed: context.campaignLevel.level.navigation.moveSpeed,
      caseStart: context.world.backroomBox,
      cartStart: context.world.cartStart,
      cartDestination: context.world.cartCooler,
      workerIdleAssetKey: context.levelAssets.workerIdle.key,
      workerWalkAssetKeys: [
        context.levelAssets.workerWalk[0].key,
        context.levelAssets.workerWalk[1].key
      ],
      workerPushAssetKey: context.levelAssets.workerPush.key,
      workerCarryAssetKey: context.levelAssets.workerCarry.key,
      workerOpenAssetKey: context.levelAssets.workerOpen.key,
      workerStockAssetKey: context.levelAssets.workerStock.key,
      cartAssetKey: context.levelAssets.cart.key,
      cartLoadedAssetKey: context.levelAssets.cartLoaded.key,
      caseAssetKey: context.levelAssets.case.key,
      caseOpenAssetKey: context.levelAssets.caseOpen.key,
      idleSize: preset.actor.idleSize,
      pushSize: preset.actor.pushSize,
      carrySize: preset.actor.carrySize,
      cartSize: preset.props.cartSize,
      caseSize: preset.props.caseSize,
      shadowOffset: preset.actor.shadowOffset,
      onManualNavigation: () => this.cancelPendingAction()
    });
  }

  private requestCurrentAction(): void {
    const snapshot = this.controller.snapshot();
    if (snapshot.step === "restock") return;
    const point = this.interactionPoint(snapshot);
    if (!point || !this.actors || !this.interactionGate.isReady()) return;

    if (this.canInteract(snapshot)) {
      this.pendingAction = false;
      this.performCurrentAction();
      return;
    }

    this.pendingAction = true;
    this.actors.setDestination(point);
    this.syncTarget(snapshot);
  }

  private advancePendingAction(): void {
    if (!this.pendingAction || !this.actors) return;
    const snapshot = this.controller.snapshot();
    const point = this.interactionPoint(snapshot);
    if (!point) {
      this.cancelPendingAction();
      return;
    }

    const configuredRadius = this.context.campaignLevel.level.navigation.interactionRadius;
    const arrivalRadius = Math.min(72, Math.max(42, configuredRadius * 0.5));
    if (!this.interactionGate.isReady() || !this.actors.isNear(point, arrivalRadius)) return;

    this.pendingAction = false;
    this.performCurrentAction();
  }

  private performCurrentAction(): void {
    const snapshot = this.controller.snapshot();
    if (!this.canInteract(snapshot)) return;
    const action = this.controller.actionForCurrentStep();
    if (!action || action === "RESTOCK_ROW" || !this.dispatchSceneAction(action)) return;

    switch (action) {
      case "PICK_BOX":
        this.actors?.setDestination(this.context.world.cartStart);
        return;
      case "LOAD_CART":
        if (this.dispatchSceneAction("PUSH_CART", false)) {
          this.pendingAction = true;
          this.actors?.setDestination(this.context.world.cartCooler);
        }
        return;
      case "PARK_CART":
        this.dispatchSceneAction("OPEN_BOX", false);
        return;
      case "PUSH_CART":
      case "OPEN_BOX":
        return;
    }
  }

  private selectRushRow(rowIndex: number): void {
    const sceneSnapshot = this.controller.snapshot();
    if (
      sceneSnapshot.step !== "restock" ||
      !this.cooler ||
      !this.interactionGate.isReady()
    ) return;

    const result = this.rush.selectRow(rowIndex, this.time.now);
    const rowCentre = this.cooler.rowCentre(rowIndex);
    if (!result.correct) {
      this.cooler.showMistake(rowIndex);
      this.rushMeter?.showMistake("WRONG SHELF");
      playActionFeedback(this, rowCentre, "mistake");
      this.cameras.main.shake(90, 0.0025);
      this.syncRushPresentation(result.snapshot);
      return;
    }

    if (!this.dispatchSceneAction("RESTOCK_ROW", false)) return;
    const streak = result.snapshot.currentStreak;
    playActionFeedback(this, rowCentre, "restock", {
      label: streak > 1 ? `FAST STOCK x${streak}` : "STOCKED!",
      emphasis: 1 + Math.min(0.4, Math.max(0, streak - 1) * 0.09)
    });
    this.cameras.main.shake(55, 0.0014);
    this.syncRushPresentation(result.snapshot);
  }

  private updateRush(): void {
    const now = this.time.now;
    const expiredRow = this.rush.snapshot(now).activeRowIndex;
    const result = this.rush.tick(now);
    if (result.event === "timeout" && expiredRow !== undefined && this.cooler) {
      const rowCentre = this.cooler.rowCentre(expiredRow);
      this.cooler.showMistake(expiredRow);
      this.rushMeter?.showMistake("TOO SLOW");
      playActionFeedback(this, rowCentre, "mistake", { label: "TOO SLOW" });
      this.cameras.main.shake(80, 0.002);
    }
    this.syncRushPresentation(result.snapshot);
  }

  private syncRushPresentation(snapshot: RestockRushSnapshot): void {
    this.cooler?.syncRush({
      filledRowIndexes: snapshot.filledRowIndexes,
      activeRowIndex: snapshot.activeRowIndex,
      remainingRatio: snapshot.remainingRatio,
      interactionEnabled: !snapshot.complete && this.interactionGate.isReady()
    });
    this.rushMeter?.sync(snapshot);
  }

  private dispatchSceneAction(action: RestockSceneAction, feedback = true): boolean {
    const accepted = this.controller.dispatch(action);
    if (!accepted) return false;

    gameDomainEvents.emit("task.action-accepted", {
      levelId: this.context.campaignLevel.level.id,
      mode: this.context.mode,
      action
    });

    if (!feedback) return true;
    const position = this.actors?.position();
    if (position) playActionFeedback(this, position, "interact");
    return true;
  }

  private cancelPendingAction(): void {
    if (!this.pendingAction) return;
    this.pendingAction = false;
    this.syncTarget(this.controller.snapshot());
  }

  private sync(snapshot: RestockSceneSnapshot, copy: RestockSceneCopy): void {
    const context = this.context;
    this.hud?.update(snapshot, copy);
    this.actors?.sync(snapshot);

    if (snapshot.step === "restock") {
      const rushSnapshot = this.previousStep === "restock"
        ? this.rush.snapshot(this.time.now)
        : this.rush.start(this.time.now);
      this.syncRushPresentation(rushSnapshot);
    } else if (snapshot.step === "complete" && this.rush.snapshot(this.time.now).started) {
      this.syncRushPresentation(this.rush.snapshot(this.time.now));
    } else {
      this.cooler?.sync(snapshot.stockedRows);
    }
    this.syncTarget(snapshot);

    if (snapshot.stockedRows !== this.previousProgress) {
      if (this.previousProgress >= 0) {
        gameDomainEvents.emit("task.progressed", {
          levelId: context.campaignLevel.level.id,
          mode: context.mode,
          progress: snapshot.stockedRows,
          total: snapshot.totalRows
        });
      }
      this.previousProgress = snapshot.stockedRows;
    }

    if (snapshot.step === "complete" && this.previousStep !== "complete") {
      this.pendingAction = false;
      const rushPerformance = this.rush.snapshot(this.time.now);
      const completedEconomy = {
        coins: snapshot.coins,
        stars: snapshot.stars,
        reputation: this.campaignSession?.initialEconomy.reputation ?? 0
      };
      gameDomainEvents.emit("task.completed", {
        levelId: context.campaignLevel.level.id,
        mode: context.mode,
        economy: completedEconomy
      });

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

      this.campaignSession?.session.completeLevel(
        context.campaignLevel.level.id,
        context.campaignLevel.nextLevelId,
        completedEconomy
      );
      const progression = resolveLevelProgression(
        context.campaignLevel.level.id,
        context.campaignLevel.nextLevelId,
        this.campaignSession?.firstLevelId ?? context.campaignLevel.level.id
      );
      const grade = rushPerformance.grade ?? "BRONZE";
      const seconds = (rushPerformance.elapsedMs / 1000).toFixed(1);
      this.completionOverlay = new LevelCompleteOverlay(
        this,
        {
          worldWidth: context.world.width,
          worldHeight: context.world.height,
          centreX: context.world.width / 2,
          centreY: 505,
          statusLabel: progression.statusLabel,
          levelTitle: context.labels.levelTitle,
          rewardLabel:
            `${grade} RUSH  •  BEST STREAK x${rushPerformance.bestStreak}  •  ${seconds}s\n` +
            `+${context.runtime.reward.totalStars} STAR   +${context.runtime.reward.totalCoins} COINS`,
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

  private syncTarget(snapshot: RestockSceneSnapshot): void {
    const rushMode = snapshot.step === "restock" || snapshot.step === "complete";
    const bounds = rushMode ? undefined : this.targetResolver.resolve(snapshot);
    const ready = this.canInteract(snapshot);
    this.target?.sync(bounds, ready || this.pendingAction);
    this.hud?.setActionEnabled(Boolean(bounds) && this.interactionGate.isReady());
  }

  private canInteract(snapshot: RestockSceneSnapshot): boolean {
    const point = this.interactionPoint(snapshot);
    return Boolean(
      point &&
      this.interactionGate.isReady() &&
      this.actors?.isNear(point, this.context.campaignLevel.level.navigation.interactionRadius)
    );
  }

  private interactionPoint(snapshot: RestockSceneSnapshot): NavigationPoint | undefined {
    const { world } = this.context;
    switch (snapshot.step) {
      case "collect": return world.backroomBox;
      case "load":
      case "push": return world.cartStart;
      case "park":
      case "open": return world.cartCooler;
      case "restock":
      case "complete": return undefined;
    }
  }

  private dispose(): void {
    this.disposers.splice(0).forEach((dispose) => dispose());
    this.completionOverlay?.destroy();
    this.actors?.destroy();
    this.cooler?.destroy();
    this.rushMeter?.destroy();
    this.target?.destroy();
    this.interactionGate.destroy();
  }
}
