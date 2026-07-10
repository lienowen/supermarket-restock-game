import Phaser from "phaser";
import { Assets } from "../assets";
import { PRODUCTS, type ProductId } from "../gameConfig";
import type { ShiftPhase } from "../domain/gameTypes";
import { CustomerStateMachine } from "../systems/CustomerStateMachine";

type PlayDay = "day01" | "day02";

type RuntimeSlot = {
  productId: ProductId;
  hitArea: Phaser.GameObjects.Rectangle;
  missingTag: Phaser.GameObjects.Image;
  product?: Phaser.GameObjects.Image;
  reservedForCustomer: boolean;
};

type RuntimeGameScene = Phaser.Scene & {
  shelfSlots: RuntimeSlot[];
  phase: ShiftPhase;
  shiftEnded: boolean;
  stocked: number;
  soldCount: number;
  money: number;
  updateHud: () => void;
  updateStars: () => void;
  advanceBusinessPhase: () => void;
  showIncome: (x: number, y: number, amount: number) => void;
};

type WaitingCustomer = {
  id: number;
  slot: RuntimeSlot;
  machine: CustomerStateMachine;
  maxPatienceMs: number;
  container: Phaser.GameObjects.Container;
  image: Phaser.GameObjects.Image;
  barFill: Phaser.GameObjects.Rectangle;
  askedToWait: boolean;
  arrived: boolean;
  resolving: boolean;
};

const STORAGE_KEY = "supermarket.activeDay";
const DAY2_WAIT_MS = 11_000;
const DAY2_WAIT_EXTENSION_MS = 4_000;

export class ProgressionCustomerScene extends Phaser.Scene {
  private gameScene?: RuntimeGameScene;
  private attached = false;
  private currentDay: PlayDay = "day01";
  private nextWaitingCustomerId = 1;
  private waitingCustomers = new Set<WaitingCustomer>();
  private waitSpawnEvent?: Phaser.Time.TimerEvent;
  private nextDayButton?: Phaser.GameObjects.Container;
  private dayBanner?: Phaser.GameObjects.Container;
  private attachEvent?: Phaser.Time.TimerEvent;

  constructor() {
    super({ key: "progression-customer", active: true });
  }

  create(): void {
    this.currentDay = this.readActiveDay();
    this.attachEvent = this.time.addEvent({
      delay: 120,
      loop: true,
      callback: () => this.tryAttach()
    });
  }

  update(_time: number, delta: number): void {
    if (!this.attached || !this.gameScene?.scene.isActive()) return;

    this.updateWaitingCustomers(delta);

    if (this.currentDay === "day01" && this.gameScene.shiftEnded) {
      this.showNextDayButton();
    }
  }

  private tryAttach(): void {
    if (this.attached) return;

    const scene = this.scene.get("game") as RuntimeGameScene;
    if (!scene?.scene?.isActive() || !scene.shelfSlots?.length) return;

    this.gameScene = scene;
    this.attached = true;
    this.showDayBanner();

    if (this.currentDay === "day02") this.startWaitingCustomerLoop();

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.detach());
    this.scene.bringToTop();
  }

  private detach(): void {
    this.waitSpawnEvent?.remove(false);
    this.waitSpawnEvent = undefined;

    for (const customer of [...this.waitingCustomers]) this.destroyWaitingCustomer(customer);
    this.waitingCustomers.clear();

    this.nextDayButton?.destroy(true);
    this.nextDayButton = undefined;
    this.dayBanner?.destroy(true);
    this.dayBanner = undefined;

    this.gameScene = undefined;
    this.attached = false;
  }

  private readActiveDay(): PlayDay {
    const queryDay = new URLSearchParams(window.location.search).get("day");
    if (queryDay === "2" || queryDay === "day02") return "day02";
    if (queryDay === "1" || queryDay === "day01") return "day01";

    try {
      return localStorage.getItem(STORAGE_KEY) === "day02" ? "day02" : "day01";
    } catch {
      return "day01";
    }
  }

  private writeActiveDay(day: PlayDay): void {
    try {
      localStorage.setItem(STORAGE_KEY, day);
    } catch {
      // Progress persistence is optional; gameplay still works without storage.
    }
  }

  private showDayBanner(): void {
    this.dayBanner?.destroy(true);

    const title = this.currentDay === "day01"
      ? "DAY 1 · MORNING RESTOCK"
      : "DAY 2 · FIRST CUSTOMERS";
    const subtitle = this.currentDay === "day01"
      ? "Learn the fast restock loop"
      : "Save waiting customers before patience runs out";

    const bg = this.add.rectangle(665, 205, 610, 82, 0x102820, 0.95)
      .setStrokeStyle(3, 0xffd75a);
    const titleText = this.add.text(665, 188, title, {
      fontFamily: "Arial",
      fontSize: "25px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5);
    const subtitleText = this.add.text(665, 220, subtitle, {
      fontFamily: "Arial",
      fontSize: "17px",
      color: "#d7eadf"
    }).setOrigin(0.5);

    this.dayBanner = this.add.container(0, 0, [bg, titleText, subtitleText]).setDepth(420);
    this.tweens.add({
      targets: this.dayBanner,
      alpha: 0,
      y: -22,
      delay: 1900,
      duration: 420,
      ease: "Cubic.In",
      onComplete: () => {
        this.dayBanner?.destroy(true);
        this.dayBanner = undefined;
      }
    });
  }

  private showNextDayButton(): void {
    if (this.nextDayButton) return;

    const button = this.add.rectangle(665, 815, 300, 74, 0x3f8f4f, 1)
      .setStrokeStyle(4, 0x245b31)
      .setInteractive({ useHandCursor: true });
    const label = this.add.text(665, 815, "NEXT DAY →", {
      fontFamily: "Arial",
      fontSize: "28px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5);

    this.nextDayButton = this.add.container(0, 0, [button, label]).setDepth(520);

    const goNext = () => {
      this.currentDay = "day02";
      this.writeActiveDay("day02");
      this.nextDayButton?.destroy(true);
      this.nextDayButton = undefined;
      this.scene.get("game").scene.restart();
    };

    button.on("pointerdown", goNext);
    label.setInteractive({ useHandCursor: true }).on("pointerdown", goNext);
  }

  private startWaitingCustomerLoop(): void {
    this.waitSpawnEvent?.remove(false);
    this.waitSpawnEvent = this.time.addEvent({
      delay: 3100,
      loop: true,
      callback: () => this.trySpawnWaitingCustomer()
    });
  }

  private trySpawnWaitingCustomer(): void {
    const scene = this.gameScene;
    if (!scene || scene.shiftEnded) return;
    if (scene.phase !== "OPEN" && scene.phase !== "RUSH") return;
    if (this.waitingCustomers.size >= 1) return;

    const targetedSlots = new Set([...this.waitingCustomers].map((customer) => customer.slot));
    const missing = scene.shelfSlots.filter(
      (slot) => !slot.product && !slot.reservedForCustomer && !targetedSlots.has(slot)
    );
    if (missing.length === 0) return;

    const slot = Phaser.Utils.Array.GetRandom(missing);
    this.spawnWaitingCustomer(slot);
  }

  private spawnWaitingCustomer(slot: RuntimeSlot): void {
    const sequence = this.nextWaitingCustomerId++;
    const idleKey = sequence % 2 === 0 ? Assets.characters.customer02Idle : Assets.characters.customer01Idle;

    const image = this.add.image(0, 0, idleKey).setOrigin(0.5, 1);
    this.fitImage(image, 150, 305);

    const bubbleBg = this.add.rectangle(0, -350, 190, 56, 0xf8f0d8, 0.98)
      .setStrokeStyle(3, 0x6b5741);
    const bubbleText = this.add.text(0, -350, `${PRODUCTS[slot.productId].label} ?`, {
      fontFamily: "Arial",
      fontSize: "21px",
      color: "#2c302f",
      fontStyle: "bold"
    }).setOrigin(0.5);

    const barBg = this.add.rectangle(-72, -310, 144, 13, 0x3a4140, 0.95)
      .setOrigin(0, 0.5);
    const barFill = this.add.rectangle(-72, -310, 140, 9, 0x72d977, 1)
      .setOrigin(0, 0.5);

    const container = this.add.container(1315, 925, [image, bubbleBg, bubbleText, barBg, barFill])
      .setDepth(410)
      .setSize(190, 355)
      .setInteractive(
        new Phaser.Geom.Rectangle(-95, -355, 190, 355),
        Phaser.Geom.Rectangle.Contains
      );
    if (container.input) container.input.cursor = "pointer";

    const machine = new CustomerStateMachine(DAY2_WAIT_MS);
    machine.transition("SEARCH");

    const waiting: WaitingCustomer = {
      id: sequence,
      slot,
      machine,
      maxPatienceMs: DAY2_WAIT_MS,
      container,
      image,
      barFill,
      askedToWait: false,
      arrived: false,
      resolving: false
    };

    this.waitingCustomers.add(waiting);

    container.on("pointerdown", () => this.askCustomerToWait(waiting));

    const stopX = Phaser.Math.Clamp(slot.hitArea.x + 105, 820, 1230);
    this.tweens.add({
      targets: container,
      x: stopX,
      y: 900,
      duration: 680,
      ease: "Sine.InOut",
      onComplete: () => {
        waiting.arrived = true;
        waiting.machine.transition("WAIT");
      }
    });
  }

  private askCustomerToWait(customer: WaitingCustomer): void {
    if (!customer.arrived || customer.resolving || customer.askedToWait) return;
    if (customer.machine.current !== "WAIT") return;

    customer.askedToWait = true;
    customer.machine.transition("ASK");
    customer.machine.extendPatience(DAY2_WAIT_EXTENSION_MS);
    customer.maxPatienceMs += DAY2_WAIT_EXTENSION_MS;
    customer.machine.transition("WAIT");

    this.showFloatingText(customer.container.x, customer.container.y - 300, "PLEASE WAIT +4s", 0x8fd7ff);
  }

  private updateWaitingCustomers(delta: number): void {
    for (const customer of [...this.waitingCustomers]) {
      if (customer.resolving || !customer.arrived) continue;

      if (customer.slot.product) {
        this.resolveWaitingCustomer(customer);
        continue;
      }

      const expired = customer.machine.tick(delta);
      const ratio = Phaser.Math.Clamp(
        customer.machine.patienceRemainingMs / Math.max(1, customer.maxPatienceMs),
        0,
        1
      );
      customer.barFill.displayWidth = 140 * ratio;
      customer.barFill.setFillStyle(ratio > 0.55 ? 0x72d977 : ratio > 0.25 ? 0xf0c85a : 0xef6f67);

      if (expired) this.missWaitingCustomer(customer);
    }
  }

  private resolveWaitingCustomer(customer: WaitingCustomer): void {
    const scene = this.gameScene;
    const product = customer.slot.product;
    if (!scene || !product || customer.resolving) return;

    customer.resolving = true;
    customer.machine.transition("BUY");
    customer.slot.reservedForCustomer = true;
    customer.slot.product = undefined;
    product.destroy();
    customer.slot.missingTag.setVisible(true);
    customer.slot.reservedForCustomer = false;

    scene.stocked = Math.max(0, scene.stocked - 1);
    const price = PRODUCTS[customer.slot.productId].price;
    const saveBonus = 10;
    scene.money += price + saveBonus;
    scene.soldCount += 1;
    scene.updateStars();
    scene.showIncome(customer.slot.hitArea.x, customer.slot.hitArea.y - 55, price + saveBonus);
    scene.advanceBusinessPhase();
    scene.updateHud();

    const basketKey = customer.id % 2 === 0
      ? Assets.characters.customer02Basket
      : Assets.characters.customer01Basket;
    customer.image.setTexture(basketKey);
    this.fitImage(customer.image, 155, 310);

    this.showFloatingText(customer.container.x, customer.container.y - 320, "SAVED CUSTOMER +10", 0x8ff08a);
    this.tweens.add({
      targets: customer.container,
      x: 1315,
      y: 970,
      alpha: 0,
      duration: 650,
      ease: "Sine.In",
      onComplete: () => this.destroyWaitingCustomer(customer)
    });
  }

  private missWaitingCustomer(customer: WaitingCustomer): void {
    if (customer.resolving) return;
    customer.resolving = true;

    this.showFloatingText(customer.container.x, customer.container.y - 320, "MISSED SALE", 0xff7a6e);
    this.tweens.add({
      targets: customer.container,
      x: 1315,
      y: 970,
      alpha: 0,
      duration: 620,
      ease: "Sine.In",
      onComplete: () => this.destroyWaitingCustomer(customer)
    });
  }

  private destroyWaitingCustomer(customer: WaitingCustomer): void {
    this.waitingCustomers.delete(customer);
    if (customer.container.active) customer.container.destroy(true);
  }

  private showFloatingText(x: number, y: number, message: string, color: number): void {
    const text = this.add.text(x, y, message, {
      fontFamily: "Arial",
      fontSize: "25px",
      color: `#${color.toString(16).padStart(6, "0")}`,
      fontStyle: "bold",
      stroke: "#172020",
      strokeThickness: 6
    }).setOrigin(0.5).setDepth(530);

    this.tweens.add({
      targets: text,
      y: y - 70,
      alpha: 0,
      duration: 820,
      ease: "Cubic.Out",
      onComplete: () => text.destroy()
    });
  }

  private fitImage(image: Phaser.GameObjects.Image, maxWidth: number, maxHeight: number): void {
    const sourceWidth = Math.max(1, image.width);
    const sourceHeight = Math.max(1, image.height);
    image.setScale(Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight));
  }
}
