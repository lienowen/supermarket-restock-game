import Phaser from "phaser";
import { MAIN_LEVEL_CAMPAIGN_RUNTIME } from "../context/StarterMarketPresentationContext";
import { resolveLevelProgressionPreview } from "./LevelProgressionPreview";

export interface LevelCompleteOverlayConfig {
  readonly worldWidth: number;
  readonly worldHeight: number;
  readonly centreX: number;
  readonly centreY: number;
  readonly statusLabel: string;
  readonly levelTitle: string;
  readonly rewardLabel: string;
  readonly actionLabel: string;
  readonly panelColor: number;
  readonly accentColor: number;
}

export class LevelCompleteOverlay {
  private timer?: Phaser.Time.TimerEvent;
  private container?: Phaser.GameObjects.Container;
  private handled = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: LevelCompleteOverlayConfig,
    private readonly onContinue: () => void
  ) {}

  show(delayMs = 180): void {
    if (this.timer || this.container) return;
    this.timer = this.scene.time.delayedCall(delayMs, () => this.create());
  }

  destroy(): void {
    this.timer?.remove(false);
    this.timer = undefined;
    this.container?.destroy(true);
    this.container = undefined;
  }

  private create(): void {
    if (this.container) return;
    const { scene, config } = this;
    const activeLevelId = document.body.dataset.activeLevel?.trim() ?? "";
    const preview = resolveLevelProgressionPreview(
      activeLevelId,
      MAIN_LEVEL_CAMPAIGN_RUNTIME.levels
    );

    const shade = scene.add.rectangle(
      0,
      0,
      config.worldWidth,
      config.worldHeight,
      0x07120e,
      0.66
    );

    const cardShadow = scene.add.graphics();
    cardShadow.fillStyle(0x020806, 0.5);
    cardShadow.fillRoundedRect(-368, -218, 760, 474, 38);

    const card = scene.add.graphics();
    card.fillStyle(0xfffbef, 1);
    card.fillRoundedRect(-380, -232, 760, 474, 38);
    card.lineStyle(5, 0x2f8a58, 1);
    card.strokeRoundedRect(-380, -232, 760, 474, 38);
    card.fillStyle(config.panelColor, 1);
    card.fillRoundedRect(-380, -232, 760, 82, {
      tl: 38,
      tr: 38,
      bl: 0,
      br: 0
    });
    card.fillStyle(0x2f8a58, 1);
    card.fillRoundedRect(-380, -158, 760, 8, 4);

    const badgeShadow = scene.add.circle(0, -228, 55, 0x020806, 0.42);
    const badge = scene.add.circle(0, -238, 52, config.accentColor, 1)
      .setStrokeStyle(6, 0xfff3bf, 1);
    const badgeStar = scene.add.text(0, -240, "★", {
      fontFamily: "Arial",
      fontSize: "54px",
      color: "#ffffff",
      fontStyle: "bold",
      stroke: "#9f6810",
      strokeThickness: 5
    }).setOrigin(0.5);

    const status = scene.add.text(0, -185, config.statusLabel, {
      fontFamily: "Arial",
      fontSize: "17px",
      color: "#ffffff",
      fontStyle: "bold",
      letterSpacing: 3
    }).setOrigin(0.5);

    const title = scene.add.text(0, -117, config.levelTitle, {
      fontFamily: "Arial",
      fontSize: "34px",
      color: "#173b2a",
      fontStyle: "bold",
      align: "center",
      wordWrap: { width: 650 }
    }).setOrigin(0.5);

    const rewardPanel = scene.add.graphics();
    rewardPanel.fillStyle(0xe6f3e8, 1);
    rewardPanel.fillRoundedRect(-315, -82, 630, 58, 18);
    rewardPanel.lineStyle(2, 0x9bc5a6, 0.65);
    rewardPanel.strokeRoundedRect(-315, -82, 630, 58, 18);

    const stars = [-76, 0, 76].map((x, index) => scene.add.text(
      x - 218,
      -53 + Math.abs(index - 1) * 4,
      "★",
      {
        fontFamily: "Arial",
        fontSize: index === 1 ? "27px" : "23px",
        color: `#${config.accentColor.toString(16).padStart(6, "0")}`,
        stroke: "#9f6810",
        strokeThickness: 2
      }
    ).setOrigin(0.5));

    const reward = scene.add.text(58, -53, config.rewardLabel, {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#28563d",
      fontStyle: "bold",
      align: "center",
      lineSpacing: 5,
      wordWrap: { width: 440 }
    }).setOrigin(0.5);

    const nextPanel = scene.add.graphics();
    nextPanel.fillStyle(config.panelColor, 0.97);
    nextPanel.fillRoundedRect(-330, -4, 660, 136, 24);
    nextPanel.lineStyle(3, 0x56894d, 0.72);
    nextPanel.strokeRoundedRect(-330, -4, 660, 136, 24);
    nextPanel.fillStyle(config.accentColor, 0.12);
    nextPanel.fillRoundedRect(-318, 8, 128, 34, 13);

    const nextEyebrow = scene.add.text(-254, 25, preview.eyebrow, {
      fontFamily: "Arial",
      fontSize: "12px",
      color: "#ffe59b",
      fontStyle: "bold",
      letterSpacing: 2
    }).setOrigin(0.5);

    const modeChip = scene.add.text(252, 25, preview.modeLabel, {
      fontFamily: "Arial",
      fontSize: "12px",
      color: "#dff4e5",
      fontStyle: "bold",
      backgroundColor: "#315f38",
      padding: { x: 13, y: 7 }
    }).setOrigin(0.5);

    const nextTitle = scene.add.text(-300, 61, preview.title, {
      fontFamily: "Arial",
      fontSize: "25px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0, 0.5);

    const nextDescription = scene.add.text(-300, 99, preview.description, {
      fontFamily: "Arial",
      fontSize: "15px",
      color: "#cfe4d5",
      lineSpacing: 4,
      wordWrap: { width: 585 }
    }).setOrigin(0, 0.5);

    const progressLabel = scene.add.text(-315, 158, `SHIFT PROGRESS  ${preview.currentLevelNumber}/${preview.totalLevels}`, {
      fontFamily: "Arial",
      fontSize: "12px",
      color: "#52705f",
      fontStyle: "bold",
      letterSpacing: 1
    }).setOrigin(0, 0.5);

    const progressDots = Array.from({ length: preview.totalLevels }, (_, index) => {
      const completed = index < preview.currentLevelNumber;
      const dot = scene.add.circle(
        112 + index * 34,
        158,
        completed ? 8 : 6,
        completed ? config.accentColor : 0xb5c7bb,
        completed ? 1 : 0.72
      );
      if (completed) dot.setStrokeStyle(2, 0xb98118, 0.75);
      return dot;
    });

    const button = scene.add.rectangle(0, 0, 330, 64, 0x2f8a58, 1)
      .setStrokeStyle(4, 0x195a38, 1)
      .setInteractive({ useHandCursor: true });
    const buttonHighlight = scene.add.rectangle(0, -21, 294, 8, 0x9ee0ae, 0.5);
    const buttonLabel = scene.add.text(0, -1, config.actionLabel, {
      fontFamily: "Arial",
      fontSize: "21px",
      color: "#ffffff",
      fontStyle: "bold",
      letterSpacing: 1
    }).setOrigin(0.5);
    const buttonArrow = scene.add.text(125, -1, "›", {
      fontFamily: "Arial",
      fontSize: "34px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5);
    const buttonContainer = scene.add.container(0, 207, [
      button,
      buttonHighlight,
      buttonLabel,
      buttonArrow
    ]);

    const confetti = [
      { x: -330, y: -154, angle: -18, color: config.accentColor },
      { x: -346, y: -78, angle: 24, color: 0x62c77d },
      { x: 330, y: -150, angle: 22, color: 0x67d7e5 },
      { x: 346, y: -70, angle: -20, color: config.accentColor }
    ].map((entry) => scene.add.rectangle(
      entry.x,
      entry.y,
      12,
      28,
      entry.color,
      1
    ).setAngle(entry.angle));

    button.on("pointerover", () => buttonContainer.setScale(1.045));
    button.on("pointerout", () => buttonContainer.setScale(1));
    button.on("pointerdown", () => this.continueOnce());

    this.container = scene.add.container(config.centreX, config.centreY, [
      shade,
      cardShadow,
      card,
      ...confetti,
      badgeShadow,
      badge,
      badgeStar,
      status,
      title,
      rewardPanel,
      ...stars,
      reward,
      nextPanel,
      nextEyebrow,
      modeChip,
      nextTitle,
      nextDescription,
      progressLabel,
      ...progressDots,
      buttonContainer
    ]).setDepth(180).setAlpha(0).setScale(0.84);

    scene.tweens.add({
      targets: this.container,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 360,
      ease: "Back.Out"
    });
    scene.tweens.add({
      targets: [badge, badgeShadow, badgeStar],
      scaleX: { from: 0.3, to: 1 },
      scaleY: { from: 0.3, to: 1 },
      angle: { from: -14, to: 0 },
      delay: 120,
      duration: 420,
      ease: "Back.Out"
    });
    scene.tweens.add({
      targets: stars,
      scaleX: { from: 0, to: 1 },
      scaleY: { from: 0, to: 1 },
      delay: scene.tweens.stagger(85, { start: 210 }),
      duration: 260,
      ease: "Back.Out"
    });
    scene.tweens.add({
      targets: buttonContainer,
      scaleX: 1.025,
      scaleY: 1.025,
      yoyo: true,
      repeat: -1,
      duration: 760,
      delay: 650,
      ease: "Sine.InOut"
    });
  }

  private continueOnce(): void {
    if (this.handled) return;
    this.handled = true;
    this.onContinue();
  }
}
