import Phaser from "phaser";
import {
  resolveCampaignProgressionPreview,
  type CampaignProgressionPreview
} from "./CampaignProgressionPreview";

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
  readonly currentLevelId?: string;
  readonly progressionPreview?: CampaignProgressionPreview;
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
    const preview = config.progressionPreview ?? resolveCampaignProgressionPreview(
      config.currentLevelId ?? document.body.dataset.activeLevel
    );

    const shade = scene.add.rectangle(
      config.worldWidth / 2 - config.centreX,
      config.worldHeight / 2 - config.centreY,
      config.worldWidth,
      config.worldHeight,
      0x10221b,
      0.58
    );

    const cardShadow = scene.add.graphics();
    cardShadow.fillStyle(0x10251d, 0.38);
    cardShadow.fillRoundedRect(-338, -202, 696, 430, 36);

    const card = scene.add.graphics();
    card.fillStyle(0xfffbef, 1);
    card.fillRoundedRect(-348, -216, 696, 430, 36);
    card.lineStyle(6, 0x2f8a58, 1);
    card.strokeRoundedRect(-348, -216, 696, 430, 36);
    card.fillStyle(0x2f8a58, 1);
    card.fillRoundedRect(-348, -216, 696, 82, {
      tl: 36,
      tr: 36,
      bl: 0,
      br: 0
    });
    card.fillStyle(0xe7f3e8, 1);
    card.fillRoundedRect(-268, -24, 536, 54, 18);
    card.fillStyle(config.panelColor, 0.96);
    card.fillRoundedRect(-280, 45, 560, 92, 22);
    card.lineStyle(3, config.accentColor, 0.72);
    card.strokeRoundedRect(-280, 45, 560, 92, 22);

    const badgeShadow = scene.add.circle(0, -214, 58, 0x173b2a, 0.32);
    const badge = scene.add.circle(0, -224, 55, config.accentColor, 1)
      .setStrokeStyle(6, 0xfff3bf, 1);
    const badgeStar = scene.add.text(0, -226, "★", {
      fontFamily: "Arial",
      fontSize: "58px",
      color: "#ffffff",
      fontStyle: "bold",
      stroke: "#b98118",
      strokeThickness: 5
    }).setOrigin(0.5);

    const status = scene.add.text(0, -164, config.statusLabel, {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#ffffff",
      fontStyle: "bold",
      letterSpacing: 3
    }).setOrigin(0.5);

    const title = scene.add.text(0, -104, config.levelTitle, {
      fontFamily: "Arial",
      fontSize: "35px",
      color: "#173b2a",
      fontStyle: "bold",
      align: "center",
      wordWrap: { width: 610 }
    }).setOrigin(0.5);

    const stars = [-72, 0, 72].map((x, index) => scene.add.text(x, -52 + Math.abs(index - 1) * 5, "★", {
      fontFamily: "Arial",
      fontSize: index === 1 ? "34px" : "29px",
      color: `#${config.accentColor.toString(16).padStart(6, "0")}`,
      stroke: "#b98118",
      strokeThickness: 3
    }).setOrigin(0.5));

    const reward = scene.add.text(0, 3, config.rewardLabel, {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#28563d",
      fontStyle: "bold",
      align: "center",
      lineSpacing: 5,
      wordWrap: { width: 510 }
    }).setOrigin(0.5);

    const previewEyebrow = scene.add.text(0, 62, preview.eyebrow, {
      fontFamily: "Arial",
      fontSize: "13px",
      color: "#ffd95e",
      fontStyle: "bold",
      letterSpacing: 2
    }).setOrigin(0.5);
    const previewTitle = scene.add.text(0, 88, preview.title, {
      fontFamily: "Arial",
      fontSize: "23px",
      color: "#ffffff",
      fontStyle: "bold",
      align: "center"
    }).setOrigin(0.5);
    const previewDetail = scene.add.text(0, 115, preview.detail, {
      fontFamily: "Arial",
      fontSize: "12px",
      color: "#b8d9c4",
      fontStyle: "bold",
      align: "center",
      wordWrap: { width: 500 }
    }).setOrigin(0.5);

    const button = scene.add.rectangle(0, 0, 330, 64, 0x2f8a58, 1)
      .setStrokeStyle(4, 0x195a38, 1)
      .setInteractive({ useHandCursor: true });
    const buttonHighlight = scene.add.rectangle(0, -21, 292, 8, 0x8bd29f, 0.48);
    const buttonLabel = scene.add.text(0, 0, config.actionLabel, {
      fontFamily: "Arial",
      fontSize: "21px",
      color: "#ffffff",
      fontStyle: "bold",
      letterSpacing: 1
    }).setOrigin(0.5);
    const buttonContainer = scene.add.container(0, 174, [button, buttonHighlight, buttonLabel]);

    const confetti = [
      { x: -292, y: -136, angle: -18, color: config.accentColor },
      { x: -307, y: -54, angle: 24, color: 0x62c77d },
      { x: -296, y: 116, angle: -30, color: 0x67d7e5 },
      { x: 292, y: -132, angle: 22, color: 0x67d7e5 },
      { x: 307, y: -48, angle: -20, color: config.accentColor },
      { x: 296, y: 118, angle: 34, color: 0x62c77d }
    ].map((entry) => scene.add.rectangle(entry.x, entry.y, 13, 31, entry.color, 1).setAngle(entry.angle));

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
      ...stars,
      reward,
      previewEyebrow,
      previewTitle,
      previewDetail,
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
      targets: [previewEyebrow, previewTitle, previewDetail, buttonContainer],
      alpha: { from: 0, to: 1 },
      y: "+=8",
      delay: scene.tweens.stagger(55, { start: 300 }),
      duration: 260,
      ease: "Sine.Out"
    });
  }

  private continueOnce(): void {
    if (this.handled) return;
    this.handled = true;
    this.onContinue();
  }
}
