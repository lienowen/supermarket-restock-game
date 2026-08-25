import Phaser from "phaser";
import type {
  NavigationBounds,
  NavigationPoint,
  PlayerNavigationSnapshot
} from "../../application/PlayerNavigationController";
import type { RestockSceneSnapshot } from "../../application/RestockSceneController";
import {
  prepareLowerOverlayTexture,
  prepareMaskedTrimmedTexture,
  prepareTrimmedTexture
} from "../assets/TrimmedTextureFactory";
import { WORKER_STOCK_COLA_MASK_RUNS } from "../assets/WorkerStockColaMask";
import type { VisualSize } from "../visual/StarterMarketVisualSpec";
import { PlayerNavigationView } from "./PlayerNavigationView";

export interface RestockActorViewConfig {
  readonly workerStart: NavigationPoint;
  readonly navigationBounds: NavigationBounds;
  readonly moveSpeed: number;
  /** Explicit in new callers; omitted by older scene wiring for compatibility. */
  readonly motionMode?: "fixed" | "route";
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
  readonly finaleStation?: {
    readonly worker: NavigationPoint;
    readonly cart: NavigationPoint;
  };
  readonly onManualNavigation?: () => void;
}

interface RestockTextureKeys {
  readonly workerIdleOriginal: string;
  readonly workerIdleCut: string;
  readonly workerWalk: readonly [string, string];
  readonly workerPush: string;
  readonly workerCarry: string;
  readonly workerOpen: string;
  readonly workerStock: string;
  readonly cartEmpty: string;
  readonly cartFront: string;
  readonly cartLoaded: string;
  readonly caseClosed: string;
  readonly caseOpen: string;
}

const RESTOCK_WORKER_POSITION: NavigationPoint = Object.freeze({ x: 660, y: 790 });
const RESTOCK_WORKER_SIZE: VisualSize = Object.freeze({ width: 190, height: 300 });
const RESTOCK_STOCK_POSE_SIZE: VisualSize = Object.freeze({ width: 174, height: 300 });
const RESTOCK_CART_SIZE: VisualSize = Object.freeze({ width: 330, height: 250 });
const RESTOCK_CASE_SIZE: VisualSize = Object.freeze({ width: 132, height: 98 });
const RESTOCK_HAND_PRODUCT_SIZE: VisualSize = Object.freeze({ width: 21, height: 54 });
const RESTOCK_HAND_PRODUCT_OFFSET: NavigationPoint = Object.freeze({ x: 52, y: -108 });
const RESTOCK_CART_CASE_OFFSET: NavigationPoint = Object.freeze({ x: 3, y: -96 });
const ROUTE_CART_WORKER_OFFSET_X = -180;
const ROUTE_CART_OFFSET_Y = 5;
const ROUTE_HELD_CASE_OFFSET: NavigationPoint = Object.freeze({ x: 26, y: -116 });
const ROUTE_CASE_STAND_OFFSET: NavigationPoint = Object.freeze({ x: -120, y: 0 });
const ROUTE_CART_STAND_OFFSET: NavigationPoint = Object.freeze({ x: 180, y: -5 });
const ROUTE_COOLER_STAND_OFFSET: NavigationPoint = Object.freeze({ x: 180, y: 0 });

export class RestockActorView {
  private readonly textures: RestockTextureKeys;
  private readonly navigation: PlayerNavigationView;
  private readonly cartShadow: Phaser.GameObjects.Ellipse;
  private readonly cart: Phaser.GameObjects.Image;
  private readonly cartFront: Phaser.GameObjects.Image;
  private readonly caseBox: Phaser.GameObjects.Image;
  private readonly handProduct: Phaser.GameObjects.Image;
  private readonly loadDropZone: Phaser.GameObjects.Rectangle;
  private readonly usesColaStockPose: boolean;
  private readonly motionMode: "fixed" | "route";
  private currentSnapshot?: RestockSceneSnapshot;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: RestockActorViewConfig
  ) {
    // The dedicated mature restock preset uses compact visible-art sizing.
    // Keep this fallback until all scene constructors explicitly pass motionMode.
    this.motionMode = config.motionMode ?? (
      config.idleSize.width <= 220 && config.idleSize.height <= 320 ? "route" : "fixed"
    );

    const walkSources = config.workerWalkAssetKeys ?? ["worker-a-walk-01", "worker-a-walk-02"];
    const workerIdleCut = prepareTrimmedTexture(
      scene,
      config.workerIdleAssetKey,
      "cut-restock-worker-idle",
      12
    );
    const cartEmpty = prepareTrimmedTexture(
      scene,
      config.cartAssetKey,
      "cut-restock-cart-empty-clean",
      10,
      true
    );

    this.usesColaStockPose = config.caseAssetKey === "prop-cola-case-closed";
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
      workerStock: prepareMaskedTrimmedTexture(
        scene,
        config.workerStockAssetKey ?? "worker-a-place-middle",
        "cut-restock-worker-stock-cola-v1",
        WORKER_STOCK_COLA_MASK_RUNS,
        12
      ),
      cartEmpty,
      cartFront: prepareLowerOverlayTexture(
        scene,
        cartEmpty,
        "cut-restock-cart-front-overlay-v1",
        0.57
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

    const start = this.motionMode === "route" ? config.workerStart : RESTOCK_WORKER_POSITION;
    this.navigation = new PlayerNavigationView(scene, {
      start,
      bounds: config.navigationBounds,
      speed: config.moveSpeed,
      assetKey: workerIdleCut,
      walkAssetKeys: this.motionMode === "route"
        ? this.textures.workerWalk
        : [workerIdleCut, workerIdleCut],
      displaySize: this.motionMode === "route" ? config.idleSize : RESTOCK_WORKER_SIZE,
      shadowOffset: config.shadowOffset,
      name: "restock-worker",
      baseDepth: 24,
      preserveAspectRatio: config.workerIdleAssetKey === "worker-restock-idle-v2",
      onManualNavigation: config.onManualNavigation
    });
    this.navigation.setEnabled(this.motionMode === "route");

    this.cartShadow = scene.add.ellipse(
      config.cartStart.x,
      config.cartStart.y + 5,
      Math.max(190, config.cartSize.width * 0.37),
      Math.max(38, config.cartSize.height * 0.105),
      0x000000,
      0.2
    ).setDepth(20).setVisible(false);

    this.loadDropZone = scene.add.rectangle(
      config.cartStart.x,
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

    this.cartFront = scene.add.image(config.cartStart.x, config.cartStart.y, this.textures.cartFront)
      .setOrigin(0.5, 0.96)
      .setDisplaySize(config.cartSize.width, config.cartSize.height)
      .setDepth(24)
      .setVisible(false)
      .setName("restock-cart-front-occlusion");

    this.handProduct = scene.add.image(
      start.x + RESTOCK_HAND_PRODUCT_OFFSET.x,
      start.y + RESTOCK_HAND_PRODUCT_OFFSET.y,
      "restock-cola-bottle-hd-v2"
    )
      .setOrigin(0.5, 1)
      .setDisplaySize(RESTOCK_HAND_PRODUCT_SIZE.width, RESTOCK_HAND_PRODUCT_SIZE.height)
      .setDepth(27)
      .setAngle(-3)
      .setVisible(false)
      .setName("restock-worker-hand-product");

    document.body.dataset.restockAssetCutting = "approved-stock-pose-mask";
    document.body.dataset.restockActorComposition = "action-pose-and-layered-cart";
    document.body.dataset.restockActorControl = this.motionMode === "route"
      ? "routed-world-action-chain"
      : "fixed-position-action-swap";
    document.body.dataset.restockLoadVisual = "cart-back-case-cart-front";
  }

  update(deltaMs: number): void {
    if (this.motionMode === "fixed") {
      this.placeWorkerAtRestockStation();
      return;
    }
    this.prepareRoutePoseForMovement();
    this.navigation.update(deltaMs);
    if (this.currentSnapshot) this.syncRouteState(this.currentSnapshot);
  }

  navigationSnapshot(): PlayerNavigationSnapshot {
    return this.navigation.snapshot();
  }

  position(): NavigationPoint {
    return this.motionMode === "route"
      ? this.navigation.position()
      : RESTOCK_WORKER_POSITION;
  }

  isNear(point: NavigationPoint, radius: number): boolean {
    return this.motionMode === "route"
      ? this.navigation.isNear(this.routeStandPoint(point), radius)
      : true;
  }

  setDestination(point: NavigationPoint): void {
    if (this.motionMode === "route") {
      this.navigation.setDestination(this.routeStandPoint(point));
      return;
    }
    this.placeWorkerAtRestockStation();
  }

  sync(snapshot: RestockSceneSnapshot): void {
    this.currentSnapshot = snapshot;
    if (this.motionMode === "route") {
      this.syncRouteState(snapshot);
      return;
    }

    this.setStableWorker();
    switch (snapshot.step) {
      case "collect": this.showCollectState(); return;
      case "load": this.showLoadState(); return;
      case "push":
      case "park": this.showPushState(); return;
      case "open": this.showOpenState(snapshot); return;
      case "restock": this.showStockState(snapshot); return;
      case "complete": this.showCompleteState(); return;
    }
  }

  destroy(): void {
    this.navigation.destroy();
    this.cart.destroy();
    this.cartFront.destroy();
    this.cartShadow.destroy();
    this.caseBox.destroy();
    this.handProduct.destroy();
    this.loadDropZone.destroy();
  }

  private routeStandPoint(point: NavigationPoint): NavigationPoint {
    const offset = this.samePoint(point, this.config.caseStart)
      ? ROUTE_CASE_STAND_OFFSET
      : this.samePoint(point, this.config.cartStart)
        ? ROUTE_CART_STAND_OFFSET
        : this.samePoint(point, this.config.cartDestination)
          ? ROUTE_COOLER_STAND_OFFSET
          : { x: 0, y: 0 };
    return {
      x: point.x + offset.x,
      y: point.y + offset.y
    };
  }

  private samePoint(a: NavigationPoint, b: NavigationPoint): boolean {
    return Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;
  }

  private syncRouteState(snapshot: RestockSceneSnapshot): void {
    const moving = this.navigation.snapshot().moving;
    this.navigation.setVisible(true);

    switch (snapshot.step) {
      case "collect":
        this.setRouteWalkOrIdlePose();
        this.showRouteEmptyCart(false);
        this.loadDropZone.setVisible(false);
        this.caseBox
          .setTexture(this.textures.caseClosed)
          .setVisible(true)
          .setPosition(this.config.caseStart.x, this.config.caseStart.y)
          .setDisplaySize(this.config.caseSize.width, this.config.caseSize.height)
          .setAngle(0)
          .setAlpha(1)
          .setDepth(23);
        this.cartFront.setVisible(false);
        this.handProduct.setVisible(false);
        return;

      case "load":
        this.showRouteEmptyCart(true);
        this.cartFront.setVisible(false);
        this.handProduct.setVisible(false);
        if (moving) {
          this.setRouteWalkOrIdlePose();
          const worker = this.navigation.position();
          this.caseBox
            .setTexture(this.textures.caseClosed)
            .setVisible(true)
            .setPosition(worker.x + ROUTE_HELD_CASE_OFFSET.x, worker.y + ROUTE_HELD_CASE_OFFSET.y)
            .setDisplaySize(this.config.caseSize.width * 0.82, this.config.caseSize.height * 0.82)
            .setAngle(-4)
            .setAlpha(1)
            .setDepth(26);
        } else {
          this.navigation.setTexture(this.textures.workerCarry);
          this.navigation.setDisplaySize(this.config.carrySize.width, this.config.carrySize.height);
          this.caseBox.setVisible(false);
        }
        return;

      case "push":
      case "park":
        this.loadDropZone.setVisible(false);
        this.caseBox.setVisible(false);
        this.cartFront.setVisible(false);
        this.handProduct.setVisible(false);
        this.navigation.setTexture(this.textures.workerPush);
        this.navigation.setDisplaySize(this.config.pushSize.width, this.config.pushSize.height);
        this.showRouteMovingCart();
        return;

      case "open":
        this.loadDropZone.setVisible(false);
        this.navigation.setTexture(this.textures.workerOpen);
        this.navigation.setDisplaySize(this.config.carrySize.width, this.config.carrySize.height);
        this.showRouteFinalCart();
        this.caseBox
          .setTexture(snapshot.boxOpened ? this.textures.caseOpen : this.textures.caseClosed)
          .setVisible(true)
          .setPosition(
            this.config.cartDestination.x + RESTOCK_CART_CASE_OFFSET.x,
            this.config.cartDestination.y + RESTOCK_CART_CASE_OFFSET.y
          )
          .setDisplaySize(this.config.caseSize.width, this.config.caseSize.height)
          .setAngle(snapshot.boxOpened ? -2 : 0)
          .setAlpha(1)
          .setDepth(25);
        this.handProduct.setVisible(false);
        return;

      case "restock":
        if (this.config.finaleStation) {
          this.navigation.setPosition(this.config.finaleStation.worker);
        }
        this.loadDropZone.setVisible(false);
        this.showRouteFinalCart();
        const finalCart = this.finalCartPosition();
        this.caseBox
          .setTexture(this.textures.caseOpen)
          .setVisible(true)
          .setPosition(
            finalCart.x + RESTOCK_CART_CASE_OFFSET.x,
            finalCart.y + RESTOCK_CART_CASE_OFFSET.y
          )
          .setDisplaySize(this.config.caseSize.width, this.config.caseSize.height)
          .setAngle(-2)
          .setAlpha(Math.max(0.78, 1 - snapshot.stockedRows * 0.03))
          .setDepth(25);
        if (this.usesColaStockPose) {
          this.navigation.setTexture(this.textures.workerStock);
          this.navigation.setDisplaySize(RESTOCK_STOCK_POSE_SIZE.width, RESTOCK_STOCK_POSE_SIZE.height);
          this.handProduct.setVisible(false);
        } else {
          this.navigation.setTexture(this.textures.workerIdleCut);
          this.navigation.setDisplaySize(this.config.idleSize.width, this.config.idleSize.height);
          const worker = this.navigation.position();
          this.handProduct
            .setDisplaySize(RESTOCK_HAND_PRODUCT_SIZE.width, RESTOCK_HAND_PRODUCT_SIZE.height)
            .setPosition(
              worker.x + RESTOCK_HAND_PRODUCT_OFFSET.x,
              worker.y + RESTOCK_HAND_PRODUCT_OFFSET.y
            )
            .setAngle(-3)
            .setVisible(true);
        }
        return;

      case "complete":
        this.setRouteWalkOrIdlePose();
        this.loadDropZone.setVisible(false);
        this.showRouteFinalCart();
        this.caseBox.setVisible(false).setAlpha(1);
        this.handProduct.setVisible(false);
        return;
    }
  }

  private prepareRoutePoseForMovement(): void {
    if (!this.currentSnapshot || !this.navigation.snapshot().moving) return;
    if (this.currentSnapshot.step === "collect" || this.currentSnapshot.step === "load") {
      this.navigation.setTexture(this.textures.workerIdleCut);
      this.navigation.setDisplaySize(this.config.idleSize.width, this.config.idleSize.height);
    } else if (this.currentSnapshot.step === "push" || this.currentSnapshot.step === "park") {
      this.navigation.setTexture(this.textures.workerPush);
      this.navigation.setDisplaySize(this.config.pushSize.width, this.config.pushSize.height);
    }
  }

  private setRouteWalkOrIdlePose(): void {
    this.navigation.setTexture(this.textures.workerIdleCut);
    this.navigation.setDisplaySize(this.config.idleSize.width, this.config.idleSize.height);
  }

  private showRouteEmptyCart(showDropZone: boolean): void {
    this.cart
      .setTexture(this.textures.cartEmpty)
      .setDisplaySize(this.config.cartSize.width, this.config.cartSize.height)
      .setPosition(this.config.cartStart.x, this.config.cartStart.y)
      .setVisible(true)
      .setDepth(22);
    this.cartShadow
      .setPosition(this.config.cartStart.x, this.config.cartStart.y + 5)
      .setSize(Math.max(190, this.config.cartSize.width * 0.55), Math.max(34, this.config.cartSize.height * 0.12))
      .setVisible(true);
    this.loadDropZone
      .setPosition(
        this.config.cartStart.x,
        this.config.cartStart.y - Math.max(58, this.config.cartSize.height * 0.28)
      )
      .setVisible(showDropZone);
  }

  private showRouteMovingCart(): void {
    const worker = this.navigation.position();
    const x = worker.x + ROUTE_CART_WORKER_OFFSET_X;
    const y = worker.y + ROUTE_CART_OFFSET_Y;
    this.cart
      .setTexture(this.textures.cartLoaded)
      .setDisplaySize(this.config.cartSize.width, this.config.cartSize.height)
      .setPosition(x, y)
      .setVisible(true)
      .setDepth(22 + y / 1000);
    this.cartShadow
      .setPosition(x, y + 5)
      .setSize(Math.max(190, this.config.cartSize.width * 0.55), Math.max(34, this.config.cartSize.height * 0.12))
      .setVisible(true)
      .setDepth(21.9 + y / 1000);
  }

  private showRouteFinalCart(): void {
    const { x, y } = this.finalCartPosition();
    this.cart
      .setTexture(this.textures.cartEmpty)
      .setDisplaySize(this.config.cartSize.width, this.config.cartSize.height)
      .setPosition(x, y)
      .setVisible(true)
      .setDepth(22 + y / 1000);
    this.cartFront
      .setTexture(this.textures.cartFront)
      .setDisplaySize(this.config.cartSize.width, this.config.cartSize.height)
      .setPosition(x, y)
      .setVisible(true)
      .setDepth(24 + y / 1000);
    this.cartShadow
      .setPosition(x, y + 5)
      .setSize(Math.max(180, this.config.cartSize.width * 0.52), Math.max(34, this.config.cartSize.height * 0.12))
      .setVisible(true)
      .setDepth(21.9 + y / 1000);
  }

  private finalCartPosition(): NavigationPoint {
    if (this.currentSnapshot?.step === "restock" && this.config.finaleStation) {
      return this.config.finaleStation.cart;
    }
    return this.config.cartDestination;
  }

  private showCollectState(): void {
    const { config } = this;
    this.loadDropZone.setVisible(false);
    this.cart.setVisible(false);
    this.cartFront.setVisible(false);
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
    this.cartFront.setVisible(false);
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
    this.cartFront.setVisible(false);
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
      .setPosition(
        this.finalCartX() + RESTOCK_CART_CASE_OFFSET.x,
        this.config.cartDestination.y + RESTOCK_CART_CASE_OFFSET.y
      )
      .setDisplaySize(RESTOCK_CASE_SIZE.width, RESTOCK_CASE_SIZE.height)
      .setAngle(snapshot.boxOpened ? -2 : 0)
      .setAlpha(1);
  }

  private showStockState(snapshot: RestockSceneSnapshot): void {
    this.loadDropZone.setVisible(false);
    this.showFinalCart();
    this.caseBox.setTexture(this.textures.caseOpen)
      .setVisible(true)
      .setPosition(
        this.finalCartX() + RESTOCK_CART_CASE_OFFSET.x,
        this.config.cartDestination.y + RESTOCK_CART_CASE_OFFSET.y
      )
      .setDisplaySize(RESTOCK_CASE_SIZE.width, RESTOCK_CASE_SIZE.height)
      .setAngle(-2)
      .setAlpha(Math.max(0.78, 1 - snapshot.stockedRows * 0.03));

    if (this.usesColaStockPose) {
      this.navigation.setTexture(this.textures.workerStock);
      this.navigation.setDisplaySize(RESTOCK_STOCK_POSE_SIZE.width, RESTOCK_STOCK_POSE_SIZE.height);
      this.handProduct.setVisible(false);
      return;
    }

    this.handProduct
      .setDisplaySize(RESTOCK_HAND_PRODUCT_SIZE.width, RESTOCK_HAND_PRODUCT_SIZE.height)
      .setPosition(
        RESTOCK_WORKER_POSITION.x + RESTOCK_HAND_PRODUCT_OFFSET.x,
        RESTOCK_WORKER_POSITION.y + RESTOCK_HAND_PRODUCT_OFFSET.y
      )
      .setAngle(-3)
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
    this.cartFront.setTexture(this.textures.cartFront)
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
