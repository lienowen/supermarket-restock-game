import Phaser from "phaser";

const STORAGE_KEY = "supermarket.activeDay";

export class OpeningScene extends Phaser.Scene {
  private finished = false;

  constructor() {
    super("opening");
  }

  create(): void {
    const day = this.resolveDay();
    const isDay2 = day === "day02";

    this.cameras.main.setBackgroundColor("#0c1413");

    const shade = this.add.rectangle(665, 591, 1330, 1182, 0x0c1413, 1);
    const leftZone = this.add.rectangle(300, 650, 430, 520, 0x244f2e, 0.26)
      .setStrokeStyle(3, 0x6aa473, 0.6);
    const rightZone = this.add.rectangle(1030, 650, 430, 520, 0x2d6688, 0.25)
      .setStrokeStyle(3, 0x72a8c9, 0.6);

    const dayText = this.add.text(665, 230, isDay2 ? "DAY 2" : "DAY 1", {
      fontFamily: "Arial",
      fontSize: "34px",
      color: "#ffd75a",
      fontStyle: "bold",
      letterSpacing: 5
    }).setOrigin(0.5).setAlpha(0);

    const title = this.add.text(665, 300, isDay2 ? "FIRST CUSTOMERS" : "MORNING RESTOCK", {
      fontFamily: "Arial",
      fontSize: "58px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5).setAlpha(0);

    const objective = this.add.text(
      665,
      390,
      isDay2
        ? "Keep shelves available. Use nearby Back Stock before running to the warehouse."
        : "Prepare the drink shelves before customers arrive.",
      {
        fontFamily: "Arial",
        fontSize: "25px",
        color: "#dbe7e2",
        align: "center",
        wordWrap: { width: 760 }
      }
    ).setOrigin(0.5).setAlpha(0);

    const backroom = this.add.text(300, 650, "BACKROOM\n\nLoad cases\nPlan the next trip", {
      fontFamily: "Arial",
      fontSize: "28px",
      color: "#dff4df",
      fontStyle: "bold",
      align: "center",
      lineSpacing: 10
    }).setOrigin(0.5).setAlpha(0);

    const sales = this.add.text(1030, 650, isDay2
      ? "SALES FLOOR\n\nServe customers\nUse Back Stock first"
      : "SALES FLOOR\n\nMatch products\nFill missing slots", {
      fontFamily: "Arial",
      fontSize: "28px",
      color: "#dcefff",
      fontStyle: "bold",
      align: "center",
      lineSpacing: 10
    }).setOrigin(0.5).setAlpha(0);

    const start = this.add.text(665, 920, "START SHIFT", {
      fontFamily: "Arial",
      fontSize: "30px",
      color: "#17221d",
      fontStyle: "bold",
      backgroundColor: "#ffd75a",
      padding: { x: 28, y: 14 }
    }).setOrigin(0.5).setAlpha(0).setInteractive({ useHandCursor: true });

    const skip = this.add.text(1245, 55, "SKIP", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#d7e1de",
      fontStyle: "bold",
      backgroundColor: "#263331",
      padding: { x: 14, y: 8 }
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });

    const finish = () => this.finishOpening();
    start.on("pointerdown", finish);
    skip.on("pointerdown", finish);

    this.tweens.add({ targets: dayText, alpha: 1, y: 215, duration: 320, ease: "Cubic.Out" });
    this.tweens.add({ targets: title, alpha: 1, y: 285, duration: 420, delay: 150, ease: "Cubic.Out" });
    this.tweens.add({ targets: objective, alpha: 1, duration: 360, delay: 420, ease: "Sine.Out" });
    this.tweens.add({ targets: [leftZone, backroom], alpha: 1, x: "+=18", duration: 420, delay: 720, ease: "Cubic.Out" });
    this.tweens.add({ targets: [rightZone, sales], alpha: 1, x: "-=18", duration: 420, delay: 920, ease: "Cubic.Out" });
    this.tweens.add({ targets: start, alpha: 1, scaleX: 1.03, scaleY: 1.03, duration: 280, delay: 1300, yoyo: true, ease: "Sine.Out" });

    this.time.delayedCall(5200, finish);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      shade.destroy();
    });
  }

  private finishOpening(): void {
    if (this.finished) return;
    this.finished = true;

    this.cameras.main.fadeOut(180, 12, 20, 19);
    this.time.delayedCall(190, () => this.scene.start("game"));
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
