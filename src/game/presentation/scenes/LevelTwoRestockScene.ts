import Phaser from "phaser";
import type { RestockStarterMarketPresentationContext } from "../context/StarterMarketPresentationContext";
import {
  StarterMarketScene,
  type SceneCampaignSessionContext
} from "./StarterMarketScene";

const OLD_COOLER_SLOTS = Object.freeze([
  Object.freeze({ x: 900, y: 325 }),
  Object.freeze({ x: 900, y: 460 }),
  Object.freeze({ x: 900, y: 595 }),
  Object.freeze({ x: 1195, y: 325 }),
  Object.freeze({ x: 1195, y: 460 }),
  Object.freeze({ x: 1195, y: 595 })
]);

// Coordinates measured against bg-restock-water-l2 after it is fitted to
// the 1600x900 logical canvas. The two columns follow the authored cooler bays.
const LEVEL_TWO_COOLER_SLOTS = Object.freeze([
  Object.freeze({ x: 1090, y: 355 }),
  Object.freeze({ x: 1090, y: 445 }),
  Object.freeze({ x: 1090, y: 535 }),
  Object.freeze({ x: 1365, y: 355 }),
  Object.freeze({ x: 1365, y: 445 }),
  Object.freeze({ x: 1365, y: 535 })
]);

const MOBILE_TOUCH_MOVE_SPEED = 760;

const touchDeviceActive = (): boolean => {
  const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  const compactViewport = Math.min(window.innerWidth, window.innerHeight) <= 820;
  return navigator.maxTouchPoints > 0 || coarsePointer || compactViewport;
};

const levelTwoContext = (
  context: RestockStarterMarketPresentationContext
): RestockStarterMarketPresentationContext => {
  const mobileTouch = touchDeviceActive();
  const campaignLevel = mobileTouch
    ? Object.freeze({
        ...context.campaignLevel,
        level: Object.freeze({
          ...context.campaignLevel.level,
          navigation: Object.freeze({
            ...context.campaignLevel.level.navigation,
            moveSpeed: MOBILE_TOUCH_MOVE_SPEED
          })
        })
      })
    : context.campaignLevel;

  return Object.freeze({
    ...context,
    campaignLevel,
    world: Object.freeze({
      ...context.world,
      // Left staging pad -> centre aisle -> right cooler. The case remains on
      // the authored staging pad while leaving room for the L1 worker stand offset.
      backroomBox: Object.freeze({ x: 300, y: 700 }),
      cartStart: Object.freeze({ x: 520, y: 790 }),
      cartCooler: Object.freeze({ x: 930, y: 790 }),
      workerStart: Object.freeze({ x: 650, y: 790 }),
      workerCooler: Object.freeze({ x: 1030, y: 790 }),
      beverageCooler: Object.freeze({ x: 1225, y: 500 })
    })
  });
};

interface MovableGameObject {
  readonly x: number;
  readonly y: number;
  setPosition(x: number, y: number): unknown;
}

interface VisibleGameObject {
  setVisible(visible: boolean): unknown;
}

interface LevelTwoActorNavigationPort {
  setDestination(point: { readonly x: number; readonly y: number }): void;
}

interface LevelTwoSceneNavigationPort {
  readonly actors?: LevelTwoActorNavigationPort;
}

type LevelTwoTouchTarget = "case" | "cart-start" | "cart-cooler" | "cooler";

type LevelTwoGuide = {
  readonly root: Phaser.GameObjects.Container;
  readonly pulse: Phaser.GameObjects.Arc;
  readonly label: Phaser.GameObjects.Text;
  readonly detail: Phaser.GameObjects.Text;
};

/**
 * L2 keeps the shared restock controller and all L1 actor/cart/product art.
 * Only the authored scene coordinates differ. This prevents Level 2 layout
 * work from changing the proven Level 1 scene.
 */
export class LevelTwoRestockScene extends StarterMarketScene {
  private readonly levelTwoPresentation: RestockStarterMarketPresentationContext;
  private readonly mobileTouchZones: Phaser.GameObjects.Zone[] = [];
  private routeGuide?: LevelTwoGuide;
  private previousGuideStep?: string;

  constructor(
    context: RestockStarterMarketPresentationContext,
    campaignSession?: SceneCampaignSessionContext
  ) {
    const presentation = levelTwoContext(context);
    super(presentation, campaignSession);
    this.levelTwoPresentation = presentation;
  }

  create(): void {
    super.create();
    this.alignInteractiveCoolerToBackground();
    this.installRouteGuide();
    this.installMobileTouchAssist();
    this.syncRouteGuide();
    document.body.dataset.levelTwoLayout = "authored-background-v1";
  }

  update(time: number, delta: number): void {
    super.update(time, delta);
    this.syncRouteGuide();
  }

  private alignInteractiveCoolerToBackground(): void {
    LEVEL_TWO_COOLER_SLOTS.forEach((target, index) => {
      const original = OLD_COOLER_SLOTS[index];
      if (!original) return;
      const dx = target.x - original.x;
      const dy = target.y - original.y;

      this.moveNamedObject(`beverage-cooler-row-${index}`, dx, dy);
      this.moveNamedObject(`beverage-cooler-row-target-${index}`, dx, dy);
      this.moveNamedObject(`beverage-cooler-row-glow-${index}`, dx, dy);
      this.moveNamedObject(`beverage-cooler-row-count-${index}`, dx, dy);
    });

    // The L2 plate already contains the refrigerator shelves and trim.
    // Keep only dynamic bottles / targets above it so no second cooler is drawn.
    this.setNamedVisibility("restock-cooler-shelf-foreground", false);
    this.setNamedVisibility("restock-cooler-shelf-rule", false);
    document.body.dataset.levelTwoCooler = "background-integrated";
  }

  private installRouteGuide(): void {
    const pulse = this.add.circle(0, 22, 66, 0xffd95e, 0.06)
      .setStrokeStyle(4, 0xffd95e, 0.9);
    const arrow = this.add.text(0, -38, "▼", {
      fontFamily: "Arial, sans-serif",
      fontSize: "36px",
      fontStyle: "bold",
      color: "#ffd95e",
      stroke: "#122016",
      strokeThickness: 6
    }).setOrigin(0.5);
    const label = this.add.text(0, -86, "TAP COOLER · PUSH CART", {
      fontFamily: "Arial, sans-serif",
      fontSize: "20px",
      fontStyle: "bold",
      color: "#ffffff",
      stroke: "#102016",
      strokeThickness: 7,
      backgroundColor: "rgba(12, 38, 25, 0.88)",
      padding: { x: 13, y: 8 }
    }).setOrigin(0.5);
    const detail = this.add.text(0, -122, "NEXT: DELIVER THE WATER", {
      fontFamily: "Arial, sans-serif",
      fontSize: "11px",
      fontStyle: "bold",
      color: "#d7ebdb"
    }).setOrigin(0.5);

    const root = this.add.container(
      this.levelTwoPresentation.world.cartCooler.x,
      this.levelTwoPresentation.world.cartCooler.y - 8,
      [pulse, arrow, label, detail]
    )
      .setDepth(216)
      .setVisible(false)
      .setName("level-two-route-guide");

    this.tweens.add({
      targets: pulse,
      scale: 1.18,
      alpha: 0.18,
      duration: 620,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut"
    });
    this.tweens.add({
      targets: arrow,
      y: -30,
      duration: 520,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut"
    });

    this.routeGuide = { root, pulse, label, detail };
    document.body.dataset.levelTwoRouteGuide = "installed";
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      root.destroy(true);
      this.routeGuide = undefined;
    });
  }

  private syncRouteGuide(): void {
    const guide = this.routeGuide;
    if (!guide) return;
    const step = this.controller.snapshot().step;
    const previousStep = this.previousGuideStep;

    if (step === "push" || step === "park") {
      guide.root
        .setPosition(
          this.levelTwoPresentation.world.cartCooler.x,
          this.levelTwoPresentation.world.cartCooler.y - 12
        )
        .setVisible(true);
      guide.label.setText(touchDeviceActive()
        ? "TAP HERE · PUSH CART"
        : "MOVE CART TO COOLER");
      guide.detail.setText("NEXT: DELIVER THE WATER");
      document.body.dataset.levelTwoRouteGuide = "deliver-cart";
    } else if (step === "open") {
      guide.root
        .setPosition(
          this.levelTwoPresentation.world.cartCooler.x,
          this.levelTwoPresentation.world.cartCooler.y - 12
        )
        .setVisible(true);
      guide.label.setText("ARRIVED · OPENING CASE");
      guide.detail.setText("GET READY TO MEMORIZE");
      document.body.dataset.levelTwoRouteGuide = "opening-case";
    } else {
      guide.root.setVisible(false);
      document.body.dataset.levelTwoRouteGuide = step === "restock"
        ? "stocking"
        : "hidden";
    }

    // PARK -> OPEN -> RESTOCK can complete inside one update. Give the player
    // an immediate acknowledgement so the memory overlay never feels like a stall.
    if (step === "restock" && previousStep && previousStep !== "restock") {
      this.playArrivalFeedback();
    }
    this.previousGuideStep = step;
  }

  private playArrivalFeedback(): void {
    const x = this.levelTwoPresentation.world.cartCooler.x;
    const y = this.levelTwoPresentation.world.cartCooler.y - 170;
    const status = this.add.text(x, y, "✓ CART ARRIVED · MEMORIZE NEXT", {
      fontFamily: "Arial, sans-serif",
      fontSize: "18px",
      fontStyle: "bold",
      color: "#efffea",
      backgroundColor: "rgba(16, 67, 36, 0.94)",
      padding: { x: 14, y: 9 },
      stroke: "#102516",
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(230);
    this.tweens.add({
      targets: status,
      y: y - 18,
      alpha: 0,
      duration: 880,
      delay: 280,
      ease: "Sine.Out",
      onComplete: () => status.destroy()
    });
    this.cameras.main.flash(90, 120, 205, 135);
    document.body.dataset.levelTwoArrivalFeedback = "shown";
  }

  private installMobileTouchAssist(): void {
    if (!touchDeviceActive()) {
      document.body.dataset.levelTwoMobileTouch = "desktop-default";
      return;
    }

    const world = this.levelTwoPresentation.world;
    this.addMobileTouchZone(
      "level-two-touch-case",
      world.backroomBox.x,
      world.backroomBox.y,
      280,
      220,
      () => this.navigateFromMobileTouch("case")
    );
    this.addMobileTouchZone(
      "level-two-touch-cart-start",
      world.cartStart.x,
      world.cartStart.y - 10,
      320,
      200,
      () => this.navigateFromMobileTouch("cart-start")
    );
    this.addMobileTouchZone(
      "level-two-touch-cart-cooler",
      world.cartCooler.x,
      world.cartCooler.y - 10,
      300,
      200,
      () => this.navigateFromMobileTouch("cart-cooler")
    );
    this.addMobileTouchZone(
      "level-two-touch-cooler",
      world.beverageCooler.x,
      world.cartCooler.y - 30,
      320,
      220,
      () => this.navigateFromMobileTouch("cooler")
    );

    // The visible PLACE button is intentionally compact. This invisible assist
    // makes the effective mobile target much more forgiving without enlarging
    // the artwork or changing the desktop presentation.
    this.addMobileTouchZone(
      "level-two-touch-place-assist",
      1480,
      690,
      190,
      190,
      () => this.activateExpandedPlaceTouch()
    );

    document.body.dataset.levelTwoMobileTouch = "context-hotspots-v1";
    document.body.dataset.levelTwoMobilePlaceTarget = "expanded-190";
    document.body.dataset.levelTwoMobileMoveSpeed = String(MOBILE_TOUCH_MOVE_SPEED);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.mobileTouchZones.splice(0).forEach((zone) => zone.destroy());
    });
  }

  private addMobileTouchZone(
    name: string,
    x: number,
    y: number,
    width: number,
    height: number,
    onPointerDown: () => void
  ): void {
    const zone = this.add.zone(x, y, width, height)
      .setDepth(218)
      .setScrollFactor(0)
      .setName(name)
      .setInteractive({ useHandCursor: false });
    zone.on("pointerdown", onPointerDown);
    this.mobileTouchZones.push(zone);
  }

  private navigateFromMobileTouch(target: LevelTwoTouchTarget): void {
    const actors = (this as unknown as LevelTwoSceneNavigationPort).actors;
    if (!actors) return;

    const world = this.levelTwoPresentation.world;
    const step = this.controller.snapshot().step;
    let destination: { readonly x: number; readonly y: number } | undefined;

    switch (target) {
      case "case":
        if (step === "collect") destination = world.backroomBox;
        break;
      case "cart-start":
        if (step === "load" || step === "push") destination = world.cartStart;
        break;
      case "cart-cooler":
        if (step === "park" || step === "open") {
          destination = world.cartCooler;
        } else if (step === "restock") {
          destination = {
            x: world.cartCooler.x + 42,
            y: world.cartCooler.y - 6
          };
        }
        break;
      case "cooler":
        if (step === "restock") {
          destination = {
            x: world.beverageCooler.x,
            y: world.cartCooler.y - 8
          };
        }
        break;
    }

    if (!destination) return;
    actors.setDestination(destination);
    this.playMobileTouchFeedback(destination.x, destination.y);
    document.body.dataset.levelTwoMobileLastTarget = target;
  }

  private activateExpandedPlaceTouch(): void {
    const root = this.children.getByName("level-two-context-place-control") as Phaser.GameObjects.Container | null;
    if (!root?.visible) {
      document.body.dataset.levelTwoMobilePlaceTap = "control-hidden";
      return;
    }
    // The PLACE arc lives inside the container, not on the Scene display list.
    // Querying Scene.children cannot find nested container children.
    const button = root.getByName("level-two-place-action") as Phaser.GameObjects.Arc | null;
    if (!button) {
      document.body.dataset.levelTwoMobilePlaceTap = "button-missing";
      return;
    }
    button.emit("pointerdown");
    document.body.dataset.levelTwoMobilePlaceTap = "accepted";
  }

  private playMobileTouchFeedback(x: number, y: number): void {
    const pulse = this.add.circle(x, y - 10, 24, 0xffd95e, 0.12)
      .setStrokeStyle(3, 0xffe89a, 0.7)
      .setDepth(217);
    this.tweens.add({
      targets: pulse,
      scale: 1.75,
      alpha: 0,
      duration: 190,
      ease: "Quad.Out",
      onComplete: () => pulse.destroy()
    });
  }

  private moveNamedObject(name: string, dx: number, dy: number): void {
    const object = this.children.getByName(name) as unknown as Partial<MovableGameObject> | null;
    if (
      !object ||
      typeof object.x !== "number" ||
      typeof object.y !== "number" ||
      typeof object.setPosition !== "function"
    ) return;
    object.setPosition(object.x + dx, object.y + dy);
  }

  private setNamedVisibility(name: string, visible: boolean): void {
    const object = this.children.getByName(name) as unknown as Partial<VisibleGameObject> | null;
    if (!object || typeof object.setVisible !== "function") return;
    object.setVisible(visible);
  }
}
