import Phaser from "phaser";
import type { FindItemsStarterMarketPresentationContext } from "../context/StarterMarketPresentationContext";
import { createOpaqueCutoutTexture } from "../visual/OpaqueCutoutTexture";
import { createTrimmedTexture, fitImageIntoBox } from "../visual/TrimmedTexture";
import { UtilityTaskScene } from "./UtilityTaskScene";
import type { SceneCampaignSessionContext } from "./StarterMarketScene";

const GOLDEN_EXTRA_PRODUCT_KEYS = Object.freeze([
  "product-banana-bunch",
  "product-grapes-pack",
  "product-peanut-butter"
]);
const GOLDEN_PICKUP_WORKER_KEY = "worker-a-place-middle";
const MOBILE_TOUCH_MOVE_SPEED = 690;

const GOLDEN_ZONE_LAYOUT = Object.freeze({
  basket: Object.freeze({ x: 825, y: 820, maxWidth: 112, maxHeight: 80 }),
  worker: Object.freeze({ maxWidth: 178, maxHeight: 286 })
});

const GOLDEN_NAVIGATION_POINTS: Readonly<Record<string, { readonly x: number; readonly y: number }>> = Object.freeze({
  "apple": Object.freeze({ x: 255, y: 770 }),
  "cereal-box": Object.freeze({ x: 720, y: 742 }),
  "milk-bottle": Object.freeze({ x: 1320, y: 758 })
});

const GOLDEN_PRODUCT_LAYOUT = Object.freeze([
  Object.freeze({ sourceName: "find-decoy-decoy-chips", name: "find-decoy-banana", interactionId: "decoy-chips", assetKey: "product-banana-bunch", x: 120, y: 515, maxWidth: 68, maxHeight: 50, requested: false }),
  Object.freeze({ sourceName: "find-item-apple", name: "find-item-apple", interactionId: "apple", assetKey: "product-apple", x: 220, y: 515, maxWidth: 58, maxHeight: 58, requested: true }),
  Object.freeze({ sourceName: "find-decoy-decoy-detergent", name: "find-decoy-grapes", interactionId: "decoy-detergent", assetKey: "product-grapes-pack", x: 320, y: 515, maxWidth: 62, maxHeight: 50, requested: false }),
  Object.freeze({ sourceName: "find-item-cereal-box", name: "find-item-cereal-box", interactionId: "cereal-box", assetKey: "product-cereal-box", x: 620, y: 390, maxWidth: 50, maxHeight: 70, requested: true }),
  Object.freeze({ sourceName: "find-decoy-decoy-oats", name: "find-decoy-oats", interactionId: "decoy-oats", assetKey: "product-oats-canister", x: 720, y: 390, maxWidth: 48, maxHeight: 66, requested: false }),
  Object.freeze({ sourceName: "find-decoy-decoy-paper-towels", name: "find-decoy-peanut-butter", interactionId: "decoy-paper-towels", assetKey: "product-peanut-butter", x: 820, y: 390, maxWidth: 48, maxHeight: 64, requested: false }),
  Object.freeze({ sourceName: "find-item-milk-bottle", name: "find-item-milk-bottle", interactionId: "milk-bottle", assetKey: "product-milk-bottle", x: 1290, y: 405, maxWidth: 50, maxHeight: 82, requested: true }),
  Object.freeze({ sourceName: "find-decoy-decoy-yogurt", name: "find-decoy-yogurt", interactionId: "decoy-yogurt", assetKey: "product-yogurt-cup", x: 1400, y: 405, maxWidth: 54, maxHeight: 58, requested: false })
]);

const WALK_FRAME_MS = 140;
const WALK_EPSILON = 0.35;
const PICKUP_HOLD_MS = 440;

const touchDeviceActive = (): boolean => {
  const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  const compactViewport = Math.min(window.innerWidth, window.innerHeight) <= 820;
  return navigator.maxTouchPoints > 0 || coarsePointer || compactViewport;
};

const levelFiveContext = (
  context: FindItemsStarterMarketPresentationContext
): FindItemsStarterMarketPresentationContext => {
  const runtime = Object.freeze({
    ...context.runtime,
    itemTargets: Object.freeze(context.runtime.itemTargets.map((target) => {
      const standPoint = GOLDEN_NAVIGATION_POINTS[target.productId];
      return Object.freeze(standPoint ? { ...target, ...standPoint } : { ...target });
    }))
  });
  const level = touchDeviceActive()
    ? Object.freeze({
        ...context.campaignLevel.level,
        navigation: Object.freeze({
          ...context.campaignLevel.level.navigation,
          moveSpeed: MOBILE_TOUCH_MOVE_SPEED
        })
      })
    : context.campaignLevel.level;
  const campaignLevel = Object.freeze({
    ...context.campaignLevel,
    level,
    runtime
  });
  return Object.freeze({
    ...context,
    campaignLevel,
    runtime
  });
};

/** Level 5: one clean authored store plate, three search zones, tap-to-pick on mobile. */
export class GoldenOrderHuntScene extends UtilityTaskScene {
  private readonly goldenContext: FindItemsStarterMarketPresentationContext;
  private readonly basketFeedbackSeen = new Set<string>();
  private readonly mobileTouchZones: Phaser.GameObjects.Zone[] = [];
  private previousWorkerPosition?: { readonly x: number; readonly y: number };
  private walkFrameElapsedMs = 0;
  private walkFrameIndex = 0;
  private pendingGoldenPickupProductId?: string;
  private pickupVisualUntil = 0;

  constructor(
    context: FindItemsStarterMarketPresentationContext,
    campaignSession?: SceneCampaignSessionContext
  ) {
    const presentation = levelFiveContext(context);
    super(presentation, campaignSession);
    this.goldenContext = presentation;
  }

  override preload(): void {
    super.preload();
    [...GOLDEN_EXTRA_PRODUCT_KEYS, GOLDEN_PICKUP_WORKER_KEY].forEach((assetKey) => {
      const asset = this.goldenContext.assets.require(assetKey);
      if (!this.textures.exists(asset.key)) this.load.image(asset.key, asset.path);
    });
  }

  override create(): void {
    super.create();
    document.body.dataset.goldenLevel = "level-5-three-zone-v2";
    document.body.dataset.goldenEnvironment = this.goldenContext.levelAssets.environment.key;
    document.body.dataset.goldenWorldScale = "background-zones-v2";
    document.body.dataset.goldenHud = "compact-v2";
    document.body.dataset.goldenWorkerMotion = "idle";
    document.body.dataset.goldenWorkerWalkObserved = "false";
    document.body.dataset.goldenPickupObserved = "false";
    document.body.dataset.goldenBasketCount = "0";
    document.body.dataset.goldenSceneDressing = document.body.dataset.sceneDressing ?? "unknown";
    this.hideLegacyHudChrome();
    this.createCompactHeader();
    this.reframeProducts();
    this.reframeBasket();
    this.installMobileProductAssist();
    this.syncWorkerMotion(0, true);
  }

  override update(time: number, delta: number): void {
    super.update(time, delta);
    this.hideLegacyHudChrome();
    this.syncBasketFeedback();
    this.syncPickupIntent();
    this.syncWorkerMotion(delta, false);
  }

  override attemptFindProduct(productId: string): void {
    const targetExists = this.goldenContext.runtime.itemTargets.some((target) => target.productId === productId);
    const item = this.children.getByName(`find-item-${productId}`);
    this.pendingGoldenPickupProductId =
      this.isInteractionReady() &&
      targetExists &&
      item instanceof Phaser.GameObjects.Image &&
      item.visible
        ? productId
        : undefined;
    super.attemptFindProduct(productId);
  }

  private hideLegacyHudChrome(): void {
    this.children.getChildren().forEach((gameObject) => {
      const displayObject = gameObject as Phaser.GameObjects.GameObject & {
        depth?: number;
        setVisible?: (visible: boolean) => unknown;
        disableInteractive?: () => unknown;
      };
      const depth = displayObject.depth ?? -1;
      if (depth < 99 || depth > 105) return;
      displayObject.setVisible?.(false);
      displayObject.disableInteractive?.();
    });
  }

  private createCompactHeader(): void {
    const panel = this.add.graphics().setDepth(110).setScrollFactor(0);
    panel.fillStyle(0x101b16, 0.88);
    panel.fillRoundedRect(24, 22, 258, 56, 16);
    panel.lineStyle(1, 0xffffff, 0.12);
    panel.strokeRoundedRect(24, 22, 258, 56, 16);

    this.add.text(44, 34, "ORDER HUNT", {
      fontFamily: "Arial",
      fontSize: "15px",
      color: "#ffffff",
      fontStyle: "bold",
      letterSpacing: 1.2
    }).setDepth(111).setScrollFactor(0);
    this.add.text(44, 55, "Tap an item · worker picks it", {
      fontFamily: "Arial",
      fontSize: "12px",
      color: "#b9d9c5"
    }).setDepth(111).setScrollFactor(0);
  }

  private reframeProducts(): void {
    GOLDEN_PRODUCT_LAYOUT.forEach((layout) => {
      const object = this.children.getByName(layout.sourceName);
      if (!(object instanceof Phaser.GameObjects.Image)) return;
      const trimmedTexture = createTrimmedTexture(this, layout.assetKey, {
        suffix: "--golden-trimmed",
        padding: 1
      });
      object
        .setName(layout.name)
        .setTexture(trimmedTexture)
        .setPosition(layout.x, layout.y)
        .setOrigin(0.5, 0.96)
        .setDepth(12 + layout.y / 1000)
        .setData("requested", layout.requested)
        .setData("golden-zone", this.zoneFor(layout.x));
      fitImageIntoBox(object, layout.maxWidth, layout.maxHeight);
      object.setInteractive({ useHandCursor: true });
    });
  }

  private reframeBasket(): void {
    const basket = this.children.getByName("order-basket");
    if (!(basket instanceof Phaser.GameObjects.Image)) return;
    const trimmedTexture = createTrimmedTexture(this, basket.texture.key, {
      suffix: "--golden-trimmed",
      padding: 2
    });
    basket
      .setTexture(trimmedTexture)
      .setPosition(GOLDEN_ZONE_LAYOUT.basket.x, GOLDEN_ZONE_LAYOUT.basket.y)
      .setOrigin(0.5, 0.98)
      .setDepth(20);
    fitImageIntoBox(basket, GOLDEN_ZONE_LAYOUT.basket.maxWidth, GOLDEN_ZONE_LAYOUT.basket.maxHeight);
  }

  private installMobileProductAssist(): void {
    if (!touchDeviceActive()) {
      document.body.dataset.goldenMobileTouch = "desktop-default";
      return;
    }

    GOLDEN_PRODUCT_LAYOUT.forEach((layout) => {
      const zone = this.add.zone(
        layout.x,
        layout.y - layout.maxHeight * 0.48,
        96,
        108
      )
        .setDepth(220)
        .setName(`golden-touch-${layout.interactionId}`)
        .setInteractive({ useHandCursor: false });
      zone.on(
        "pointerdown",
        (
          _pointer: Phaser.Input.Pointer,
          _localX: number,
          _localY: number,
          event: Phaser.Types.Input.EventData
        ) => {
          event.stopPropagation();
          this.playProductTapFeedback(layout.x, layout.y - layout.maxHeight * 0.5, layout.requested);
          this.attemptFindProduct(layout.interactionId);
          document.body.dataset.goldenMobileLastProduct = layout.interactionId;
        }
      );
      this.mobileTouchZones.push(zone);
    });

    document.body.dataset.goldenMobileTouch = "expanded-product-hotspots-v1";
    document.body.dataset.goldenMobileMoveSpeed = String(MOBILE_TOUCH_MOVE_SPEED);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.mobileTouchZones.splice(0).forEach((zone) => zone.destroy());
    });
  }

  private playProductTapFeedback(x: number, y: number, requested: boolean): void {
    const pulse = this.add.circle(x, y, 28, 0xffd95e, 0.05)
      .setStrokeStyle(3, 0xffd95e, 0.9)
      .setDepth(218);
    this.tweens.add({
      targets: pulse,
      scale: 1.55,
      alpha: 0,
      duration: 260,
      ease: "Quad.Out",
      onComplete: () => pulse.destroy()
    });
    if (!requested) return;
    const label = this.add.text(x, y - 42, "PICKING…", {
      fontFamily: "Arial",
      fontSize: "12px",
      fontStyle: "bold",
      color: "#f8f1cf",
      backgroundColor: "rgba(12, 38, 25, 0.88)",
      padding: { x: 8, y: 4 }
    }).setOrigin(0.5).setDepth(219);
    this.tweens.add({
      targets: label,
      y: label.y - 12,
      alpha: 0,
      duration: 520,
      delay: 180,
      ease: "Sine.Out",
      onComplete: () => label.destroy()
    });
  }

  private zoneFor(x: number): "produce" | "grocery" | "dairy" {
    if (x < 450) return "produce";
    if (x < 1050) return "grocery";
    return "dairy";
  }

  private syncPickupIntent(): void {
    if (this.time.now < this.pickupVisualUntil) return;
    const productId = this.pendingGoldenPickupProductId;
    if (!productId) return;
    const item = this.children.getByName(`find-item-${productId}`);
    if (!(item instanceof Phaser.GameObjects.Image)) {
      this.pendingGoldenPickupProductId = undefined;
      return;
    }

    if (item.visible && item.alpha >= 0.995) return;

    this.pickupVisualUntil = this.time.now + PICKUP_HOLD_MS;
    this.pendingGoldenPickupProductId = undefined;
    document.body.dataset.goldenPickupProduct = productId;
  }

  private syncBasketFeedback(): void {
    const collected = this.controller.snapshot().progress;
    while (this.basketFeedbackSeen.size < collected) {
      const marker = `collected-${this.basketFeedbackSeen.size + 1}`;
      this.basketFeedbackSeen.add(marker);
      this.playBasketFeedback();
    }
    document.body.dataset.goldenBasketCount = String(this.basketFeedbackSeen.size);
  }

  private playBasketFeedback(): void {
    const basket = this.children.getByName("order-basket");
    if (!(basket instanceof Phaser.GameObjects.Image)) return;

    this.tweens.killTweensOf(basket);
    const baseScaleX = basket.scaleX;
    const baseScaleY = basket.scaleY;
    this.tweens.add({
      targets: basket,
      scaleX: baseScaleX * 1.14,
      scaleY: baseScaleY * 1.14,
      duration: 120,
      yoyo: true,
      ease: "Sine.Out",
      onComplete: () => basket.setScale(baseScaleX, baseScaleY)
    });

    const plusOne = this.add.text(basket.x, basket.y - basket.displayHeight - 8, "+1", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#f7e7a9",
      fontStyle: "bold",
      stroke: "#16231c",
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(112).setName("golden-basket-plus-one");
    this.tweens.add({
      targets: plusOne,
      y: plusOne.y - 28,
      alpha: 0,
      duration: 520,
      ease: "Cubic.Out",
      onComplete: () => plusOne.destroy()
    });
  }

  private syncWorkerMotion(delta: number, initialize: boolean): void {
    const actor = this.children.getByName("find-items-worker");
    if (!(actor instanceof Phaser.GameObjects.Image)) return;

    const previous = this.previousWorkerPosition;
    const dx = previous ? actor.x - previous.x : 0;
    const dy = previous ? actor.y - previous.y : 0;
    const moving = !initialize && Math.hypot(dx, dy) > WALK_EPSILON;
    const pickupActive = this.time.now < this.pickupVisualUntil;

    if (pickupActive) {
      this.walkFrameElapsedMs = 0;
      this.walkFrameIndex = 0;
      const pickupTexture = createOpaqueCutoutTexture(this, GOLDEN_PICKUP_WORKER_KEY);
      actor.setTexture(pickupTexture);
      document.body.dataset.goldenWorkerMotion = "pickup";
      document.body.dataset.goldenWorkerFrame = "pick";
      document.body.dataset.goldenPickupObserved = "true";
      document.body.dataset.goldenLastPickupTexture = pickupTexture;
    } else if (moving) {
      this.walkFrameElapsedMs += delta;
      if (this.walkFrameElapsedMs >= WALK_FRAME_MS) {
        this.walkFrameElapsedMs %= WALK_FRAME_MS;
        this.walkFrameIndex = (this.walkFrameIndex + 1) % this.goldenContext.levelAssets.workerWalk.length;
      }
      const walkKey = this.goldenContext.levelAssets.workerWalk[this.walkFrameIndex]?.key;
      if (walkKey) actor.setTexture(createOpaqueCutoutTexture(this, walkKey));
      if (Math.abs(dx) > 0.05) actor.setFlipX(dx < 0);
      document.body.dataset.goldenWorkerMotion = "walk";
      document.body.dataset.goldenWorkerFrame = String(this.walkFrameIndex + 1);
      document.body.dataset.goldenWorkerWalkObserved = "true";
      document.body.dataset.goldenLastWalkTexture = actor.texture.key;
    } else {
      this.walkFrameElapsedMs = 0;
      this.walkFrameIndex = 0;
      actor.setTexture(createOpaqueCutoutTexture(this, this.goldenContext.levelAssets.worker.key));
      document.body.dataset.goldenWorkerMotion = "idle";
      document.body.dataset.goldenWorkerFrame = "0";
    }

    actor
      .setAlpha(1)
      .setOrigin(0.5, 0.98)
      .setBlendMode(Phaser.BlendModes.NORMAL);
    fitImageIntoBox(actor, GOLDEN_ZONE_LAYOUT.worker.maxWidth, GOLDEN_ZONE_LAYOUT.worker.maxHeight);
    this.previousWorkerPosition = { x: actor.x, y: actor.y };
  }
}
