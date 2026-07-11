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
  private unlockCard?: Phaser.GameObjects.Container;
  private lastWingActive = false;
  private lastVisible = false;
  private lastTopRefreshAt = -Infinity;

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
      game.phase !== "PREPARE" &&
      !gameSession.isPaused;

    if (!relevant) {
      this.gameScene = undefined;
      this.lastWingActive = false;
      this.setPanelVisible(false);
      return;
    }

    this.gameScene = game;
    const wingActive = this.scene.isActive("promotion-wing");
    const open = !game.shiftEnded && (game.phase === "OPEN" || game.phase === "RUSH");

    const becameVisible = !this.lastVisible;
    this.setPanelVisible(true);
    this.refreshButtons(wingActive, open);

    if (
      becameVisible ||
      wingActive !== this.lastWingActive ||
      this.time.now - this.lastTopRefreshAt >= 250
    ) {
      this.scene.bringToTop("day2-room-nav");
      this.lastTopRefreshAt = this.time.now;
    }
    this.lastWingActive = wingActive;

    if (open && !game.__promotionWingVisited && !game.__promotionWingAutoQueued) {
      game.__promotionWingAutoQueued = true;
      this.time.delayedCall(700, () => {
        const current = this.gameScene;
        if (!current?.scene?.isActive() || gameSession.day !== "day02") return;
        if (current.shiftEnded || (current.phase !== "OPEN" && current.phase !== "RUSH")) return;
        if (current.__promotionWingVisited || this.scene.isActive("promotion-wing")) return;
        this.showUnlockAndEnter();
      });
    }
  }

  private createPanel(): void {
    const portrait = window.innerWidth < 760 && window.innerHeight > window.innerWidth;
    const panelWidth = portrait ? 1040 : 940;
    const panelHeight = portrait ? 124 : 100;
    const y = portrait ? 210 : 180;

    const background = this.add.rectangle(665, y, panelWidth, panelHeight, 0x081416, 0.985)
      .setStrokeStyle(4, 0x6d888b, 0.96);
    const eyebrow = this.add.text(220, y - 27, "STORE EXPANDED", {
      fontFamily: "Arial",
      fontSize: portrait ? "19px" : "15px",
      color: "#ffd75a",
      fontStyle: "bold",
      letterSpacing: 2
    }).setOrigin(0.5);
    this.statusText = this.add.text(220, y + 22, "2 PLAYABLE ROOMS", {
      fontFamily: "Arial",
      fontSize: portrait ? "24px" : "19px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5);

    this.mainButton = this.createRoomButton(
      540,
      y,
      portrait ? 310 : 275,
      panelHeight - 22,
      "ROOM 1/2",
      "MAIN STORE"
    );
    this.wingButton = this.createRoomButton(
      905,
      y,
      portrait ? 385 : 345,
      panelHeight - 22,
      "ROOM 2/2",
      "PROMOTION WING"
    );

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
    const title = this.add.text(0, -19, eyebrow, {
      fontFamily: "Arial",
      fontSize: "13px",
      color: "#a9c1c4",
      fontStyle: "bold",
      letterSpacing: 1
    }).setOrigin(0.5);
    const subtitle = this.add.text(0, 19, label, {
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

  private showUnlockAndEnter(): void {
    const game = this.gameScene;
    if (!game || this.unlockCard?.active) return;

    game.showPhaseBanner("STORE EXPANDED · ROOM 2 OPEN");

    const shade = this.add.rectangle(665, 591, 1330, 1182, 0x061012, 0.78)
      .setInteractive();
    const panel = this.add.rectangle(665, 560, 950, 470, 0x10272a, 0.99)
      .setStrokeStyle(7, 0xffd75a);
    const eyebrow = this.add.text(665, 410, "DAY 2 · SPACE EXPANSION", {
      fontFamily: "Arial",
      fontSize: "23px",
      color: "#ffd75a",
      fontStyle: "bold",
      letterSpacing: 3
    }).setOrigin(0.5);
    const title = this.add.text(665, 495, "NEW ROOM UNLOCKED", {
      fontFamily: "Arial",
      fontSize: "48px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5);
    const room = this.add.text(665, 575, "ROOM 2/2 · PROMOTION WING", {
      fontFamily: "Arial",
      fontSize: "31px",
      color: "#ffe59b",
      fontStyle: "bold"
    }).setOrigin(0.5);
    const subtitle = this.add.text(665, 660, "A separate sales floor with its own displays, customers and stock pressure", {
      fontFamily: "Arial",
      fontSize: "21px",
      color: "#d9e9e6",
      align: "center",
      wordWrap: { width: 780 }
    }).setOrigin(0.5);

    this.unlockCard = this.add.container(0, 0, [shade, panel, eyebrow, title, room, subtitle])
      .setDepth(3000)
      .setAlpha(0)
      .setScale(0.94);

    this.tweens.add({
      targets: this.unlockCard,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 220,
      ease: "Back.Out",
      onComplete: () => {
        this.time.delayedCall(1050, () => {
          const card = this.unlockCard;
          this.unlockCard = undefined;
          this.tweens.add({
            targets: card,
            alpha: 0,
            duration: 180,
            ease: "Cubic.In",
            onComplete: () => {
              card?.destroy(true);
              this.openWing(true);
            }
          });
        });
      }
    });
  }

  private openMainStore(): void {
    if (!this.scene.isActive("promotion-wing")) return;
    this.scene.stop("promotion-wing");
    this.time.delayedCall(40, () => this.scene.bringToTop("day2-room-nav"));
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
    this.time.delayedCall(40, () => this.scene.bringToTop("day2-room-nav"));
  }

  private setPanelVisible(visible: boolean): void {
    if (!this.panel) return;
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
  if (button.hit.input) button.hit.input.enabled = enabled;
}
