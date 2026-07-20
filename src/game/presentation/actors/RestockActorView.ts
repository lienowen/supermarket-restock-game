import Phaser from "phaser";
import type { RestockSceneSnapshot } from "../../application/RestockSceneController";
import type { PresentationPoint } from "../context/StarterMarketPresentationContext";

export interface RestockActorViewConfig {
  readonly workerStart: PresentationPoint;
  readonly workerDestination: PresentationPoint;
  readonly caseStart: PresentationPoint;
  readonly cartStart: PresentationPoint;
  readonly cartDestination: PresentationPoint;
  readonly workerPushAssetKey: string;
  readonly workerCarryAssetKey: string;
  readonly cartAssetKey: string;
  readonly caseAssetKey: string;
  readonly travelDurationMs: number;
  readonly travelLockBufferMs: number;
  readonly pushSize: { readonly width: number; readonly height: number };
  readonly carrySize: { readonly width: number; readonly height: number };
  readonly shadowOffset: PresentationPoint;
}

export interface RestockActorSyncCallbacks {
  readonly onTravelStart: (maxDurationMs: number) => void;
  readonly onTravelComplete: () => void;
}

export class RestockActorView {
  private readonly workerShadow: Phaser.GameObjects.Ellipse;
  private readonly cartShadow: Phaser.GameObjects.Ellipse;
  private readonly cart: Phaser.GameObjects.Image;
  private readonly worker: Phaser.GameObjects.Image;
  private readonly caseBox: Phaser.GameObjects.Image;
  private cartMoved = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: RestockActorViewConfig
  ) {
    this.workerShadow = scene.add.ellipse(
      config.workerStart.x + config.shadowOffset.x,
      config.workerStart.y + config.shadowOffset.y,
      210,
      48,
      0x000000,
      0.3
    ).setDepth(20);
    this.cartShadow = scene.add.ellipse(
      config.cartStart.x,
      config.cartStart.y + 52,
      225,
      45,
      0x000000,
      0.24
    ).setDepth(20).setVisible(false);
    this.cart = scene.add.image(config.cartStart.x, config.cartStart.y, config.cartAssetKey)
      .setDisplaySize(270, 205)
      .setDepth(22)
      .setVisible(false)
      .setName("restock-cart");
    this.worker = scene.add.image(config.workerStart.x, config.workerStart.y, config.workerPushAssetKey)
      .setDisplaySize(config.pushSize.width, config.pushSize.height)
      .setDepth(24)
      .setName("restock-worker");
    this.caseBox = scene.add.image(config.caseStart.x, config.caseStart.y, config.caseAssetKey)
      .setDisplaySize(132, 98)
      .setDepth(23)
      .setName("restock-case");
  }

  sync(snapshot: RestockSceneSnapshot, callbacks: RestockActorSyncCallbacks): void {
    switch (snapshot.step) {
      case "collect":
        this.showCollectState();
        return;
      case "load":
        this.showLoadState();
        return;
      case "push":
        this.showPushState();
        return;
      case "park":
        this.playTravelOnce(callbacks);
        return;
      case "open":
      case "restock":
      case "complete":
        this.showCoolerState(snapshot);
        return;
    }
  }

  private showCollectState(): void {
    const { config } = this;
    this.worker.setTexture(config.workerPushAssetKey)
      .setDisplaySize(config.pushSize.width, config.pushSize.height)
      .setPosition(config.workerStart.x, config.workerStart.y)
      .setVisible(true);
    this.workerShadow.setPosition(
      config.workerStart.x + config.shadowOffset.x,
      config.workerStart.y + config.shadowOffset.y
    ).setScale(1).setVisible(true);
    this.cart.setVisible(false);
    this.cartShadow.setVisible(false);
    this.caseBox.setVisible(true)
      .setPosition(config.caseStart.x, config.caseStart.y)
      .setDisplaySize(132, 98)
      .setAngle(0);
  }

  private showLoadState(): void {
    const { config } = this;
    this.worker.setTexture(config.workerCarryAssetKey)
      .setDisplaySize(config.carrySize.width, config.carrySize.height)
      .setPosition(config.cartStart.x - 35, config.cartStart.y - 95)
      .setVisible(true);
    this.workerShadow.setPosition(config.cartStart.x - 30, config.cartStart.y - 12)
      .setScale(0.85)
      .setVisible(true);
    this.cart.setTexture(config.cartAssetKey)
      .setDisplaySize(270, 205)
      .setPosition(config.cartStart.x + 70, config.cartStart.y + 8)
      .setVisible(true);
    this.cartShadow.setPosition(config.cartStart.x + 70, config.cartStart.y + 60).setVisible(true);
    this.caseBox.setVisible(false);
  }

  private showPushState(): void {
    const { config } = this;
    this.worker.setTexture(config.workerPushAssetKey)
      .setDisplaySize(config.pushSize.width, config.pushSize.height)
      .setPosition(config.workerStart.x, config.workerStart.y)
      .setVisible(true);
    this.workerShadow.setPosition(
      config.workerStart.x + config.shadowOffset.x,
      config.workerStart.y + config.shadowOffset.y
    ).setScale(1).setVisible(true);
    this.cart.setVisible(false);
    this.cartShadow.setVisible(false);
    this.caseBox.setVisible(false);
  }

  private playTravelOnce(callbacks: RestockActorSyncCallbacks): void {
    if (this.cartMoved) return;
    this.cartMoved = true;

    const { config } = this;
    callbacks.onTravelStart(config.travelDurationMs + config.travelLockBufferMs);

    this.worker.setTexture(config.workerPushAssetKey)
      .setDisplaySize(config.pushSize.width, config.pushSize.height);
    this.cart.setVisible(false);
    this.cartShadow.setVisible(false);
    this.caseBox.setVisible(false);

    this.scene.tweens.add({
      targets: this.worker,
      x: config.workerDestination.x,
      y: config.workerDestination.y,
      duration: config.travelDurationMs,
      ease: "Sine.InOut",
      onComplete: callbacks.onTravelComplete
    });
    this.scene.tweens.add({
      targets: this.workerShadow,
      x: config.workerDestination.x + config.shadowOffset.x,
      y: config.workerDestination.y + config.shadowOffset.y,
      duration: config.travelDurationMs,
      ease: "Sine.InOut"
    });
  }

  private showCoolerState(snapshot: RestockSceneSnapshot): void {
    const { config } = this;
    this.worker.setPosition(config.workerDestination.x, config.workerDestination.y)
      .setTexture(config.workerPushAssetKey)
      .setDisplaySize(240, 360)
      .setVisible(true);
    this.workerShadow.setPosition(config.workerDestination.x + 8, config.workerDestination.y + 82)
      .setScale(0.95)
      .setVisible(true);
    this.cart.setVisible(false);
    this.cartShadow.setVisible(false);
    this.caseBox.setVisible(snapshot.step !== "complete")
      .setPosition(config.cartDestination.x + 18, config.cartDestination.y - 84)
      .setDisplaySize(112, 82)
      .setAngle(snapshot.boxOpened ? -8 : 0);
  }
}
