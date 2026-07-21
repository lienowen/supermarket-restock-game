import Phaser from "phaser";
import type { CheckoutSceneSnapshot } from "../../application/CheckoutSceneController";
import type { PresentationPoint } from "../context/StarterMarketPresentationContext";
import type { CheckoutLevelVisualPreset } from "../visual/MarketLevelVisualPreset";

export interface CheckoutStationViewConfig {
  readonly checkoutPosition: PresentationPoint;
  readonly queueStart: PresentationPoint;
  readonly customerAssetKeys: readonly string[];
  readonly customerCount: number;
  readonly scanDurationMs: number;
  readonly queueAdvanceDurationMs: number;
  readonly panelColor: number;
  readonly accentColor: number;
  readonly visual: CheckoutLevelVisualPreset;
}

export class CheckoutStationView {
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly customers: Phaser.GameObjects.Image[] = [];
  private readonly registerText: Phaser.GameObjects.Text;
  private readonly laneLight: Phaser.GameObjects.Arc;
  private readonly scanBeam: Phaser.GameObjects.Rectangle;
  private previousServed = 0;
  private initialized = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: CheckoutStationViewConfig
  ) {
    const { checkoutPosition, visual } = config;
    this.createDepartmentSign();

    const shadow = scene.add.ellipse(
      checkoutPosition.x + 10,
      checkoutPosition.y + 28,
      visual.station.shadowSize.width,
      visual.station.shadowSize.height,
      0x1b2c26,
      0.22
    ).setDepth(19);

    const counter = scene.add.image(
      checkoutPosition.x,
      checkoutPosition.y + visual.station.counterOffsetY,
      "fixture-checkout-a"
    )
      .setOrigin(0.5, 0.96)
      .setDisplaySize(visual.station.counterSize.width, visual.station.counterSize.height)
      .setDepth(25)
      .setName("checkout-counter-production");

    this.scanBeam = scene.add.rectangle(
      checkoutPosition.x + visual.station.scanBeamOffset.x,
      checkoutPosition.y + visual.station.scanBeamOffset.y,
      visual.station.scanBeamSize.width,
      visual.station.scanBeamSize.height,
      0xff3c31,
      0
    ).setDepth(31);

    this.registerText = scene.add.text(
      checkoutPosition.x + visual.station.registerOffset.x,
      checkoutPosition.y + visual.station.registerOffset.y,
      "CLOSED",
      {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#ffd95e",
        fontStyle: "bold",
        align: "center",
        backgroundColor: "#10211d",
        padding: { x: 12, y: 7 }
      }
    ).setOrigin(0.5).setDepth(31);

    this.laneLight = scene.add.circle(
      checkoutPosition.x + visual.station.laneLightOffset.x,
      checkoutPosition.y + visual.station.laneLightOffset.y,
      13,
      0xc95b4f,
      1
    ).setStrokeStyle(3, 0xffffff, 0.45).setDepth(31);

    this.objects.push(
      shadow,
      counter,
      this.scanBeam,
      this.registerText,
      this.laneLight
    );

    for (let index = 0; index < config.customerCount; index += 1) {
      const position = this.queuePosition(index);
      const assetKey = config.customerAssetKeys[index % config.customerAssetKeys.length];
      if (!assetKey) throw new Error("Checkout station requires customer assets");
      const customer = scene.add.image(position.x, position.y, assetKey)
        .setOrigin(0.5, 0.96)
        .setDisplaySize(visual.queue.customerSize.width, visual.queue.customerSize.height)
        .setDepth(this.queueDepth(position.y))
        .setName(`checkout-customer-${index + 1}`);
      this.customers.push(customer);
      this.objects.push(customer);
    }
  }

  sync(snapshot: CheckoutSceneSnapshot): void {
    const isOpen = snapshot.step !== "open";
    this.registerText.setText(
      isOpen
        ? `${snapshot.customersServed}/${snapshot.totalCustomers}`
        : "CLOSED"
    );
    this.registerText.setColor(isOpen ? "#9ff0b5" : "#ffd95e");
    this.laneLight.setFillStyle(isOpen ? 0x52be75 : 0xc95b4f, 1);

    if (!this.initialized) {
      this.initialized = true;
      this.previousServed = snapshot.customersServed;
      this.layoutQueue(snapshot.customersServed, false);
      return;
    }

    if (snapshot.customersServed <= this.previousServed) return;

    this.playScanBeam();
    const servedIndex = snapshot.customersServed - 1;
    const servedCustomer = this.customers[servedIndex];
    if (servedCustomer) {
      this.scene.tweens.add({
        targets: servedCustomer,
        x: this.config.checkoutPosition.x + this.config.visual.station.servedExitOffset.x,
        y: this.config.checkoutPosition.y + this.config.visual.station.servedExitOffset.y,
        alpha: 0,
        scaleX: 0.78,
        scaleY: 0.78,
        duration: this.config.scanDurationMs,
        ease: "Sine.InOut",
        onComplete: () => servedCustomer.setVisible(false)
      });
    }

    this.scene.time.delayedCall(
      Math.max(80, Math.floor(this.config.scanDurationMs * 0.45)),
      () => this.layoutQueue(snapshot.customersServed, true)
    );
    this.previousServed = snapshot.customersServed;
  }

  destroy(): void {
    this.objects.forEach((object) => object.destroy());
    this.objects.length = 0;
    this.customers.length = 0;
  }

  private createDepartmentSign(): void {
    const { scene, config } = this;
    const { centre, size } = config.visual.sign;
    const sign = scene.add.graphics().setDepth(4);
    sign.fillStyle(0x276f42, 1);
    sign.fillRoundedRect(centre.x - size.width / 2, centre.y - size.height / 2, size.width, size.height, 18);
    sign.lineStyle(3, 0x9dd6ac, 0.5);
    sign.strokeRoundedRect(centre.x - size.width / 2, centre.y - size.height / 2, size.width, size.height, 18);
    const title = scene.add.text(centre.x, centre.y - 8, "CHECKOUT", {
      fontFamily: "Arial",
      fontSize: "23px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(5);
    const subtitle = scene.add.text(centre.x, centre.y + 15, "EXPRESS LANE", {
      fontFamily: "Arial",
      fontSize: "12px",
      color: "#d8f1df",
      letterSpacing: 2
    }).setOrigin(0.5).setDepth(5);
    this.objects.push(sign, title, subtitle);
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
  }

  private layoutQueue(servedCount: number, animate: boolean): void {
    this.customers.forEach((customer, index) => {
      if (index < servedCount) return;
      const queueIndex = index - servedCount;
      const position = this.queuePosition(queueIndex);
      const scale = this.queueScale(queueIndex);
      customer.setVisible(true).setAlpha(1).setDepth(this.queueDepth(position.y));

      if (!animate) {
        customer.setPosition(position.x, position.y).setScale(scale);
        return;
      }

      this.scene.tweens.add({
        targets: customer,
        x: position.x,
        y: position.y,
        scaleX: scale,
        scaleY: scale,
        duration: this.config.queueAdvanceDurationMs,
        ease: "Sine.Out"
      });
    });
  }

  private queueScale(index: number): number {
    const { queue } = this.config.visual;
    const row = Math.floor(index / queue.columns);
    const column = index % queue.columns;
    return Math.max(
      queue.minimumScale,
      queue.baseScale - row * queue.rowScaleStep - column * queue.columnScaleStep
    );
  }

  private queuePosition(index: number): PresentationPoint {
    const { queue } = this.config.visual;
    const column = index % queue.columns;
    const row = Math.floor(index / queue.columns);
    return {
      x: this.config.queueStart.x + column * queue.columnGap + row * queue.rowDriftX,
      y: this.config.queueStart.y - row * queue.rowGap + (column % 2) * queue.alternatingYOffset
    };
  }

  private queueDepth(y: number): number {
    return 21 + y / 1000;
  }
}
