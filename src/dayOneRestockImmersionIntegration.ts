import Phaser from "phaser";
import { GAME_RULES, PRODUCTS, type ProductId } from "./gameConfig";
import { GameScene } from "./scenes/GameScene";
import { gameSession } from "./systems/GameSession";

type GamePrototype = {
  create: (...args: unknown[]) => void;
};

type RuntimeShelfSlot = {
  index: number;
  productId: ProductId;
  hitArea: Phaser.GameObjects.Rectangle;
  missingTag: Phaser.GameObjects.Image;
  product?: Phaser.GameObjects.Image;
  reservedForCustomer: boolean;
};

type GuideStep = "LOAD" | "MOVE" | "RESTOCK" | "OPEN" | "SERVE" | "COMPLETE";

type RuntimeGame = Phaser.Scene & {
  shelfSlots?: RuntimeShelfSlot[];
  loadedProducts?: ProductId[];
  cartAtShelf?: boolean;
  cart?: Phaser.GameObjects.Container;
  worker?: Phaser.GameObjects.Image;
  stocked?: number;
  phase?: string;
  shiftEnded?: boolean;
  __dayOneRestockImmersion?: DayOneRestockImmersion;
};

type DayOneRestockImmersion = {
  worldLayer: Phaser.GameObjects.Container;
  routeLayer: Phaser.GameObjects.Container;
  targetLayer: Phaser.GameObjects.Container;
  guideLayer: Phaser.GameObjects.Container;
  feedbackLayer: Phaser.GameObjects.Container;
  guideText: Phaser.GameObjects.Text;
  guideBadge: Phaser.GameObjects.Text;
  routeGraphics: Phaser.GameObjects.Graphics;
  targetFrame: Phaser.GameObjects.Graphics;
  targetGlow: Phaser.GameObjects.Rectangle;
  targetArrow: Phaser.GameObjects.Text;
  targetLabelBg: Phaser.GameObjects.Rectangle;
  targetLabel: Phaser.GameObjects.Text;
  pulseTween: Phaser.Tweens.Tween;
  monitor: () => void;
  lastGuideStep?: GuideStep;
  lastTargetIndex?: number;
  lastMonitorAt: number;
  filledSlots: Set<number>;
  destroyed: boolean;
  destroy: () => void;
};

type ZoneDefinition = {
  label: string;
  subtitle: string;
  x: number;
  accent: number;
  productColors: number[];
};

const DAY_ONE_ZONES: ZoneDefinition[] = [
  {
    label: "FRUIT MARKET",
    subtitle: "APPLES · CITRUS · BANANAS",
    x: 400,
    accent: 0xf1a64a,
    productColors: [0xe85d4a, 0xf2c14e, 0x7fbf4d]
  },
  {
    label: "FRESH VEGETABLES",
    subtitle: "LEAFY GREENS · ROOTS",
    x: 620,
    accent: 0x79bd62,
    productColors: [0x5fa64b, 0x8ecf68, 0xd48a43]
  },
  {
    label: "RICE & NOODLES",
    subtitle: "GRAINS · FLOUR · PANTRY",
    x: 840,
    accent: 0xd8b978,
    productColors: [0xe6d5a9, 0xc99e55, 0xf0e5c2]
  },
  {
    label: "DRINKS & DAIRY",
    subtitle: "WATER · COLA · MILK",
    x: 1060,
    accent: 0x72b8df,
    productColors: [0x4aa7d8, 0xd6534d, 0xf3f0d7]
  }
];

installDayOneRestockImmersion();

function installDayOneRestockImmersion(): void {
  const prototype = GameScene.prototype as unknown as GamePrototype;
  const originalCreate = prototype.create;

  prototype.create = function createWithDayOneRestockImmersion(...args: unknown[]): void {
    originalCreate.apply(this, args);
    const scene = this as unknown as RuntimeGame;
    scene.time.delayedCall(120, () => installDayOneExperience(scene));
  };
}

function installDayOneExperience(scene: RuntimeGame): void {
  scene.__dayOneRestockImmersion?.destroy();
  if (gameSession.day !== "day01" || !scene.scene.isActive()) return;

  hideLegacySingleShelf(scene);
  renameDayOneHud(scene);

  const worldLayer = scene.add.container(0, 0).setDepth(1.75).setName("day1-zone-world");
  DAY_ONE_ZONES.forEach((zone) => worldLayer.add(createZoneDisplay(scene, zone)));

  const routeGraphics = scene.add.graphics().setName("day1-restock-route");
  const routeLayer = scene.add.container(0, 0, [routeGraphics])
    .setDepth(22)
    .setName("day1-restock-route-layer");
  drawRestockRoute(routeGraphics);

  const targetFrame = scene.add.graphics().setName("day1-target-frame");
  const targetGlow = scene.add.rectangle(0, 0, 132, 154, 0xffdf67, 0.07)
    .setStrokeStyle(3, 0xffdf67, 0.85)
    .setName("day1-target-glow");
  const targetArrow = scene.add.text(0, 0, "▼", {
    fontFamily: "Arial",
    fontSize: "36px",
    color: "#ffe36a",
    fontStyle: "bold",
    stroke: "#2e331d",
    strokeThickness: 6
  }).setOrigin(0.5).setName("day1-target-arrow");
  const targetLabelBg = scene.add.rectangle(0, 0, 190, 38, 0x173238, 0.94)
    .setStrokeStyle(2, 0xffdf67, 0.9)
    .setName("day1-target-label-bg");
  const targetLabel = scene.add.text(0, 0, "EMPTY SHELF", {
    fontFamily: "Arial",
    fontSize: "15px",
    color: "#ffffff",
    fontStyle: "bold",
    letterSpacing: 1
  }).setOrigin(0.5).setName("day1-target-label");
  const targetLayer = scene.add.container(0, 0, [targetFrame, targetGlow, targetArrow, targetLabelBg, targetLabel])
    .setDepth(32)
    .setName("day1-restock-target-layer");

  const guideBg = scene.add.rectangle(665, 1015, 790, 86, 0x081719, 0.88)
    .setStrokeStyle(2, 0x7b9a78, 0.82)
    .setName("day1-guide-bg");
  const guideBadge = scene.add.text(315, 1015, "DAY 1", {
    fontFamily: "Arial",
    fontSize: "17px",
    color: "#f8e89f",
    fontStyle: "bold",
    backgroundColor: "#24443a",
    padding: { x: 12, y: 7 }
  }).setOrigin(0.5).setName("day1-guide-badge");
  const guideText = scene.add.text(690, 1015, "", {
    fontFamily: "Arial",
    fontSize: "21px",
    color: "#f4f8f5",
    fontStyle: "bold",
    align: "center",
    wordWrap: { width: 650 }
  }).setOrigin(0.5).setName("day1-guide-text");
  const guideLayer = scene.add.container(0, 0, [guideBg, guideBadge, guideText])
    .setDepth(55)
    .setName("day1-guide-layer");

  const feedbackLayer = scene.add.container(0, 0)
    .setDepth(59)
    .setName("day1-feedback-layer");

  const intro = createOpeningIntro(scene);
  const pulseTween = scene.tweens.add({
    targets: [targetGlow, targetArrow],
    alpha: { from: 0.42, to: 1 },
    scaleX: { from: 0.96, to: 1.06 },
    scaleY: { from: 0.96, to: 1.06 },
    duration: 720,
    yoyo: true,
    repeat: -1,
    ease: "Sine.InOut"
  });

  const immersion: DayOneRestockImmersion = {
    worldLayer,
    routeLayer,
    targetLayer,
    guideLayer,
    feedbackLayer,
    guideText,
    guideBadge,
    routeGraphics,
    targetFrame,
    targetGlow,
    targetArrow,
    targetLabelBg,
    targetLabel,
    pulseTween,
    monitor: () => undefined,
    lastMonitorAt: -1000,
    filledSlots: new Set(
      (scene.shelfSlots ?? []).filter((slot) => Boolean(slot.product)).map((slot) => slot.index)
    ),
    destroyed: false,
    destroy: () => undefined
  };

  const monitor = (): void => {
    if (immersion.destroyed || !scene.scene.isActive()) return;
    if (scene.time.now - immersion.lastMonitorAt < 90) return;
    immersion.lastMonitorAt = scene.time.now;

    const slots = scene.shelfSlots ?? [];
    const missingSlots = slots.filter((slot) => !slot.product && !slot.reservedForCustomer);
    const target = missingSlots[0];
    syncRestockTarget(immersion, target);
    syncRoute(immersion, scene);
    syncGuide(immersion, scene, target);
    detectNewRestocks(immersion, scene, slots);
  };

  const destroy = (): void => {
    if (immersion.destroyed) return;
    immersion.destroyed = true;
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, monitor);
    pulseTween.stop();
    [worldLayer, routeLayer, targetLayer, guideLayer, feedbackLayer, intro].forEach((layer) => {
      if (layer.active) layer.destroy(true);
    });
    if (scene.__dayOneRestockImmersion === immersion) scene.__dayOneRestockImmersion = undefined;
  };

  immersion.monitor = monitor;
  immersion.destroy = destroy;
  scene.__dayOneRestockImmersion = immersion;
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, monitor);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, destroy);
  monitor();

  document.body.dataset.dayOneRestockImmersion = "ready";
}

function hideLegacySingleShelf(scene: Phaser.Scene): void {
  for (const child of scene.children.list) {
    if (!(child instanceof Phaser.GameObjects.Image)) continue;
    if (child.name?.startsWith("day1-") || child.name?.startsWith("immersion-")) continue;
    if (child.texture.key === "shelf") child.setVisible(false).disableInteractive();
  }
}

function renameDayOneHud(scene: Phaser.Scene): void {
  for (const child of scene.children.list) {
    if (!(child instanceof Phaser.GameObjects.Text)) continue;
    if (child.text === "Morning Shift") child.setText("Day 1 · Grand Opening");
    if (child.text === "Restock Drinks") child.setText("Opening Restock");
  }
}

function createZoneDisplay(scene: Phaser.Scene, zone: ZoneDefinition): Phaser.GameObjects.Container {
  const width = 196;
  const panel = scene.add.rectangle(0, 170, width, 340, zone.accent, 0.085)
    .setStrokeStyle(2, zone.accent, 0.32);
  const header = scene.add.rectangle(0, 12, width - 10, 50, 0x0e2425, 0.84)
    .setStrokeStyle(2, zone.accent, 0.72);
  const label = scene.add.text(0, 3, zone.label, {
    fontFamily: "Arial",
    fontSize: "15px",
    color: "#ffffff",
    fontStyle: "bold",
    align: "center"
  }).setOrigin(0.5);
  const subtitle = scene.add.text(0, 25, zone.subtitle, {
    fontFamily: "Arial",
    fontSize: "9px",
    color: "#d8e7df",
    align: "center"
  }).setOrigin(0.5);

  const objects: Phaser.GameObjects.GameObject[] = [panel, header, label, subtitle];
  [105, 185, 265].forEach((shelfY, shelfIndex) => {
    const shelf = scene.add.rectangle(0, shelfY, width - 24, 8, 0x695341, 0.88)
      .setStrokeStyle(1, 0xc8ad85, 0.5);
    objects.push(shelf);

    for (let productIndex = 0; productIndex < 6; productIndex += 1) {
      const color = zone.productColors[(productIndex + shelfIndex) % zone.productColors.length];
      const productWidth = 17 + ((productIndex + shelfIndex) % 3) * 3;
      const productHeight = 34 + ((productIndex * 7 + shelfIndex * 5) % 24);
      const product = scene.add.rectangle(
        -72 + productIndex * 29,
        shelfY - productHeight / 2 - 5,
        productWidth,
        productHeight,
        color,
        0.9
      ).setStrokeStyle(1, 0xffffff, 0.18);
      objects.push(product);
    }
  });

  const floorLabel = scene.add.text(0, 318, "SHOP THIS SECTION", {
    fontFamily: "Arial",
    fontSize: "9px",
    color: "#d6e4df",
    letterSpacing: 1
  }).setOrigin(0.5);
  objects.push(floorLabel);

  return scene.add.container(zone.x, 260, objects).setName(`day1-zone-${zone.label.toLowerCase().replaceAll(" ", "-")}`);
}

function createOpeningIntro(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const panel = scene.add.rectangle(0, 0, 700, 112, 0x071416, 0.93)
    .setStrokeStyle(3, 0xf0cf67, 0.82);
  const eyebrow = scene.add.text(0, -29, "DAY 1 · YOUR FIRST OPENING SHIFT", {
    fontFamily: "Arial",
    fontSize: "16px",
    color: "#f7e49b",
    fontStyle: "bold",
    letterSpacing: 1
  }).setOrigin(0.5);
  const title = scene.add.text(0, 5, "THE DRINKS & DAIRY SHELF IS EMPTY", {
    fontFamily: "Arial",
    fontSize: "25px",
    color: "#ffffff",
    fontStyle: "bold"
  }).setOrigin(0.5);
  const direction = scene.add.text(0, 37, "Load the cart, push it into the aisle, then tap the glowing shelf slot.", {
    fontFamily: "Arial",
    fontSize: "15px",
    color: "#d9e9e3"
  }).setOrigin(0.5);
  const intro = scene.add.container(665, 245, [panel, eyebrow, title, direction])
    .setDepth(60)
    .setAlpha(0)
    .setScale(0.96)
    .setName("day1-opening-intro");

  scene.tweens.add({
    targets: intro,
    alpha: 1,
    scaleX: 1,
    scaleY: 1,
    duration: 360,
    ease: "Back.Out"
  });
  scene.time.delayedCall(4200, () => {
    if (!intro.active) return;
    scene.tweens.add({
      targets: intro,
      alpha: 0,
      y: intro.y - 18,
      duration: 360,
      ease: "Sine.In",
      onComplete: () => intro.setVisible(false)
    });
  });
  return intro;
}

function drawRestockRoute(graphics: Phaser.GameObjects.Graphics): void {
  graphics.clear();
  graphics.lineStyle(5, 0xffd95c, 0.56);
  drawDashedSegment(graphics, 500, 855, 690, 855, 18, 11);
  drawDashedSegment(graphics, 690, 855, 790, 760, 18, 11);
  drawDashedSegment(graphics, 790, 760, 865, 650, 18, 11);
  graphics.fillStyle(0xffd95c, 0.75);
  graphics.fillTriangle(852, 666, 879, 648, 871, 679);
}

function drawDashedSegment(
  graphics: Phaser.GameObjects.Graphics,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  dashLength: number,
  gapLength: number
): void {
  const distance = Phaser.Math.Distance.Between(x1, y1, x2, y2);
  if (distance <= 0) return;
  const dx = (x2 - x1) / distance;
  const dy = (y2 - y1) / distance;
  for (let cursor = 0; cursor < distance; cursor += dashLength + gapLength) {
    const end = Math.min(distance, cursor + dashLength);
    graphics.lineBetween(x1 + dx * cursor, y1 + dy * cursor, x1 + dx * end, y1 + dy * end);
  }
}

function drawDashedRect(
  graphics: Phaser.GameObjects.Graphics,
  centerX: number,
  centerY: number,
  width: number,
  height: number
): void {
  graphics.clear();
  graphics.lineStyle(4, 0xffdf67, 0.96);
  const left = centerX - width / 2;
  const right = centerX + width / 2;
  const top = centerY - height / 2;
  const bottom = centerY + height / 2;
  drawDashedSegment(graphics, left, top, right, top, 11, 7);
  drawDashedSegment(graphics, right, top, right, bottom, 11, 7);
  drawDashedSegment(graphics, right, bottom, left, bottom, 11, 7);
  drawDashedSegment(graphics, left, bottom, left, top, 11, 7);
}

function syncRestockTarget(
  immersion: DayOneRestockImmersion,
  target: RuntimeShelfSlot | undefined
): void {
  const visible = Boolean(target);
  immersion.targetLayer.setVisible(visible);
  if (!target) return;
  if (immersion.lastTargetIndex === target.index) return;

  immersion.lastTargetIndex = target.index;
  const x = target.hitArea.x;
  const y = target.hitArea.y + 6;
  immersion.targetGlow.setPosition(x, y);
  immersion.targetArrow.setPosition(x, y - 118);
  immersion.targetLabelBg.setPosition(x, y - 86);
  immersion.targetLabel
    .setPosition(x, y - 86)
    .setText(`RESTOCK ${PRODUCTS[target.productId].label}`);
  drawDashedRect(immersion.targetFrame, x, y, 132, 154);
}

function syncRoute(immersion: DayOneRestockImmersion, scene: RuntimeGame): void {
  const loaded = scene.loadedProducts?.length ?? 0;
  const show = !scene.shiftEnded && !scene.cartAtShelf && loaded >= GAME_RULES.firstMoveRequirement;
  immersion.routeLayer.setVisible(show);
}

function syncGuide(
  immersion: DayOneRestockImmersion,
  scene: RuntimeGame,
  target: RuntimeShelfSlot | undefined
): void {
  const step = resolveGuideStep(scene, target);
  if (immersion.lastGuideStep === step) return;
  immersion.lastGuideStep = step;

  const loaded = scene.loadedProducts?.length ?? 0;
  const required = Math.max(0, GAME_RULES.firstMoveRequirement - loaded);
  const targetLabel = target ? PRODUCTS[target.productId].label : "PRODUCT";
  const copy: Record<GuideStep, string> = {
    LOAD: `1 / 3 · Load ${required} more matching box${required === 1 ? "" : "es"} onto the cart.`,
    MOVE: "2 / 3 · Follow the golden aisle path and push the cart to the empty shelf.",
    RESTOCK: `3 / 3 · Tap the glowing ${targetLabel} slot to place the product on the shelf.`,
    OPEN: "Opening restock complete · The doors are opening for customers.",
    SERVE: "Keep the shelves full while shoppers move through the store.",
    COMPLETE: "Shift complete · Your first supermarket floor is ready for tomorrow."
  };
  const badges: Record<GuideStep, string> = {
    LOAD: "DAY 1 · LOAD",
    MOVE: "DAY 1 · MOVE",
    RESTOCK: "DAY 1 · RESTOCK",
    OPEN: "DAY 1 · OPEN",
    SERVE: "DAY 1 · SERVE",
    COMPLETE: "DAY 1 · DONE"
  };

  immersion.guideText.setText(copy[step]);
  immersion.guideBadge.setText(badges[step]);
  document.body.dataset.dayOneRestockStep = step.toLowerCase();

  immersion.guideLayer.setScale(0.985).setAlpha(0.72);
  const sceneRef = immersion.guideLayer.scene;
  sceneRef.tweens.add({
    targets: immersion.guideLayer,
    scaleX: 1,
    scaleY: 1,
    alpha: 1,
    duration: 220,
    ease: "Sine.Out"
  });
}

function resolveGuideStep(scene: RuntimeGame, target: RuntimeShelfSlot | undefined): GuideStep {
  if (scene.shiftEnded) return "COMPLETE";
  if (scene.phase !== "PREPARE") return target ? "SERVE" : "OPEN";

  const loaded = scene.loadedProducts?.length ?? 0;
  if (!scene.cartAtShelf && loaded < GAME_RULES.firstMoveRequirement) return "LOAD";
  if (!scene.cartAtShelf) return "MOVE";
  if (target) return "RESTOCK";
  return "OPEN";
}

function detectNewRestocks(
  immersion: DayOneRestockImmersion,
  scene: RuntimeGame,
  slots: RuntimeShelfSlot[]
): void {
  const newlyFilled = slots.filter((slot) => Boolean(slot.product) && !immersion.filledSlots.has(slot.index));
  if (newlyFilled.length === 0) return;

  newlyFilled.forEach((slot) => immersion.filledSlots.add(slot.index));
  const latest = newlyFilled[newlyFilled.length - 1];
  const allPrepared = slots.length > 0 && slots.every((slot) => Boolean(slot.product));
  showRestockFeedback(
    immersion,
    scene,
    allPrepared ? "OPENING READY" : "SHELF RESTORED",
    allPrepared
      ? "The first customers are entering your fully stocked supermarket."
      : `A shopper can find ${PRODUCTS[latest.productId].label.toLowerCase()} again.`
  );
}

function showRestockFeedback(
  immersion: DayOneRestockImmersion,
  scene: Phaser.Scene,
  titleText: string,
  bodyText: string
): void {
  const panel = scene.add.rectangle(0, 0, 520, 100, 0x102725, 0.95)
    .setStrokeStyle(3, 0x9bd36f, 0.9);
  const title = scene.add.text(0, -20, titleText, {
    fontFamily: "Arial",
    fontSize: "23px",
    color: "#dff8a9",
    fontStyle: "bold",
    letterSpacing: 1
  }).setOrigin(0.5);
  const body = scene.add.text(0, 20, bodyText, {
    fontFamily: "Arial",
    fontSize: "15px",
    color: "#ffffff",
    align: "center",
    wordWrap: { width: 460 }
  }).setOrigin(0.5);
  const bubble = scene.add.container(930, 785, [panel, title, body])
    .setAlpha(0)
    .setScale(0.9)
    .setName("day1-restock-feedback");
  immersion.feedbackLayer.add(bubble);

  scene.tweens.add({
    targets: bubble,
    alpha: 1,
    scaleX: 1,
    scaleY: 1,
    y: bubble.y - 10,
    duration: 260,
    ease: "Back.Out"
  });
  scene.time.delayedCall(2200, () => {
    if (!bubble.active) return;
    scene.tweens.add({
      targets: bubble,
      alpha: 0,
      y: bubble.y - 18,
      duration: 300,
      ease: "Sine.In",
      onComplete: () => bubble.destroy(true)
    });
  });
}
