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
import { resolveLevelExperienceSpec } from "../../content/experience/LevelExperienceSpec";
import { gameDomainEvents } from "../../events/GameDomainEvents";
import { navigateToLevel } from "../../infrastructure/browser/BrowserLevelNavigator";
import { RestockActorView } from "../actors/RestockActorView";
import {
  STARTER_MARKET_PRESENTATION,
  type RestockStarterMarketPresentationContext
} from "../context/StarterMarketPresentationContext";
import { playActionFeedback } from "../effects/ActionFeedback";
import { playRestockCompletionFeedback } from "../effects/RestockCompletionFeedback";
import {
  BeverageCoolerView,
  prepareBeverageCoolerTextures,
  type BeverageCoolerRushState,
  type BeverageCoolerViewConfig
} from "../fixtures/BeverageCoolerView";
import { InteractionGate } from "../interactions/InteractionGate";
import { InteractionTargetView } from "../interactions/InteractionTargetView";
import { RestockTargetResolver } from "../interactions/RestockTargetResolver";
import { LevelCompleteOverlay } from "../ui/LevelCompleteOverlay";
import {
  mountRestockMemoryPreviewDom,
  type RestockMemoryPreviewDomHandle
} from "../ui/RestockMemoryPreviewDom";
import { RestockRushMeter } from "../ui/RestockRushMeter";
import { ShiftHud } from "../ui/ShiftHud";
import { resolveLevelVisualPreset } from "../visual/LevelVisualPresetResolver";
import type { RestockLevelVisualPreset } from "../visual/MarketLevelVisualPreset";
import { COOLER_STOCK_ITEMS_PER_SLOT } from "../visual/CoolerStockLayout";
import { StarterMarketEnvironmentView } from "../world/StarterMarketEnvironmentView";

export interface SceneCampaignSessionContext {
  readonly session: CampaignSession;
  readonly initialEconomy: CampaignEconomy;
  readonly firstLevelId: string;
}

interface CoolerPresentation {
  create(): void;
  sync(stockedRows: number): void;
  syncRush(state: BeverageCoolerRushState): void;
  rowCentre(rowIndex: number): { readonly x: number; readonly y: number };
  showMistake(rowIndex: number): void;
  destroy(): void;
}

export class StarterMarketScene extends Phaser.Scene {
  readonly controller: RestockSceneController;

  private readonly interactionGate = new InteractionGate();
  private readonly targetResolver: RestockTargetResolver;
  private readonly visualPreset: RestockLevelVisualPreset;
  private readonly rush: RestockRushController;
  private readonly disposers: Array<() => void> = [];
  private readonly wavePreviewedStarts = new Set<number>();
  private hud?: ShiftHud;
  private actors?: RestockActorView;
  private cooler?: CoolerPresentation;
  private target?: InteractionTargetView;
  private rushMeter?: RestockRushMeter;
  private completionOverlay?: LevelCompleteOverlay;
  private memoryPreview?: RestockMemoryPreviewDomHandle;
  private memoryPreviewActive = false;
  private memoryPreviewShown = false;
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
    const rushTuning = context.campaignLevel.level.tuning.rush;
    const itemsPerRow = rushTuning?.itemsPerRow ?? COOLER_STOCK_ITEMS_PER_SLOT;
    this.controller = new RestockSceneController({
      runtime: context.runtime,
      initialCoins: initialEconomy.coins,
      initialStars: initialEconomy.stars,
      sourceLocationId: "staff-backroom",
      destinationLocationId: "beverage-restock-zone",
      itemsPerRow
    });
    this.targetResolver = new RestockTargetResolver({
      backroomBox: context.world.backroomBox,
      cartStart: context.world.cartStart,
      cartDestination: context.world.cartCooler,
      coolerCentreX: context.world.beverageCooler.x,
      coolerRowYs: this.visualPreset.cooler.rowYs,
      coolerTargetWidth: this.visualPreset.cooler.activeStockWidth
    });
    this.validateWaveMemoryConfig();
    this.rush = new RestockRushController({
      rowCount: this.visualPreset.cooler.rowYs.length,
      itemsPerRow,
      randomSeed: context.campaignLevel.level.randomSeed,
      ...(rushTuning ?? {}),
      keepTargetOnFailure:
        rushTuning?.waveMemory?.keepTargetOnFailure ??
        rushTuning?.memoryPreview?.keepTargetOnFailure
    });
  }

  preload(): void {
    this.context.levelAssets.preload.forEach((asset) => this.load.image(asset.key, asset.path));
  }

  create(): void {
    const context = this.context;
    const experience = resolveLevelExperienceSpec(context.campaignLevel.level);
    const memoryConfig = this.memoryConfig();
    const waveMemoryConfig = this.waveMemoryConfig();
    document.body.dataset.gameScene = context.scene.datasetName;
    document.body.dataset.gameArchitecture = context.scene.architecture;
    document.body.dataset.activeShift = context.runtime.shift.id;
    document.body.dataset.activeDay = String(context.campaignShift.dayNumber);
    document.body.dataset.activeLevel = context.campaignLevel.level.id;
    document.body.dataset.activeMode = context.mode;
    document.body.dataset.restockChallenge = waveMemoryConfig
      ? "wave-memory"
      : memoryConfig
        ? "memory"
        : "rush";
    if (waveMemoryConfig) {
      const waveCount = Math.ceil(this.visualPreset.cooler.rowYs.length / waveMemoryConfig.waveSize);
      document.body.dataset.restockFinaleWaveCount = String(waveCount);
      document.body.dataset.restockFinaleWave = `0/${waveCount}`;
      document.body.dataset.restockFinaleWaveState = "delivery";
    }
    this.cameras.main.setBackgroundColor("#171712");

    new StarterMarketEnvironmentView(this, context).create();
    this.cooler = this.createCooler();
    this.rushMeter = new RestockRushMeter(this, {
      x: context.world.beverageCooler.x,
      y: 770,
      accentColor: context.palette.gold,
      title: waveMemoryConfig
        ? "FINAL MEMORY RUSH"
        : memoryConfig
          ? "SHELF MEMORY"
          : context.campaignLevel.level.tuning.rush?.timeoutEnabled === false
            ? "GUIDED STOCK"
            : "RESTOCK RUSH",
      instruction: waveMemoryConfig
        ? `MEMORIZE ${waveMemoryConfig.waveSize} SHELVES · THEN STOCK BLIND`
        : memoryConfig
          ? "FOLLOW THE MEMORIZED ORDER · STOCK 3 ITEMS"
          : context.campaignLevel.level.tuning.rush?.timeoutEnabled === false
            ? context.campaignLevel.level.tuning.rush?.itemsPerRow === 1
              ? "TAP EACH SHELF ONCE · AUTO-PLACE 3 BOTTLES"
              : "FOLLOW THE GUIDED ORDER · STOCK 3 ITEMS"
            : "FIND THE GLOWING SHELF · STOCK 3 ITEMS"
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
        timeLabel: this.shiftTimeLabel(),
        initialObjective: context.runtime.mission.title,
        modeLabel: experience.modeLabel,
        palette: context.palette
      },
      () => this.requestCurrentAction()
    );

    this.input.on("pointerdown", this.handleRushPointerDown, this);
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
    if (snapshot.step === "restock" && !this.memoryPreviewActive) this.updateRush();
    this.syncTarget(snapshot);
  }

  isInteractionReady(): boolean {
    const snapshot = this.controller.snapshot();
    return snapshot.step === "restock"
      ? !this.memoryPreviewActive && this.interactionGate.isReady()
      : this.canInteract(snapshot);
  }

  playerPosition(): NavigationPoint | undefined {
    return this.actors?.position();
  }

  private createCooler(): CoolerPresentation {
    const context = this.context;
    const preset = this.visualPreset.cooler;
    const usesFinaleWallCooler = context.levelAssets.environment.key === "environment-final-shift-l10";
    const config: BeverageCoolerViewConfig = {
      centreX: context.world.beverageCooler.x,
      stockSource: {
        x: context.world.cartCooler.x,
        y: context.world.cartCooler.y - 18
      },
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
    };
    if (usesFinaleWallCooler) {
      Object.assign(config, {
        stockSource: { x: 1160, y: 760 },
        slotPositions: [
          { x: 1450, y: 315 }, { x: 1450, y: 380 }, { x: 1450, y: 445 },
          { x: 1535, y: 315 }, { x: 1535, y: 380 }, { x: 1535, y: 445 }
        ],
        slotWidth: 78,
        slotHeight: 58,
        shelfBaselineYs: [345, 410, 475],
        glassPanels: [],
        bottleWidth: 18,
        bottleHeights: [44, 48, 52],
        itemOffsets: [-22, 0, 22]
      });
    }
    prepareBeverageCoolerTextures(this, config);
    const cooler: CoolerPresentation = new BeverageCoolerView(this, config);
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
      finaleStation: context.levelAssets.environment.key === "environment-final-shift-l10"
        ? { worker: { x: 1280, y: 770 }, cart: { x: 1120, y: 785 } }
        : undefined,
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

  private readonly handleRushPointerDown = (pointer: Phaser.Input.Pointer): void => {
    if (
      this.controller.snapshot().step !== "restock" ||
      this.memoryPreviewActive ||
      !this.interactionGate.isReady()
    ) return;

    const x = Number.isFinite(pointer.worldX) ? pointer.worldX : pointer.x;
    const y = Number.isFinite(pointer.worldY) ? pointer.worldY : pointer.y;
    const centreX = this.context.world.beverageCooler.x;
    const halfWidth = Math.max(155, this.visualPreset.cooler.activeStockWidth * 0.72);
    if (Math.abs(x - centreX) > halfWidth) return;

    let nearestRow = -1;
    let nearestDistance = Number.POSITIVE_INFINITY;
    this.visualPreset.cooler.rowYs.forEach((rowY, index) => {
      const distance = Math.abs(y - rowY);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestRow = index;
      }
    });
    if (nearestRow < 0 || nearestDistance > 34) return;
    this.selectRushRow(nearestRow);
  };

  private selectRushRow(rowIndex: number): void {
    const sceneSnapshot = this.controller.snapshot();
    if (
      sceneSnapshot.step !== "restock" ||
      this.memoryPreviewActive ||
      !this.cooler ||
      !this.interactionGate.isReady()
    ) return;

    const result = this.rush.selectRow(rowIndex, this.time.now);
    const rowCentre = this.cooler.rowCentre(rowIndex);
    if (!result.correct) {
      this.cooler.showMistake(rowIndex);
      this.rushMeter?.showMistake(this.waveMemoryConfig() ? "ROUTE BROKEN" : "WRONG SHELF");
      playActionFeedback(this, rowCentre, "mistake", {
        label: this.waveMemoryConfig() ? "WRONG ROUTE" : "WRONG SHELF"
      });
      this.cameras.main.shake(90, 0.0025);
      this.syncRushPresentation(result.snapshot);
      return;
    }

    this.interactionGate.lockFor(320);
    if (result.rowCompleted && !this.dispatchSceneAction("RESTOCK_ROW", false)) return;
    this.syncRushPresentation(result.snapshot);

    const physicalStockedCount = result.stockedItemCount * result.snapshot.unitsPerInteraction;
    const physicalItemsPerRow = result.snapshot.itemsPerRow * result.snapshot.unitsPerInteraction;
    const singleTapShelf = result.snapshot.itemsPerRow === 1 && physicalItemsPerRow === 3;
    const itemLabel = `${physicalStockedCount}/${physicalItemsPerRow}`;
    playActionFeedback(this, rowCentre, "restock", {
      label: result.rowCompleted
        ? singleTapShelf
          ? "SHELF STOCKED · 3 BOTTLES"
          : `SHELF FULL ${itemLabel}`
        : `STOCKED ${itemLabel}`,
      emphasis: result.rowCompleted ? 1.22 : 1.04
    });
    this.cameras.main.shake(result.rowCompleted ? 55 : 30, result.rowCompleted ? 0.0014 : 0.0008);

    if (result.rowCompleted) this.startNextWaveIfNeeded(result.snapshot);
  }

  private updateRush(): void {
    const now = this.time.now;
    const expiredRow = this.rush.snapshot(now).activeRowIndex;
    const result = this.rush.tick(now);
    if (result.event === "timeout" && expiredRow !== undefined && this.cooler) {
      const rowCentre = this.cooler.rowCentre(expiredRow);
      this.cooler.showMistake(expiredRow);
      this.rushMeter?.showMistake(this.waveMemoryConfig() ? "ROUTE TIMEOUT" : "TOO SLOW");
      playActionFeedback(this, rowCentre, "mistake", {
        label: this.waveMemoryConfig() ? "ROUTE TIMEOUT" : "TOO SLOW"
      });
      this.cameras.main.shake(80, 0.002);
    }
    this.syncRushPresentation(result.snapshot);
  }

  private syncRushPresentation(snapshot: RestockRushSnapshot): void {
    const memoryConfig = this.memoryConfig();
    const waveMemoryConfig = this.waveMemoryConfig();
    const hideActiveTarget =
      waveMemoryConfig?.hideActiveTarget ?? memoryConfig?.hideActiveTarget ?? false;
    this.cooler?.syncRush({
      filledRowIndexes: snapshot.filledRowIndexes,
      rowItemCounts: snapshot.rowItemCounts.map((count) => (
        Math.min(COOLER_STOCK_ITEMS_PER_SLOT, count * snapshot.unitsPerInteraction)
      )),
      activeRowIndex: hideActiveTarget ? undefined : snapshot.activeRowIndex,
      remainingRatio: snapshot.remainingRatio,
      interactionEnabled:
        !snapshot.complete &&
        !this.memoryPreviewActive &&
        this.interactionGate.isReady()
    });
    this.rushMeter?.sync(snapshot);
  }

  private startMemoryPreview(): boolean {
    const memoryConfig = this.memoryConfig();
    if (!memoryConfig || this.memoryPreviewShown) return false;
    this.memoryPreviewShown = true;
    this.memoryPreviewActive = true;
    this.interactionGate.lockFor(memoryConfig.durationMs + 620);
    this.cooler?.syncRush({
      filledRowIndexes: [],
      rowItemCounts: Array.from({ length: this.visualPreset.cooler.rowYs.length }, () => 0),
      activeRowIndex: undefined,
      remainingRatio: 1,
      interactionEnabled: false
    });
    this.memoryPreview = mountRestockMemoryPreviewDom({
      sequence: this.rush.plannedRowIndexes(),
      durationMs: memoryConfig.durationMs,
      onComplete: () => {
        if (!this.sys.isActive()) return;
        this.memoryPreviewActive = false;
        const rushSnapshot = this.rush.start(this.time.now);
        this.syncRushPresentation(rushSnapshot);
      }
    });
    return true;
  }

  private startWaveMemoryPreview(completedRows: number): boolean {
    const waveConfig = this.waveMemoryConfig();
    if (!waveConfig || this.memoryPreviewActive || this.wavePreviewedStarts.has(completedRows)) return false;

    const planned = this.rush.plannedRowIndexes();
    if (completedRows < 0 || completedRows >= planned.length) return false;
    const sequence = planned.slice(completedRows, completedRows + waveConfig.waveSize);
    if (sequence.length === 0) return false;

    const waveIndex = Math.floor(completedRows / waveConfig.waveSize);
    const waveCount = Math.ceil(planned.length / waveConfig.waveSize);
    this.wavePreviewedStarts.add(completedRows);
    this.memoryPreviewActive = true;
    this.memoryPreview?.destroy();
    this.interactionGate.lockFor(waveConfig.previewDurationMs + 620);
    document.body.dataset.restockFinaleWave = `${waveIndex + 1}/${waveCount}`;
    document.body.dataset.restockFinaleWaveState = "preview";

    const rushSnapshot = this.rush.snapshot(this.time.now);
    this.cooler?.syncRush({
      filledRowIndexes: rushSnapshot.filledRowIndexes,
      rowItemCounts: rushSnapshot.rowItemCounts.map((count) => (
        Math.min(COOLER_STOCK_ITEMS_PER_SLOT, count * rushSnapshot.unitsPerInteraction)
      )),
      activeRowIndex: undefined,
      remainingRatio: 1,
      interactionEnabled: false
    });

    this.memoryPreview = mountRestockMemoryPreviewDom({
      sequence,
      durationMs: waveConfig.previewDurationMs,
      variant: "finale-wave",
      waveLabel: `WAVE ${waveIndex + 1} OF ${waveCount}`,
      onComplete: () => {
        if (!this.sys.isActive()) return;
        this.memoryPreviewActive = false;
        document.body.dataset.restockFinaleWaveState = "active";
        const projected = this.rush.snapshot(this.time.now);
        const activeSnapshot = projected.started
          ? projected
          : this.rush.start(this.time.now);
        this.syncRushPresentation(activeSnapshot);
      }
    });
    return true;
  }

  private startNextWaveIfNeeded(snapshot: RestockRushSnapshot): boolean {
    const waveConfig = this.waveMemoryConfig();
    if (!waveConfig || snapshot.complete) return false;
    const completedRows = snapshot.filledRowIndexes.length;
    if (completedRows === 0 || completedRows % waveConfig.waveSize !== 0) return false;
    return this.startWaveMemoryPreview(completedRows);
  }

  private memoryConfig() {
    return this.context.campaignLevel.level.tuning.rush?.memoryPreview;
  }

  private waveMemoryConfig() {
    return this.context.campaignLevel.level.tuning.rush?.waveMemory;
  }

  private validateWaveMemoryConfig(): void {
    const rushTuning = this.context.campaignLevel.level.tuning.rush;
    const waveConfig = rushTuning?.waveMemory;
    if (!waveConfig) return;
    if (rushTuning?.memoryPreview) {
      throw new Error("Restock rush cannot use memoryPreview and waveMemory at the same time");
    }
    if (!Number.isInteger(waveConfig.waveSize) || waveConfig.waveSize < 1) {
      throw new Error("Restock wave-memory waveSize must be a positive integer");
    }
    if (waveConfig.waveSize >= this.visualPreset.cooler.rowYs.length) {
      throw new Error("Restock wave-memory must split the cooler into at least two waves");
    }
    if (!Number.isFinite(waveConfig.previewDurationMs) || waveConfig.previewDurationMs < 1000) {
      throw new Error("Restock wave-memory preview must last at least one second");
    }
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
      if (this.previousStep !== "restock" && this.startWaveMemoryPreview(0)) {
        // Finale wave clock starts only after the first route preview closes.
      } else if (this.previousStep !== "restock" && this.startMemoryPreview()) {
        // The challenge clock starts only after the memorization window closes.
      } else if (!this.memoryPreviewActive) {
        const rushSnapshot = this.previousStep === "restock"
          ? this.rush.snapshot(this.time.now)
          : this.rush.start(this.time.now);
        this.syncRushPresentation(rushSnapshot);
      }
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
      document.body.dataset.restockFinaleWaveState = "complete";
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
        title: this.waveMemoryConfig() ? "FINAL SHIFT COMPLETE!" : context.labels.completionTitle,
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
      const finaleLabel = this.waveMemoryConfig() ? "FINAL ROUTE" : "RUSH";
      const campaignCompleteLabel = this.waveMemoryConfig() ? "CAMPAIGN COMPLETE  •  " : "";
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
            `${campaignCompleteLabel}${grade} ${finaleLabel}  •  ${context.runtime.totalUnits} ITEMS  •  ${seconds}s\n` +
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

  private shiftTimeLabel(): string {
    const hour = Number(this.context.runtime.shift.startTime.slice(0, 2));
    return `${this.context.runtime.shift.startTime} ${hour < 12 ? "AM" : "PM"}`;
  }

  completeDispatchChallenge(): void {
    let safety = 0;
    while (this.controller.snapshot().step !== "complete" && safety < 20) {
      const action = this.controller.actionForCurrentStep();
      if (!action || !this.controller.dispatch(action)) break;
      safety += 1;
    }
  }

  private dispose(): void {
    this.disposers.splice(0).forEach((dispose) => dispose());
    this.input.off("pointerdown", this.handleRushPointerDown, this);
    this.memoryPreview?.destroy();
    this.completionOverlay?.destroy();
    this.actors?.destroy();
    this.cooler?.destroy();
    this.rushMeter?.destroy();
    this.target?.destroy();
    this.interactionGate.destroy();
    delete document.body.dataset.restockFinaleWave;
    delete document.body.dataset.restockFinaleWaveCount;
    delete document.body.dataset.restockFinaleWaveState;
  }
}
