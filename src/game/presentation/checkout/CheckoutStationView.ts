import Phaser from "phaser";
import type { CheckoutSceneSnapshot } from "../../application/CheckoutSceneController";
import type { PresentationPoint } from "../context/StarterMarketPresentationContext";
import type { CheckoutLevelVisualPreset } from "../visual/MarketLevelVisualPreset";
import { createOpaqueCutoutTexture } from "../visual/OpaqueCutoutTexture";
import { createTrimmedTexture, fitImageIntoBox } from "../visual/TrimmedTexture";

export interface CheckoutStationViewConfig {
  readonly checkoutPosition: PresentationPoint;
  readonly queueStart: PresentationPoint;
  readonly checkoutAssetKey: string;
  readonly basketAssetKey: string;
  readonly customerAssetKeys: readonly string[];
  readonly productAssetKeys: readonly string[];
  readonly customerCount: number;
  readonly scanDurationMs: number;
  readonly queueAdvanceDurationMs: number;
  readonly panelColor: number;
  readonly accentColor: number;
  readonly visual: CheckoutLevelVisualPreset;
}

const PRODUCT_BOXES = Object.freeze([
  Object.freeze({ width: 44, height: 46 }),
  Object.freeze({ width: 40, height: 62 }),
  Object.freeze({ width: 42, height: 64 })
]);

/**
 * Mature checkout presentation keeps the register grounded in the store world:
 * real product art sits on the belt, one solid customer stands at the counter,
 * and each served order visibly advances the customer instead of only changing
 * a number in the HUD.
 */
export class CheckoutStationView {
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly queueBaskets: Phaser.GameObjects.Image[] = [];
  private readonly beltItems: Phaser.GameObjects.Image[] = [];
  private readonly customerTextureKeys: readonly string[];
  private readonly beltBasket: Phaser.GameObjects.Image;
  private readonly activeCustomer?: Phaser.GameObjects.Image;
  private readonly registerText: Phaser.GameObjects.Text;
  private readonly waitingText: Phaser.GameObjects.Text;
  private readonly queueOverflowText: Phaser.GameObjects.Text;
  private readonly laneLight: Phaser.GameObjects.Arc;
  private readonly serviceHalo: Phaser.GameObjects.Ellipse;
  private readonly scanBeam: Phaser.GameObjects.Rectangle;
  private previousServed = 0;
  private initialized = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: CheckoutStationViewConfig
  ) {
    const { checkoutPosition, visual } = config;
    this.customerTextureKeys = Object.freeze(
      config.customerAssetKeys.map((assetKey) => createOpaqueCutoutTexture(scene, assetKey))
    );

    this.serviceHalo = scene.add.ellipse(
      checkoutPosition.x - 34,
      checkoutPosition.y - 6,
      270,
      102,
      config.accentColor,
      0.04
    ).setStrokeStyle(2, config.accentColor, 0.18).setDepth(18);

    const shadow = scene.add.ellipse(
      checkoutPosition.x + 8,
      checkoutPosition.y + 25,
      visual.station.shadowSize.width,
      visual.station.shadowSize.height,
      0x1b2c26,
      0.22
    ).setDepth(19);

    const counterTexture = createTrimmedTexture(scene, config.checkoutAssetKey, {
      alphaThreshold: 10,
      suffix: "--checkout-trimmed",
      padding: 2
    });
    const counter = scene.add.image(
      checkoutPosition.x,
      checkoutPosition.y + visual.station.counterOffsetY,
      counterTexture
    )
      .setOrigin(0.5, 0.96)
      .setDisplaySize(visual.station.counterSize.width, visual.station.counterSize.height)
      .setDepth(25)
      .setName("checkout-counter-production");

    const beltSurface = scene.add.graphics().setDepth(29);
    beltSurface.fillStyle(0x192824, 0.76);
    beltSurface.fillRoundedRect(checkoutPosition.x - 146, checkoutPosition.y - 88, 170, 46, 14);
    beltSurface.lineStyle(2, 0xffffff, 0.1);
    beltSurface.strokeRoundedRect(checkoutPosition.x - 146, checkoutPosition.y - 88, 170, 46, 14);

    const basketTexture = createTrimmedTexture(scene, config.basketAssetKey, {
      alphaThreshold: 10,
      suffix: "--checkout-trimmed",
      padding: 2
    });
    this.beltBasket = scene.add.image(
      checkoutPosition.x - 110,
      checkoutPosition.y - 43,
      basketTexture
    )
      .setOrigin(0.5, 0.96)
      .setDisplaySize(88, 62)
      .setDepth(30)
      .setName("checkout-active-basket");

    config.productAssetKeys.slice(0, 3).forEach((assetKey, index) => {
      const texture = createTrimmedTexture(scene, assetKey, {
        alphaThreshold: 10,
        suffix: "--checkout-product",
        padding: 1
      });
      const item = scene.add.image(
        checkoutPosition.x - 116 + index * 42,
        checkoutPosition.y - 67,
        texture
      )
        .setOrigin(0.5, 0.96)
        .setDepth(31)
        .setName(`checkout-belt-product-${index + 1}`);
      const box = PRODUCT_BOXES[index] ?? PRODUCT_BOXES[0];
      fitImageIntoBox(item, box.width, box.height);
      this.beltItems.push(item);
      this.objects.push(item);
    });

    this.scanBeam = scene.add.rectangle(
      checkoutPosition.x + visual.station.scanBeamOffset.x,
      checkoutPosition.y + visual.station.scanBeamOffset.y,
      visual.station.scanBeamSize.width,
      visual.station.scanBeamSize.height,
      0xff3c31,
      0
    ).setDepth(32);

    this.registerText = scene.add.text(
      checkoutPosition.x + visual.station.registerOffset.x,
      checkoutPosition.y + visual.station.registerOffset.y,
      "CLOSED",
      {
        fontFamily: "Arial",
        fontSize: "14px",
        color: "#ffd95e",
        fontStyle: "bold",
        align: "center",
        backgroundColor: "#10211d",
        padding: { x: 9, y: 5 }
      }
    ).setOrigin(0.5).setDepth(32);

    this.laneLight = scene.add.circle(
      checkoutPosition.x + visual.station.laneLightOffset.x,
      checkoutPosition.y + visual.station.laneLightOffset.y,
      10,
      0xc95b4f,
      1
    ).setStrokeStyle(2, 0xffffff, 0.4).setDepth(32);

    if (this.customerTextureKeys[0]) {
      this.activeCustomer = scene.add.image(
        checkoutPosition.x + 195,
        checkoutPosition.y + 18,
        this.customerTextureKeys[0]
      )
        .setOrigin(0.5, 0.96)
        .setDisplaySize(184, 292)
        .setDepth(24.6)
        .setName("checkout-active-customer");
      const customerShadow = scene.add.ellipse(
        checkoutPosition.x + 195,
        checkoutPosition.y + 23,
        112,
        26,
        0x18261f,
        0.2
      ).setDepth(24.5).setName("checkout-customer-shadow");
      this.objects.push(customerShadow, this.activeCustomer);
    }

    const queueCentre = {
      x: config.queueStart.x + visual.queue.panelOffset.x,
      y: config.queueStart.y + visual.queue.panelOffset.y
    };
    const queuePanel = scene.add.graphics().setDepth(20);
    queuePanel.fillStyle(config.panelColor, 0.9);
    queuePanel.fillRoundedRect(
      queueCentre.x - visual.queue.panelSize.width / 2,
      queueCentre.y - visual.queue.panelSize.height / 2,
      visual.queue.panelSize.width,
      visual.queue.panelSize.height,
      16
    );
    queuePanel.lineStyle(1, config.accentColor, 0.34);
    queuePanel.strokeRoundedRect(
      queueCentre.x - visual.queue.panelSize.width / 2,
      queueCentre.y - visual.queue.panelSize.height / 2,
      visual.queue.panelSize.width,
      visual.queue.panelSize.height,
      16
    );

    this.waitingText = scene.add.text(
      queueCentre.x,
      queueCentre.y - 24,
      `${config.customerCount} ORDERS WAITING`,
      {
        fontFamily: "Arial",
        fontSize: "12px",
        color: "#eaf5ed",
        fontStyle: "bold"
      }
    ).setOrigin(0.5).setDepth(22);

    const visibleWidth = (visual.queue.visibleBasketCount - 1) * visual.queue.basketGap;
    for (let index = 0; index < visual.queue.visibleBasketCount; index += 1) {
      const basket = scene.add.image(
        queueCentre.x - visibleWidth / 2 + index * visual.queue.basketGap,
        queueCentre.y + 28,
        basketTexture
      )
        .setOrigin(0.5, 0.96)
        .setDisplaySize(visual.queue.basketSize.width, visual.queue.basketSize.height)
        .setDepth(22)
        .setName(`checkout-queued-basket-${index + 1}`);
      this.queueBaskets.push(basket);
      this.objects.push(basket);
    }

    this.queueOverflowText = scene.add.text(
      queueCentre.x + visual.queue.panelSize.width / 2 - 19,
      queueCentre.y + 18,
      "",
      {
        fontFamily: "Arial",
        fontSize: "12px",
        color: "#ffd95e",
        fontStyle: "bold"
      }
    ).setOrigin(0.5).setDepth(23);

    this.objects.push(
      this.serviceHalo,
      shadow,
      counter,
      beltSurface,
      this.beltBasket,
      this.scanBeam,
      this.registerText,
      this.laneLight,
      queuePanel,
      this.waitingText,
      this.queueOverflowText
    );
    document.body.dataset.checkoutPresentation = "mature-station-v1";
    document.body.dataset.checkoutProducts = "real-product-sprites";
    document.body.dataset.checkoutCustomer = this.activeCustomer ? "solid-active-customer" : "unavailable";
  }

  sync(snapshot: CheckoutSceneSnapshot): void {
    const isOpen = snapshot.step !== "open";
    const remaining = Math.max(0, snapshot.totalCustomers - snapshot.customersServed);
    this.registerText.setText(isOpen ? `${snapshot.customersServed}/${snapshot.totalCustomers}` : "CLOSED");
    this.registerText.setColor(isOpen ? "#9ff0b5" : "#ffd95e");
    this.laneLight.setFillStyle(isOpen ? 0x52be75 : 0xc95b4f, 1);
    this.waitingText.setText(`${remaining} ORDERS WAITING`);
    this.waitingText.setAlpha(snapshot.step === "complete" ? 0.45 : 1);
    this.serviceHalo.setVisible(snapshot.step !== "complete");
    this.beltBasket.setAlpha(isOpen && remaining > 0 ? 1 : 0.42);
    this.layoutBasketQueue(remaining);

    if (!this.initialized) {
      this.initialized = true;
      this.previousServed = snapshot.customersServed;
      this.activeCustomer?.setVisible(remaining > 0);
      return;
    }

    if (snapshot.customersServed <= this.previousServed) return;
    this.playScanBeam();
    this.playCustomerAdvance(snapshot.customersServed, remaining);
    this.previousServed = snapshot.customersServed;
  }

  destroy(): void {
    this.objects.forEach((object) => object.destroy());
    this.objects.length = 0;
    this.queueBaskets.length = 0;
    this.beltItems.length = 0;
  }

  private layoutBasketQueue(remaining: number): void {
    const visible = Math.min(remaining, this.queueBaskets.length);
    this.queueBaskets.forEach((basket, index) => {
      basket.setVisible(index < visible).setAlpha(index === 0 ? 1 : 0.72);
    });
    const overflow = Math.max(0, remaining - visible);
    this.queueOverflowText.setText(overflow > 0 ? `+${overflow}` : "");
  }

  private playScanBeam(): void {
    this.scanBeam.setAlpha(0.92).setScale(0.25, 1);
    this.scene.tweens.add({
      targets: this.scanBeam,
      alpha: 0,
      scaleX: 1.25,
      duration: Math.max(180, this.config.scanDurationMs * 0.65),
      ease: "Cubic.Out"
    });

    const startX = this.config.checkoutPosition.x - 110;
    this.beltBasket.setPosition(startX, this.config.checkoutPosition.y - 43).setAlpha(1).setScale(1);
    this.scene.tweens.add({
      targets: this.beltBasket,
      x: startX + 105,
      alpha: 0.16,
      scaleX: 0.82,
      scaleY: 0.82,
      duration: Math.max(240, this.config.queueAdvanceDurationMs),
      ease: "Cubic.In",
      onComplete: () => this.beltBasket
        .setPosition(startX, this.config.checkoutPosition.y - 43)
        .setAlpha(1)
        .setScale(1)
    });

    this.beltItems.forEach((item, index) => {
      const originalX = this.config.checkoutPosition.x - 116 + index * 42;
      item.setAlpha(1).setScale(1);
      this.scene.tweens.add({
        targets: item,
        x: originalX + 58,
        alpha: 0.18,
        scaleX: 0.72,
        scaleY: 0.72,
        duration: Math.max(220, this.config.scanDurationMs * 0.72),
        delay: index * 55,
        ease: "Cubic.In",
        onComplete: () => item
          .setPosition(originalX, this.config.checkoutPosition.y - 67)
          .setAlpha(1)
          .setScale(1)
      });
    });
  }

  private playCustomerAdvance(served: number, remaining: number): void {
    const customer = this.activeCustomer;
    if (!customer) return;
    const startX = this.config.checkoutPosition.x + 195;
    this.scene.tweens.killTweensOf(customer);
    this.scene.tweens.add({
      targets: customer,
      x: startX + 95,
      alpha: 0,
      duration: Math.max(220, this.config.queueAdvanceDurationMs),
      ease: "Cubic.In",
      onComplete: () => {
        if (remaining <= 0) {
          customer.setVisible(false);
          return;
        }
        const texture = this.customerTextureKeys[served % this.customerTextureKeys.length];
        if (texture) customer.setTexture(texture);
        customer.setPosition(startX - 45, this.config.checkoutPosition.y + 18).setAlpha(0).setVisible(true);
        this.scene.tweens.add({
          targets: customer,
          x: startX,
          alpha: 1,
          duration: Math.max(180, this.config.queueAdvanceDurationMs * 0.75),
          ease: "Cubic.Out"
        });
      }
    });
  }
}
