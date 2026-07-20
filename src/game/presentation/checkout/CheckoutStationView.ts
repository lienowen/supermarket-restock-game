import Phaser from "phaser";
import type { CheckoutSceneSnapshot } from "../../application/CheckoutSceneController";
import type { PresentationPoint } from "../context/StarterMarketPresentationContext";

export interface CheckoutStationViewConfig {
  readonly checkoutPosition: PresentationPoint;
  readonly queueStart: PresentationPoint;
  readonly customerAssetKeys: readonly string[];
  readonly customerCount: number;
  readonly scanDurationMs: number;
  readonly queueAdvanceDurationMs: number;
  readonly panelColor: number;
  readonly accentColor: number;
}

export class CheckoutStationView {
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly customers: Phaser.GameObjects.Image[] = [];
  private readonly registerText: Phaser.GameObjects.Text;
  private previousServed = 0;
  private initialized = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: CheckoutStationViewConfig
  ) {
    const { checkoutPosition } = config;

    this.objects.push(
      scene.add.ellipse(
        checkoutPosition.x,
        checkoutPosition.y + 62,
        390,
        62,
        0x000000,
        0.28
      ).setDepth(19),
      scene.add.polygon(checkoutPosition.x, checkoutPosition.y, [
        -180, -72,
        130, -72,
        185, 58,
        -125, 58
      ], 0x4e463c, 1).setStrokeStyle(5, 0x25231f, 1).setDepth(25),
      scene.add.polygon(checkoutPosition.x - 8, checkoutPosition.y - 48, [
        -148, -42,
        118, -42,
        142, 22,
        -122, 22
      ], 0x81715f, 1).setDepth(26),
      scene.add.rectangle(
        checkoutPosition.x - 70,
        checkoutPosition.y - 93,
        105,
        66,
        config.panelColor,
        1
      ).setStrokeStyle(3, config.accentColor, 0.85).setDepth(28),
      scene.add.rectangle(
        checkoutPosition.x + 80,
        checkoutPosition.y - 52,
        110,
        10,
        0x1a1d1b,
        0.9
      ).setDepth(28)
    );

    this.registerText = scene.add.text(
      checkoutPosition.x - 70,
      checkoutPosition.y - 93,
      "CLOSED",
      {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#ffe07a",
        fontStyle: "bold",
        align: "center"
      }
    ).setOrigin(0.5).setDepth(29);
    this.objects.push(this.registerText);

    for (let index = 0; index < config.customerCount; index += 1) {
      const texture = config.customerAssetKeys[index % config.customerAssetKeys.length];
      const position = this.queuePosition(index);
      const scale = Math.max(0.72, 1 - index * 0.045);
      const customer = scene.add.image(position.x, position.y, texture)
        .setDisplaySize(150 * scale, 225 * scale)
        .setDepth(32 - index)
        .setName(`checkout-customer-${index + 1}`);
      this.customers.push(customer);
      this.objects.push(customer);
    }
  }

  sync(snapshot: CheckoutSceneSnapshot): void {
    this.registerText.setText(
      snapshot.step === "open"
        ? "CLOSED"
        : `${snapshot.customersServed}/${snapshot.totalCustomers}`
    );

    if (!this.initialized) {
      this.initialized = true;
      this.previousServed = snapshot.customersServed;
      this.layoutQueue(snapshot.customersServed, false);
      return;
    }

    if (snapshot.customersServed <= this.previousServed) return;

    const servedIndex = snapshot.customersServed - 1;
    const servedCustomer = this.customers[servedIndex];
    if (servedCustomer) {
      this.scene.tweens.add({
        targets: servedCustomer,
        x: this.config.checkoutPosition.x + 55,
        y: this.config.checkoutPosition.y - 105,
        alpha: 0,
        scaleX: 0.82,
        scaleY: 0.82,
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

  private layoutQueue(servedCount: number, animate: boolean): void {
    this.customers.forEach((customer, index) => {
      if (index < servedCount) return;
      const queueIndex = index - servedCount;
      const position = this.queuePosition(queueIndex);
      const scale = Math.max(0.72, 1 - queueIndex * 0.045);
      customer.setVisible(true).setAlpha(1);

      if (!animate) {
        customer.setPosition(position.x, position.y).setDisplaySize(150 * scale, 225 * scale);
        return;
      }

      this.scene.tweens.add({
        targets: customer,
        x: position.x,
        y: position.y,
        displayWidth: 150 * scale,
        displayHeight: 225 * scale,
        duration: this.config.queueAdvanceDurationMs,
        ease: "Sine.Out"
      });
    });
  }

  private queuePosition(index: number): PresentationPoint {
    return {
      x: this.config.queueStart.x + index * 132,
      y: this.config.queueStart.y - index * 13
    };
  }
}
