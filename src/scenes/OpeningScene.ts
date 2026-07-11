import Phaser from "phaser";
import { AssetPaths, Assets } from "../assets";

const STORAGE_KEY = "supermarket.activeDay";
const AUXILIARY_SCENES = ["polish-overlay", "progression-customer", "back-stock"] as const;
type OpeningDay = "day01" | "day02" | "day03";

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
    const advancedDay = day !== "day01";
    const backgroundKey = advancedDay ? Assets.backgrounds.salesfloor : Assets.ui.openingStorefront;

    this.cameras.main.setBackgroundColor("#0c1413");

    const background = this.add.image(665, 591, backgroundKey).setAlpha(0);
    this.coverImage(background, 1330, 1182);

    const shade = this.add.rectangle(
      665,
      591,
      1330,
      1182,
      0x07100f,
      advancedDay ? 0.48 : 0.12
    );

    const dayNumber = Number(day.slice(-2));
    const dayChip = this.add.text(665, 92, `DAY ${dayNumber}`, {
      fontFamily: "Arial",
      fontSize: "24px",
      color: "#ffd75a",
      fontStyle: "bold",
      letterSpacing: 4,
      backgroundColor: "#172824",
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setAlpha(0);

    const shiftBadge = day === "day02"
      ? this.createDay2Badge().setAlpha(0).setY(455)
      : day === "day03"
        ? this.createDay3Badge().setAlpha(0).setY(455)
        : undefined;

    const leftSubtitle = day === "day01"
      ? "Load the first case and earn a fast first win"
      : day === "day02"
        ? "Choose today's deal, then stage extra matching cases"
        : "Stage mixed stock and keep Back Stock ready";
    const rightSubtitle = day === "day01"
      ? "Fill the single glowing gap to open"
      : day === "day02"
        ? "Use Back Stock for 3 flash-sale emergency saves"
        : "Tap requests: Restock, Wait or Substitute";

    const leftTip = this.createTip(315, 810, "BACKROOM", leftSubtitle, 0x244f2e, 0x8fd09a);
    const rightTip = this.createTip(1015, 810, "SALES FLOOR", rightSubtitle, 0x315f7d, 0x8fc5e8);

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

    this.tweens.add({ targets: background, alpha: 1, duration: 380, ease: "Sine.Out" });
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

    this.time.delayedCall(day === "day01" ? 4700 : 6000, finish);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => shade.destroy());
  }

  private createDay2Badge(): Phaser.GameObjects.Container {
    const panel = this.add.rectangle(0, 0, 930, 330, 0x10252a, 0.98)
      .setStrokeStyle(6, 0xffd75a);
    const title = this.add.text(0, -112, "DAY 2 · TODAY'S HOT DEAL", {
      fontFamily: "Arial",
      fontSize: "37px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5);
    const subtitle = this.add.text(0, -57, "Inventory planning + timed flash sale", {
      fontFamily: "Arial",
      fontSize: "25px",
      color: "#f7e8a9",
      fontStyle: "bold"
    }).setOrigin(0.5);
    const options = this.add.text(0, 48, [
      "1. Pick COLA, WATER or MILK as today's promotion",
      "2. Load extra matching stock before the lunch rush",
      "3. Complete 3 Back Stock saves during the 20-second sale"
    ].join("\n"), {
      fontFamily: "Arial",
      fontSize: "22px",
      color: "#e4efeb",
      align: "left",
      lineSpacing: 16
    }).setOrigin(0.5);

    return this.add.container(665, 430, [panel, title, subtitle, options]);
  }

  private createDay3Badge(): Phaser.GameObjects.Container {
    const panel = this.add.rectangle(0, 0, 930, 330, 0x10252a, 0.98)
      .setStrokeStyle(6, 0xffd75a);
    const title = this.add.text(0, -112, "DAY 3 · PLEASE WAIT", {
      fontFamily: "Arial",
      fontSize: "38px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5);
    const subtitle = this.add.text(0, -55, "Customer service decisions", {
      fontFamily: "Arial",
      fontSize: "25px",
      color: "#f7e8a9",
      fontStyle: "bold"
    }).setOrigin(0.5);
    const options = this.add.text(0, 45, [
      "RESTOCK NOW  · commit to the requested product",
      "PLEASE WAIT   · extend patience once",
      "OFFER SUBSTITUTE · faster, but the customer may refuse"
    ].join("\n"), {
      fontFamily: "Arial",
      fontSize: "22px",
      color: "#e4efeb",
      align: "left",
      lineSpacing: 16
    }).setOrigin(0.5);

    return this.add.container(665, 430, [panel, title, subtitle, options]);
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
    this.time.delayedCall(190, () => {
      AUXILIARY_SCENES.forEach((key) => {
        if (!this.scene.isActive(key)) this.scene.launch(key);
      });
      this.scene.start("game");
    });
  }

  private loadIfMissing(key: keyof typeof AssetPaths): void {
    if (!this.textures.exists(key)) this.load.image(key, AssetPaths[key]);
  }

  private coverImage(image: Phaser.GameObjects.Image, width: number, height: number): void {
    const sourceWidth = Math.max(1, image.width);
    const sourceHeight = Math.max(1, image.height);
    image.setScale(Math.max(width / sourceWidth, height / sourceHeight));
  }

  private resolveDay(): OpeningDay {
    const queryDay = new URLSearchParams(window.location.search).get("day");
    if (queryDay === "3" || queryDay === "day03") return "day03";
    if (queryDay === "2" || queryDay === "day02") return "day02";

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "day03") return "day03";
      if (stored === "day02") return "day02";
      return "day01";
    } catch {
      return "day01";
    }
  }
}
