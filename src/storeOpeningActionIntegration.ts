import Phaser from "phaser";
import { GameScene } from "./scenes/GameScene";

type RuntimeGameScene = Phaser.Scene & {
  phase: "PREPARE" | "OPEN" | "RUSH" | "CLOSING" | "RESULT";
  shiftEnded: boolean;
  taskText: Phaser.GameObjects.Text;
  hintText: Phaser.GameObjects.Text;
  showPhaseBanner: (message: string) => void;
  updateHud: () => void;
  __openingChecklistPanel?: Phaser.GameObjects.Container;
  __openingPromptShown?: boolean;
  __registerChecked?: boolean;
  __doorsUnlocked?: boolean;
};

type GamePrototype = {
  create: () => void;
  openStore: () => void;
};

const prototype = GameScene.prototype as unknown as GamePrototype;
const originalCreate = prototype.create;
const originalOpenStore = prototype.openStore;

prototype.create = function createWithOpeningChecklist(): void {
  const scene = this as unknown as RuntimeGameScene;
  scene.__openingChecklistPanel?.destroy(true);
  scene.__openingChecklistPanel = undefined;
  scene.__openingPromptShown = false;
  scene.__registerChecked = false;
  scene.__doorsUnlocked = false;
  originalCreate.call(this);
};

prototype.openStore = function requestExplicitStoreOpening(): void {
  const scene = this as unknown as RuntimeGameScene;
  if (scene.shiftEnded || scene.phase !== "PREPARE") return;

  if (scene.__doorsUnlocked) {
    originalOpenStore.call(this);
    return;
  }

  if (scene.__openingPromptShown && scene.__openingChecklistPanel?.active) return;
  scene.__openingPromptShown = true;
  showOpeningChecklist(scene, () => {
    scene.__doorsUnlocked = true;
    scene.__openingChecklistPanel?.destroy(true);
    scene.__openingChecklistPanel = undefined;
    scene.showPhaseBanner("DOORS OPEN");
    originalOpenStore.call(this);
  });
};

function showOpeningChecklist(scene: RuntimeGameScene, openStore: () => void): void {
  scene.taskText.setText("FINAL OPENING CHECK · SHELVES READY");
  scene.hintText.setText("TEST THE REGISTER → UNLOCK THE DOORS → OPEN STORE");

  const shade = scene.add.rectangle(665, 591, 1330, 1182, 0x061012, 0.68)
    .setInteractive()
    .setDepth(890);
  const panel = scene.add.rectangle(665, 585, 780, 610, 0xf1ead9, 0.99)
    .setStrokeStyle(8, 0x4f7358)
    .setDepth(891);
  const title = scene.add.text(665, 340, "OPENING CHECK", {
    fontFamily: "Arial",
    fontSize: "44px",
    color: "#263a30",
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(892);
  const subtitle = scene.add.text(665, 405, "Do the final employee checks before customers enter.", {
    fontFamily: "Arial",
    fontSize: "23px",
    color: "#53645c",
    align: "center"
  }).setOrigin(0.5).setDepth(892);

  const checklist = scene.add.text(470, 490, [
    "✓ Clocked in",
    "✓ Delivery received",
    "✓ Shelves stocked",
    "○ Register tested",
    "○ Doors unlocked"
  ].join("\n"), {
    fontFamily: "Arial",
    fontSize: "28px",
    color: "#2f4438",
    fontStyle: "bold",
    lineSpacing: 17
  }).setDepth(892);

  const status = scene.add.text(665, 730, "REGISTER NOT TESTED", {
    fontFamily: "Arial",
    fontSize: "22px",
    color: "#8a4d26",
    fontStyle: "bold",
    backgroundColor: "#f4d9bb",
    padding: { x: 18, y: 10 }
  }).setOrigin(0.5).setDepth(892);

  const buttonBackground = scene.add.rectangle(0, 0, 430, 92, 0x315f7d, 1)
    .setStrokeStyle(4, 0x9fcbe8)
    .setInteractive({ useHandCursor: true });
  const buttonText = scene.add.text(0, 0, "TEST REGISTER", {
    fontFamily: "Arial",
    fontSize: "28px",
    color: "#ffffff",
    fontStyle: "bold"
  }).setOrigin(0.5);
  const button = scene.add.container(665, 845, [buttonBackground, buttonText]).setDepth(893);

  let testing = false;
  buttonBackground.on("pointerover", () => button.setScale(1.025));
  buttonBackground.on("pointerout", () => button.setScale(1));
  buttonBackground.on("pointerdown", () => {
    if (testing) return;

    if (!scene.__registerChecked) {
      testing = true;
      buttonBackground.disableInteractive();
      buttonText.setText("TESTING…");
      status.setText("SCANNING TEST ITEM").setColor("#5f5522").setBackgroundColor("#f2e8b8");
      scene.time.delayedCall(650, () => {
        testing = false;
        scene.__registerChecked = true;
        checklist.setText([
          "✓ Clocked in",
          "✓ Delivery received",
          "✓ Shelves stocked",
          "✓ Register tested",
          "○ Doors unlocked"
        ].join("\n"));
        status.setText("REGISTER ONLINE").setColor("#285331").setBackgroundColor("#cce8c7");
        buttonText.setText("UNLOCK DOORS & OPEN");
        buttonBackground.setFillStyle(0x4f8b4c).setStrokeStyle(4, 0xbfe5a6).setInteractive({ useHandCursor: true });
      });
      return;
    }

    checklist.setText([
      "✓ Clocked in",
      "✓ Delivery received",
      "✓ Shelves stocked",
      "✓ Register tested",
      "✓ Doors unlocked"
    ].join("\n"));
    status.setText("STORE READY TO OPEN").setColor("#285331").setBackgroundColor("#cce8c7");
    buttonBackground.disableInteractive();
    buttonText.setText("OPENING…");
    scene.time.delayedCall(420, openStore);
  });

  scene.__openingChecklistPanel = scene.add.container(0, 0, [
    shade,
    panel,
    title,
    subtitle,
    checklist,
    status,
    button
  ]).setDepth(890);
}
