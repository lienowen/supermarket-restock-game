import Phaser from "phaser";
import { Assets } from "./assets";
import { PRODUCTS, type FixtureType, type ProductId } from "./gameConfig";
import { GameScene } from "./scenes/GameScene";
import { gameSession } from "./systems/GameSession";

const DAY3_AISLE_SHELF = "day3-aisle-shelf";
const DAY3_AISLE_SHELF_PATH = "assets/day02/promotion/promo_display_empty.png";

type RuntimeSlot = {
  index: number;
  productId: ProductId;
  hitArea: Phaser.GameObjects.Rectangle;
  missingTag: Phaser.GameObjects.Image;
  typeLabel: Phaser.GameObjects.Text;
  productBottomY: number;
  product?: Phaser.GameObjects.Image;
  reservedForCustomer: boolean;
};

type RuntimeGame = Phaser.Scene & {
  shelfSlots: RuntimeSlot[];
  showTransientHint: (message: string) => void;
  tryRestockSlot: (slot: RuntimeSlot) => void;
};

type GamePrototype = {
  preload: () => void;
  create: () => void;
  createStage: () => void;
  createShelfSlots: () => void;
};

type Day3SlotDefinition = {
  productId: ProductId;
  fixtureType: FixtureType;
  x: number;
  y: number;
  productBottomY: number;
};

const SLOT_DEFINITIONS: Day3SlotDefinition[] = [
  { productId: "cola", fixtureType: "drinks_shelf", x: 790, y: 430, productBottomY: 515 },
  { productId: "cola", fixtureType: "drinks_shelf", x: 790, y: 650, productBottomY: 735 },
  { productId: "water", fixtureType: "grocery_shelf", x: 1000, y: 430, productBottomY: 515 },
  { productId: "water", fixtureType: "grocery_shelf", x: 1000, y: 650, productBottomY: 735 },
  { productId: "milk", fixtureType: "cold_case", x: 1210, y: 430, productBottomY: 515 },
  { productId: "milk", fixtureType: "cold_case", x: 1210, y: 650, productBottomY: 735 }
];

const FIXTURE_LABELS: Record<FixtureType, string> = {
  drinks_shelf: "DRINKS AISLE",
  grocery_shelf: "GROCERY AISLE",
  cold_case: "COLD CASE"
};

const FIXTURE_COLORS: Record<FixtureType, number> = {
  drinks_shelf: 0x2f6f9f,
  grocery_shelf: 0x8a5a2b,
  cold_case: 0x377c73
};

const prototype = GameScene.prototype as unknown as GamePrototype;
const originalPreload = prototype.preload;
const originalCreate = prototype.create;
const originalCreateStage = prototype.createStage;
const originalCreateShelfSlots = prototype.createShelfSlots;

prototype.preload = function preloadDayThreeFixtures(): void {
  originalPreload.call(this);
  const scene = this as unknown as Phaser.Scene;
  if (gameSession.day === "day03" && !scene.textures.exists(DAY3_AISLE_SHELF)) {
    scene.load.image(DAY3_AISLE_SHELF, DAY3_AISLE_SHELF_PATH);
  }
};

prototype.createStage = function createDayThreeFixtureStage(): void {
  originalCreateStage.call(this);
  if (gameSession.day !== "day03") return;

  const scene = this as unknown as RuntimeGame;
  removeLegacyColdCase(scene);
  createFixture(scene, 790, "drinks_shelf", DAY3_AISLE_SHELF);
  createFixture(scene, 1000, "grocery_shelf", DAY3_AISLE_SHELF);
  createFixture(scene, 1210, "cold_case", Assets.props.shelf);

  scene.add.text(1000, 865, "ONE CART · THREE DEPARTMENTS · MATCH EACH CASE TO ITS FIXTURE", {
    fontFamily: "Arial",
    fontSize: "17px",
    color: "#ffffff",
    fontStyle: "bold",
    backgroundColor: "#142c31",
    padding: { x: 18, y: 9 }
  }).setOrigin(0.5).setDepth(12);
};

prototype.createShelfSlots = function createDayThreeFixtureSlots(): void {
  if (gameSession.day !== "day03") {
    originalCreateShelfSlots.call(this);
    return;
  }

  const scene = this as unknown as RuntimeGame;
  scene.shelfSlots = [];

  SLOT_DEFINITIONS.forEach((position, index) => {
    const definition = PRODUCTS[position.productId];
    const fixtureLabel = FIXTURE_LABELS[position.fixtureType];
    const hitArea = scene.add.rectangle(position.x, position.y, 152, 166, 0xffffff, 0.001)
      .setDepth(25)
      .setInteractive({ useHandCursor: true });

    const missingTag = scene.add.image(position.x, position.y + 28, Assets.ui.missingTag)
      .setDisplaySize(112, 44)
      .setDepth(24);

    const typeLabel = scene.add.text(position.x, position.y - 61, `${definition.label} · ${fixtureLabel}`, {
      fontFamily: "Arial",
      fontSize: "11px",
      color: "#ffffff",
      fontStyle: "bold",
      backgroundColor: colorToCss(FIXTURE_COLORS[position.fixtureType]),
      padding: { x: 5, y: 3 }
    }).setOrigin(0.5).setDepth(23);

    const slot: RuntimeSlot = {
      index,
      productId: position.productId,
      hitArea,
      missingTag,
      typeLabel,
      productBottomY: position.productBottomY,
      reservedForCustomer: false
    };

    hitArea.on("pointerdown", () => scene.tryRestockSlot(slot));
    scene.shelfSlots.push(slot);
  });
};

prototype.create = function createWithDayThreeFixtureGuidance(): void {
  originalCreate.call(this);
  if (gameSession.day !== "day03") return;

  const scene = this as unknown as RuntimeGame;
  document.body.dataset.day3MultiFixture = "ready";
  scene.time.delayedCall(500, () => {
    if (!scene.scene.isActive()) return;
    scene.showTransientHint("Day 3 upgrade: COLA goes to Drinks, WATER to Grocery, and MILK to the Cold Case.");
  });
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    delete document.body.dataset.day3MultiFixture;
  });
};

function createFixture(
  scene: RuntimeGame,
  x: number,
  fixtureType: FixtureType,
  texture: string
): void {
  scene.add.rectangle(x, 575, 198, 640, 0x0b1719, 0.34)
    .setStrokeStyle(3, FIXTURE_COLORS[fixtureType], 0.9)
    .setDepth(2);

  const fixture = scene.add.image(x, 585, texture)
    .setDisplaySize(184, 590)
    .setDepth(3);

  if (fixtureType === "drinks_shelf") fixture.setTint(0xc7e8ff);
  if (fixtureType === "grocery_shelf") fixture.setTint(0xffe0b5);

  scene.add.rectangle(x, 285, 184, 58, FIXTURE_COLORS[fixtureType], 0.98)
    .setStrokeStyle(3, 0xf4e7c9)
    .setDepth(7);
  scene.add.text(x, 285, FIXTURE_LABELS[fixtureType], {
    fontFamily: "Arial",
    fontSize: fixtureType === "grocery_shelf" ? "15px" : "16px",
    color: "#ffffff",
    fontStyle: "bold",
    align: "center"
  }).setOrigin(0.5).setDepth(8);
}

function removeLegacyColdCase(scene: RuntimeGame): void {
  scene.children.list
    .filter((child): child is Phaser.GameObjects.Image =>
      child instanceof Phaser.GameObjects.Image && child.texture.key === Assets.props.shelf
    )
    .forEach((image) => image.destroy());

  scene.children.list
    .filter((child): child is Phaser.GameObjects.Text => child instanceof Phaser.GameObjects.Text)
    .filter((text) => {
      const normalized = text.text.trim().toUpperCase();
      return normalized === "COLD DRINKS" || normalized === "SHELF +3";
    })
    .forEach((text) => text.destroy());
}

function colorToCss(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}
