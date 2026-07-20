import Phaser from "phaser";

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

    const shade = scene.add.rectangle(
      0,
      0,
      config.worldWidth,
      config.worldHeight,
      0x10221b,
      0.48
    );

    const cardShadow = scene.add.graphics();
    cardShadow.fillStyle(0x10251d, 0.34);
    cardShadow.fillRoundedRect(-318, -154, 656, 340, 34);

    const card = scene.add.graphics();
    card.fillStyle(0xfffbef, 1);
    card.fillRoundedRect(-328, -168, 656, 340, 34);
    card.lineStyle(6, 0x2f8a58, 1);
    card.strokeRoundedRect(-328, -168, 656, 340, 34);
    card.fillStyle(0x2f8a58, 1);
    card.fillRoundedRect(-328, -168, 656, 72, {
      tl: 34,
      tr: 34,
      bl: 0,
      br: 0
    });
    card.fillStyle(0xe7f3e8, 1);
    card.fillRoundedRect(-245, 13, 490, 54, 18);

    const badgeShadow = scene.add.circle(0, -166, 58, 0x173b2a, 0.32);
    const badge = scene.add.circle(0, -176, 55, config.accentColor, 1)
      .setStrokeStyle(6, 0xfff3bf, 1);
    const badgeStar = scene.add.text(0, -178, "★", {
      fontFamily: "Arial",
      fontSize: "58px",
      color: "#ffffff",
      fontStyle: "bold",
      stroke: "#b98118",
      strokeThickness: 5
    }).setOrigin(0.5);

    const status = scene.add.text(0, -119, config.statusLabel, {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#ffffff",
      fontStyle: "bold",
      letterSpacing: 3
    }).setOrigin(0.5);

    const title = scene.add.text(0, -55, config.levelTitle, {
      fontFamily: "Arial",
      fontSize: "36px",
      color: "#173b2a",
      fontStyle: "bold",
      align: "center",
      wordWrap: { width: 570 }
    }).setOrigin(0.5);

    const stars = [-72, 0, 72].map((x, index) => scene.add.text(x, -5 + Math.abs(index - 1) * 5, "★", {
      fontFamily: "Arial",
      fontSize: index === 1 ? "34px" : "29px",
      color: `#${config.accentColor.toString(16).padStart(6, "0")}`,
      stroke: "#b98118",
      strokeThickness: 3
    }).setOrigin(0.5));

    const reward = scene.add.text(0, 40, config.rewardLabel, {
      fontFamily: "Arial",
      fontSize: "19px",
      color: "#28563d",
      fontStyle: "bold",
      align: "center"
    }).setOrigin(0.5);

    const button = scene.add.rectangle(0, 0, 310, 62, 0x2f8a58, 1)
      .setStrokeStyle(4, 0x195a38, 1)
      .setInteractive({ useHandCursor: true });
    const buttonHighlight = scene.add.rectangle(0, -20, 274, 8, 0x8bd29f, 0.48);
    const buttonLabel = scene.add.text(0, 0, config.actionLabel, {
      fontFamily: "Arial",
      fontSize: "21px",
      color: "#ffffff",
      fontStyle: "bold",
      letterSpacing: 1
    }).setOrigin(0.5);
    const buttonContainer = scene.add.container(0, 116, [button, buttonHighlight, buttonLabel]);

    const confetti = [
      { x: -270, y: -112, angle: -18, color: config.accentColor },
      { x: -288, y: -42, angle: 24, color: 0x62c77d },
      { x: -267, y: 73, angle: -30, color: 0x67d7e5 },
      { x: 270, y: -108, angle: 22, color: 0x67d7e5 },
      { x: 288, y: -30, angle: -20, color: config.accentColor },
      { x: 270, y: 76, angle: 34, color: 0x62c77d }
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
  }

  private continueOnce(): void {
    if (this.handled) return;
    this.handled = true;
    this.onContinue();
  }
}
