import Phaser from "phaser";
import { crazyGamesPlatform } from "../../../platform/crazyGamesPlatform";
import {
  FindItemsChallengeController,
  type FindItemsChallengeSnapshot
} from "../../application/FindItemsChallengeController";
import type { NavigationPoint } from "../../application/PlayerNavigationController";
import { resolveLevelProgression } from "../../application/LevelProgression";
import {
  UtilityTaskSceneController,
  type UtilityTaskCopy,
  type UtilityTaskSnapshot
} from "../../application/UtilityTaskSceneController";
import { STARTER_RUNTIME_ASSET_REGISTRY } from "../../assets/RuntimeAssetRegistry";
import {
  resolveCleaningExperienceSpec,
  type CleaningExperienceSpec
} from "../../content/experience/CleaningExperienceSpec";
import {
  resolveLevelExperienceSpec,
  type FindItemsSearchDecoySpec,
  type LevelExperienceSpec
} from "../../content/experience/LevelExperienceSpec";
import {
  resolvePriorityOrderExperienceSpec,
  type PriorityOrderExperienceSpec
} from "../../content/experience/PriorityOrderExperienceSpec";
import { navigateToLevel } from "../../infrastructure/browser/BrowserLevelNavigator";
import { PlayerNavigationView } from "../actors/PlayerNavigationView";
import { CleaningTaskView } from "../cleaning/CleaningTaskView";
import { ClosingSafetyCleaningTaskView } from "../cleaning/ClosingSafetyCleaningTaskView";
import type {
  CleanStarterMarketPresentationContext,
  FindItemsStarterMarketPresentationContext
} from "../context/StarterMarketPresentationContext";
import { playActionFeedback } from "../effects/ActionFeedback";
import { playRestockCompletionFeedback } from "../effects/RestockCompletionFeedback";
import { FindItemsCountdownView } from "../findItems/FindItemsCountdownView";
import { OrderTicketView } from "../findItems/OrderTicketView";
import { InteractionGate } from "../interactions/InteractionGate";
import { InteractionTargetView } from "../interactions/InteractionTargetView";
import { LevelCompleteOverlay } from "../ui/LevelCompleteOverlay";
import { ShiftHud } from "../ui/ShiftHud";
import { resolveLevelVisualPreset } from "../visual/LevelVisualPresetResolver";
import type {
  CleanLevelVisualPreset,
  FindItemsLevelVisualPreset
} from "../visual/MarketLevelVisualPreset";
import { StarterMarketEnvironmentView } from "../world/StarterMarketEnvironmentView";
import type { SceneCampaignSessionContext } from "./StarterMarketScene";

export type UtilityPresentationContext =
  | CleanStarterMarketPresentationContext
  | FindItemsStarterMarketPresentationContext;

type UtilityVisualPreset = CleanLevelVisualPreset | FindItemsLevelVisualPreset;
type UtilityProgressObject = Phaser.GameObjects.Image | Phaser.GameObjects.Container;
type CleanTaskPresentation = CleaningTaskView | ClosingSafetyCleaningTaskView;

export class UtilityTaskScene extends Phaser.Scene {
  readonly controller: UtilityTaskSceneController;

  private readonly interactionGate = new InteractionGate();
  private readonly visualPreset: UtilityVisualPreset;
  private readonly experience: LevelExperienceSpec;
  private readonly cleaningExperience?: CleaningExperienceSpec;
  private readonly priorityOrderExperience?: PriorityOrderExperienceSpec;
  private readonly findChallenge?: FindItemsChallengeController;
  private readonly disposers: Array<() => void> = [];
  private readonly findItemsByProduct = new Map<string, Phaser.GameObjects.Image>();
  private player?: PlayerNavigationView;
  private target?: InteractionTargetView;
  private hud?: ShiftHud;
  private cleaningView?: CleanTaskPresentation;
  private orderTicket?: OrderTicketView;
  private findCountdown?: FindItemsCountdownView;
  private findBasket?: Phaser.GameObjects.Image;
  private completionOverlay?: LevelCompleteOverlay;
  private readonly taskObjects: Phaser.GameObjects.GameObject[] = [];
  private readonly progressObjects: UtilityProgressObject[] = [];
  private pendingFindProductId?: string;
  private completed = false;
  private failed = false;

  constructor(
    private readonly context: UtilityPresentationContext,
    private readonly campaignSession?: SceneCampaignSessionContext
  ) {
    super(context.scene.key);
    this.visualPreset = resolveLevelVisualPreset(context.campaignLevel.level);
    this.experience = resolveLevelExperienceSpec(context.campaignLevel.level);
    this.cleaningExperience = resolveCleaningExperienceSpec(context.campaignLevel.level);
    this.priorityOrderExperience = resolvePriorityOrderExperienceSpec(context.campaignLevel.level);
    const initialEconomy = campaignSession?.initialEconomy ?? {
      coins: context.campaignLevel.level.tuning.initialCoins,
      stars: 0,
      reputation: 0
    };
    this.controller = new UtilityTaskSceneController(context.runtime, initialEconomy);
    if (context.mode === "find-items") {
      this.findChallenge = new FindItemsChallengeController({
        productIds: context.runtime.itemTargets.map((target) => target.productId),
        timeLimitSeconds: context.runtime.timeLimitSeconds,
        mistakePenaltySeconds: context.runtime.mistakePenaltySeconds,
        selectionMode: this.priorityOrderExperience?.selectionMode ?? "any"
      });
    }
  }

  preload(): void {
    this.context.levelAssets.preload.forEach((asset) => this.load.image(asset.key, asset.path));

    this.cleaningExperience?.spillAssetKeys.forEach((assetKey) => {
      const asset = STARTER_RUNTIME_ASSET_REGISTRY.require(assetKey);
      if (!this.textures.exists(asset.key)) this.load.image(asset.key, asset.path);
    });

    if (this.context.mode !== "find-items") return;
    this.findItemsDecoys().forEach((decoy) => {
      const asset = STARTER_RUNTIME_ASSET_REGISTRY.require(decoy.assetKey);
      if (!this.textures.exists(asset.key)) this.load.image(asset.key, asset.path);
    });
  }

  create(): void {
    const context = this.context;
    document.body.dataset.gameScene = context.scene.datasetName;
    document.body.dataset.gameArchitecture = context.scene.architecture;
    document.body.dataset.activeShift = context.runtime.shift.id;
    document.body.dataset.activeDay = String(context.campaignShift.dayNumber);
    document.body.dataset.activeLevel = context.campaignLevel.level.id;
    document.body.dataset.activeMode = context.mode;
    document.body.dataset.findItemsVisibleCount = context.mode === "find-items"
      ? String(context.runtime.itemTargets.length + this.findItemsDecoys().length)
      : "0";
    document.body.dataset.findItemsSelectionMode = context.mode === "find-items"
      ? (this.priorityOrderExperience?.selectionMode ?? "any")
      : "none";
    this.cameras.main.setBackgroundColor("#171712");

    new StarterMarketEnvironmentView(this, context).create();
    if (context.mode === "clean") {
      this.createCleanTask(context, this.visualPreset as CleanLevelVisualPreset);
    } else {
      this.createFindItemsTask(context, this.visualPreset as FindItemsLevelVisualPreset);
    }

    this.player = new PlayerNavigationView(this, {
      start: context.world.workerStart,
      bounds: context.visual.actor.navigationBounds,
      speed: context.campaignLevel.level.navigation.moveSpeed,
      assetKey: context.levelAssets.worker.key,
      // The L9 cutout already carries the priority basket. Replacing it with
      // the generic walk frames while moving makes the character visibly swap
      // identity, so keep the approved picker art throughout this challenge.
      walkAssetKeys: this.priorityOrderExperience
        ? undefined
        : ["worker-a-walk-01", "worker-a-walk-02"],
      displaySize: this.visualPreset.actor.idleSize,
      shadowOffset: this.visualPreset.actor.shadowOffset,
      name: `${context.mode}-worker`,
      baseDepth: 24,
      preserveAspectRatio: Boolean(this.priorityOrderExperience),
      onManualNavigation: () => {
        this.pendingFindProductId = undefined;
      }
    });

    this.target = new InteractionTargetView(
      this,
      {
        color: context.visual.targeting.color,
        arrowOffsetY: context.visual.targeting.arrowOffsetY,
        name: `${context.mode}-interaction-target`
      },
      () => this.performCurrentAction()
    );
    this.hud = new ShiftHud(
      this,
      {
        dayLabel: `${context.labels.day} · ${context.labels.level}`,
        timeLabel: `${context.runtime.shift.startTime} ${Number(context.runtime.shift.startTime.slice(0, 2)) < 12 ? "AM" : "PM"}`,
        initialObjective: context.runtime.mission.title,
        modeLabel: this.experience.modeLabel,
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
    if (this.context.mode === "find-items") {
      this.updateFindItems(delta);
      return;
    }
    this.syncTarget(this.controller.snapshot());
  }

  isInteractionReady(): boolean {
    if (this.context.mode === "find-items") {
      return Boolean(
        this.findChallenge?.snapshot().status === "active" &&
        this.interactionGate.isReady()
      );
    }
    return this.canInteract(this.controller.snapshot());
  }

  playerPosition(): NavigationPoint | undefined {
    return this.player?.position();
  }

  isPlayerNear(point: NavigationPoint): boolean {
    return Boolean(this.player?.isNear(
      point,
      this.context.campaignLevel.level.navigation.interactionRadius
    ));
  }

  commitClosingSafetySpill(index: number): boolean {
    if (
      this.context.mode !== "clean" ||
      !(this.cleaningView instanceof ClosingSafetyCleaningTaskView) ||
      !this.cleaningView.canCommitCurrentSpill(index)
    ) return false;
    this.interactionGate.lockFor(this.context.runtime.cleanDurationMs);
    return this.controller.dispatch("CLEAN_SPOT");
  }

  /** Public scene boundary used by product sprites and browser interaction audits. */
  attemptFindProduct(productId: string): void {
    this.requestFindProduct(productId);
  }

  private createCleanTask(
    context: CleanStarterMarketPresentationContext,
    visual: CleanLevelVisualPreset
  ): void {
    if (this.cleaningExperience?.kind === "closing-safety") {
      this.cleaningView = new ClosingSafetyCleaningTaskView(this, {
        cleaningCartAssetKey: context.levelAssets.cleaningCart.key,
        wetFloorSignAssetKey: context.levelAssets.wetFloorSign.key,
        spillAssetKeys: this.cleaningExperience.spillAssetKeys,
        warningRequiredSpillIndexes: this.cleaningExperience.warningRequiredSpillIndexes,
        toolPoint: context.runtime.toolPoint,
        spotPositions: context.runtime.spotPositions,
        visual
      });
    } else {
      this.cleaningView = new CleaningTaskView(this, {
        fixtureAssetKey: context.levelAssets.cleaningFixture.key,
        cleaningCartAssetKey: context.levelAssets.cleaningCart.key,
        wetFloorSignAssetKey: context.levelAssets.wetFloorSign.key,
        toolPoint: context.runtime.toolPoint,
        spotPositions: context.runtime.spotPositions,
        visual
      });
    }
    this.cleaningView.create();
  }

  private createFindItemsTask(
    context: FindItemsStarterMarketPresentationContext,
    visual: FindItemsLevelVisualPreset
  ): void {
    this.textures.exists(context.levelAssets.fixture.key);

    const basket = this.add.image(
      visual.basket.position.x,
      visual.basket.position.y,
      "equipment-shopping-basket"
    )
      .setOrigin(0.5, 0.96)
      .setDisplaySize(visual.basket.size.width, visual.basket.size.height)
      .setDepth(19)
      .setName("order-basket");
    // L9's approved worker cutout already includes a basket. Keep this target
    // object for the collection animation, but do not draw a duplicate basket
    // on the floor beside the picker.
    basket.setVisible(!this.priorityOrderExperience);
    this.findBasket = basket;
    this.taskObjects.push(basket);

    context.runtime.itemTargets.forEach((target, index) => {
      const asset = context.levelAssets.items[index];
      if (!asset) throw new Error(`Missing find-items asset at index ${index}`);
      const dimensions = visual.itemSizes[target.productId];
      if (!dimensions) throw new Error(`Missing find-items visual size for ${target.productId}`);
      const shelfPosition = visual.itemPositions[target.productId];
      if (!shelfPosition) throw new Error(`Missing find-items shelf position for ${target.productId}`);
      const item = this.createFindProductSprite({
        id: target.productId,
        assetKey: asset.key,
        x: shelfPosition.x,
        y: shelfPosition.y,
        width: dimensions.width,
        height: dimensions.height,
        requested: true
      });
      this.findItemsByProduct.set(target.productId, item);
    });

    this.findItemsDecoys().forEach((decoy) => {
      this.createFindDecoySprite(decoy);
    });

    this.orderTicket = new OrderTicketView(this, {
      productIds: context.runtime.itemTargets.map((target) => target.productId),
      itemAssetKeys: context.levelAssets.items.map((asset) => asset.key),
      itemSizes: visual.itemSizes,
      visual: visual.orderTicket,
      panelColor: context.palette.hud,
      accentColor: context.palette.gold,
      numberedSequence: this.priorityOrderExperience?.numberedTicket ?? false
    });
    this.orderTicket.create();

    this.findCountdown = new FindItemsCountdownView(this, {
      x: visual.orderTicket.centre.x,
      y: visual.orderTicket.centre.y + visual.orderTicket.size.height / 2 + 24,
      panelColor: context.palette.hud,
      accentColor: context.palette.gold,
      initialSeconds: context.runtime.timeLimitSeconds
    });
    this.findCountdown.create();
  }

  private findItemsDecoys(): readonly FindItemsSearchDecoySpec[] {
    return this.priorityOrderExperience?.decoys ?? this.experience.findItemsSearch?.decoys ?? [];
  }

  private createFindDecoySprite(decoy: FindItemsSearchDecoySpec): void {
    STARTER_RUNTIME_ASSET_REGISTRY.require(decoy.assetKey);
    this.createFindProductSprite({
      id: decoy.id,
      assetKey: decoy.assetKey,
      x: decoy.x,
      y: decoy.y,
      width: decoy.width,
      height: decoy.height,
      requested: false
    });
  }

  private createFindProductSprite(config: {
    readonly id: string;
    readonly assetKey: string;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly requested: boolean;
  }): Phaser.GameObjects.Image {
    const item = this.add.image(config.x, config.y, config.assetKey)
      .setOrigin(0.5, 0.96)
      .setDisplaySize(config.width, config.height)
      .setDepth(12 + config.y / 1000)
      .setName(`${config.requested ? "find-item" : "find-decoy"}-${config.id}`)
      .setData("find-product-id", config.id)
      .setData("requested", config.requested)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => {
        this.tweens.killTweensOf(item);
        item.setDisplaySize(config.width, config.height);
        this.tweens.add({
          targets: item,
          scaleX: item.scaleX * 1.08,
          scaleY: item.scaleY * 1.08,
          duration: 100,
          ease: "Sine.Out"
        });
      })
      .on("pointerout", () => {
        this.tweens.killTweensOf(item);
        item.setDisplaySize(config.width, config.height);
      })
      .on(
        "pointerdown",
        (
          _pointer: Phaser.Input.Pointer,
          _localX: number,
          _localY: number,
          event: Phaser.Types.Input.EventData
        ) => {
          event.stopPropagation();
          this.attemptFindProduct(config.id);
        }
      );
    this.progressObjects.push(item);
    return item;
  }

  private performCurrentAction(): void {
    if (this.context.mode === "find-items") return;
    const snapshot = this.controller.snapshot();
    if (!this.canInteract(snapshot)) return;
    const action = this.controller.actionForCurrentStep();
    if (!action) return;
    if (
      action === "CLEAN_SPOT" &&
      this.cleaningView instanceof ClosingSafetyCleaningTaskView &&
      !this.cleaningView.canCommitCurrentSpill(snapshot.progress)
    ) return;

    const duration = this.context.runtime.cleanDurationMs;
    this.interactionGate.lockFor(action === "COLLECT_TOOLS" ? 320 : duration);
    const accepted = this.controller.dispatch(action);
    if (!accepted) return;

    const point = this.player?.position();
    if (point) playActionFeedback(this, point, action === "CLEAN_SPOT" ? "restock" : "interact");
  }

  private updateFindItems(delta: number): void {
    const challenge = this.findChallenge;
    if (!challenge || this.completed || this.failed) return;
    const before = challenge.snapshot();
    const after = challenge.tick(delta);
    this.findCountdown?.sync(after.remainingSeconds);
    if (after.status === "failed") {
      if (before.status !== "failed") this.failFindItems(after);
      return;
    }
    this.advancePendingFindAction();
    this.syncTarget(this.controller.snapshot());
  }

  private requestFindProduct(productId: string): void {
    if (this.context.mode !== "find-items" || !this.findChallenge || !this.player) return;
    const challenge = this.findChallenge.snapshot();
    if (challenge.status !== "active" || !this.interactionGate.isReady()) return;

    this.pendingFindProductId = undefined;
    const currentPosition = this.player.position();
    this.player.setDestination(currentPosition);
    if (!challenge.remainingProductIds.includes(productId)) {
      this.recordFindMistake("WRONG ITEM");
      return;
    }

    const target = this.context.runtime.itemTargets.find((entry) => entry.productId === productId);
    if (!target) return;
    if (this.player.isNear(target, this.context.campaignLevel.level.navigation.interactionRadius)) {
      this.collectFindProduct(productId);
      return;
    }

    this.pendingFindProductId = productId;
    this.player.setDestination(target);
  }

  private advancePendingFindAction(): void {
    if (
      this.context.mode !== "find-items" ||
      !this.pendingFindProductId ||
      !this.player ||
      !this.interactionGate.isReady()
    ) return;
    const productId = this.pendingFindProductId;
    const target = this.context.runtime.itemTargets.find((entry) => entry.productId === productId);
    if (!target) {
      this.pendingFindProductId = undefined;
      return;
    }
    const configuredRadius = this.context.campaignLevel.level.navigation.interactionRadius;
    const arrivalRadius = Math.min(72, Math.max(42, configuredRadius * 0.5));
    if (!this.player.isNear(target, arrivalRadius)) return;

    this.pendingFindProductId = undefined;
    this.collectFindProduct(productId);
  }

  private collectFindProduct(productId: string): void {
    if (this.context.mode !== "find-items" || !this.findChallenge) return;
    const result = this.findChallenge.selectProduct(productId);
    if (!result.accepted) {
      if (result.reason !== "inactive") {
        this.showFindMistake(
          result.snapshot,
          result.reason === "out-of-order" ? "WRONG ORDER" : "WRONG ITEM"
        );
      }
      return;
    }

    this.interactionGate.lockFor(420);
    if (!this.controller.dispatch("PICK_ITEM")) return;
    const item = this.findItemsByProduct.get(productId);
    const basket = this.findBasket;
    const playerPosition = this.player?.position();
    const collectionTarget = this.priorityOrderExperience && playerPosition
      ? { x: playerPosition.x + 30, y: playerPosition.y - 92 }
      : { x: basket?.x ?? item?.x ?? 0, y: basket ? basket.y - 22 : item?.y ?? 0 };
    if (item) {
      const baseScaleX = item.scaleX;
      const baseScaleY = item.scaleY;
      this.tweens.add({
        targets: item,
        x: collectionTarget.x,
        y: collectionTarget.y,
        alpha: 0,
        scaleX: baseScaleX * 0.32,
        scaleY: baseScaleY * 0.32,
        duration: 380,
        ease: "Cubic.In",
        onComplete: () => item.setVisible(false).disableInteractive()
      });
    }
    const visual = this.visualPreset as FindItemsLevelVisualPreset;
    const shelfPosition = visual.itemPositions[productId];
    if (shelfPosition) {
      playActionFeedback(this, shelfPosition, "interact", { label: "ADDED TO ORDER" });
    }
    this.findCountdown?.sync(result.snapshot.remainingSeconds);
  }

  private recordFindMistake(label: string): void {
    if (this.context.mode !== "find-items" || !this.findChallenge) return;
    const before = this.findChallenge.snapshot();
    if (before.status !== "active" || !this.interactionGate.isReady()) return;
    const after = this.findChallenge.recordMistake();
    this.showFindMistake(after, label);
  }

  private showFindMistake(snapshot: FindItemsChallengeSnapshot, label: string): void {
    if (this.context.mode !== "find-items") return;
    this.findCountdown?.showPenalty(this.context.runtime.mistakePenaltySeconds);
    const position = this.player?.position() ?? this.visualPreset.environment.focus;
    playActionFeedback(this, position, "mistake", {
      label: `${label}  -${this.context.runtime.mistakePenaltySeconds}s`
    });
    this.cameras.main.shake(90, 0.0025);
    if (snapshot.status === "failed") this.failFindItems(snapshot);
  }

  private failFindItems(snapshot: FindItemsChallengeSnapshot): void {
    if (this.context.mode !== "find-items" || this.failed || this.completed) return;
    this.failed = true;
    this.pendingFindProductId = undefined;
    this.target?.sync(undefined, false);
    this.hud?.setActionEnabled(false);
    this.findCountdown?.sync(0);
    const context = this.context;
    this.completionOverlay = new LevelCompleteOverlay(
      this,
      {
        worldWidth: context.world.width,
        worldHeight: context.world.height,
        centreX: context.world.width / 2,
        centreY: 505,
        statusLabel: "ORDER EXPIRED",
        levelTitle: context.labels.levelTitle,
        rewardLabel:
          `${snapshot.collectedProductIds.length}/${snapshot.collectedProductIds.length + snapshot.remainingProductIds.length} ITEMS FOUND  •  ` +
          `${snapshot.mistakes} MISTAKES\nThe customer is still waiting. Try the order again.`,
        actionLabel: "RETRY ORDER",
        panelColor: context.palette.hud,
        accentColor: context.palette.gold
      },
      () => navigateToLevel(context.campaignLevel.level.id)
    );
    this.completionOverlay.show();
    crazyGamesPlatform.gameplayStop();
  }

  private sync(snapshot: UtilityTaskSnapshot, copy: UtilityTaskCopy): void {
    const context = this.context;
    this.hud?.update(
      {
        step: snapshot.step,
        stockedRows: snapshot.progress,
        totalRows: snapshot.total,
        progressUnit: copy.progressUnit,
        coins: snapshot.coins,
        stars: snapshot.stars
      },
      copy
    );

    if (context.mode === "clean") {
      this.player?.setTexture(snapshot.step === "collect-tools"
        ? context.levelAssets.worker.key
        : context.levelAssets.workerMop.key);
      this.cleaningView?.sync({
        phase: snapshot.step === "collect-tools"
          ? "tools"
          : snapshot.step === "clean"
            ? "spills"
            : "complete",
        completedSpills: snapshot.progress
      });
    } else {
      this.player?.setTexture(snapshot.step === "complete"
        ? context.levelAssets.worker.key
        : context.levelAssets.workerThinking.key);
      this.orderTicket?.sync(this.findChallenge?.snapshot().collectedProductIds ?? []);
    }

    this.syncTarget(snapshot);
    if (snapshot.step === "complete" && !this.completed) this.completeLevel(snapshot);
  }

  private completeLevel(snapshot: UtilityTaskSnapshot): void {
    this.completed = true;
    const context = this.context;
    playRestockCompletionFeedback(this, {
      title: context.labels.completionTitle,
      coins: context.runtime.reward.totalCoins,
      stars: context.runtime.reward.totalStars,
      hudColor: context.palette.hud,
      accentColor: context.palette.gold,
      centreX: context.world.width / 2,
      centreY: 400,
      sparkleOriginX: context.mode === "clean" ? 900 : 1120,
      sparkleOriginY: 560
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
    const findPerformance = context.mode === "find-items" && this.findChallenge
      ? this.findChallenge.snapshot()
      : undefined;
    const performanceLabel = findPerformance
      ? `ORDER CLEARED  •  ${findPerformance.remainingSeconds}s LEFT  •  ${findPerformance.mistakes} MISTAKES\n`
      : "";
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
          `${performanceLabel}+${context.runtime.reward.totalStars} STAR   +${context.runtime.reward.totalCoins} COINS`,
        actionLabel: progression.actionLabel,
        panelColor: context.palette.hud,
        accentColor: context.palette.gold
      },
      () => {
        if (progression.kind === "replay-campaign") this.campaignSession?.session.reset();
        navigateToLevel(progression.targetLevelId);
      }
    );
    this.completionOverlay.show();

    crazyGamesPlatform.reportProgress(
      Math.round((context.campaignLevel.levelNumber / context.campaignTotalLevels) * 100)
    );
    crazyGamesPlatform.gameplayStop();
  }

  private syncTarget(snapshot: UtilityTaskSnapshot): void {
    if (this.context.mode === "find-items") {
      this.target?.sync(undefined, false);
      this.hud?.setActionEnabled(false);
      return;
    }
    const bounds = this.targetBounds(snapshot);
    const enabled = this.canInteract(snapshot);
    this.target?.sync(bounds, enabled);
    this.hud?.setActionEnabled(enabled);
  }

  private targetBounds(snapshot: UtilityTaskSnapshot): {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  } | undefined {
    if (
      snapshot.step === "complete" ||
      this.context.mode !== "clean" ||
      this.cleaningView instanceof ClosingSafetyCleaningTaskView
    ) return undefined;
    const point = this.currentInteractionPoint(snapshot);
    if (!point) return undefined;
    const visual = this.visualPreset as CleanLevelVisualPreset;
    const size = snapshot.step === "collect-tools"
      ? visual.toolsTargetSize
      : visual.spillTargetSize;
    return {
      x: point.x,
      y: point.y,
      width: size.width,
      height: size.height
    };
  }

  private currentInteractionPoint(snapshot: UtilityTaskSnapshot): NavigationPoint | undefined {
    if (this.context.mode !== "clean") return undefined;
    if (snapshot.step === "collect-tools") return this.context.runtime.toolPoint;
    if (snapshot.step === "clean") return this.context.runtime.spotPositions[snapshot.progress];
    return undefined;
  }

  private canInteract(snapshot: UtilityTaskSnapshot): boolean {
    const point = this.currentInteractionPoint(snapshot);
    return Boolean(
      point &&
      this.interactionGate.isReady() &&
      this.player?.isNear(point, this.context.campaignLevel.level.navigation.interactionRadius)
    );
  }

  private dispose(): void {
    this.disposers.splice(0).forEach((dispose) => dispose());
    this.taskObjects.forEach((object) => object.destroy());
    if (this.cleaningView) this.cleaningView.destroy();
    else this.progressObjects.forEach((object) => object.destroy());
    this.orderTicket?.destroy();
    this.findCountdown?.destroy();
    this.completionOverlay?.destroy();
    this.player?.destroy();
    this.target?.destroy();
    this.interactionGate.destroy();
    delete document.body.dataset.findItemsVisibleCount;
    delete document.body.dataset.findItemsSelectionMode;
  }
}
