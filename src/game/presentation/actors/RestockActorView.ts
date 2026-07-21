import Phaser from "phaser";
import type {
  NavigationBounds,
  NavigationPoint,
  PlayerNavigationSnapshot
} from "../../application/PlayerNavigationController";
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
  readonly workerWalkAssetKeys?: readonly [string, string];
  readonly workerPushAssetKey: string;
  readonly workerCarryAssetKey: string;
  readonly workerOpenAssetKey?: string;
  readonly workerStockAssetKey?: string;
  readonly cartAssetKey: string;
  readonly cartLoadedAssetKey?: string;
  readonly caseAssetKey: string;
  readonly caseOpenAssetKey?: string;
  readonly idleSize: { readonly width: number; readonly height: number };
  readonly pushSize: { readonly width: number; readonly height: number };
  readonly carrySize: { readonly width: number; readonly height: number };
  readonly shadowOffset: NavigationPoint;
}

const CART_SIZE = { width: 560, height: 400 } as const;
const CASE_SIZE = { width: 400, height: 340 } as const;
const OPEN_CASE_SIZE = { width: 380, height: 330 } as const;

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
      walkAssetKeys: config.workerWalkAssetKeys ?? ["worker-a-walk-01", "worker-a-walk-02"],
      displaySize: config.idleSize,
      shadowOffset: config.shadowOffset,
      name: "restock-worker",
      baseDepth: 24
    });
    this.cartShadow = scene.add.ellipse(
      config.cartStart.x,
      config.cartStart.y + 5,
      205,
      42,
      0x000000,
      0.2
    ).setDepth(20).setVisible(false);
    this.cart = scene.add.image(config.cartStart.x, config.cartStart.y, config.cartAssetKey)
      .setOrigin(0.5, 0.96)
      .setDisplaySize(CART_SIZE.width, CART_SIZE.height)
      .setDepth(22)
      .setVisible(false)
      .setName("restock-cart");
    this.caseBox = scene.add.image(config.caseStart.x, config.caseStart.y, config.caseAssetKey)
      .setOrigin(0.5, 0.96)
      .setDisplaySize(CASE_SIZE.width, CASE_SIZE.height)
      .setDepth(23)
      .setName("restock-case");
  }

  update(deltaMs: number): void {
    this.navigation.update(deltaMs);
  }

  navigationSnapshot(): PlayerNavigationSnapshot {
    return this.navigation.snapshot();
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
        this.showOpenState(snapshot);
        return;
      case "restock":
        this.showStockState(snapshot);
        return;
      case "complete":
        this.showCompleteState();
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
    this.setWorker(config.workerIdleAssetKey, config.idleSize);
    this.cart.setVisible(false);
    this.cartShadow.setVisible(false);
    this.caseBox.setTexture(config.caseAssetKey)
      .setVisible(true)
      .setPosition(config.caseStart.x, config.caseStart.y)
      .setDisplaySize(CASE_SIZE.width, CASE_SIZE.height)
      .setAngle(0)
      .setAlpha(1);
  }

  private showLoadState(): void {
    const { config } = this;
    this.setWorker(config.workerCarryAssetKey, config.carrySize);
    this.cart.setTexture(config.cartLoadedAssetKey ?? "equipment-restock-cart-a-loaded")
      .setDisplaySize(CART_SIZE.width, CART_SIZE.height)
      .setPosition(config.cartStart.x + 72, config.cartStart.y + 8)
      .setVisible(true);
    this.cartShadow.setPosition(config.cartStart.x + 72, config.cartStart.y + 7).setVisible(true);
    this.caseBox.setVisible(false);
  }

  private showPushState(): void {
    const { config } = this;
    this.setWorker(config.workerPushAssetKey, config.pushSize);
    this.cart.setVisible(false);
    this.cartShadow.setVisible(false);
    this.caseBox.setVisible(false);
  }

  private showOpenState(snapshot: RestockSceneSnapshot): void {
    const { config } = this;
    this.setWorker(config.workerOpenAssetKey ?? "worker-a-open-case", config.idleSize);
    this.cart.setVisible(false);
    this.cartShadow.setVisible(false);
    this.caseBox.setTexture(
      snapshot.boxOpened
        ? config.caseOpenAssetKey ?? this.openCaseKey()
        : config.caseAssetKey
    )
      .setVisible(true)
      .setPosition(config.cartDestination.x + 24, config.cartDestination.y - 5)
      .setDisplaySize(OPEN_CASE_SIZE.width, OPEN_CASE_SIZE.height)
      .setAngle(snapshot.boxOpened ? -4 : 0);
  }

  private showStockState(snapshot: RestockSceneSnapshot): void {
    const { config } = this;
    this.setWorker(config.workerStockAssetKey ?? "worker-a-place-middle", config.idleSize);
    this.cart.setVisible(false);
    this.cartShadow.setVisible(false);
    this.caseBox.setTexture(config.caseOpenAssetKey ?? this.openCaseKey())
      .setVisible(true)
      .setPosition(config.cartDestination.x + 28, config.cartDestination.y - 5)
      .setDisplaySize(OPEN_CASE_SIZE.width, OPEN_CASE_SIZE.height)
      .setAngle(-4)
      .setAlpha(Math.max(0.55, 1 - snapshot.stockedRows * 0.07));
  }

  private showCompleteState(): void {
    const { config } = this;
    this.setWorker(config.workerIdleAssetKey, config.idleSize);
    this.cart.setVisible(false);
    this.cartShadow.setVisible(false);
    this.caseBox.setVisible(false).setAlpha(1);
  }

  private openCaseKey(): string {
    return this.config.caseAssetKey === "prop-cola-case-closed"
      ? "prop-cola-case-open"
      : this.config.caseAssetKey;
  }

  private setWorker(
    assetKey: string,
    size: { readonly width: number; readonly height: number }
  ): void {
    this.navigation.setTexture(assetKey);
    this.navigation.setDisplaySize(size.width, size.height);
    this.navigation.setVisible(true);
  }
}
