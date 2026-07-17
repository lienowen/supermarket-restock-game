import Phaser from "phaser";
import { Assets } from "./assets";
import { GameScene } from "./scenes/GameScene";
import { DAY_ONE_STORE_LAYOUT, type StoreZone } from "./supermarket/dayOneVisualLayout";
import { gameSession } from "./systems/GameSession";

type GamePrototype = {
  create: (...args: unknown[]) => void;
};

type RuntimeGame = Phaser.Scene & {
  __dayOneDepartmentPolish?: DayOneDepartmentPolish;
};

type DayOneDepartmentPolish = {
  layer: Phaser.GameObjects.Container;
  monitor: () => void;
  destroyed: boolean;
  destroy: () => void;
};

installDayOneDepartmentPolish();

function installDayOneDepartmentPolish(): void {
  const prototype = GameScene.prototype as unknown as GamePrototype;
  const originalCreate = prototype.create;

  prototype.create = function createWithDayOneDepartmentPolish(...args: unknown[]): void {
    originalCreate.apply(this, args);
    const scene = this as unknown as RuntimeGame;

    // The Day 1 restock layer is installed at 120 ms. This pass intentionally
    // follows it so it can replace the placeholder department cards and tune
    // the guide/target positions without changing the proven gameplay logic.
    scene.time.delayedCall(260, () => installDepartmentPolish(scene));
  };
}

function installDepartmentPolish(scene: RuntimeGame): void {
  scene.__dayOneDepartmentPolish?.destroy();
  if (gameSession.day !== "day01" || !scene.scene.isActive()) return;

  hidePlaceholderDepartmentCards(scene);
  hideLegacyShelfAsset(scene);
  polishOpeningGuide(scene);

  const layer = scene.add.container(0, 0)
    .setDepth(2.35)
    .setName("day1-department-polish-world");

  const departmentRowShadow = scene.add.rectangle(724, 433, 900, 342, 0x061012, 0.075)
    .setStrokeStyle(1, 0xdce9df, 0.08)
    .setName("day1-department-row-shadow");
  layer.add(departmentRowShadow);

  DAY_ONE_STORE_LAYOUT.forEach((zone) => layer.add(createDepartmentFixture(scene, zone)));

  const aisleCaptionBg = scene.add.rectangle(728, 635, 640, 34, 0x071416, 0.52)
    .setStrokeStyle(1, 0xa7c6b3, 0.28);
  const aisleCaption = scene.add.text(728, 635, "FRESH FOOD  ·  PANTRY  ·  OPENING RESTOCK AISLE", {
    fontFamily: "Arial",
    fontSize: "13px",
    color: "#e7efe9",
    fontStyle: "bold",
    letterSpacing: 1
  }).setOrigin(0.5);
  layer.add([aisleCaptionBg, aisleCaption]);

  const polish: DayOneDepartmentPolish = {
    layer,
    monitor: () => undefined,
    destroyed: false,
    destroy: () => undefined
  };

  let lastMonitorAt = -1000;
  const monitor = (): void => {
    if (polish.destroyed || !scene.scene.isActive()) return;
    if (scene.time.now - lastMonitorAt < 100) return;
    lastMonitorAt = scene.time.now;

    hidePlaceholderDepartmentCards(scene);
    positionRestockTarget(scene);
    keepGuideClearOfGameplay(scene);
  };

  const destroy = (): void => {
    if (polish.destroyed) return;
    polish.destroyed = true;
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, monitor);
    if (layer.active) layer.destroy(true);
    if (scene.__dayOneDepartmentPolish === polish) scene.__dayOneDepartmentPolish = undefined;
  };

  polish.monitor = monitor;
  polish.destroy = destroy;
  scene.__dayOneDepartmentPolish = polish;
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, monitor);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, destroy);
  monitor();

  document.body.dataset.dayOneDepartmentPolish = "ready";
}

function createDepartmentFixture(scene: Phaser.Scene, zone: StoreZone): Phaser.GameObjects.Container {
  const objects: Phaser.GameObjects.GameObject[] = [];
  const halfWidth = zone.width / 2;
  const halfHeight = zone.height / 2;

  const floorShadow = scene.add.ellipse(0, halfHeight - 4, zone.width * 0.96, 28, 0x000000, 0.18);
  const backGlow = scene.add.rectangle(0, 10, zone.width - 10, zone.height - 62, zone.accent, 0.035)
    .setStrokeStyle(1, zone.accent, 0.16);
  const leftPost = scene.add.rectangle(-halfWidth + 9, 18, 9, zone.height - 74, 0x584a3d, 0.88);
  const rightPost = scene.add.rectangle(halfWidth - 9, 18, 9, zone.height - 74, 0x584a3d, 0.88);
  const crown = scene.add.rectangle(0, -halfHeight + 26, zone.width - 4, 48, 0x102a29, 0.9)
    .setStrokeStyle(2, zone.accent, 0.78);
  const crownStripe = scene.add.rectangle(0, -halfHeight + 49, zone.width - 18, 4, zone.accent, 0.9);
  const label = scene.add.text(0, -halfHeight + 17, zone.name, {
    fontFamily: "Arial",
    fontSize: "14px",
    color: "#ffffff",
    fontStyle: "bold",
    align: "center",
    wordWrap: { width: zone.width - 20 }
  }).setOrigin(0.5);
  const subtitle = scene.add.text(0, -halfHeight + 36, zone.subtitle, {
    fontFamily: "Arial",
    fontSize: "8px",
    color: "#d7e5df",
    align: "center"
  }).setOrigin(0.5);

  objects.push(floorShadow, backGlow, leftPost, rightPost, crown, crownStripe, label, subtitle);

  if (zone.fixtureStyle === "produce") {
    createProduceFixture(scene, zone, objects);
  } else {
    createPackagedFixture(scene, zone, objects);
  }

  const department = scene.add.container(zone.x, zone.y, objects)
    .setName(`day1-polished-zone-${zone.id}`);

  scene.tweens.add({
    targets: department,
    y: zone.y - 2,
    duration: 2100 + DAY_ONE_STORE_LAYOUT.indexOf(zone) * 180,
    yoyo: true,
    repeat: -1,
    ease: "Sine.InOut"
  });

  return department;
}

function createProduceFixture(
  scene: Phaser.Scene,
  zone: StoreZone,
  objects: Phaser.GameObjects.GameObject[]
): void {
  const binYs = [-38, 70];

  binYs.forEach((binY, rowIndex) => {
    for (let binIndex = 0; binIndex < 3; binIndex += 1) {
      const binX = -62 + binIndex * 62;
      const bin = scene.add.rectangle(binX, binY + 22, 54, 48, 0x76563c, 0.94)
        .setStrokeStyle(2, 0xb58a5a, 0.72);
      const rim = scene.add.rectangle(binX, binY, 58, 8, 0x9a744f, 0.96);
      objects.push(bin, rim);

      for (let produceIndex = 0; produceIndex < 7; produceIndex += 1) {
        const color = zone.productColors[(produceIndex + binIndex + rowIndex) % zone.productColors.length];
        const produceX = binX - 18 + (produceIndex % 4) * 12;
        const produceY = binY + 5 + Math.floor(produceIndex / 4) * 12;
        const produce = scene.add.ellipse(produceX, produceY, 13, 11, color, 0.98)
          .setStrokeStyle(1, 0xffffff, 0.14);
        objects.push(produce);
      }
    }
  });

  const lowerShelf = scene.add.rectangle(0, 142, zone.width - 28, 10, 0x6b523f, 0.96)
    .setStrokeStyle(1, 0xc1a078, 0.55);
  const priceRail = scene.add.rectangle(0, 153, zone.width - 42, 10, 0xe4c85b, 0.82);
  objects.push(lowerShelf, priceRail);
}

function createPackagedFixture(
  scene: Phaser.Scene,
  zone: StoreZone,
  objects: Phaser.GameObjects.GameObject[]
): void {
  const shelfYs = [-62, 18, 98];

  shelfYs.slice(0, zone.shelfCount).forEach((shelfY, shelfIndex) => {
    const shelf = scene.add.rectangle(0, shelfY + 39, zone.width - 24, 9, 0x68513f, 0.96)
      .setStrokeStyle(1, 0xc6a77d, 0.55);
    const priceRail = scene.add.rectangle(0, shelfY + 46, zone.width - 38, 7, 0xe3c75b, 0.78);
    objects.push(shelf, priceRail);

    for (let productIndex = 0; productIndex < 6; productIndex += 1) {
      const color = zone.productColors[(productIndex + shelfIndex) % zone.productColors.length];
      const productX = -70 + productIndex * 28;

      if (zone.fixtureStyle === "beverage") {
        const bottle = scene.add.rectangle(productX, shelfY + 15, 17, 38, color, 0.97)
          .setStrokeStyle(1, 0xffffff, 0.18);
        const neck = scene.add.rectangle(productX, shelfY - 7, 8, 8, color, 0.97);
        const cap = scene.add.rectangle(productX, shelfY - 13, 10, 4, 0xe8eef0, 0.9);
        objects.push(bottle, neck, cap);
      } else {
        const packageHeight = 42 + ((productIndex + shelfIndex) % 3) * 5;
        const packageBox = scene.add.rectangle(productX, shelfY + 12, 21, packageHeight, color, 0.97)
          .setStrokeStyle(1, 0xffffff, 0.18);
        const packageLabel = scene.add.rectangle(productX, shelfY + 12, 13, 9, 0xffffff, 0.32);
        objects.push(packageBox, packageLabel);
      }
    }
  });
}

function hidePlaceholderDepartmentCards(scene: Phaser.Scene): void {
  const placeholder = findNamedObject<Phaser.GameObjects.Container>(scene, "day1-zone-world");
  placeholder?.setVisible(false);
}

function hideLegacyShelfAsset(scene: Phaser.Scene): void {
  for (const child of scene.children.list) {
    if (!(child instanceof Phaser.GameObjects.Image)) continue;
    if (child.name?.startsWith("immersion-") || child.name?.startsWith("day1-")) continue;
    if (child.texture.key === Assets.props.shelf) child.setVisible(false).disableInteractive();
  }
}

function polishOpeningGuide(scene: Phaser.Scene): void {
  const intro = findNamedObject<Phaser.GameObjects.Container>(scene, "day1-opening-intro");
  intro?.setPosition(360, 232).setScale(0.76);

  const roomSignBg = findNamedObject<Phaser.GameObjects.Rectangle>(scene, "immersion-room-sign-bg");
  const roomSign = findNamedObject<Phaser.GameObjects.Text>(scene, "immersion-room-sign");
  roomSignBg?.setVisible(false);
  roomSign?.setVisible(false);

  scene.time.delayedCall(4250, () => {
    if (!scene.scene.isActive()) return;
    roomSignBg?.setVisible(true);
    roomSign?.setVisible(true);
  });

  keepGuideClearOfGameplay(scene);
}

function keepGuideClearOfGameplay(scene: Phaser.Scene): void {
  const guideLayer = findNamedObject<Phaser.GameObjects.Container>(scene, "day1-guide-layer");
  const guideBg = findNamedObject<Phaser.GameObjects.Rectangle>(scene, "day1-guide-bg");
  const guideBadge = findNamedObject<Phaser.GameObjects.Text>(scene, "day1-guide-badge");
  const guideText = findNamedObject<Phaser.GameObjects.Text>(scene, "day1-guide-text");

  guideLayer?.setDepth(56);
  guideBg?.setPosition(665, 1042).setDisplaySize(720, 72).setFillStyle(0x071416, 0.82);
  guideBadge?.setPosition(350, 1042).setFontSize(15);
  guideText?.setPosition(700, 1042).setFontSize(18).setWordWrapWidth(600);
}

function positionRestockTarget(scene: Phaser.Scene): void {
  const glow = findNamedObject<Phaser.GameObjects.Rectangle>(scene, "day1-target-glow");
  const arrow = findNamedObject<Phaser.GameObjects.Text>(scene, "day1-target-arrow");
  const labelBg = findNamedObject<Phaser.GameObjects.Rectangle>(scene, "day1-target-label-bg");
  const label = findNamedObject<Phaser.GameObjects.Text>(scene, "day1-target-label");
  if (!glow || !arrow || !labelBg || !label || !glow.visible) return;

  const upperRow = glow.y < 430;
  const arrowY = upperRow ? glow.y - 92 : glow.y - 110;
  const labelY = upperRow ? glow.y - 60 : glow.y - 80;
  const targetX = Phaser.Math.Clamp(glow.x, 780, 1200);

  glow.setFillStyle(0xffdf67, 0.045).setStrokeStyle(4, 0xffdf67, 0.9);
  arrow.setPosition(targetX, arrowY).setFontSize(31);
  labelBg.setPosition(targetX, labelY).setDisplaySize(176, 34);
  label.setPosition(targetX, labelY).setFontSize(13);
}

function findNamedObject<T extends Phaser.GameObjects.GameObject>(scene: Phaser.Scene, name: string): T | undefined {
  for (const child of scene.children.list) {
    const found = findInObjectTree<T>(child, name);
    if (found) return found;
  }
  return undefined;
}

function findInObjectTree<T extends Phaser.GameObjects.GameObject>(
  object: Phaser.GameObjects.GameObject,
  name: string
): T | undefined {
  if (object.name === name) return object as T;
  if (!(object instanceof Phaser.GameObjects.Container)) return undefined;

  for (const child of object.list) {
    const found = findInObjectTree<T>(child, name);
    if (found) return found;
  }
  return undefined;
}
