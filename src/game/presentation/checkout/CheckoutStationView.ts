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

const CUSTOMER_BASE_WIDTH = 116;
const CUSTOMER_BASE_HEIGHT = 208;

export class CheckoutStationView {
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly customers: Phaser.GameObjects.Container[] = [];
  private readonly registerText: Phaser.GameObjects.Text;
  private readonly laneLight: Phaser.GameObjects.Arc;
  private previousServed = 0;
  private initialized = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: CheckoutStationViewConfig
  ) {
    const { checkoutPosition } = config;
    this.createDepartmentSign();

    const shadow = scene.add.ellipse(
      checkoutPosition.x + 10,
      checkoutPosition.y + 72,
      410,
      64,
      0x31483f,
      0.18
    ).setDepth(19);

    const counter = scene.add.graphics().setDepth(25).setName("checkout-counter");
    counter.fillStyle(0x2f8a58, 1);
    counter.fillRoundedRect(checkoutPosition.x - 190, checkoutPosition.y - 65, 370, 132, 24);
    counter.lineStyle(6, 0x195a38, 1);
    counter.strokeRoundedRect(checkoutPosition.x - 190, checkoutPosition.y - 65, 370, 132, 24);
    counter.fillStyle(0xf1d6a4, 1);
    counter.fillRoundedRect(checkoutPosition.x - 176, checkoutPosition.y - 53, 342, 46, 16);
    counter.fillStyle(0x7e6346, 1);
    counter.fillRoundedRect(checkoutPosition.x - 158, checkoutPosition.y - 39, 205, 18, 8);
    counter.fillStyle(0x47776a, 0.7);
    counter.fillRoundedRect(checkoutPosition.x - 166, checkoutPosition.y + 18, 330, 31, 12);

    const register = scene.add.graphics().setDepth(28);
    register.fillStyle(0x173b38, 1);
    register.fillRoundedRect(checkoutPosition.x + 55, checkoutPosition.y - 104, 112, 80, 16);
    register.lineStyle(3, config.accentColor, 0.72);
    register.strokeRoundedRect(checkoutPosition.x + 55, checkoutPosition.y - 104, 112, 80, 16);
    register.fillStyle(0x0c2421, 1);
    register.fillRoundedRect(checkoutPosition.x + 68, checkoutPosition.y - 91, 86, 43, 10);
    register.fillStyle(0x264f49, 1);
    register.fillRoundedRect(checkoutPosition.x + 88, checkoutPosition.y - 24, 48, 17, 7);

    this.registerText = scene.add.text(
      checkoutPosition.x + 111,
      checkoutPosition.y - 70,
      "CLOSED",
      {
        fontFamily: "Arial",
        fontSize: "15px",
        color: "#ffd95e",
        fontStyle: "bold",
        align: "center"
      }
    ).setOrigin(0.5).setDepth(29);

    this.laneLight = scene.add.circle(
      checkoutPosition.x - 145,
      checkoutPosition.y - 96,
      12,
      0xc95b4f,
      1
    ).setStrokeStyle(3, 0xffffff, 0.45).setDepth(29);

    const scanner = scene.add.graphics().setDepth(29);
    scanner.fillStyle(0x233c39, 1);
    scanner.fillRoundedRect(checkoutPosition.x - 12, checkoutPosition.y - 50, 54, 31, 10);
    scanner.fillStyle(0x8ce5d4, 0.65);
    scanner.fillRoundedRect(checkoutPosition.x - 5, checkoutPosition.y - 44, 40, 5, 3);

    this.objects.push(shadow, counter, register, this.registerText, this.laneLight, scanner);

    for (let index = 0; index < config.customerCount; index += 1) {
      const position = this.queuePosition(index);
      const customer = this.createCustomer(index)
        .setPosition(position.x, position.y)
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

    const servedIndex = snapshot.customersServed - 1;
    const servedCustomer = this.customers[servedIndex];
    if (servedCustomer) {
      this.scene.tweens.add({
        targets: servedCustomer,
        x: this.config.checkoutPosition.x + 30,
        y: this.config.checkoutPosition.y - 100,
        alpha: 0,
        scaleX: 0.6,
        scaleY: 0.6,
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
    const { scene } = this;
    const x = 1285;
    const y = 190;
    const sign = scene.add.graphics().setDepth(4);
    sign.fillStyle(0x2f8a58, 1);
    sign.fillRoundedRect(x - 210, y - 29, 420, 58, 18);
    sign.lineStyle(2, 0xbce0c8, 0.42);
    sign.strokeRoundedRect(x - 210, y - 29, 420, 58, 18);
    const title = scene.add.text(x, y - 8, "CHECKOUT", {
      fontFamily: "Arial",
      fontSize: "23px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(5);
    const subtitle = scene.add.text(x, y + 14, "EXPRESS LANE", {
      fontFamily: "Arial",
      fontSize: "12px",
      color: "#d8f1df",
      letterSpacing: 2
    }).setOrigin(0.5).setDepth(5);
    this.objects.push(sign, title, subtitle);
  }

  private createCustomer(index: number): Phaser.GameObjects.Container {
    const palettes = [
      { shirt: 0x4a8dc7, pants: 0x405873, hair: 0x4b3427, basket: 0xe45a47 },
      { shirt: 0xe5a13f, pants: 0x5d4d3d, hair: 0x38271e, basket: 0x56a85d },
      { shirt: 0xb96ab1, pants: 0x50465f, hair: 0x6b432d, basket: 0x4d9f62 },
      { shirt: 0x54aa83, pants: 0x354f48, hair: 0x28231f, basket: 0xe46c42 }
    ] as const;
    const palette = palettes[index % palettes.length] ?? palettes[0];
    const { scene } = this;

    const shadow = scene.add.ellipse(0, 92, 90, 24, 0x263d35, 0.18);
    const leftLeg = scene.add.rectangle(-16, 54, 21, 70, palette.pants, 1);
    const rightLeg = scene.add.rectangle(16, 54, 21, 70, palette.pants, 1);
    const leftShoe = scene.add.ellipse(-18, 94, 34, 16, 0xefe9dc, 1).setStrokeStyle(2, 0x8f8b83, 0.5);
    const rightShoe = scene.add.ellipse(18, 94, 34, 16, 0xefe9dc, 1).setStrokeStyle(2, 0x8f8b83, 0.5);
    const torso = scene.add.rectangle(0, 6, 68, 92, palette.shirt, 1).setStrokeStyle(3, 0xffffff, 0.18);
    const leftArm = scene.add.rectangle(-43, 8, 19, 72, palette.shirt, 1).setAngle(7);
    const rightArm = scene.add.rectangle(43, 8, 19, 72, palette.shirt, 1).setAngle(-7);
    const leftHand = scene.add.circle(-47, 45, 11, 0xeeb183, 1);
    const rightHand = scene.add.circle(47, 45, 11, 0xeeb183, 1);
    const neck = scene.add.rectangle(0, -46, 20, 20, 0xeeb183, 1);
    const head = scene.add.circle(0, -76, 34, 0xf0b789, 1).setStrokeStyle(3, 0xba7652, 0.45);
    const hairBack = scene.add.ellipse(0, -83, 66, 58, palette.hair, 1);
    const face = scene.add.circle(0, -74, 31, 0xf0b789, 1);
    const leftEye = scene.add.circle(-11, -77, 3, 0x2e302d, 1);
    const rightEye = scene.add.circle(11, -77, 3, 0x2e302d, 1);
    const smile = scene.add.arc(0, -66, 10, 15, 165, false, 0x8d4d39, 1);
    const hairTop = scene.add.arc(0, -91, 31, 180, 360, false, palette.hair, 1);

    const basket = scene.add.graphics();
    basket.fillStyle(palette.basket, 1);
    basket.fillRoundedRect(-35, 32, 70, 48, 10);
    basket.lineStyle(4, 0x314a3d, 0.7);
    basket.strokeRoundedRect(-35, 32, 70, 48, 10);
    basket.lineStyle(5, 0x314a3d, 0.85);
    basket.beginPath();
    basket.arc(
      0,
      31,
      28,
      Phaser.Math.DegToRad(200),
      Phaser.Math.DegToRad(340),
      false
    );
    basket.strokePath();
    basket.lineStyle(2, 0xffffff, 0.18);
    [-20, 0, 20].forEach((x) => basket.lineBetween(x, 38, x, 72));

    return scene.add.container(0, 0, [
      shadow,
      leftLeg,
      rightLeg,
      leftShoe,
      rightShoe,
      torso,
      leftArm,
      rightArm,
      neck,
      hairBack,
      head,
      face,
      leftEye,
      rightEye,
      smile,
      hairTop,
      leftHand,
      rightHand,
      basket
    ]).setSize(CUSTOMER_BASE_WIDTH, CUSTOMER_BASE_HEIGHT);
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
    const row = Math.floor(index / 2);
    const column = index % 2;
    return Math.max(0.64, 0.84 - row * 0.065 - column * 0.025);
  }

  private queuePosition(index: number): PresentationPoint {
    const column = index % 2;
    const row = Math.floor(index / 2);
    return {
      x: this.config.queueStart.x + 180 + column * 120 + row * 28,
      y: this.config.queueStart.y - row * 108 - column * 26
    };
  }

  private queueDepth(y: number): number {
    return 31 + y / 1000;
  }
}
