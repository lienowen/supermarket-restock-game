import Phaser from "phaser";
import { gameSession } from "../systems/GameSession";

type RuntimeGameScene = Phaser.Scene & {
  phase: "PREPARE" | "OPEN" | "RUSH" | "CLOSING" | "RESULT";
  shiftEnded: boolean;
  __promotionWingVisited?: boolean;
  __promotionWingAutoQueued?: boolean;
  showPhaseBanner: (message: string) => void;
  showTransientHint: (message: string) => void;
};

type RoomButton = {
  container: Phaser.GameObjects.Container;
  background: Phaser.GameObjects.Rectangle;
  title: Phaser.GameObjects.Text;
  subtitle: Phaser.GameObjects.Text;
  hit: Phaser.GameObjects.Rectangle;
};

export class DayTwoRoomNavigationScene extends Phaser.Scene {
  private gameScene?: RuntimeGameScene;
  private panel?: Phaser.GameObjects.Container;
  private mainButton?: RoomButton;
  private wingButton?: RoomButton;
  private statusText?: Phaser.GameObjects.Text;
  private lastWingActive = false;
  private lastVisible = false;

  constructor() {
    super({ key: "day2-room-nav", active: true });
  }

  create(): void {
    this.createPanel();
    this.setPanelVisible(false);
  }

  update(): void {
    const game = this.scene.get("game") as RuntimeGameScene;
    const relevant =
      gameSession.day === "day02" &&
      Boolean(game?.scene?.isActive()) &&
      !gameSession.isPaused;

    if (!relevant) {
      this.gameScene = undefined;
      this.setPanelVisible(false);
      return;
    }

    this.gameScene = game;
    const wingActive = this.scene.isActive("promotion-wing");
    const open = !game.shiftEnded && (game.phase === "OPEN" || game.phase === "RUSH");

    this.setPanelVisible(true);
    this.refreshButtons(wingActive, open);

    if (!this.lastVisible || wingActive !== this.lastWingActive) {
      this.scene.bringToTop("day2-room-nav");
    }
    this.lastVisible = true;
    this.lastWingActive = wingActive;

    if (open && !game.__promotionWingVisited && !game.__promotionWingAutoQueued) {
      game.__promotionWingAutoQueued = true;
      this.time.delayedCall(850, () => {
        const current = this.gameScene;
        if (!current?.scene?.isActive() || gameSession.day !== "day02") return;
        if (current.shiftEnded || (current.phase !== "OPEN" && current.phase !== "RUSH")) return;
        if (current.__promotionWingVisited || this.scene.isActive("promotion-wing")) return;

        current.showPhaseBanner("STORE EXPANDED · ROOM 2 OPEN");
        current.showTransientHint(
          "Day 2 adds a second playable room. You can switch between the Main Store and Promotion Wing at any time."
        );
        this.openWing(true);
      });
    }
  }

  private createPanel(): void {
    const portrait = window.innerWidth < 760 && window.innerHeight > window.innerWidth;
    const panelWidth = portrait ? 1020 : 920;
    const panelHeight = portrait ? 116 : 98;
    const y = portrait ? 205 : 178;

    const background = this.add.rectangle(665, y, panelWidth, panelHeight, 0x081416, 0.985)
      .setStrokeStyle(4, 0x6d888b, 0.96);
    const eyebrow = this.add.text(225, y - 25, "STORE EXPANDED", {
      fontFamily: "Arial",
      fontSize: portrait ? "18px" : "15px",
      color: "#ffd75a",
      fontStyle: "bold",
      letterSpacing: 2
    }).setOrigin(0.5);
    this.statusText = this.add.text(225, y + 19, "2 PLAYABLE ROOMS", {
      fontFamily: "Arial",
      fontSize: portrait ? "23px" : "19px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5);

    this.mainButton = this.createRoomButton(545, y, portrait ? 300 : 270, panelHeight - 22, "ROOM 1/2", "MAIN STORE");
    this.wingButton = this.createRoomButton(895, y, portrait ? 360 : 330, panelHeight - 22, "ROOM 2/2", "PROMOTION WING");

    this.mainButton.hit.on("pointerdown", () => this.openMainStore());
    this.wingButton.hit.on("pointerdown", () => this.openWing(false));

    this.panel = this.add.container(0, 0, [
      background,
      eyebrow,
      this.statusText,
      this.mainButton.container,
      this.wingButton.container
    ]).setDepth(2000);
  }

  private createRoomButton(
    x: number,
    y: number,
    width: number,
    height: number,
    eyebrow: string,
    label: string
  ): RoomButton {
    const background = this.add.rectangle(0, 0, width, height, 0x20373b, 1)
      .setStrokeStyle(3, 0x70898d, 1);
    const title = this.add.text(0, -18, eyebrow, {
      fontFamily: "Arial",
      fontSize: "13px",
      color: "#a9c1c4",
      fontStyle: "bold",
      letterSpacing: 1
    }).setOrigin(0.5);
    const subtitle = this.add.text(0, 18, label, {
      fontFamily: "Arial",
      fontSize: "22px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5);
    const hit = this.add.rectangle(0, 0, width + 18, height + 14, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });
    const container = this.add.container(x, y, [background, title, subtitle, hit]);

    hit.on("pointerover", () => container.setScale(1.025));
    hit.on("pointerout", () => container.setScale(1));
    hit.on("pointerdown", () => container.setScale(0.98));
    return { container, background, title, subtitle, hit };
  }

  private refreshButtons(wingActive: boolean, open: boolean): void {
    if (!this.mainButton || !this.wingButton || !this.statusText) return;

    setButtonState(this.mainButton, !wingActive, true, "MAIN STORE");
    setButtonState(
      this.wingButton,
      wingActive,
      open || wingActive,
      open || wingActive ? "PROMOTION WING" : "PROMOTION WING · CLOSED"
    );

    this.statusText
      .setText(wingActive ? "CURRENT ROOM · 2/2" : "CURRENT ROOM · 1/2")
      .setColor(wingActive ? "#ffe39a" : "#ffffff");
  }

  private openMainStore(): void {
    if (!this.scene.isActive("promotion-wing")) return;
    this.scene.stop("promotion-wing");
    this.time.delayedCall(30, () => this.scene.bringToTop("day2-room-nav"));
  }

  private openWing(automatic: boolean): void {
    const game = this.gameScene;
    if (!game || this.scene.isActive("promotion-wing")) return;

    const open = !game.shiftEnded && (game.phase === "OPEN" || game.phase === "RUSH");
    if (!open) {
      if (!automatic) game.showTransientHint("The Promotion Wing opens during trading and closes with the store.");
      return;
    }

    game.__promotionWingVisited = true;
    this.scene.launch("promotion-wing");
    this.scene.bringToTop("promotion-wing");
    this.time.delayedCall(30, () => this.scene.bringToTop("day2-room-nav"));
  }

  private setPanelVisible(visible: boolean): void {
    if (!this.panel || this.lastVisible === visible) return;
    this.lastVisible = visible;
    this.panel.setVisible(visible);

    [this.mainButton, this.wingButton].forEach((button) => {
      if (!button) return;
      if (visible) button.hit.setInteractive({ useHandCursor: true });
      else button.hit.disableInteractive();
    });
  }
}

function setButtonState(
  button: RoomButton,
  selected: boolean,
  enabled: boolean,
  label: string
): void {
  button.background
    .setFillStyle(selected ? 0x315f7d : enabled ? 0x20373b : 0x222d2f, 1)
    .setStrokeStyle(3, selected ? 0xffd75a : enabled ? 0x70898d : 0x465357, enabled ? 1 : 0.7);
  button.title.setColor(selected ? "#ffe49a" : enabled ? "#a9c1c4" : "#718083");
  button.subtitle.setText(label).setColor(enabled ? "#ffffff" : "#829093");
  button.hit.input!.enabled = enabled;
}
