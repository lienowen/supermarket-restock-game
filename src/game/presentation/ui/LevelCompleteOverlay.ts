import Phaser from "phaser";
import type { CampaignSession } from "../../application/CampaignSession";
import { CampaignUpgradePanel } from "./CampaignUpgradePanel";
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
  readonly campaignSession?: CampaignSession;
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
    const hasUpgradeShop = Boolean(config.campaignSession);
    const cardTop = hasUpgradeShop ? -306 : -216;
    const cardHeight = hasUpgradeShop ? 612 : 474;
    const statusY = hasUpgradeShop ? -254 : -164;
    const titleY = hasUpgradeShop ? -194 : -104;
    const starsY = hasUpgradeShop ? -142 : -52;
    const rewardY = hasUpgradeShop ? -90 : 3;
    const previewPanelY = hasUpgradeShop ? -46 : 45;
    const previewEyebrowY = previewPanelY + 17;
    const previewTitleY = previewPanelY + 43;
    const previewDetailY = previewPanelY + 70;
    const progressY = hasUpgradeShop ? 230 : 166;
    const buttonY = hasUpgradeShop ? 282 : 218;

    const shade = scene.add.rectangle(
      config.worldWidth / 2 - config.centreX,
      config.worldHeight / 2 - config.centreY,
      config.worldWidth,
      config.worldHeight,
      0x10221b,
      0.62
    );

    const cardShadow = scene.add.graphics();
    cardShadow.fillStyle(0x10251d, 0.38);
    cardShadow.fillRoundedRect(-338, cardTop + 14, 696, cardHeight + 12, 36);

    const card = scene.add.graphics();
    card.fillStyle(0xfffbef, 1);
    card.fillRoundedRect(-348, cardTop, 696, cardHeight, 36);
    card.lineStyle(6, 0x2f8a58, 1);
    card.strokeRoundedRect(-348, cardTop, 696, cardHeight, 36);
    card.fillStyle(0x2f8a58, 1);
    card.fillRoundedRect(-348, cardTop, 696, 82, {
      tl: 36,
      tr: 36,
      bl: 0,
      br: 0
    });
    card.fillStyle(0xe7f3e8, 1);
    card.fillRoundedRect(-268, rewardY - 27, 536, 54, 18);
    card.fillStyle(config.panelColor, 0.96);
    card.fillRoundedRect(-280, previewPanelY, 560, 92, 22);
    card.lineStyle(3, config.accentColor, 0.72);
    card.strokeRoundedRect(-280, previewPanelY, 560, 92, 22);

    const badgeY = cardTop + 2;
    const badgeShadow = scene.add.circle(0, badgeY + 10, 58, 0x173b2a, 0.32);
    const badge = scene.add.circle(0, badgeY, 55, config.accentColor, 1)
      .setStrokeStyle(6, 0xfff3bf, 1);
    const badgeStar = scene.add.text(0, badgeY - 2, "★", {
      fontFamily: "Arial",
      fontSize: "58px",
      color: "#ffffff",
      fontStyle: "bold",
      stroke: "#b98118",
      strokeThickness: 5
    }).setOrigin(0.5);

    const status = scene.add.text(0, statusY, config.statusLabel, {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#ffffff",
      fontStyle: "bold",
      letterSpacing: 3
    }).setOrigin(0.5);

    const title = scene.add.text(0, titleY, config.levelTitle, {
      fontFamily: "Arial",
      fontSize: "35px",
      color: "#173b2a",
      fontStyle: "bold",
      align: "center",
      wordWrap: { width: 610 }
    }).setOrigin(0.5);

    const stars = [-72, 0, 72].map((x, index) => scene.add.text(x, starsY + Math.abs(index - 1) * 5, "★", {
      fontFamily: "Arial",
      fontSize: index === 1 ? "34px" : "29px",
      color: `#${config.accentColor.toString(16).padStart(6, "0")}`,
      stroke: "#b98118",
      strokeThickness: 3
    }).setOrigin(0.5));

    const reward = scene.add.text(0, rewardY, config.rewardLabel, {
      fontFamily: "Arial",
      fontSize: "17px",
      color: "#28563d",
      fontStyle: "bold",
      align: "center",
      lineSpacing: 4,
      wordWrap: { width: 510 }
    }).setOrigin(0.5);

    const previewEyebrow = scene.add.text(0, previewEyebrowY, preview.eyebrow, {
      fontFamily: "Arial",
      fontSize: "13px",
      color: "#ffd95e",
      fontStyle: "bold",
      letterSpacing: 2
    }).setOrigin(0.5);
    const previewTitle = scene.add.text(0, previewTitleY, preview.title, {
      fontFamily: "Arial",
      fontSize: "23px",
      color: "#ffffff",
      fontStyle: "bold",
      align: "center"
    }).setOrigin(0.5);
    const previewDetail = scene.add.text(0, previewDetailY, preview.detail, {
      fontFamily: "Arial",
      fontSize: "12px",
      color: "#b8d9c4",
      fontStyle: "bold",
      align: "center",
      wordWrap: { width: 500 }
    }).setOrigin(0.5);

    const upgradePanel = config.campaignSession
      ? new CampaignUpgradePanel(scene, {
          x: 0,
          y: 132,
          width: 600,
          panelColor: config.panelColor,
          accentColor: config.accentColor,
          session: config.campaignSession
        })
      : undefined;

    const progressLabel = scene.add.text(
      -280,
      progressY,
      `SHIFT PROGRESS  ${preview.currentLevelNumber}/${preview.totalLevels}`,
      {
        fontFamily: "Arial",
        fontSize: "12px",
        color: "#52705f",
        fontStyle: "bold",
        letterSpacing: 1
      }
    ).setOrigin(0, 0.5);

    const progressDots = Array.from({ length: preview.totalLevels }, (_, index) => {
      const completed = index < preview.currentLevelNumber;
      const dot = scene.add.circle(
        126 + index * 31,
        progressY,
        completed ? 8 : 6,
        completed ? config.accentColor : 0xb5c7bb,
        completed ? 1 : 0.72
      ).setName(`completion-progress-dot-${index + 1}`);
      if (completed) dot.setStrokeStyle(2, 0xb98118, 0.75);
      return dot;
    });

    const buttonGlow = scene.add.rectangle(0, 0, 348, 78, 0x9ee0ae, 0.12);
    const button = scene.add.rectangle(0, 0, 330, 64, 0x2f8a58, 1)
      .setStrokeStyle(4, 0x195a38, 1)
      .setInteractive({ useHandCursor: true });
    const buttonHighlight = scene.add.rectangle(0, -21, 292, 8, 0x8bd29f, 0.48);
    const buttonLabel = scene.add.text(-10, 0, config.actionLabel, {
      fontFamily: "Arial",
      fontSize: "21px",
      color: "#ffffff",
      fontStyle: "bold",
      letterSpacing: 1
    }).setOrigin(0.5);
    const buttonArrow = scene.add.text(126, -1, "›", {
      fontFamily: "Arial",
      fontSize: "34px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5);
    const buttonContainer = scene.add.container(0, buttonY, [
      buttonGlow,
      button,
      buttonHighlight,
      buttonLabel,
      buttonArrow
    ]).setName("completion-primary-action");

    const confetti = [
      { x: -292, y: statusY + 28, angle: -18, color: config.accentColor },
      { x: -307, y: rewardY - 4, angle: 24, color: 0x62c77d },
      { x: -296, y: progressY - 48, angle: -30, color: 0x67d7e5 },
      { x: 292, y: statusY + 32, angle: 22, color: 0x67d7e5 },
      { x: 307, y: rewardY + 2, angle: -20, color: config.accentColor },
      { x: 296, y: progressY - 46, angle: 34, color: 0x62c77d }
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
      ...(upgradePanel ? [upgradePanel.container] : []),
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
      targets: [previewEyebrow, previewTitle, previewDetail],
      alpha: { from: 0, to: 1 },
      y: "+=8",
      delay: scene.tweens.stagger(45, { start: 260 }),
      duration: 240,
      ease: "Sine.Out"
    });
    if (upgradePanel) {
      scene.tweens.add({
        targets: upgradePanel.container,
        alpha: { from: 0, to: 1 },
        y: { from: 148, to: 132 },
        delay: 320,
        duration: 260,
        ease: "Sine.Out"
      });
    }
    scene.tweens.add({
      targets: buttonGlow,
      alpha: { from: 0.06, to: 0.24 },
      scaleX: { from: 0.98, to: 1.08 },
      scaleY: { from: 0.92, to: 1.08 },
      yoyo: true,
      repeat: -1,
      delay: 900,
      duration: 820,
      ease: "Sine.InOut"
    });
    scene.tweens.add({
      targets: buttonArrow,
      x: { from: 122, to: 130 },
      yoyo: true,
      repeat: -1,
      delay: 900,
      duration: 620,
      ease: "Sine.InOut"
    });
  }

  private continueOnce(): void {
    if (this.handled) return;
    this.handled = true;
    this.onContinue();
  }
}
