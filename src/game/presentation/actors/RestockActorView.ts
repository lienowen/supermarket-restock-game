import Phaser from "phaser";
import type { NavigationBounds, NavigationPoint } from "../../application/PlayerNavigationController";
import type { RestockSceneSnapshot } from "../../application/RestockSceneController";
import { PlayerNavigationView } from "./PlayerNavigationView";

export interface RestockActorViewConfig {
  readonly workerStart: NavigationPoint;
  readonly navigationBounds: NavigationBounds;
  readonly moveSpeed: number;
  readonly caseStart: NavigationPoint;
  readonly cartStart: NavigationPoint;
  readonly cartDestination: NavigationPoint;
  readonly workerIdleAssetKey: string;
  readonly workerPushAssetKey: string;
  readonly workerCarryAssetKey: string;
  readonly cartAssetKey: string;
  readonly caseAssetKey: string;
  readonly idleSize: { readonly width: number; readonly height: number };
  readonly pushSize: { readonly width: number; readonly height: number };
  readonly carrySize: { readonly width: number; readonly height: number };
  readonly shadowOffset: NavigationPoint;
}

export class RestockActorView {
  private readonly navigation: PlayerNavigationView;
  private readonly cartShadow: Phaser.GameObjects.Ellipse;
  private readonly cart: Phaser.GameObjects.Image;
  private readonly caseBox: Phaser.GameObjects.Image;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: RestockActorViewConfig
  ) {
    this.navigation = new PlayerNavigationView(scene, {
      start: config.workerStart,
      bounds: config.navigationBounds,
      speed: config.moveSpeed,
      assetKey: config.workerIdleAssetKey,
      displaySize: config.idleSize,
      shadowOffset: config.shadowOffset,
      name: "restock-worker",
      baseDepth: 24
    });
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
    this.caseBox = scene.add.image(config.caseStart.x, config.caseStart.y, config.caseAssetKey)
      .setDisplaySize(132, 98)
      .setDepth(23)
      .setName("restock-case");
  }

  update(deltaMs: number): void {
    this.navigation.update(deltaMs);
  }

  position(): NavigationPoint {
    return this.navigation.position();
  }

  isNear(point: NavigationPoint, radius: number): boolean {
    return this.navigation.isNear(point, radius);
  }

  setDestination(point: NavigationPoint): void {
    this.navigation.setDestination(point);
  }

  sync(snapshot: RestockSceneSnapshot): void {
    switch (snapshot.step) {
      case "collect":
        this.showCollectState();
        return;
      case "load":
        this.showLoadState();
        return;
      case "push":
      case "park":
        this.showPushState();
        return;
      case "open":
      case "restock":
      case "complete":
        this.showCoolerState(snapshot);
        return;
    }
  }

  destroy(): void {
    this.navigation.destroy();
    this.cart.destroy();
    this.cartShadow.destroy();
    this.caseBox.destroy();
  }

  private showCollectState(): void {
    const { config } = this;
    this.navigation.setTexture(config.workerIdleAssetKey);
    this.navigation.setDisplaySize(config.idleSize.width, config.idleSize.height);
    this.navigation.setVisible(true);
    this.cart.setVisible(false);
    this.cartShadow.setVisible(false);
    this.caseBox.setVisible(true)
      .setPosition(config.caseStart.x, config.caseStart.y)
      .setDisplaySize(132, 98)
      .setAngle(0);
  }

  private showLoadState(): void {
    const { config } = this;
    this.navigation.setTexture(config.workerCarryAssetKey);
    this.navigation.setDisplaySize(config.carrySize.width, config.carrySize.height);
    this.navigation.setVisible(true);
    this.cart.setTexture(config.cartAssetKey)
      .setDisplaySize(270, 205)
      .setPosition(config.cartStart.x + 70, config.cartStart.y + 8)
      .setVisible(true);
    this.cartShadow.setPosition(config.cartStart.x + 70, config.cartStart.y + 60).setVisible(true);
    this.caseBox.setVisible(false);
  }

  private showPushState(): void {
    const { config } = this;
    this.navigation.setTexture(config.workerPushAssetKey);
    this.navigation.setDisplaySize(config.pushSize.width, config.pushSize.height);
    this.navigation.setVisible(true);
    this.cart.setVisible(false);
    this.cartShadow.setVisible(false);
    this.caseBox.setVisible(false);
  }

  private showCoolerState(snapshot: RestockSceneSnapshot): void {
    const { config } = this;
    this.navigation.setTexture(config.workerIdleAssetKey);
    this.navigation.setDisplaySize(config.idleSize.width, config.idleSize.height);
    this.navigation.setVisible(true);
    this.cart.setVisible(false);
    this.cartShadow.setVisible(false);
    this.caseBox.setVisible(snapshot.step !== "complete")
      .setPosition(config.cartDestination.x + 18, config.cartDestination.y - 84)
      .setDisplaySize(112, 82)
      .setAngle(snapshot.boxOpened ? -8 : 0);
  }
}
