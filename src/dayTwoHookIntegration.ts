import Phaser from "phaser";
import { PRODUCTS, type ProductId } from "./gameConfig";
import { LEVELS } from "./levels/levelConfigs";
import { GameScene } from "./scenes/GameScene";
import { BackStockScene } from "./scenes/BackStockScene";
import { gameSession } from "./systems/GameSession";

const PROMO_SECONDS = 20;
const PROMO_TARGET = 3;
const PROMO_CUSTOMER_INTERVAL_MS = 1050;
const CHOICE_AUTO_SECONDS = 7;
const PER_SAVE_COINS = 6;
const COMPLETION_BONUS = 30;

type RuntimeSlot = {
  productId: ProductId;
  product?: Phaser.GameObjects.Image;
};

type RuntimeGameScene = Phaser.Scene & {
  phase: "PREPARE" | "OPEN" | "RUSH" | "CLOSING" | "RESULT";
  shiftEnded: boolean;
  restockBusy: boolean;
  money: number;
  shelfSlots: RuntimeSlot[];
  __rushPreparing?: boolean;
  __finalServiceActive?: boolean;
  __day2FeaturedProduct?: ProductId;
  __day2PlanningActive?: boolean;
  __day2PromoStarted?: boolean;
  __day2PromoActive?: boolean;
  __day2PromoSeconds?: number;
  __day2BackStockSaves?: number;
  __day2PromoBonusClaimed?: boolean;
  __day2PlanningOverlay?: Phaser.GameObjects.Container;
  __day2PromoPanel?: Phaser.GameObjects.Container;
  __day2DealBoard?: Phaser.GameObjects.Container;
  __day2DealTitle?: Phaser.GameObjects.Text;
  __day2DealStatus?: Phaser.GameObjects.Text;
  __day2Monitor?: () => void;
  showPhaseBanner: (message: string) => void;
  showTransientHint: (message: string) => void;
  startCustomerLoop: (delay: number) => void;
  updateHud: () => void;
};

type GamePrototype = {
  create: () => void;
  openStore: () => void;
  pickWeightedSlot: (slots: RuntimeSlot[]) => RuntimeSlot;
};

type RuntimeBackStockScene = Phaser.Scene & {
  gameScene?: RuntimeGameScene;
  inventory: Record<ProductId, number>;
};

type BackStockPrototype = {
  quickRestock: (productId: ProductId) => void;
};

const gamePrototype = GameScene.prototype as unknown as GamePrototype;
const originalCreate = gamePrototype.create;
const originalOpenStore = gamePrototype.openStore;
const originalPickWeightedSlot = gamePrototype.pickWeightedSlot;

gamePrototype.create = function createWithDayTwoHook(): void {
  originalCreate.call(this);
  const scene = this as unknown as RuntimeGameScene;
  if (gameSession.day !== "day02") return;

  resetDayTwoRuntime(scene);
  scene.__day2PlanningActive = true;

  scene.time.delayedCall(260, () => {
    if (!scene.scene.isActive() || scene.shiftEnded || gameSession.day !== "day02") return;
    openDealSelection(scene);
  });

  const monitor = (): void => monitorDayTwoFlow(scene);
  scene.__day2Monitor = monitor;
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, monitor);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => cleanupDayTwo(scene, monitor));
};

gamePrototype.openStore = function openDayTwoWithDealForecast(): void {
  const scene = this as unknown as RuntimeGameScene;
  if (gameSession.day === "day02" && !scene.__day2FeaturedProduct) {
    selectFeaturedProduct(scene, "water");
  }

  originalOpenStore.call(this);

  if (gameSession.day !== "day02") return;
  scene.startCustomerLoop(LEVELS.day02.customerIntervalsMs.open);
  const featured = scene.__day2FeaturedProduct ?? "water";
  scene.showTransientHint(
    `${PRODUCTS[featured].label} is today's hot deal. Build Back Stock before the lunch rush.`
  );
  refreshDealBoard(scene);
};

gamePrototype.pickWeightedSlot = function pickPromotedDayTwoSlot(slots: RuntimeSlot[]): RuntimeSlot {
  const scene = this as unknown as RuntimeGameScene;
  const featured = scene.__day2FeaturedProduct;

  if (
    gameSession.day === "day02" &&
    scene.__day2PromoActive &&
    featured &&
    Phaser.Math.FloatBetween(0, 1) <= 0.74
  ) {
    const promoted = slots.filter((slot) => slot.productId === featured && slot.product);
    if (promoted.length > 0) return Phaser.Utils.Array.GetRandom(promoted);
  }

  return originalPickWeightedSlot.call(this, slots);
};

function resetDayTwoRuntime(scene: RuntimeGameScene): void {
  scene.__day2FeaturedProduct = undefined;
  scene.__day2PlanningActive = false;
  scene.__day2PromoStarted = false;
  scene.__day2PromoActive = false;
  scene.__day2PromoSeconds = 0;
  scene.__day2BackStockSaves = 0;
  scene.__day2PromoBonusClaimed = false;
  scene.__day2PlanningOverlay?.destroy(true);
  scene.__day2PromoPanel?.destroy(true);
  scene.__day2DealBoard?.destroy(true);
  scene.__day2PlanningOverlay = undefined;
  scene.__day2PromoPanel = undefined;
  scene.__day2DealBoard = undefined;
  scene.__day2DealTitle = undefined;
  scene.__day2DealStatus = undefined;
}

function openDealSelection(scene: RuntimeGameScene): void {
  if (scene.__day2PlanningOverlay?.active || scene.__day2FeaturedProduct) return;

  const shade = scene.add.rectangle(665, 591, 1330, 1182, 0x071012, 0.76)
    .setInteractive()
    .setDepth(920);
  const panel = scene.add.rectangle(665, 560, 1030, 590, 0x10272a, 0.99)
    .setStrokeStyle(6, 0xffd75a)
    .setDepth(921);
  const eyebrow = scene.add.text(665, 315, "DAY 2 · MORNING DECISION", {
    fontFamily: "Arial",
    fontSize: "21px",
    color: "#ffd75a",
    fontStyle: "bold",
    letterSpacing: 3
  }).setOrigin(0.5).setDepth(922);
  const title = scene.add.text(665, 365, "CHOOSE TODAY'S HOT DEAL", {
    fontFamily: "Arial",
    fontSize: "38px",
    color: "#ffffff",
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(922);
  const subtitle = scene.add.text(665, 420,
    "This drink will sell much faster during the flash sale.\nChoose it now, then prepare matching Back Stock before Rush.", {
      fontFamily: "Arial",
      fontSize: "21px",
      color: "#d9e9e6",
      align: "center",
      lineSpacing: 8
    }).setOrigin(0.5).setDepth(922);

  const cards = (["cola", "water", "milk"] as ProductId[]).map((productId, index) =>
    createDealCard(scene, productId, 355 + index * 310, 610)
  );

  const countdown = scene.add.text(665, 815, `AUTO SELECT IN ${CHOICE_AUTO_SECONDS}`, {
    fontFamily: "Arial",
    fontSize: "18px",
    color: "#a9c2c2",
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(922).setName("deal-choice-countdown");

  scene.__day2PlanningOverlay = scene.add.container(0, 0, [
    shade,
    panel,
    eyebrow,
    title,
    subtitle,
    ...cards,
    countdown
  ]).setDepth(920).setAlpha(0).setScale(0.96);

  scene.tweens.add({
    targets: scene.__day2PlanningOverlay,
    alpha: 1,
    scaleX: 1,
    scaleY: 1,
    duration: 180,
    ease: "Back.Out"
  });

  let seconds = CHOICE_AUTO_SECONDS;
  const tick = (): void => {
    if (!scene.__day2PlanningOverlay?.active || scene.__day2FeaturedProduct) return;
    seconds -= 1;
    countdown.setText(`AUTO SELECT IN ${Math.max(0, seconds)}`);
    if (seconds <= 0) {
      selectFeaturedProduct(scene, "water");
      return;
    }
    scene.time.delayedCall(1000, tick);
  };
  scene.time.delayedCall(1000, tick);
}

function createDealCard(
  scene: RuntimeGameScene,
  productId: ProductId,
  x: number,
  y: number
): Phaser.GameObjects.Container {
  const definition = PRODUCTS[productId];
  const background = scene.add.rectangle(0, 0, 250, 265, 0x1d3438, 1)
    .setStrokeStyle(4, 0x6f8e91);
  const product = scene.add.image(0, -40, definition.productKey).setOrigin(0.5, 1);
  fitImage(product, 82, 145);
  const label = scene.add.text(0, 40, definition.label.toUpperCase(), {
    fontFamily: "Arial",
    fontSize: "26px",
    color: "#ffffff",
    fontStyle: "bold"
  }).setOrigin(0.5);
  const effect = scene.add.text(0, 82, "74% FLASH-SALE BIAS", {
    fontFamily: "Arial",
    fontSize: "14px",
    color: "#ffd75a",
    fontStyle: "bold"
  }).setOrigin(0.5);
  const choose = scene.add.text(0, 112, "SELECT", {
    fontFamily: "Arial",
    fontSize: "18px",
    color: "#ffffff",
    fontStyle: "bold",
    backgroundColor: "#417c50",
    padding: { x: 20, y: 9 }
  }).setOrigin(0.5);
  const hit = scene.add.rectangle(0, 0, 275, 290, 0xffffff, 0.001)
    .setInteractive({ useHandCursor: true });
  const card = scene.add.container(x, y, [background, product, label, effect, choose, hit])
    .setDepth(923);

  hit.on("pointerover", () => card.setScale(1.035));
  hit.on("pointerout", () => card.setScale(1));
  hit.on("pointerdown", () => {
    card.setScale(0.98);
    selectFeaturedProduct(scene, productId);
  });
  return card;
}

function selectFeaturedProduct(scene: RuntimeGameScene, productId: ProductId): void {
  if (scene.__day2FeaturedProduct) return;
  scene.__day2FeaturedProduct = productId;
  scene.__day2PlanningActive = false;

  const overlay = scene.__day2PlanningOverlay;
  scene.__day2PlanningOverlay = undefined;
  if (overlay?.active) {
    scene.tweens.add({
      targets: overlay,
      alpha: 0,
      scaleX: 0.96,
      scaleY: 0.96,
      duration: 150,
      ease: "Cubic.In",
      onComplete: () => overlay.destroy(true)
    });
  }

  createDealBoard(scene);
  scene.showTransientHint(
    `${PRODUCTS[productId].label} selected. Load extra ${PRODUCTS[productId].label} into Back Stock before Rush.`
  );
}

function createDealBoard(scene: RuntimeGameScene): void {
  scene.__day2DealBoard?.destroy(true);
  const background = scene.add.rectangle(0, 0, 445, 112, 0x153036, 0.97)
    .setStrokeStyle(4, 0xffd75a, 0.96);
  const title = scene.add.text(0, -25, "", {
    fontFamily: "Arial",
    fontSize: "22px",
    color: "#fff0a8",
    fontStyle: "bold"
  }).setOrigin(0.5);
  const status = scene.add.text(0, 22, "", {
    fontFamily: "Arial",
    fontSize: "17px",
    color: "#dcebea",
    fontStyle: "bold",
    align: "center"
  }).setOrigin(0.5);

  scene.__day2DealTitle = title;
  scene.__day2DealStatus = status;
  scene.__day2DealBoard = scene.add.container(1040, 255, [background, title, status])
    .setDepth(82)
    .setScale(0.9)
    .setAlpha(0);

  scene.tweens.add({
    targets: scene.__day2DealBoard,
    alpha: 1,
    scaleX: 1,
    scaleY: 1,
    duration: 180,
    ease: "Back.Out"
  });
  refreshDealBoard(scene);
}

function monitorDayTwoFlow(scene: RuntimeGameScene): void {
  if (gameSession.day !== "day02" || scene.shiftEnded) return;

  if (
    scene.phase === "RUSH" &&
    !scene.__rushPreparing &&
    !scene.__finalServiceActive &&
    !scene.__day2PromoStarted &&
    scene.__day2FeaturedProduct
  ) {
    startFlashSale(scene);
  }

  if (scene.__day2PromoActive && (scene.phase === "CLOSING" || scene.__finalServiceActive)) {
    endFlashSale(scene, true);
  }

  refreshDealBoard(scene);
}

function startFlashSale(scene: RuntimeGameScene): void {
  if (scene.__day2PromoStarted || !scene.__day2FeaturedProduct) return;
  scene.__day2PromoStarted = true;
  scene.__day2PromoActive = true;
  scene.__day2PromoSeconds = PROMO_SECONDS;

  const featured = scene.__day2FeaturedProduct;
  scene.showPhaseBanner(`${PRODUCTS[featured].label.toUpperCase()} FLASH SALE!`);
  scene.showTransientHint(
    `20-second challenge: keep ${PRODUCTS[featured].label} available and use Back Stock for 3 emergency saves.`
  );
  scene.startCustomerLoop(PROMO_CUSTOMER_INTERVAL_MS);
  createPromoPanel(scene);
  refreshDealBoard(scene);

  const tick = (): void => {
    if (!scene.scene.isActive() || !scene.__day2PromoActive || scene.shiftEnded) return;
    scene.__day2PromoSeconds = Math.max(0, (scene.__day2PromoSeconds ?? 0) - 1);
    updatePromoPanel(scene);
    refreshDealBoard(scene);

    if ((scene.__day2PromoSeconds ?? 0) <= 0) {
      endFlashSale(scene, false);
      return;
    }
    scene.time.delayedCall(1000, tick);
  };
  scene.time.delayedCall(1000, tick);
}

function createPromoPanel(scene: RuntimeGameScene): void {
  scene.__day2PromoPanel?.destroy(true);
  const featured = scene.__day2FeaturedProduct ?? "water";
  const background = scene.add.rectangle(0, 0, 590, 106, 0x8a4315, 0.97)
    .setStrokeStyle(5, 0xffd75a);
  const title = scene.add.text(-150, -23, `${PRODUCTS[featured].label.toUpperCase()} FLASH SALE`, {
    fontFamily: "Arial",
    fontSize: "21px",
    color: "#fff1af",
    fontStyle: "bold"
  });
  const objective = scene.add.text(-150, 17, `BACK STOCK SAVES 0/${PROMO_TARGET}`, {
    fontFamily: "Arial",
    fontSize: "18px",
    color: "#ffffff",
    fontStyle: "bold"
  });
  const countdown = scene.add.text(210, 0, String(PROMO_SECONDS), {
    fontFamily: "Arial",
    fontSize: "48px",
    color: "#ffffff",
    fontStyle: "bold",
    stroke: "#4a210c",
    strokeThickness: 7
  }).setOrigin(0.5).setName("day2-promo-countdown");
  objective.setName("day2-promo-objective");

  scene.__day2PromoPanel = scene.add.container(665, 335, [background, title, objective, countdown])
    .setDepth(875)
    .setScale(0.88)
    .setAlpha(0);
  scene.tweens.add({
    targets: scene.__day2PromoPanel,
    alpha: 1,
    scaleX: 1,
    scaleY: 1,
    duration: 170,
    ease: "Back.Out"
  });
}

function updatePromoPanel(scene: RuntimeGameScene): void {
  const countdown = scene.__day2PromoPanel?.getByName("day2-promo-countdown") as Phaser.GameObjects.Text | null;
  const objective = scene.__day2PromoPanel?.getByName("day2-promo-objective") as Phaser.GameObjects.Text | null;
  countdown?.setText(String(Math.max(0, scene.__day2PromoSeconds ?? 0)));
  objective?.setText(`BACK STOCK SAVES ${Math.min(PROMO_TARGET, scene.__day2BackStockSaves ?? 0)}/${PROMO_TARGET}`);
}

function endFlashSale(scene: RuntimeGameScene, interrupted: boolean): void {
  if (!scene.__day2PromoActive) return;
  scene.__day2PromoActive = false;
  scene.__day2PromoPanel?.destroy(true);
  scene.__day2PromoPanel = undefined;

  const saves = scene.__day2BackStockSaves ?? 0;
  if (saves >= PROMO_TARGET) {
    scene.showPhaseBanner("HOT DEAL MASTERED!");
    scene.showTransientHint(`Promotion complete. ${saves} emergency saves and the bonus are secured.`);
  } else if (!interrupted) {
    scene.showPhaseBanner("FLASH SALE ENDED");
    scene.showTransientHint(`Flash sale complete. Back Stock saves: ${saves}/${PROMO_TARGET}.`);
  }

  if (scene.phase === "RUSH" && !scene.__finalServiceActive) {
    scene.startCustomerLoop(LEVELS.day02.customerIntervalsMs.rush);
  }
  refreshDealBoard(scene);
}

function refreshDealBoard(scene: RuntimeGameScene): void {
  const featured = scene.__day2FeaturedProduct;
  if (!featured || !scene.__day2DealTitle || !scene.__day2DealStatus) return;

  const saves = scene.__day2BackStockSaves ?? 0;
  const availableCount = scene.shelfSlots.filter(
    (slot) => slot.productId === featured && slot.product
  ).length;
  const label = PRODUCTS[featured].label.toUpperCase();
  scene.__day2DealTitle.setText(`TODAY'S DEAL · ${label}`);

  if (scene.__day2PromoActive) {
    if (availableCount === 0) {
      scene.__day2DealStatus
        .setText(`SOLD OUT · TAP BACK STOCK · SAVES ${saves}/${PROMO_TARGET}`)
        .setColor("#ff8179");
    } else if (availableCount === 1) {
      scene.__day2DealStatus
        .setText(`LOW STOCK · ${scene.__day2PromoSeconds ?? 0}s · SAVES ${saves}/${PROMO_TARGET}`)
        .setColor("#ffd75a");
    } else {
      scene.__day2DealStatus
        .setText(`FLASH SALE ${scene.__day2PromoSeconds ?? 0}s · SAVES ${saves}/${PROMO_TARGET}`)
        .setColor("#dcebea");
    }
    return;
  }

  if (scene.__day2PromoStarted) {
    scene.__day2DealStatus
      .setText(saves >= PROMO_TARGET ? "BONUS SECURED · GREAT STOCK CONTROL" : `PROMO ENDED · SAVES ${saves}/${PROMO_TARGET}`)
      .setColor(saves >= PROMO_TARGET ? "#9ff18d" : "#dcebea");
    return;
  }

  scene.__day2DealStatus
    .setText(`PREPARE BACK STOCK · BONUS TARGET ${PROMO_TARGET} SAVES`)
    .setColor("#dcebea");
}

function recordBackStockSave(scene: RuntimeBackStockScene, game: RuntimeGameScene, productId: ProductId): void {
  if (!game.__day2PromoActive || game.__day2FeaturedProduct !== productId) return;

  game.__day2BackStockSaves = Math.min(PROMO_TARGET, (game.__day2BackStockSaves ?? 0) + 1);
  game.money += PER_SAVE_COINS;
  game.updateHud();
  updatePromoPanel(game);
  refreshDealBoard(game);
  showFloatingText(scene, 1070, 815, `HOT DEAL SAVE +${PER_SAVE_COINS}`, 0x9ff18d);

  if ((game.__day2BackStockSaves ?? 0) >= PROMO_TARGET && !game.__day2PromoBonusClaimed) {
    game.__day2PromoBonusClaimed = true;
    game.money += COMPLETION_BONUS;
    game.updateHud();
    game.showPhaseBanner("PROMOTION MASTERED!");
    game.showTransientHint(`Three emergency saves complete. Bonus +${COMPLETION_BONUS} coins.`);
    showFloatingText(scene, 1070, 765, `CHALLENGE BONUS +${COMPLETION_BONUS}`, 0xffe16d);
  }
}

const backStockPrototype = BackStockScene.prototype as unknown as BackStockPrototype;
const originalQuickRestock = backStockPrototype.quickRestock;

backStockPrototype.quickRestock = function quickRestockWithDayTwoChallenge(productId: ProductId): void {
  const scene = this as unknown as RuntimeBackStockScene;
  const game = scene.gameScene;
  const beforeInventory = scene.inventory?.[productId] ?? 0;
  const hadGap = Boolean(game?.shelfSlots.some(
    (slot) => slot.productId === productId && !slot.product
  ));
  const wasBusy = Boolean(game?.restockBusy);

  originalQuickRestock.call(this, productId);

  const succeeded = Boolean(
    game &&
    !wasBusy &&
    hadGap &&
    beforeInventory > 0 &&
    game.restockBusy &&
    (scene.inventory?.[productId] ?? beforeInventory) < beforeInventory
  );
  if (succeeded && game) recordBackStockSave(scene, game, productId);
};

function showFloatingText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  message: string,
  color: number
): void {
  const text = scene.add.text(x, y, message, {
    fontFamily: "Arial",
    fontSize: "23px",
    color: `#${color.toString(16).padStart(6, "0")}`,
    fontStyle: "bold",
    stroke: "#172020",
    strokeThickness: 6,
    align: "center"
  }).setOrigin(0.5).setDepth(900);
  scene.tweens.add({
    targets: text,
    y: y - 58,
    alpha: 0,
    duration: 850,
    ease: "Cubic.Out",
    onComplete: () => text.destroy()
  });
}

function cleanupDayTwo(scene: RuntimeGameScene, monitor: () => void): void {
  scene.events.off(Phaser.Scenes.Events.POST_UPDATE, monitor);
  scene.__day2PlanningOverlay?.destroy(true);
  scene.__day2PromoPanel?.destroy(true);
  scene.__day2DealBoard?.destroy(true);
  scene.__day2PlanningOverlay = undefined;
  scene.__day2PromoPanel = undefined;
  scene.__day2DealBoard = undefined;
  scene.__day2DealTitle = undefined;
  scene.__day2DealStatus = undefined;
  scene.__day2Monitor = undefined;
}

function fitImage(image: Phaser.GameObjects.Image, maxWidth: number, maxHeight: number): void {
  const width = Math.max(1, image.width);
  const height = Math.max(1, image.height);
  image.setScale(Math.min(maxWidth / width, maxHeight / height));
}
