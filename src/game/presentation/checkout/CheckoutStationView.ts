import Phaser from "phaser";
import type { CheckoutSceneSnapshot } from "../../application/CheckoutSceneController";
import type { PresentationPoint } from "../context/StarterMarketPresentationContext";
import type { CheckoutLevelVisualPreset } from "../visual/MarketLevelVisualPreset";

export interface CheckoutStationViewConfig {
  readonly checkoutPosition: PresentationPoint;
  readonly queueStart: PresentationPoint;
  readonly checkoutAssetKey: string;
  readonly basketAssetKey: string;
  readonly customerCount: number;
  readonly scanDurationMs: number;
  readonly queueAdvanceDurationMs: number;
  readonly panelColor: number;
  readonly accentColor: number;
  readonly visual: CheckoutLevelVisualPreset;
}

/**
 * Checkout presentation intentionally avoids rendering the current photographic
 * customer cuts in the 3D-cartoon scene. The gameplay is communicated through
 * a grounded register, one active grocery basket and a compact order queue.
 */
export class CheckoutStationView {
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly queueBaskets: Phaser.GameObjects.Image[] = [];
  private readonly beltItems: Phaser.GameObjects.Arc[] = [];
  private readonly beltBasket: Phaser.GameObjects.Image;
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

    this.serviceHalo = scene.add.ellipse(
      checkoutPosition.x - 34,
      checkoutPosition.y - 6,
      270,
      102,
      config.accentColor,
      0.05
    ).setStrokeStyle(2, config.accentColor, 0.22).setDepth(18);

    const shadow = scene.add.ellipse(
      checkoutPosition.x + 8,
      checkoutPosition.y + 25,
      visual.station.shadowSize.width,
      visual.station.shadowSize.height,
      0x1b2c26,
      0.22
    ).setDepth(19);

    const counter = scene.add.image(
      checkoutPosition.x,
      checkoutPosition.y + visual.station.counterOffsetY,
      config.checkoutAssetKey
    )
      .setOrigin(0.5, 0.96)
      .setDisplaySize(visual.station.counterSize.width, visual.station.counterSize.height)
      .setDepth(25)
      .setName("checkout-counter-production");

    const beltSurface = scene.add.graphics().setDepth(29);
    beltSurface.fillStyle(0x192824, 0.7);
    beltSurface.fillRoundedRect(checkoutPosition.x - 146, checkoutPosition.y - 88, 170, 46, 14);
    beltSurface.lineStyle(2, 0xffffff, 0.1);
    beltSurface.strokeRoundedRect(checkoutPosition.x - 146, checkoutPosition.y - 88, 170, 46, 14);

    this.beltBasket = scene.add.image(
      checkoutPosition.x - 110,
      checkoutPosition.y - 43,
      config.basketAssetKey
    )
      .setOrigin(0.5, 0.96)
      .setDisplaySize(88, 62)
      .setDepth(30)
      .setName("checkout-active-basket");

    [0, 1, 2].forEach((index) => {
      const item = scene.add.circle(
        checkoutPosition.x - 112 + index * 39,
        checkoutPosition.y - 70,
        8 + index,
        index === 0 ? 0xd96055 : index === 1 ? 0x5ca4cc : 0xe0bb58,
        0.92
      ).setStrokeStyle(2, 0xffffff, 0.28).setDepth(31);
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
        fontSize: "15px",
        color: "#ffd95e",
        fontStyle: "bold",
        align: "center",
        backgroundColor: "#10211d",
        padding: { x: 10, y: 6 }
      }
    ).setOrigin(0.5).setDepth(32);

    this.laneLight = scene.add.circle(
      checkoutPosition.x + visual.station.laneLightOffset.x,
      checkoutPosition.y + visual.station.laneLightOffset.y,
      11,
      0xc95b4f,
      1
    ).setStrokeStyle(2, 0xffffff, 0.4).setDepth(32);

    const queueCentre = {
      x: config.queueStart.x + visual.queue.panelOffset.x,
      y: config.queueStart.y + visual.queue.panelOffset.y
    };
    const queuePanel = scene.add.graphics().setDepth(20);
    queuePanel.fillStyle(config.panelColor, 0.94);
    queuePanel.fillRoundedRect(
      queueCentre.x - visual.queue.panelSize.width / 2,
      queueCentre.y - visual.queue.panelSize.height / 2,
      visual.queue.panelSize.width,
      visual.queue.panelSize.height,
      18
    );
    queuePanel.lineStyle(2, config.accentColor, 0.42);
    queuePanel.strokeRoundedRect(
      queueCentre.x - visual.queue.panelSize.width / 2,
      queueCentre.y - visual.queue.panelSize.height / 2,
      visual.queue.panelSize.width,
      visual.queue.panelSize.height,
      18
    );

    this.waitingText = scene.add.text(
      queueCentre.x,
      queueCentre.y - 25,
      `${config.customerCount} ORDERS WAITING`,
      {
        fontFamily: "Arial",
        fontSize: "13px",
        color: "#eaf5ed",
        fontStyle: "bold"
      }
    ).setOrigin(0.5).setDepth(22);

    const visibleWidth = (visual.queue.visibleBasketCount - 1) * visual.queue.basketGap;
    for (let index = 0; index < visual.queue.visibleBasketCount; index += 1) {
      const basket = scene.add.image(
        queueCentre.x - visibleWidth / 2 + index * visual.queue.basketGap,
        queueCentre.y + 29,
        config.basketAssetKey
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
      return;
    }

    if (snapshot.customersServed <= this.previousServed) return;
    this.playScanBeam();
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
      const originalX = this.config.checkoutPosition.x - 112 + index * 39;
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
          .setPosition(originalX, this.config.checkoutPosition.y - 70)
          .setAlpha(1)
          .setScale(1)
      });
    });
  }
}
