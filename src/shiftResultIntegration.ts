import Phaser from "phaser";
import { GameScene } from "./scenes/GameScene";
import { ProgressionCustomerScene } from "./scenes/ProgressionCustomerScene";
import { gameSession } from "./systems/GameSession";
import { LEVELS } from "./levels/levelConfigs";

type RuntimeGameScene = Phaser.Scene & {
  shiftEnded: boolean;
  pauseOverlay?: Phaser.GameObjects.Container;
};

type GameScenePrototype = {
  endShift: () => void;
};

type ProgressionPrototype = {
  showNextDayButton: () => void;
};

const gamePrototype = GameScene.prototype as unknown as GameScenePrototype;
const originalEndShift = gamePrototype.endShift;

// The detailed result card owns progression now, so the old floating Day 1 button
// must not appear above it from the always-active progression scene.
const progressionPrototype = ProgressionCustomerScene.prototype as unknown as ProgressionPrototype;
progressionPrototype.showNextDayButton = function suppressLegacyNextDayButton(): void {
  // Intentionally empty.
};

gamePrototype.endShift = function endShiftWithDetailedResults(): void {
  const scene = this as unknown as RuntimeGameScene;
  const alreadyEnded = scene.shiftEnded;
  originalEndShift.call(this);
  if (alreadyEnded || !scene.shiftEnded) return;

  scene.pauseOverlay?.destroy(true);
  scene.pauseOverlay = createResultCard(scene);
};

function createResultCard(scene: RuntimeGameScene): Phaser.GameObjects.Container {
  const snapshot = gameSession.snapshot;
  const level = LEVELS[snapshot.activeDay];
  const stars = Math.max(0, Math.min(3, snapshot.stars));
  const starLine = `${"★".repeat(stars)}${"☆".repeat(3 - stars)}`;

  const shade = scene.add.rectangle(665, 591, 1330, 1182, 0x071010, 0.84)
    .setInteractive();
  const panel = scene.add.rectangle(665, 585, 720, 650, 0xf4e7c9, 0.99)
    .setStrokeStyle(8, 0x4c7148);

  const title = scene.add.text(665, 325, "SHIFT COMPLETE", {
    fontFamily: "Arial",
    fontSize: "46px",
    color: "#25382d",
    fontStyle: "bold"
  }).setOrigin(0.5);

  const dayTitle = scene.add.text(665, 378, level.title.toUpperCase(), {
    fontFamily: "Arial",
    fontSize: "22px",
    color: "#5d715f",
    fontStyle: "bold"
  }).setOrigin(0.5);

  const starsText = scene.add.text(665, 430, starLine, {
    fontFamily: "Arial",
    fontSize: "54px",
    color: "#d89b18",
    fontStyle: "bold",
    stroke: "#7a5410",
    strokeThickness: 2
  }).setOrigin(0.5);

  const leftStats = scene.add.text(470, 520, [
    "SALES",
    "MISSED SALES",
    "WRONG STOCK",
    "BEST COMBO",
    "WALLET COINS"
  ].join("\n"), {
    fontFamily: "Arial",
    fontSize: "24px",
    color: "#506456",
    fontStyle: "bold",
    lineSpacing: 15
  }).setOrigin(0, 0);

  const rightStats = scene.add.text(860, 520, [
    `${snapshot.soldCount}/${level.salesTargets.rushToClosing}`,
    String(snapshot.missedSales),
    String(snapshot.wrongStock),
    `x${snapshot.bestCombo}`,
    String(snapshot.money)
  ].join("\n"), {
    fontFamily: "Arial",
    fontSize: "24px",
    color: "#25382d",
    fontStyle: "bold",
    align: "right",
    lineSpacing: 15
  }).setOrigin(1, 0);

  const ratingHint = scene.add.text(665, 735, ratingMessage(stars, snapshot.missedSales, snapshot.wrongStock), {
    fontFamily: "Arial",
    fontSize: "20px",
    color: "#405346",
    align: "center",
    wordWrap: { width: 600 }
  }).setOrigin(0.5);

  const replayButton = makeButton(scene, 500, 855, "REPLAY SHIFT", 0x4f8b4c, () => {
    gameSession.reset(snapshot.activeDay);
    scene.scene.restart();
  });

  const continueLabel = snapshot.activeDay === "day01" ? "NEXT DAY" : "SHIFT INTRO";
  const continueButton = makeButton(scene, 830, 855, continueLabel, 0x315f7d, () => {
    if (snapshot.activeDay === "day01") {
      try {
        localStorage.setItem("supermarket.activeDay", "day02");
      } catch {
        // The runtime day switch still works if browser storage is unavailable.
      }
      gameSession.setActiveDay("day02");
    }
    scene.scene.start("opening");
  });

  return scene.add.container(0, 0, [
    shade,
    panel,
    title,
    dayTitle,
    starsText,
    leftStats,
    rightStats,
    ratingHint,
    replayButton,
    continueButton
  ]).setDepth(900);
}

function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  color: number,
  action: () => void
): Phaser.GameObjects.Container {
  const background = scene.add.rectangle(0, 0, 286, 78, color, 1)
    .setStrokeStyle(4, 0x294735);
  const text = scene.add.text(0, 0, label, {
    fontFamily: "Arial",
    fontSize: "22px",
    color: "#ffffff",
    fontStyle: "bold"
  }).setOrigin(0.5);

  // A transparent hit plate is deliberately larger than the visible button.
  // It owns the input directly, so clicks do not depend on container hit testing.
  const hitPlate = scene.add.rectangle(0, 0, 326, 104, 0xffffff, 0.001)
    .setInteractive({ useHandCursor: true });

  const button = scene.add.container(x, y, [background, text, hitPlate]);
  let activated = false;

  hitPlate.on("pointerover", () => {
    if (!activated) button.setScale(1.025);
  });
  hitPlate.on("pointerout", () => {
    if (!activated) button.setScale(1);
  });
  hitPlate.on("pointerdown", () => {
    if (activated) return;
    activated = true;
    button.setScale(0.985);
    action();
  });

  return button;
}

function ratingMessage(stars: number, missedSales: number, wrongStock: number): string {
  if (stars >= 3) return "Perfect shift: no missed sales, no wrong stock and a strong restock combo.";
  if (missedSales > 0) return "Improve the next run by prioritizing waiting customers before their patience expires.";
  if (wrongStock > 0) return "Match product labels carefully to protect the three-star rating.";
  if (stars === 2) return "Good shift. Build a faster restock combo to reach three stars.";
  return "Complete the sales target and keep shelves available to improve the rating.";
}
