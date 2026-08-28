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
    const registeredSession = scene.game.registry.get("campaignSession") as CampaignSession | undefined;
    const campaignSession = config.campaignSession ?? registeredSession;
    const hasUpgradeShop = Boolean(campaignSession);
    const compactMobile = document.body.dataset.mobileLandscape === "required";
    const finalScaleX = compactMobile ? 0.9 : 1;
    const finalScaleY = compactMobile ? 0.82 : 1;

    const cardTop = hasUpgradeShop ? -306 : -216;
    const cardHeight = hasUpgradeShop ? 612 : 474;
    const statusY = hasUpgradeShop ? -254 : -164;
    const titleY = hasUpgradeShop ? -194 : -104;
    const starsY = hasUpgradeShop ? -142 : -52;
    const rewardY = hasUpgradeShop ? -90 : 3;
    const previewPanelY = hasUpgradeShop ? -46 : 45;
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
    card.fillRoundedRect(-348, cardTop, 696, 82, { tl: 36, tr: 36, bl: 0, br: 0 });
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
    const stars = [-72, 0, 72].map((x, index) => scene.add.text(
      x,
      starsY + Math.abs(index - 1) * 5,
      "★",
      {
        fontFamily: "Arial",
        fontSize: index === 1 ? "34px" : "29px",
        color: `#${config.accentColor.toString(16).padStart(6, "0")}`,
        stroke: "#b98118",
        strokeThickness: 3
      }
    ).setOrigin(0.5));
    const reward = scene.add.text(0, rewardY, config.rewardLabel, {
      fontFamily: "Arial",
      fontSize: "17px",
      color: "#28563d",
      fontStyle: "bold",
      align: "center",
      lineSpacing: 4,
      wordWrap: { width: 510 }
    }).setOrigin(0.5);

    const previewEyebrow = scene.add.text(0, previewPanelY + 17, preview.eyebrow, {
      fontFamily: "Arial",
      fontSize: "13px",
      color: "#ffd95e",
      fontStyle: "bold",
      letterSpacing: 2
    }).setOrigin(0.5);
    const previewTitle = scene.add.text(0, previewPanelY + 43, preview.title, {
      fontFamily: "Arial",
      fontSize: "23px",
      color: "#ffffff",
      fontStyle: "bold",
      align: "center"
    }).setOrigin(0.5);
    const previewDetail = scene.add.text(0, previewPanelY + 70, preview.detail, {
      fontFamily: "Arial",
      fontSize: "12px",
      color: "#b8d9c4",
      fontStyle: "bold",
      align: "center",
      wordWrap: { width: 500 }
    }).setOrigin(0.5);

    const upgradePanel = campaignSession
      ? new CampaignUpgradePanel(scene, {
          x: 0,
          y: 132,
          width: 600,
          panelColor: config.panelColor,
          accentColor: config.accentColor,
          session: campaignSession
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
      .setStrokeStyle(4, 0x195a38, 1);
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
    // Keep one generous hit surface above every visual child. This avoids
    // mobile edge misses on the arrow/right half after canvas fitting or the
    // portrait-to-landscape coordinate transform.
    const buttonHit = scene.add.rectangle(0, 0, 460, 120, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true })
      .setName("completion-primary-action-hit");
    const buttonContainer = scene.add.container(0, buttonY, [
      buttonGlow,
      button,
      buttonHighlight,
      buttonLabel,
      buttonArrow,
      buttonHit
    ])
      .setSize(460, 120)
      .setInteractive({ useHandCursor: true })
      .setName("completion-primary-action");

    buttonHit.on("pointerover", () => buttonContainer.setScale(1.045));
    buttonHit.on("pointerout", () => buttonContainer.setScale(1));
    buttonHit.on("pointerdown", () => this.continueOnce());
    buttonContainer.on("pointerdown", () => this.continueOnce());

    this.container = scene.add.container(config.centreX, config.centreY, [
      shade,
      cardShadow,
      card,
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
    ])
      .setDepth(180)
      .setAlpha(0)
      .setScale(finalScaleX * 0.84, finalScaleY * 0.84);

    scene.tweens.add({
      targets: this.container,
      alpha: 1,
      scaleX: finalScaleX,
      scaleY: finalScaleY,
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
  }

  private continueOnce(): void {
    if (this.handled) return;
    this.handled = true;
    this.onContinue();
  }
}
