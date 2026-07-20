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

  show(delayMs = 520): void {
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
      config.worldWidth / 2,
      config.worldHeight / 2,
      config.worldWidth,
      config.worldHeight,
      0x000000,
      0.52
    );
    const panel = scene.add.rectangle(0, 0, 690, 310, config.panelColor, 0.98)
      .setStrokeStyle(5, config.accentColor, 1);
    const status = scene.add.text(0, -103, config.statusLabel, {
      fontFamily: "Arial",
      fontSize: "19px",
      color: `#${config.accentColor.toString(16).padStart(6, "0")}`,
      fontStyle: "bold",
      letterSpacing: 3
    }).setOrigin(0.5);
    const title = scene.add.text(0, -48, config.levelTitle, {
      fontFamily: "Arial",
      fontSize: "36px",
      color: "#ffffff",
      fontStyle: "bold",
      align: "center",
      wordWrap: { width: 600 }
    }).setOrigin(0.5);
    const reward = scene.add.text(0, 10, config.rewardLabel, {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#dce8df",
      fontStyle: "bold"
    }).setOrigin(0.5);
    const button = scene.add.rectangle(0, 88, 310, 64, config.accentColor, 1)
      .setStrokeStyle(3, 0xffffff, 0.45)
      .setInteractive({ useHandCursor: true });
    const buttonLabel = scene.add.text(0, 88, config.actionLabel, {
      fontFamily: "Arial",
      fontSize: "22px",
      color: "#101713",
      fontStyle: "bold",
      letterSpacing: 1
    }).setOrigin(0.5);

    button.on("pointerover", () => button.setScale(1.04));
    button.on("pointerout", () => button.setScale(1));
    button.on("pointerdown", () => this.continueOnce());

    this.container = scene.add.container(config.centreX, config.centreY, [
      shade,
      panel,
      status,
      title,
      reward,
      button,
      buttonLabel
    ]).setDepth(180).setAlpha(0).setScale(0.94);

    shade.setPosition(0, 0);
    scene.tweens.add({
      targets: this.container,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 320,
      ease: "Back.Out"
    });
  }

  private continueOnce(): void {
    if (this.handled) return;
    this.handled = true;
    this.onContinue();
  }
}
