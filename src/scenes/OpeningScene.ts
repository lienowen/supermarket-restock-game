import Phaser from "phaser";
import { AssetPaths, Assets } from "../assets";

const STORAGE_KEY = "supermarket.activeDay";

export class OpeningScene extends Phaser.Scene {
  private finished = false;

  constructor() {
    super("opening");
  }

  preload(): void {
    this.loadIfMissing(Assets.ui.openingStorefront);
    this.loadIfMissing(Assets.ui.openingShiftBadge);
    this.loadIfMissing(Assets.backgrounds.salesfloor);
  }

  create(): void {
    this.finished = false;

    const day = this.resolveDay();
    const isDay2 = day === "day02";
    const backgroundKey = isDay2 ? Assets.backgrounds.salesfloor : Assets.ui.openingStorefront;

    this.cameras.main.setBackgroundColor("#0c1413");

    const background = this.add.image(665, 591, backgroundKey).setAlpha(0);
    this.coverImage(background, 1330, 1182);

    const shade = this.add.rectangle(
      665,
      591,
      1330,
      1182,
      0x07100f,
      isDay2 ? 0.48 : 0.12
    );

    const dayChip = this.add.text(665, 92, isDay2 ? "DAY 2" : "DAY 1", {
      fontFamily: "Arial",
      fontSize: "24px",
      color: "#ffd75a",
      fontStyle: "bold",
      letterSpacing: 4,
      backgroundColor: "#172824",
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setAlpha(0);

    const shiftBadge = isDay2
      ? this.add.image(665, 430, Assets.ui.openingShiftBadge)
          .setDisplaySize(980, 380)
          .setAlpha(0)
          .setY(455)
      : undefined;

    const leftTip = this.createTip(
      315,
      810,
      "BACKROOM",
      isDay2 ? "Prepare one opening trip" : "Load the first cases",
      0x244f2e,
      0x8fd09a
    );

    const rightTip = this.createTip(
      1015,
      810,
      "SALES FLOOR",
      isDay2 ? "Use Back Stock before warehouse trips" : "Match products to empty slots",
      0x315f7d,
      0x8fc5e8
    );

    leftTip.setAlpha(0).setX(285);
    rightTip.setAlpha(0).setX(1045);

    const start = this.add.text(665, 1010, "START SHIFT", {
      fontFamily: "Arial",
      fontSize: "30px",
      color: "#17221d",
      fontStyle: "bold",
      backgroundColor: "#ffd75a",
      padding: { x: 32, y: 15 }
    }).setOrigin(0.5).setAlpha(0).setInteractive({ useHandCursor: true });

    const skip = this.add.text(1260, 42, "SKIP", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#ffffff",
      fontStyle: "bold",
      backgroundColor: "#263331",
      padding: { x: 15, y: 9 }
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });

    const finish = () => this.finishOpening();
    start.on("pointerdown", finish);
    skip.on("pointerdown", finish);

    this.tweens.add({
      targets: background,
      alpha: 1,
      duration: 380,
      ease: "Sine.Out"
    });
    this.tweens.add({
      targets: dayChip,
      alpha: 1,
      y: 106,
      duration: 300,
      delay: 120,
      ease: "Cubic.Out"
    });

    if (shiftBadge) {
      this.tweens.add({
        targets: shiftBadge,
        alpha: 1,
        y: 430,
        duration: 420,
        delay: 260,
        ease: "Cubic.Out"
      });
    }

    this.tweens.add({
      targets: leftTip,
      alpha: 1,
      x: 315,
      duration: 360,
      delay: 620,
      ease: "Cubic.Out"
    });
    this.tweens.add({
      targets: rightTip,
      alpha: 1,
      x: 1015,
      duration: 360,
      delay: 780,
      ease: "Cubic.Out"
    });
    this.tweens.add({
      targets: start,
      alpha: 1,
      duration: 260,
      delay: 1050,
      ease: "Sine.Out"
    });

    this.time.delayedCall(5200, finish);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      shade.destroy();
    });
  }

  private createTip(
    x: number,
    y: number,
    title: string,
    subtitle: string,
    backgroundColor: number,
    borderColor: number
  ): Phaser.GameObjects.Container {
    const background = this.add.rectangle(0, 0, 470, 112, backgroundColor, 0.94)
      .setStrokeStyle(3, borderColor, 0.95);
    const titleText = this.add.text(0, -25, title, {
      fontFamily: "Arial",
      fontSize: "24px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5);
    const subtitleText = this.add.text(0, 23, subtitle, {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#e3efeb",
      align: "center",
      wordWrap: { width: 420 }
    }).setOrigin(0.5);

    return this.add.container(x, y, [background, titleText, subtitleText]);
  }

  private finishOpening(): void {
    if (this.finished) return;
    this.finished = true;

    this.input.enabled = false;
    this.cameras.main.fadeOut(180, 12, 20, 19);
    this.time.delayedCall(190, () => this.scene.start("game"));
  }

  private loadIfMissing(key: keyof typeof AssetPaths): void {
    if (!this.textures.exists(key)) this.load.image(key, AssetPaths[key]);
  }

  private coverImage(image: Phaser.GameObjects.Image, width: number, height: number): void {
    const sourceWidth = Math.max(1, image.width);
    const sourceHeight = Math.max(1, image.height);
    image.setScale(Math.max(width / sourceWidth, height / sourceHeight));
  }

  private resolveDay(): "day01" | "day02" {
    const queryDay = new URLSearchParams(window.location.search).get("day");
    if (queryDay === "2" || queryDay === "day02") return "day02";

    try {
      return localStorage.getItem(STORAGE_KEY) === "day02" ? "day02" : "day01";
    } catch {
      return "day01";
    }
  }
}
