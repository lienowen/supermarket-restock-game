import Phaser from "phaser";
import type { FindItemsStarterMarketPresentationContext } from "../context/StarterMarketPresentationContext";
import { resolveLevelVisualPreset } from "../visual/LevelVisualPresetResolver";
import type { FindItemsLevelVisualPreset } from "../visual/MarketLevelVisualPreset";
import { createOpaqueCutoutTexture } from "../visual/OpaqueCutoutTexture";
import { createTrimmedTexture, fitImageIntoBox } from "../visual/TrimmedTexture";
import { UtilityTaskScene } from "./UtilityTaskScene";
import type { SceneCampaignSessionContext } from "./StarterMarketScene";

const GOLDEN_EXTRA_PRODUCT_KEYS = Object.freeze([
  "product-banana-bunch",
  "product-grapes-pack",
  "product-peanut-butter"
]);

const GOLDEN_ZONE_LAYOUT = Object.freeze({
  breakfastFixture: Object.freeze({ x: 700, y: 706, maxWidth: 470, maxHeight: 320 }),
  produceFixture: Object.freeze({ x: 1220, y: 752, maxWidth: 360, maxHeight: 250 }),
  basket: Object.freeze({ x: 855, y: 816, maxWidth: 118, maxHeight: 82 }),
  worker: Object.freeze({ maxWidth: 185, maxHeight: 300 })
});

const GOLDEN_PRODUCT_LAYOUT = Object.freeze([
  Object.freeze({ sourceName: "find-item-milk-bottle", name: "find-item-milk-bottle", assetKey: "product-milk-bottle", x: 940, y: 590, maxWidth: 40, maxHeight: 64, requested: true }),
  Object.freeze({ sourceName: "find-decoy-decoy-yogurt", name: "find-decoy-yogurt", assetKey: "product-yogurt-cup", x: 1015, y: 590, maxWidth: 40, maxHeight: 46, requested: false }),
  Object.freeze({ sourceName: "find-item-cereal-box", name: "find-item-cereal-box", assetKey: "product-cereal-box", x: 720, y: 620, maxWidth: 38, maxHeight: 54, requested: true }),
  Object.freeze({ sourceName: "find-decoy-decoy-oats", name: "find-decoy-oats", assetKey: "product-oats-canister", x: 650, y: 620, maxWidth: 38, maxHeight: 50, requested: false }),
  Object.freeze({ sourceName: "find-decoy-decoy-paper-towels", name: "find-decoy-peanut-butter", assetKey: "product-peanut-butter", x: 790, y: 620, maxWidth: 36, maxHeight: 50, requested: false }),
  Object.freeze({ sourceName: "find-item-apple", name: "find-item-apple", assetKey: "product-apple", x: 1220, y: 697, maxWidth: 42, maxHeight: 42, requested: true }),
  Object.freeze({ sourceName: "find-decoy-decoy-chips", name: "find-decoy-banana", assetKey: "product-banana-bunch", x: 1155, y: 700, maxWidth: 56, maxHeight: 42, requested: false }),
  Object.freeze({ sourceName: "find-decoy-decoy-detergent", name: "find-decoy-grapes", assetKey: "product-grapes-pack", x: 1285, y: 700, maxWidth: 48, maxHeight: 40, requested: false })
]);

const GOLDEN_REQUESTED_NAMES = Object.freeze([
  "find-item-milk-bottle",
  "find-item-apple",
  "find-item-cereal-box"
]);
const WALK_FRAME_MS = 140;
const WALK_EPSILON = 0.35;
const PICKUP_START_RADIUS = 82;
const PICKUP_HOLD_MS = 440;

/** Level 5 mature-pass golden presentation over the proven Order Hunt controller. */
export class GoldenOrderHuntScene extends UtilityTaskScene {
  private readonly goldenVisual: FindItemsLevelVisualPreset;
  private readonly basketFeedbackSeen = new Set<string>();
  private previousWorkerPosition?: { readonly x: number; readonly y: number };
  private walkFrameElapsedMs = 0;
  private walkFrameIndex = 0;
  private pendingGoldenPickupProductId?: string;
  private pickupVisualUntil = 0;

  constructor(
    private readonly goldenContext: FindItemsStarterMarketPresentationContext,
    campaignSession?: SceneCampaignSessionContext
  ) {
    super(goldenContext, campaignSession);
    this.goldenVisual = resolveLevelVisualPreset(goldenContext.campaignLevel.level) as FindItemsLevelVisualPreset;
  }

  override preload(): void {
    super.preload();
    GOLDEN_EXTRA_PRODUCT_KEYS.forEach((assetKey) => {
      const asset = this.goldenContext.assets.require(assetKey);
      if (!this.textures.exists(asset.key)) this.load.image(asset.key, asset.path);
    });
  }

  override create(): void {
    super.create();
    document.body.dataset.goldenLevel = "level-5-mature-pass-v1";
    document.body.dataset.goldenEnvironment = this.goldenContext.levelAssets.environment.key;
    document.body.dataset.goldenWorldScale = "trimmed-v3";
    document.body.dataset.goldenHud = "compact-v1";
    document.body.dataset.goldenWorkerMotion = "idle";
    document.body.dataset.goldenBasketCount = "0";
    this.hideLegacyHudChrome();
    this.createCompactHeader();
    this.createStoreFixtures();
    this.reframeProducts();
    this.reframeBasket();
    this.syncWorkerMotion(0, true);
  }

  override update(time: number, delta: number): void {
    super.update(time, delta);
    this.hideLegacyHudChrome();
    this.syncBasketFeedback();
    this.syncPickupIntent();
    this.syncWorkerMotion(delta, false);
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
    panel.fillRoundedRect(24, 22, 248, 54, 16);
    panel.lineStyle(1, 0xffffff, 0.12);
    panel.strokeRoundedRect(24, 22, 248, 54, 16);

    this.add.text(44, 34, "ORDER HUNT", {
      fontFamily: "Arial",
      fontSize: "15px",
      color: "#ffffff",
      fontStyle: "bold",
      letterSpacing: 1.2
    }).setDepth(111).setScrollFactor(0);
    this.add.text(44, 54, "Find the 3 items on the order card", {
      fontFamily: "Arial",
      fontSize: "12px",
      color: "#b9d9c5"
    }).setDepth(111).setScrollFactor(0);
  }

  private createStoreFixtures(): void {
    const breakfastTexture = createTrimmedTexture(this, this.goldenContext.levelAssets.fixture.key, {
      suffix: "--golden-trimmed",
      padding: 2
    });
    const breakfast = this.add.image(
      GOLDEN_ZONE_LAYOUT.breakfastFixture.x,
      GOLDEN_ZONE_LAYOUT.breakfastFixture.y,
      breakfastTexture
    ).setOrigin(0.5, 0.98).setDepth(10).setName("golden-order-breakfast-fixture");
    fitImageIntoBox(breakfast, GOLDEN_ZONE_LAYOUT.breakfastFixture.maxWidth, GOLDEN_ZONE_LAYOUT.breakfastFixture.maxHeight);

    const produceAssetKey = this.goldenVisual.auxiliaryFixtures[0]?.assetKey;
    if (!produceAssetKey) throw new Error("Golden Level 5 requires a produce fixture");
    this.goldenContext.assets.require(produceAssetKey);
    const produceTexture = createTrimmedTexture(this, produceAssetKey, {
      suffix: "--golden-trimmed",
      padding: 2
    });
    const produce = this.add.image(
      GOLDEN_ZONE_LAYOUT.produceFixture.x,
      GOLDEN_ZONE_LAYOUT.produceFixture.y,
      produceTexture
    ).setOrigin(0.5, 0.98).setDepth(10).setName("golden-order-produce-fixture");
    fitImageIntoBox(produce, GOLDEN_ZONE_LAYOUT.produceFixture.maxWidth, GOLDEN_ZONE_LAYOUT.produceFixture.maxHeight);
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
        .setData("requested", layout.requested);
      fitImageIntoBox(object, layout.maxWidth, layout.maxHeight);
      object.setInteractive({ useHandCursor: true });
      if (layout.requested) {
        const productId = layout.name.replace("find-item-", "");
        object.on("pointerdown", () => {
          this.pendingGoldenPickupProductId = productId;
        });
      }
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

  private syncPickupIntent(): void {
    const productId = this.pendingGoldenPickupProductId;
    if (!productId || this.time.now < this.pickupVisualUntil) return;
    const target = this.goldenContext.runtime.itemTargets.find((entry) => entry.productId === productId);
    const actor = this.children.getByName("find-items-worker");
    if (!target || !(actor instanceof Phaser.GameObjects.Image)) return;
    if (Phaser.Math.Distance.Between(actor.x, actor.y, target.x, target.y) > PICKUP_START_RADIUS) return;

    this.pickupVisualUntil = this.time.now + PICKUP_HOLD_MS;
    this.pendingGoldenPickupProductId = undefined;
    document.body.dataset.goldenPickupProduct = productId;
  }

  private syncBasketFeedback(): void {
    GOLDEN_REQUESTED_NAMES.forEach((name) => {
      if (this.basketFeedbackSeen.has(name)) return;
      const item = this.children.getByName(name);
      if (!(item instanceof Phaser.GameObjects.Image) || item.visible) return;
      this.basketFeedbackSeen.add(name);
      this.playBasketFeedback();
    });
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
      actor.setTexture(createOpaqueCutoutTexture(this, this.goldenContext.levelAssets.workerThinking.key));
      document.body.dataset.goldenWorkerMotion = "pickup";
      document.body.dataset.goldenWorkerFrame = "pick";
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
