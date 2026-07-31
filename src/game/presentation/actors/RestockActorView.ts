import Phaser from "phaser";
import type {
  NavigationBounds,
  NavigationPoint,
  PlayerNavigationSnapshot
} from "../../application/PlayerNavigationController";
import type { RestockSceneSnapshot } from "../../application/RestockSceneController";
import { prepareTrimmedTexture } from "../assets/TrimmedTextureFactory";
import type { VisualSize } from "../visual/StarterMarketVisualSpec";
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
  readonly idleSize: VisualSize;
  readonly pushSize: VisualSize;
  readonly carrySize: VisualSize;
  readonly cartSize: VisualSize;
  readonly caseSize: VisualSize;
  readonly shadowOffset: NavigationPoint;
  readonly onManualNavigation?: () => void;
}

interface RestockTextureKeys {
  readonly workerIdleOriginal: string;
  readonly workerIdleCut: string;
  readonly workerWalk: readonly [string, string];
  readonly workerPush: string;
  readonly workerCarry: string;
  readonly workerOpen: string;
  readonly cartEmpty: string;
  readonly cartLoaded: string;
  readonly caseClosed: string;
  readonly caseOpen: string;
}

const RESTOCK_WORKER_POSITION: NavigationPoint = Object.freeze({ x: 660, y: 790 });
const RESTOCK_WORKER_SIZE: VisualSize = Object.freeze({ width: 190, height: 300 });
const RESTOCK_CART_SIZE: VisualSize = Object.freeze({ width: 330, height: 250 });
const RESTOCK_CASE_SIZE: VisualSize = Object.freeze({ width: 145, height: 108 });
const RESTOCK_HAND_PRODUCT_SIZE: VisualSize = Object.freeze({ width: 24, height: 60 });

export class RestockActorView {
  private readonly textures: RestockTextureKeys;
  private readonly navigation: PlayerNavigationView;
  private readonly cartShadow: Phaser.GameObjects.Ellipse;
  private readonly cart: Phaser.GameObjects.Image;
  private readonly caseBox: Phaser.GameObjects.Image;
  private readonly handProduct: Phaser.GameObjects.Image;
  private readonly loadDropZone: Phaser.GameObjects.Rectangle;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: RestockActorViewConfig
  ) {
    const walkSources = config.workerWalkAssetKeys ?? ["worker-a-walk-01", "worker-a-walk-02"];
    const workerIdleCut = prepareTrimmedTexture(
      scene,
      config.workerIdleAssetKey,
      "cut-restock-worker-idle",
      12
    );

    this.textures = Object.freeze({
      workerIdleOriginal: config.workerIdleAssetKey,
      workerIdleCut,
      workerWalk: Object.freeze([
        prepareTrimmedTexture(scene, walkSources[0], "cut-restock-worker-walk-01", 12),
        prepareTrimmedTexture(scene, walkSources[1], "cut-restock-worker-walk-02", 12)
      ]) as readonly [string, string],
      workerPush: prepareTrimmedTexture(scene, config.workerPushAssetKey, "cut-restock-worker-push", 12),
      workerCarry: prepareTrimmedTexture(scene, config.workerCarryAssetKey, "cut-restock-worker-carry", 12),
      workerOpen: prepareTrimmedTexture(
        scene,
        config.workerOpenAssetKey ?? "worker-a-open-case",
        "cut-restock-worker-open",
        12
      ),
      cartEmpty: prepareTrimmedTexture(
        scene,
        config.cartAssetKey,
        "cut-restock-cart-empty-clean",
        10,
        true
      ),
      cartLoaded: prepareTrimmedTexture(
        scene,
        config.cartLoadedAssetKey ?? "equipment-restock-cart-a-loaded",
        "cut-restock-cart-loaded-clean",
        10,
        true
      ),
      caseClosed: prepareTrimmedTexture(scene, config.caseAssetKey, "cut-restock-case-closed", 8),
      caseOpen: prepareTrimmedTexture(
        scene,
        config.caseOpenAssetKey ?? this.openCaseSourceKey(),
        "cut-restock-case-open-without-pallet-v2",
        8,
        false,
        0.42
      )
    });

    this.navigation = new PlayerNavigationView(scene, {
      start: RESTOCK_WORKER_POSITION,
      bounds: config.navigationBounds,
      speed: config.moveSpeed,
      assetKey: workerIdleCut,
      walkAssetKeys: [workerIdleCut, workerIdleCut],
      displaySize: RESTOCK_WORKER_SIZE,
      shadowOffset: config.shadowOffset,
      name: "restock-worker",
      baseDepth: 24
    });
    this.navigation.setEnabled(false);

    this.cartShadow = scene.add.ellipse(
      config.cartStart.x,
      config.cartStart.y + 5,
      Math.max(190, config.cartSize.width * 0.37),
      Math.max(38, config.cartSize.height * 0.105),
      0x000000,
      0.2
    ).setDepth(20).setVisible(false);

    this.loadDropZone = scene.add.rectangle(
      config.cartStart.x + 72,
      config.cartStart.y - Math.max(58, config.cartSize.height * 0.28),
      Math.max(210, config.cartSize.width * 0.76),
      Math.max(105, config.cartSize.height * 0.52),
      0xffd95e,
      0.035
    )
      .setStrokeStyle(4, 0xffd95e, 0.8)
      .setDepth(21)
      .setVisible(false)
      .setName("restock-load-drop-zone");

    this.cart = scene.add.image(config.cartStart.x, config.cartStart.y, this.textures.cartEmpty)
      .setOrigin(0.5, 0.96)
      .setDisplaySize(config.cartSize.width, config.cartSize.height)
      .setDepth(22)
      .setVisible(false)
      .setName("restock-cart");

    this.caseBox = scene.add.image(config.caseStart.x, config.caseStart.y, this.textures.caseClosed)
      .setOrigin(0.5, 0.96)
      .setDisplaySize(config.caseSize.width, config.caseSize.height)
      .setDepth(23)
      .setName("restock-case");

    this.handProduct = scene.add.image(
      RESTOCK_WORKER_POSITION.x + 74,
      RESTOCK_WORKER_POSITION.y - 150,
      "restock-cola-bottle-hd-v2"
    )
      .setOrigin(0.5, 1)
      .setDisplaySize(RESTOCK_HAND_PRODUCT_SIZE.width, RESTOCK_HAND_PRODUCT_SIZE.height)
      .setDepth(27)
      .setAngle(-8)
      .setVisible(false)
      .setName("restock-worker-hand-product");

    document.body.dataset.restockAssetCutting = "opaque-bounds";
    document.body.dataset.restockActorComposition = "fixed-guide-worker-stable-size";
    document.body.dataset.restockActorControl = "fixed-position-no-action-swap";
    document.body.dataset.restockLoadVisual = "empty-cart-and-case";
  }

  update(_deltaMs: number): void {
    this.placeWorkerAtRestockStation();
  }

  navigationSnapshot(): PlayerNavigationSnapshot {
    return this.navigation.snapshot();
  }

  position(): NavigationPoint {
    return RESTOCK_WORKER_POSITION;
  }

  isNear(_point: NavigationPoint, _radius: number): boolean {
    return true;
  }

  setDestination(_point: NavigationPoint): void {
    this.placeWorkerAtRestockStation();
  }

  sync(snapshot: RestockSceneSnapshot): void {
    this.setStableWorker();

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
    this.handProduct.destroy();
    this.loadDropZone.destroy();
  }

  private showCollectState(): void {
    const { config } = this;
    this.loadDropZone.setVisible(false);
    this.cart.setVisible(false);
    this.cartShadow.setVisible(false);
    this.handProduct.setVisible(false);
    this.caseBox.setTexture(this.textures.caseClosed)
      .setVisible(true)
      .setPosition(config.caseStart.x, config.caseStart.y)
      .setDisplaySize(config.caseSize.width, config.caseSize.height)
      .setAngle(0)
      .setAlpha(1);
  }

  private showLoadState(): void {
    const { config } = this;
    const cartX = config.cartStart.x + 72;
    const cartY = config.cartStart.y + 8;
    this.loadDropZone.setPosition(
      cartX,
      cartY - Math.max(58, config.cartSize.height * 0.28)
    ).setVisible(true);
    this.cart.setTexture(this.textures.cartEmpty)
      .setDisplaySize(config.cartSize.width, config.cartSize.height)
      .setPosition(cartX, cartY)
      .setVisible(true);
    this.cartShadow.setPosition(cartX, cartY + 1).setVisible(true);
    this.caseBox.setTexture(this.textures.caseClosed)
      .setVisible(true)
      .setPosition(cartX - Math.max(170, config.cartSize.width * 0.55), cartY + 2)
      .setDisplaySize(config.caseSize.width, config.caseSize.height)
      .setAngle(-2)
      .setAlpha(1);
    this.handProduct.setVisible(false);
  }

  private showPushState(): void {
    const { config } = this;
    this.loadDropZone.setVisible(false);
    this.cart.setTexture(this.textures.cartLoaded)
      .setDisplaySize(config.cartSize.width, config.cartSize.height)
      .setPosition(config.cartDestination.x - 265, config.cartDestination.y + 20)
      .setVisible(true);
    this.cartShadow
      .setPosition(config.cartDestination.x - 265, config.cartDestination.y + 25)
      .setVisible(true);
    this.caseBox.setVisible(false);
    this.handProduct.setVisible(false);
  }

  private showOpenState(snapshot: RestockSceneSnapshot): void {
    this.loadDropZone.setVisible(false);
    this.showFinalCart();
    this.handProduct.setVisible(false);
    this.caseBox.setTexture(snapshot.boxOpened ? this.textures.caseOpen : this.textures.caseClosed)
      .setVisible(true)
      .setPosition(this.finalCartX() + 8, this.config.cartDestination.y - 64)
      .setDisplaySize(RESTOCK_CASE_SIZE.width, RESTOCK_CASE_SIZE.height)
      .setAngle(snapshot.boxOpened ? -2 : 0)
      .setAlpha(1);
  }

  private showStockState(snapshot: RestockSceneSnapshot): void {
    this.loadDropZone.setVisible(false);
    this.showFinalCart();
    this.caseBox.setTexture(this.textures.caseOpen)
      .setVisible(true)
      .setPosition(this.finalCartX() + 8, this.config.cartDestination.y - 64)
      .setDisplaySize(RESTOCK_CASE_SIZE.width, RESTOCK_CASE_SIZE.height)
      .setAngle(-2)
      .setAlpha(Math.max(0.78, 1 - snapshot.stockedRows * 0.03));
    this.handProduct
      .setDisplaySize(RESTOCK_HAND_PRODUCT_SIZE.width, RESTOCK_HAND_PRODUCT_SIZE.height)
      .setPosition(RESTOCK_WORKER_POSITION.x + 74, RESTOCK_WORKER_POSITION.y - 150)
      .setVisible(true);
  }

  private showCompleteState(): void {
    this.loadDropZone.setVisible(false);
    this.showFinalCart();
    this.caseBox.setVisible(false).setAlpha(1);
    this.handProduct.setVisible(false);
  }

  private showFinalCart(): void {
    const x = this.finalCartX();
    const y = this.config.cartDestination.y + 20;
    this.cart.setTexture(this.textures.cartEmpty)
      .setDisplaySize(RESTOCK_CART_SIZE.width, RESTOCK_CART_SIZE.height)
      .setPosition(x, y)
      .setVisible(true);
    this.cartShadow
      .setPosition(x, y + 5)
      .setSize(180, 34)
      .setVisible(true);
  }

  private placeWorkerAtRestockStation(): void {
    const current = this.navigation.position();
    if (Math.hypot(current.x - RESTOCK_WORKER_POSITION.x, current.y - RESTOCK_WORKER_POSITION.y) > 0.5) {
      this.navigation.setPosition(RESTOCK_WORKER_POSITION);
    }
  }

  private setStableWorker(): void {
    this.placeWorkerAtRestockStation();
    this.navigation.setTexture(this.textures.workerIdleCut);
    this.navigation.setDisplaySize(RESTOCK_WORKER_SIZE.width, RESTOCK_WORKER_SIZE.height);
    this.navigation.setVisible(true);
  }

  private finalCartX(): number {
    return this.config.cartDestination.x - 265;
  }

  private openCaseSourceKey(): string {
    return this.config.caseAssetKey === "prop-cola-case-closed"
      ? "prop-cola-case-open"
      : this.config.caseAssetKey;
  }
}
