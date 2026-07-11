import Phaser from "phaser";
import { GameScene } from "./scenes/GameScene";
import { gameSession } from "./systems/GameSession";

type RuntimeGameScene = Phaser.Scene & {
  phase: "PREPARE" | "OPEN" | "RUSH" | "CLOSING" | "RESULT";
  shiftEnded: boolean;
  cartAtShelf: boolean;
  movingCart: boolean;
  restockBusy: boolean;
  __promotionWingDoor?: Phaser.GameObjects.Container;
  __promotionWingDoorBg?: Phaser.GameObjects.Rectangle;
  __promotionWingDoorLabel?: Phaser.GameObjects.Text;
  __promotionWingMonitor?: () => void;
  __promotionWingAnnounced?: boolean;
  showTransientHint: (message: string) => void;
  showPhaseBanner: (message: string) => void;
};

type GamePrototype = {
  create: () => void;
};

const prototype = GameScene.prototype as unknown as GamePrototype;
const originalCreate = prototype.create;

prototype.create = function createWithPromotionWingDoor(): void {
  originalCreate.call(this);
  const scene = this as unknown as RuntimeGameScene;
  if (gameSession.day !== "day02") return;

  createWingDoor(scene);
  const monitor = (): void => refreshWingDoor(scene);
  scene.__promotionWingMonitor = monitor;
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, monitor);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, monitor);
    scene.__promotionWingDoor?.destroy(true);
    scene.__promotionWingDoor = undefined;
    scene.__promotionWingDoorBg = undefined;
    scene.__promotionWingDoorLabel = undefined;
    scene.__promotionWingMonitor = undefined;
    scene.__promotionWingAnnounced = false;
  });
};

function createWingDoor(scene: RuntimeGameScene): void {
  scene.__promotionWingDoor?.destroy(true);

  const floorArrow = scene.add.triangle(0, -50, -34, 0, 34, 0, 0, 44, 0xffd75a, 1)
    .setStrokeStyle(3, 0x6a4812);
  const background = scene.add.rectangle(0, 25, 260, 118, 0x1b3438, 0.98)
    .setStrokeStyle(5, 0x789395)
    .setInteractive({ useHandCursor: true });
  const eyebrow = scene.add.text(0, -2, "DAY 2 · NEW SPACE", {
    fontFamily: "Arial",
    fontSize: "13px",
    color: "#ffd75a",
    fontStyle: "bold",
    letterSpacing: 2
  }).setOrigin(0.5);
  const label = scene.add.text(0, 39, "PROMOTION WING", {
    fontFamily: "Arial",
    fontSize: "21px",
    color: "#ffffff",
    fontStyle: "bold"
  }).setOrigin(0.5);
  const sublabel = scene.add.text(0, 68, "OPENS WHEN STORE OPENS", {
    fontFamily: "Arial",
    fontSize: "12px",
    color: "#a7b9ba",
    fontStyle: "bold"
  }).setOrigin(0.5);

  const door = scene.add.container(790, 965, [floorArrow, background, eyebrow, label, sublabel])
    .setDepth(75);
  scene.__promotionWingDoor = door;
  scene.__promotionWingDoorBg = background;
  scene.__promotionWingDoorLabel = sublabel;

  background.on("pointerover", () => {
    if (scene.phase !== "PREPARE") door.setScale(1.025);
  });
  background.on("pointerout", () => door.setScale(1));
  background.on("pointerdown", () => enterPromotionWing(scene));
  refreshWingDoor(scene);
}

function refreshWingDoor(scene: RuntimeGameScene): void {
  const background = scene.__promotionWingDoorBg;
  const label = scene.__promotionWingDoorLabel;
  if (!background || !label) return;

  const open = !scene.shiftEnded && (scene.phase === "OPEN" || scene.phase === "RUSH");
  background.setFillStyle(open ? 0x315f7d : 0x253538, open ? 1 : 0.92);
  background.setStrokeStyle(5, open ? 0xffd75a : 0x607174, open ? 1 : 0.8);
  label.setText(open ? "ENTER NEW STORE AREA ↓" : "OPENS WHEN STORE OPENS");
  label.setColor(open ? "#fff1a8" : "#a7b9ba");

  if (open && !scene.__promotionWingAnnounced) {
    scene.__promotionWingAnnounced = true;
    scene.showPhaseBanner("NEW STORE WING OPEN");
    scene.showTransientHint(
      "The store has expanded. Enter the Promotion Wing and manage stock across both rooms."
    );
  }
}

function enterPromotionWing(scene: RuntimeGameScene): void {
  if (scene.shiftEnded || scene.phase === "CLOSING" || scene.phase === "RESULT") {
    scene.showTransientHint("The Promotion Wing is closed for the end-of-shift routine.");
    return;
  }
  if (scene.phase === "PREPARE") {
    scene.showTransientHint("Finish the Main Cooler opening stock first. The new wing opens with the store.");
    return;
  }
  if (scene.movingCart || scene.restockBusy) {
    scene.showTransientHint("Finish the current movement or restock before changing store areas.");
    return;
  }
  if (!scene.cartAtShelf) {
    scene.showTransientHint("Bring the cart to the sales floor before entering the Promotion Wing.");
    return;
  }
  if (scene.scene.isActive("promotion-wing")) return;

  scene.scene.launch("promotion-wing");
  scene.scene.bringToTop("promotion-wing");
}
