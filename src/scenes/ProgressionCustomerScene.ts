import Phaser from "phaser";
import { Assets } from "../assets";
import { PRODUCTS, type ProductId } from "../gameConfig";
import type { ShiftPhase } from "../domain/gameTypes";
import { CustomerStateMachine } from "../systems/CustomerStateMachine";
import { gameSession } from "../systems/GameSession";

type PlayDay = "day01" | "day02" | "day03";

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
  restockBusy: boolean;
  __rushPreparing?: boolean;
  updateHud: () => void;
  updateStars: () => void;
  advanceBusinessPhase: () => void;
  showIncome: (x: number, y: number, amount: number) => void;
  showTransientHint: (message: string) => void;
};

type WaitingCustomer = {
  id: number;
  slot: RuntimeSlot;
  machine: CustomerStateMachine;
  maxPatienceMs: number;
  container: Phaser.GameObjects.Container;
  image: Phaser.GameObjects.Image;
  bubbleText: Phaser.GameObjects.Text;
  barFill: Phaser.GameObjects.Rectangle;
  askedToWait: boolean;
  restockPriority: boolean;
  arrived: boolean;
  resolving: boolean;
  movedAside: boolean;
  laneX: number;
};

const STORAGE_KEY = "supermarket.activeDay";
const DAY2_WAIT_MS = 11_000;
const DAY3_WAIT_MS = 10_000;
const DAY2_WAIT_EXTENSION_MS = 4_000;
const DAY3_WAIT_EXTENSION_MS = 5_000;
const RESTOCK_COMMITMENT_EXTENSION_MS = 2_500;
const SUBSTITUTE_FAILURE_PENALTY_MS = 2_000;

const SUBSTITUTE_CHANCE: Record<ProductId, Partial<Record<ProductId, number>>> = {
  cola: { water: 0.65, milk: 0.2 },
  water: { cola: 0.55, milk: 0.35 },
  milk: { water: 0.45, cola: 0.25 }
};

export class ProgressionCustomerScene extends Phaser.Scene {
  private gameScene?: RuntimeGameScene;
  private attached = false;
  private currentDay: PlayDay = "day01";
  private nextWaitingCustomerId = 1;
  private waitingCustomers = new Set<WaitingCustomer>();
  private waitSpawnEvent?: Phaser.Time.TimerEvent;
  private nextDayButton?: Phaser.GameObjects.Container;
  private dayBanner?: Phaser.GameObjects.Container;
  private actionMenu?: Phaser.GameObjects.Container;
  private attachEvent?: Phaser.Time.TimerEvent;
  private pauseApplied = false;
  private restockWasBusy = false;

  constructor() {
    super({ key: "progression-customer", active: true });
  }

  create(): void {
    this.attached = false;
    this.currentDay = this.readActiveDay();
    this.nextWaitingCustomerId = 1;
    this.waitingCustomers.clear();
    this.actionMenu = undefined;
    this.restockWasBusy = false;
    gameSession.setActiveDay(this.currentDay);

    this.attachEvent = this.time.addEvent({
      delay: 120,
      loop: true,
      callback: () => this.tryAttach()
    });
  }

  update(_time: number, delta: number): void {
    if (!this.attached || !this.gameScene?.scene.isActive()) return;

    this.syncPauseState();
    this.syncSharedSession();
    if (this.pauseApplied) return;

    this.syncRestockLane();
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
    this.syncSharedSession();
    this.showDayBanner();

    if (this.currentDay === "day02" || this.currentDay === "day03") {
      this.startWaitingCustomerLoop();
    }

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.detach());
    this.scene.bringToTop();
  }

  private detach(): void {
    this.waitSpawnEvent?.remove(false);
    this.waitSpawnEvent = undefined;
    this.attachEvent?.remove(false);
    this.attachEvent = undefined;
    this.closeActionMenu();

    for (const customer of [...this.waitingCustomers]) this.destroyWaitingCustomer(customer);
    this.waitingCustomers.clear();

    this.nextDayButton?.destroy(true);
    this.nextDayButton = undefined;
    this.dayBanner?.destroy(true);
    this.dayBanner = undefined;

    if (this.pauseApplied) this.tweens.resumeAll();
    this.pauseApplied = false;
    gameSession.setPaused(false);
    this.gameScene = undefined;
    this.attached = false;
    this.restockWasBusy = false;
  }

  private syncPauseState(): void {
    const paused = Boolean(this.gameScene?.time.paused);
    gameSession.setPaused(paused);
    if (paused === this.pauseApplied) return;

    this.pauseApplied = paused;
    if (paused) {
      this.tweens.pauseAll();
    } else {
      this.tweens.resumeAll();
    }
  }

  private syncSharedSession(): void {
    const scene = this.gameScene;
    if (!scene) return;

    gameSession.syncRuntime({
      phase: scene.phase,
      soldCount: scene.soldCount,
      money: scene.money,
      stocked: scene.stocked,
      shiftEnded: scene.shiftEnded
    });
  }

  private readActiveDay(): PlayDay {
    const queryDay = new URLSearchParams(window.location.search).get("day");
    if (queryDay === "3" || queryDay === "day03") return "day03";
    if (queryDay === "2" || queryDay === "day02") return "day02";
    if (queryDay === "1" || queryDay === "day01") return "day01";

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "day03") return "day03";
      if (stored === "day02") return "day02";
      return "day01";
    } catch {
      return "day01";
    }
  }

  private writeActiveDay(day: PlayDay): void {
    gameSession.setActiveDay(day);
    try {
      localStorage.setItem(STORAGE_KEY, day);
    } catch {
      // Progress persistence is optional; gameplay still works without storage.
    }
  }

  private showDayBanner(): void {
    this.dayBanner?.destroy(true);

    const copy: Record<PlayDay, { title: string; subtitle: string }> = {
      day01: {
        title: "DAY 1 · MORNING RESTOCK",
        subtitle: "Learn the fast restock loop"
      },
      day02: {
        title: "DAY 2 · FIRST CUSTOMERS",
        subtitle: "Save waiting customers before patience runs out"
      },
      day03: {
        title: "DAY 3 · PLEASE WAIT",
        subtitle: "Restock, ask customers to wait, or recommend a substitute"
      }
    };

    const bg = this.add.rectangle(665, 205, 720, 82, 0x102820, 0.95)
      .setStrokeStyle(3, 0xffd75a);
    const titleText = this.add.text(665, 188, copy[this.currentDay].title, {
      fontFamily: "Arial",
      fontSize: "25px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5);
    const subtitleText = this.add.text(665, 220, copy[this.currentDay].subtitle, {
      fontFamily: "Arial",
      fontSize: "17px",
      color: "#d7eadf"
    }).setOrigin(0.5);

    this.dayBanner = this.add.container(0, 0, [bg, titleText, subtitleText]).setDepth(420);
    this.tweens.add({
      targets: this.dayBanner,
      alpha: 0,
      y: -22,
      delay: 2100,
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
      delay: this.currentDay === "day03" ? 2600 : 3100,
      loop: true,
      callback: () => this.trySpawnWaitingCustomer()
    });
  }

  private trySpawnWaitingCustomer(): void {
    const scene = this.gameScene;
    if (!scene || scene.shiftEnded || gameSession.isPaused || scene.__rushPreparing) return;
    if (scene.phase !== "OPEN" && scene.phase !== "RUSH") return;

    const limit = this.currentDay === "day03" ? 2 : 1;
    if (this.waitingCustomers.size >= limit) return;

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
    this.fitImage(image, 142, 295);

    const bubbleBg = this.add.rectangle(0, -350, 210, 60, 0xf8f0d8, 0.98)
      .setStrokeStyle(3, 0x6b5741);
    const bubbleText = this.add.text(0, -350, `I NEED ${PRODUCTS[slot.productId].label}`, {
      fontFamily: "Arial",
      fontSize: "19px",
      color: "#2c302f",
      fontStyle: "bold",
      align: "center"
    }).setOrigin(0.5);

    const barBg = this.add.rectangle(-72, -310, 144, 13, 0x3a4140, 0.95)
      .setOrigin(0, 0.5);
    const barFill = this.add.rectangle(-72, -310, 140, 9, 0x72d977, 1)
      .setOrigin(0, 0.5);

    // Customers use the outer service lanes instead of standing over shelf hit areas.
    // Only the speech bubble is interactive, so shelf input always wins.
    const laneX = sequence % 2 === 0 ? 1245 : 785;
    const container = this.add.container(1335, 915, [image, bubbleBg, bubbleText, barBg, barFill])
      .setDepth(36)
      .setInteractive(
        new Phaser.Geom.Rectangle(-110, -388, 220, 82),
        Phaser.Geom.Rectangle.Contains
      );
    if (container.input) container.input.cursor = "pointer";

    const patienceMs = this.currentDay === "day03" ? DAY3_WAIT_MS : DAY2_WAIT_MS;
    const machine = new CustomerStateMachine(patienceMs);
    machine.transition("SEARCH");

    const waiting: WaitingCustomer = {
      id: sequence,
      slot,
      machine,
      maxPatienceMs: patienceMs,
      container,
      image,
      bubbleText,
      barFill,
      askedToWait: false,
      restockPriority: false,
      arrived: false,
      resolving: false,
      movedAside: false,
      laneX
    };

    this.waitingCustomers.add(waiting);
    container.on("pointerdown", () => this.handleCustomerInteraction(waiting));

    this.tweens.add({
      targets: container,
      x: laneX,
      y: 900,
      duration: 620,
      ease: "Sine.InOut",
      onComplete: () => {
        waiting.arrived = true;
        waiting.machine.transition("WAIT");
        if (this.currentDay === "day03") {
          this.showFloatingText(laneX, 530, "TAP THE REQUEST", 0x8fd7ff);
        }
      }
    });
  }

  private handleCustomerInteraction(customer: WaitingCustomer): void {
    if (this.pauseApplied || !customer.arrived || customer.resolving) return;
    if (customer.machine.current !== "WAIT") return;

    if (this.currentDay === "day02") {
      this.askCustomerToWait(customer);
      return;
    }

    this.openCustomerActions(customer);
  }

  private openCustomerActions(customer: WaitingCustomer): void {
    this.closeActionMenu();

    const preferred = this.preferredSubstitute(customer.slot.productId);
    const centerX = Phaser.Math.Clamp(customer.container.x, 930, 1100);
    const panel = this.add.rectangle(0, 0, 570, 230, 0x10252a, 0.98)
      .setStrokeStyle(5, 0xffd75a);
    const title = this.add.text(0, -82, `${PRODUCTS[customer.slot.productId].label} REQUEST`, {
      fontFamily: "Arial",
      fontSize: "24px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5);

    const restock = this.createActionButton(-185, 25, 170, 86, "RESTOCK\nNOW", 0x3f8f4f, () => {
      this.prioritizeRestock(customer);
    });
    const wait = this.createActionButton(0, 25, 170, 86, "PLEASE\nWAIT", 0x315f7d, () => {
      this.askCustomerToWait(customer);
    });
    const substitute = this.createActionButton(185, 25, 170, 86, `OFFER\n${PRODUCTS[preferred].label}`, 0x8a6420, () => {
      this.offerSubstitute(customer, preferred);
    });

    const cancel = this.add.text(0, 92, "CLOSE", {
      fontFamily: "Arial",
      fontSize: "17px",
      color: "#d7e4e8",
      fontStyle: "bold"
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    cancel.on("pointerdown", () => this.closeActionMenu());

    this.actionMenu = this.add.container(centerX, 655, [panel, title, restock, wait, substitute, cancel])
      .setDepth(520)
      .setScale(0.9)
      .setAlpha(0);

    this.tweens.add({
      targets: this.actionMenu,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 150,
      ease: "Back.Out"
    });
  }

  private createActionButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    color: number,
    action: () => void
  ): Phaser.GameObjects.Container {
    const background = this.add.rectangle(0, 0, width, height, color, 1)
      .setStrokeStyle(3, 0xd9e7db);
    const text = this.add.text(0, 0, label, {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#ffffff",
      fontStyle: "bold",
      align: "center"
    }).setOrigin(0.5);
    const hit = this.add.rectangle(0, 0, width + 18, height + 16, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });
    const button = this.add.container(x, y, [background, text, hit]);

    hit.on("pointerover", () => button.setScale(1.035));
    hit.on("pointerout", () => button.setScale(1));
    hit.on("pointerdown", () => {
      button.setScale(0.98);
      action();
    });
    return button;
  }

  private closeActionMenu(): void {
    this.actionMenu?.destroy(true);
    this.actionMenu = undefined;
  }

  private prioritizeRestock(customer: WaitingCustomer): void {
    if (customer.resolving) return;
    this.closeActionMenu();

    if (!customer.restockPriority) {
      customer.restockPriority = true;
      customer.machine.transition("ASK");
      customer.machine.extendPatience(RESTOCK_COMMITMENT_EXTENSION_MS);
      customer.maxPatienceMs += RESTOCK_COMMITMENT_EXTENSION_MS;
      customer.machine.transition("WAIT");
    }

    this.moveCustomerAside(customer, "EXCUSE ME!");
    this.pulseMissingTag(customer.slot.missingTag);
    this.gameScene?.showTransientHint(
      `Priority request: restock ${PRODUCTS[customer.slot.productId].label} before patience expires.`
    );
    this.showFloatingText(customer.container.x, customer.container.y - 320, "RESTOCK PRIORITY +2.5s", 0x8ff08a);
  }

  private askCustomerToWait(customer: WaitingCustomer): void {
    if (this.pauseApplied || !customer.arrived || customer.resolving || customer.askedToWait) {
      if (customer.askedToWait) {
        this.showFloatingText(customer.container.x, customer.container.y - 320, "ALREADY ASKED", 0xffd75a);
      }
      this.closeActionMenu();
      return;
    }
    if (customer.machine.current !== "WAIT") return;

    this.closeActionMenu();
    const extension = this.currentDay === "day03" ? DAY3_WAIT_EXTENSION_MS : DAY2_WAIT_EXTENSION_MS;
    customer.askedToWait = true;
    customer.machine.transition("ASK");
    customer.machine.extendPatience(extension);
    customer.maxPatienceMs += extension;
    customer.machine.transition("WAIT");
    customer.bubbleText.setText("I'LL WAIT");

    this.showFloatingText(
      customer.container.x,
      customer.container.y - 320,
      `PLEASE WAIT +${extension / 1000}s`,
      0x8fd7ff
    );
  }

  private offerSubstitute(customer: WaitingCustomer, preferred: ProductId): void {
    const scene = this.gameScene;
    if (!scene || customer.resolving || gameSession.isPaused) return;
    this.closeActionMenu();

    const alternative = scene.shelfSlots.find(
      (slot) => slot.productId === preferred && slot.product && !slot.reservedForCustomer
    ) ?? scene.shelfSlots.find(
      (slot) => slot.productId !== customer.slot.productId && slot.product && !slot.reservedForCustomer
    );

    if (!alternative?.product) {
      this.showFloatingText(customer.container.x, customer.container.y - 320, "NO ALTERNATIVE IN STOCK", 0xffd75a);
      return;
    }

    const chance = SUBSTITUTE_CHANCE[customer.slot.productId][alternative.productId] ?? 0.25;
    const accepted = Phaser.Math.FloatBetween(0, 1) <= chance;

    if (!accepted) {
      const expired = customer.machine.tick(SUBSTITUTE_FAILURE_PENALTY_MS);
      customer.bubbleText.setText(`STILL NEED ${PRODUCTS[customer.slot.productId].label}`);
      this.showFloatingText(customer.container.x, customer.container.y - 320, "NOT INTERESTED -2s", 0xff8a72);
      if (expired) this.missWaitingCustomer(customer);
      return;
    }

    customer.resolving = true;
    customer.machine.transition("BUY");
    alternative.reservedForCustomer = true;
    const product = alternative.product;
    alternative.product = undefined;
    product.destroy();
    alternative.missingTag.setVisible(true);
    alternative.reservedForCustomer = false;

    scene.stocked = Math.max(0, scene.stocked - 1);
    const price = PRODUCTS[alternative.productId].price;
    const serviceBonus = 15;
    scene.money += price + serviceBonus;
    scene.soldCount += 1;
    gameSession.recordSatisfiedCustomer();
    scene.updateStars();
    scene.showIncome(alternative.hitArea.x, alternative.hitArea.y - 55, price + serviceBonus);
    scene.advanceBusinessPhase();
    scene.updateHud();
    this.syncSharedSession();

    const basketKey = customer.id % 2 === 0
      ? Assets.characters.customer02Basket
      : Assets.characters.customer01Basket;
    customer.image.setTexture(basketKey);
    this.fitImage(customer.image, 150, 302);
    customer.bubbleText.setText(`OK, ${PRODUCTS[alternative.productId].label}!`);

    this.showFloatingText(customer.container.x, customer.container.y - 330, "GOOD RECOMMENDATION +15", 0x8ff08a);
    this.leaveCustomer(customer);
  }

  private preferredSubstitute(target: ProductId): ProductId {
    if (target === "cola") return "water";
    if (target === "water") return "cola";
    return "water";
  }

  private updateWaitingCustomers(delta: number): void {
    if (gameSession.isPaused) return;

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

      if (ratio <= 0.25 && !customer.restockPriority) {
        customer.bubbleText.setText(`${PRODUCTS[customer.slot.productId].label} — HURRY!`);
      }

      if (expired) this.missWaitingCustomer(customer);
    }
  }

  private resolveWaitingCustomer(customer: WaitingCustomer): void {
    const scene = this.gameScene;
    const product = customer.slot.product;
    if (!scene || !product || customer.resolving || gameSession.isPaused) return;

    customer.resolving = true;
    customer.machine.transition("BUY");
    customer.slot.reservedForCustomer = true;
    customer.slot.product = undefined;
    product.destroy();
    customer.slot.missingTag.setVisible(true);
    customer.slot.reservedForCustomer = false;

    scene.stocked = Math.max(0, scene.stocked - 1);
    const price = PRODUCTS[customer.slot.productId].price;
    const saveBonus = customer.restockPriority ? 20 : 10;
    scene.money += price + saveBonus;
    scene.soldCount += 1;
    gameSession.recordSatisfiedCustomer();
    scene.updateStars();
    scene.showIncome(customer.slot.hitArea.x, customer.slot.hitArea.y - 55, price + saveBonus);
    scene.advanceBusinessPhase();
    scene.updateHud();
    this.syncSharedSession();

    const basketKey = customer.id % 2 === 0
      ? Assets.characters.customer02Basket
      : Assets.characters.customer01Basket;
    customer.image.setTexture(basketKey);
    this.fitImage(customer.image, 155, 310);
    customer.bubbleText.setText("THANK YOU!");

    this.showFloatingText(
      customer.container.x,
      customer.container.y - 330,
      customer.restockPriority ? "CUSTOMER SAVED +20" : "CUSTOMER SAVED +10",
      0x8ff08a
    );
    this.leaveCustomer(customer);
  }

  private missWaitingCustomer(customer: WaitingCustomer): void {
    if (customer.resolving || gameSession.isPaused) return;
    customer.resolving = true;
    this.closeActionMenu();
    gameSession.recordMissedSale();
    this.gameScene?.updateStars();
    this.gameScene?.updateHud();
    this.syncSharedSession();

    customer.bubbleText.setText("I'M LEAVING");
    this.showFloatingText(customer.container.x, customer.container.y - 320, "MISSED SALE", 0xff7a6e);
    this.leaveCustomer(customer);
  }

  private leaveCustomer(customer: WaitingCustomer): void {
    this.tweens.add({
      targets: customer.container,
      x: 1335,
      y: 970,
      alpha: 0,
      duration: 620,
      ease: "Sine.In",
      onComplete: () => this.destroyWaitingCustomer(customer)
    });
  }

  private syncRestockLane(): void {
    const busy = Boolean(this.gameScene?.restockBusy);
    if (busy === this.restockWasBusy) return;
    this.restockWasBusy = busy;

    if (busy) {
      this.closeActionMenu();
      for (const customer of this.waitingCustomers) {
        if (customer.arrived && !customer.resolving) this.moveCustomerAside(customer, "EXCUSE ME!");
      }
      return;
    }

    this.time.delayedCall(120, () => {
      for (const customer of this.waitingCustomers) {
        if (!customer.arrived || customer.resolving || !customer.movedAside) continue;
        customer.movedAside = false;
        customer.bubbleText.setText(`I NEED ${PRODUCTS[customer.slot.productId].label}`);
        this.tweens.add({
          targets: customer.container,
          x: customer.laneX,
          duration: 220,
          ease: "Sine.Out"
        });
      }
    });
  }

  private moveCustomerAside(customer: WaitingCustomer, message: string): void {
    if (customer.resolving) return;
    customer.movedAside = true;
    customer.bubbleText.setText(message);
    const sideX = customer.laneX < 1000 ? 735 : 1285;
    this.tweens.killTweensOf(customer.container);
    this.tweens.add({
      targets: customer.container,
      x: sideX,
      duration: 180,
      ease: "Sine.Out"
    });
  }

  private pulseMissingTag(tag: Phaser.GameObjects.Image): void {
    this.tweens.killTweensOf(tag);
    tag.setVisible(true).setTint(0xffd75a).setScale(tag.scaleX, tag.scaleY);
    const baseX = tag.scaleX;
    const baseY = tag.scaleY;
    this.tweens.add({
      targets: tag,
      scaleX: baseX * 1.12,
      scaleY: baseY * 1.12,
      duration: 150,
      yoyo: true,
      repeat: 2,
      ease: "Sine.InOut",
      onComplete: () => tag.clearTint().setScale(baseX, baseY)
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
      strokeThickness: 6,
      align: "center"
    }).setOrigin(0.5).setDepth(530);

    this.tweens.add({
      targets: text,
      y: y - 70,
      alpha: 0,
      duration: 900,
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
