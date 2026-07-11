import Phaser from "phaser";
import { AssetPaths, Assets } from "./assets";
import type { ProductId } from "./gameConfig";
import { OpeningScene } from "./scenes/OpeningScene";

const ACTIVE_DAY_KEY = "supermarket.activeDay";
const HANDLING_UPGRADE_KEY = "supermarket.upgrade.handling";
const DELIVERY_READY_KEY = "supermarket.deliveryReady";

type OpeningDay = "day01" | "day02" | "day03";

type RuntimeOpeningScene = Phaser.Scene & {
  finished: boolean;
  finishOpening: () => void;
  coverImage: (image: Phaser.GameObjects.Image, width: number, height: number) => void;
};

type OpeningPrototype = {
  preload: () => void;
  create: () => void;
};

type DeliveryCase = {
  productId: ProductId;
  image: Phaser.GameObjects.Image;
  unloaded: boolean;
};

const prototype = OpeningScene.prototype as unknown as OpeningPrototype;
const originalPreload = prototype.preload;

prototype.preload = function preloadOpeningOperations(): void {
  originalPreload.call(this);
  const scene = this as unknown as Phaser.Scene;
  const keys = [
    Assets.storefront.day,
    Assets.characters.workerIdle,
    Assets.props.boxCola,
    Assets.props.boxWater,
    Assets.props.boxMilk
  ] as const;

  keys.forEach((key) => {
    const assetKey = key as keyof typeof AssetPaths;
    if (!scene.textures.exists(assetKey)) scene.load.image(assetKey, AssetPaths[assetKey]);
  });
};

prototype.create = function createInteractiveOpeningShift(): void {
  const scene = this as unknown as RuntimeOpeningScene;
  scene.finished = false;

  const day = resolveDay();
  const dayNumber = Number(day.slice(-2));
  const handlingLevel = readNumber(HANDLING_UPGRADE_KEY, 0);
  const unloadDuration = Math.max(220, 520 - handlingLevel * 110);
  const deliveryOrder: ProductId[] = day === "day01"
    ? ["cola", "water", "milk"]
    : ["cola", "water", "milk", "cola"];

  scene.cameras.main.setBackgroundColor("#0b1517");
  const background = scene.add.image(665, 591, Assets.storefront.day).setDepth(0);
  scene.coverImage(background, 1330, 1182);
  scene.add.rectangle(665, 591, 1330, 1182, 0x061012, 0.48).setDepth(1);

  scene.add.rectangle(665, 70, 1330, 140, 0x0b1719, 0.97)
    .setStrokeStyle(2, 0x3f5558)
    .setDepth(20);
  scene.add.text(42, 25, `DAY ${dayNumber} · MORNING SHIFT`, {
    fontFamily: "Arial",
    fontSize: "34px",
    color: "#ffffff",
    fontStyle: "bold"
  }).setDepth(21);
  scene.add.text(42, 78, "PRE-OPENING OPERATIONS", {
    fontFamily: "Arial",
    fontSize: "20px",
    color: "#bfe88a",
    fontStyle: "bold",
    letterSpacing: 3
  }).setDepth(21);

  const progressText = scene.add.text(1240, 56, "1/4", {
    fontFamily: "Arial",
    fontSize: "31px",
    color: "#ffffff",
    fontStyle: "bold",
    backgroundColor: "#315f4b",
    padding: { x: 18, y: 10 }
  }).setOrigin(0.5).setDepth(21);

  const panel = scene.add.rectangle(665, 620, 1100, 830, 0x102126, 0.94)
    .setStrokeStyle(5, 0x6f9166)
    .setDepth(4);

  const checklistTitle = scene.add.text(175, 245, "OPENING CHECKLIST", {
    fontFamily: "Arial",
    fontSize: "25px",
    color: "#f7e8a9",
    fontStyle: "bold"
  }).setDepth(7);

  const checklist = scene.add.text(175, 305, "○ Clock in\n○ Unload delivery\n○ Check invoice\n○ Move stock inside", {
    fontFamily: "Arial",
    fontSize: "23px",
    color: "#dce9e4",
    lineSpacing: 20
  }).setDepth(7);

  const title = scene.add.text(765, 245, "CLOCK IN FOR YOUR SHIFT", {
    fontFamily: "Arial",
    fontSize: "37px",
    color: "#ffffff",
    fontStyle: "bold",
    align: "center"
  }).setOrigin(0.5).setDepth(7);

  const instruction = scene.add.text(765, 315, "Start like a real store employee: clock in before touching the delivery.", {
    fontFamily: "Arial",
    fontSize: "23px",
    color: "#d8e7df",
    align: "center",
    wordWrap: { width: 700 },
    lineSpacing: 8
  }).setOrigin(0.5).setDepth(7);

  scene.add.rectangle(290, 725, 315, 410, 0x142b31, 0.92)
    .setStrokeStyle(3, 0x48666d)
    .setDepth(5);
  const worker = scene.add.image(290, 910, Assets.characters.workerIdle)
    .setOrigin(0.5, 1)
    .setDepth(8);
  fitImage(worker, 225, 420);

  const dockLabel = scene.add.text(775, 430, "RECEIVING BAY", {
    fontFamily: "Arial",
    fontSize: "24px",
    color: "#9fd0bd",
    fontStyle: "bold",
    backgroundColor: "#173238",
    padding: { x: 18, y: 9 }
  }).setOrigin(0.5).setDepth(7);

  const receivingFloor = scene.add.rectangle(790, 835, 675, 220, 0x263b3f, 0.72)
    .setStrokeStyle(4, 0x6e858b)
    .setDepth(5);
  const receivingLabel = scene.add.text(790, 920, "UNLOADED CASES 0/" + deliveryOrder.length, {
    fontFamily: "Arial",
    fontSize: "22px",
    color: "#ffffff",
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(8);

  void panel;
  void checklistTitle;
  void dockLabel;
  void receivingFloor;

  const truck = createDeliveryTruck(scene);
  truck.setPosition(-520, 660).setDepth(9);

  const deliveryCases: DeliveryCase[] = [];
  const targetPositions = deliveryOrder.map((_, index) => ({
    x: 560 + (index % 4) * 155,
    y: 850 - Math.floor(index / 4) * 125
  }));

  let completedSteps = 0;
  let unloadedCount = 0;
  let actionButton: Phaser.GameObjects.Container | undefined;
  let invoicePanel: Phaser.GameObjects.Container | undefined;

  const refreshChecklist = (): void => {
    const completed = [
      completedSteps >= 1,
      completedSteps >= 2,
      completedSteps >= 3,
      completedSteps >= 4
    ];
    const labels = ["Clock in", "Unload delivery", "Check invoice", "Move stock inside"];
    checklist.setText(labels.map((label, index) => `${completed[index] ? "✓" : "○"} ${label}`).join("\n"));
    progressText.setText(`${Math.min(4, completedSteps + 1)}/4`);
  };

  const setAction = (label: string, action: () => void, color = 0x5f9a56): void => {
    actionButton?.destroy(true);
    const backgroundButton = scene.add.rectangle(0, 0, 430, 94, color, 1)
      .setStrokeStyle(4, 0xd8efaf)
      .setInteractive({ useHandCursor: true });
    const labelText = scene.add.text(0, 0, label, {
      fontFamily: "Arial",
      fontSize: "27px",
      color: "#ffffff",
      fontStyle: "bold",
      align: "center"
    }).setOrigin(0.5);
    actionButton = scene.add.container(790, 1040, [backgroundButton, labelText]).setDepth(30);
    backgroundButton.on("pointerover", () => actionButton?.setScale(1.025));
    backgroundButton.on("pointerout", () => actionButton?.setScale(1));
    backgroundButton.on("pointerdown", action);
  };

  const showDeliveryCases = (): void => {
    deliveryOrder.forEach((productId, index) => {
      const texture = productId === "cola"
        ? Assets.props.boxCola
        : productId === "water"
          ? Assets.props.boxWater
          : Assets.props.boxMilk;
      const startX = 470 + (index % 2) * 145;
      const startY = 650 + Math.floor(index / 2) * 125;
      const image = scene.add.image(startX, startY, texture)
        .setOrigin(0.5, 1)
        .setDepth(14)
        .setInteractive({ useHandCursor: true });
      fitImage(image, 120, 112);
      const deliveryCase: DeliveryCase = { productId, image, unloaded: false };
      deliveryCases.push(deliveryCase);

      image.on("pointerdown", () => {
        if (deliveryCase.unloaded) return;
        deliveryCase.unloaded = true;
        image.disableInteractive();
        const target = targetPositions[index];
        worker.setTexture(Assets.characters.workerIdle);
        scene.tweens.add({
          targets: worker,
          x: target.x - 80,
          y: 900,
          duration: unloadDuration,
          ease: "Sine.InOut"
        });
        scene.tweens.add({
          targets: image,
          x: target.x,
          y: target.y,
          duration: unloadDuration,
          ease: "Cubic.Out",
          onComplete: () => {
            unloadedCount += 1;
            receivingLabel.setText(`UNLOADED CASES ${unloadedCount}/${deliveryOrder.length}`);
            if (unloadedCount >= deliveryOrder.length) {
              completedSteps = 2;
              refreshChecklist();
              title.setText("DELIVERY UNLOADED");
              instruction.setText("All cases are in the receiving bay. Check the invoice before accepting stock.");
              setAction("CHECK DELIVERY", showInvoice, 0x315f7d);
            }
          }
        });
      });
    });
  };

  const acceptDelivery = (): void => {
    invoicePanel?.destroy(true);
    invoicePanel = undefined;
    completedSteps = 3;
    refreshChecklist();
    title.setText("DELIVERY ACCEPTED");
    instruction.setText("The quantity matches the delivery note. Move the cases through the stockroom door.");
    setAction("MOVE STOCK INSIDE", () => {
      actionButton?.destroy(true);
      actionButton = undefined;
      deliveryCases.forEach((deliveryCase, index) => {
        scene.tweens.add({
          targets: deliveryCase.image,
          x: 360,
          y: 600 - index * 18,
          alpha: 0,
          duration: 480 + index * 80,
          ease: "Sine.In",
          onComplete: () => deliveryCase.image.destroy()
        });
      });
      scene.tweens.add({
        targets: worker,
        x: 390,
        duration: 520,
        ease: "Sine.InOut",
        onComplete: () => {
          completedSteps = 4;
          refreshChecklist();
          progressText.setText("4/4");
          title.setText("STOCK IS IN THE BACKROOM");
          instruction.setText("Next duty: load the cart, fill the shelf, test the register and unlock the doors.");
          try {
            globalThis.localStorage?.setItem(DELIVERY_READY_KEY, day);
          } catch {
            // The current browser session can continue without persistence.
          }
          setAction("ENTER BACKROOM", () => scene.finishOpening(), 0x5f9a56);
        }
      });
    }, 0x8a5b18);
  };

  function showInvoice(): void {
    if (invoicePanel?.active) return;
    const counts = deliveryOrder.reduce<Record<ProductId, number>>((result, productId) => {
      result[productId] += 1;
      return result;
    }, { cola: 0, water: 0, milk: 0 });

    const shade = scene.add.rectangle(665, 591, 1330, 1182, 0x061012, 0.68).setInteractive();
    const backgroundPanel = scene.add.rectangle(665, 600, 690, 590, 0xf2ead9, 0.99)
      .setStrokeStyle(7, 0x4b7259);
    const invoiceTitle = scene.add.text(665, 355, "DELIVERY NOTE", {
      fontFamily: "Arial",
      fontSize: "39px",
      color: "#24352d",
      fontStyle: "bold"
    }).setOrigin(0.5);
    const invoiceText = scene.add.text(665, 480, [
      `COLA CASES       ${counts.cola}/${counts.cola}   ✓`,
      `WATER CASES      ${counts.water}/${counts.water}   ✓`,
      `MILK CASES       ${counts.milk}/${counts.milk}   ✓`,
      "",
      `TOTAL RECEIVED   ${deliveryOrder.length}/${deliveryOrder.length}`
    ].join("\n"), {
      fontFamily: "Arial",
      fontSize: "27px",
      color: "#273b31",
      fontStyle: "bold",
      lineSpacing: 18
    }).setOrigin(0.5);
    const acceptBg = scene.add.rectangle(665, 790, 360, 88, 0x4f8b4c, 1)
      .setInteractive({ useHandCursor: true });
    const acceptText = scene.add.text(665, 790, "ACCEPT DELIVERY", {
      fontFamily: "Arial",
      fontSize: "27px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5);
    invoicePanel = scene.add.container(0, 0, [shade, backgroundPanel, invoiceTitle, invoiceText, acceptBg, acceptText])
      .setDepth(120);
    acceptBg.on("pointerdown", acceptDelivery);
    acceptText.setInteractive({ useHandCursor: true }).on("pointerdown", acceptDelivery);
  }

  setAction("CLOCK IN", () => {
    completedSteps = 1;
    refreshChecklist();
    actionButton?.destroy(true);
    actionButton = undefined;
    title.setText("DELIVERY TRUCK ARRIVING");
    instruction.setText("Wait for the truck to stop, then tap each case to unload it into the receiving bay.");
    scene.tweens.add({
      targets: truck,
      x: 360,
      duration: 950,
      ease: "Cubic.Out",
      onComplete: () => {
        title.setText("UNLOAD THE DELIVERY");
        instruction.setText(`Tap all ${deliveryOrder.length} cases. Handling training level ${handlingLevel} controls unloading speed.`);
        showDeliveryCases();
      }
    });
  });

  refreshChecklist();
};

function createDeliveryTruck(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const body = scene.add.rectangle(0, 0, 480, 230, 0xe9ece9, 1)
    .setStrokeStyle(6, 0x33464b);
  const stripe = scene.add.rectangle(-40, 12, 390, 48, 0x5f9a56, 1);
  const cab = scene.add.rectangle(300, 50, 180, 170, 0xf2b74f, 1)
    .setStrokeStyle(6, 0x604719);
  const window = scene.add.rectangle(305, 15, 100, 65, 0x85b7c6, 1)
    .setStrokeStyle(3, 0x2c4f59);
  const wheelLeft = scene.add.circle(-145, 125, 48, 0x20292b, 1)
    .setStrokeStyle(9, 0x7b8585);
  const wheelRight = scene.add.circle(260, 125, 48, 0x20292b, 1)
    .setStrokeStyle(9, 0x7b8585);
  const label = scene.add.text(-40, -45, "FRESH MART\nDELIVERY", {
    fontFamily: "Arial",
    fontSize: "28px",
    color: "#24452d",
    fontStyle: "bold",
    align: "center"
  }).setOrigin(0.5);
  return scene.add.container(0, 0, [body, stripe, cab, window, wheelLeft, wheelRight, label]);
}

function fitImage(image: Phaser.GameObjects.Image, maxWidth: number, maxHeight: number): void {
  const width = Math.max(1, image.width);
  const height = Math.max(1, image.height);
  image.setScale(Math.min(maxWidth / width, maxHeight / height));
}

function resolveDay(): OpeningDay {
  const queryDay = new URLSearchParams(window.location.search).get("day");
  if (queryDay === "3" || queryDay === "day03") return "day03";
  if (queryDay === "2" || queryDay === "day02") return "day02";
  try {
    const stored = globalThis.localStorage?.getItem(ACTIVE_DAY_KEY);
    if (stored === "day03") return "day03";
    if (stored === "day02") return "day02";
  } catch {
    // Default to the first shift when storage is unavailable.
  }
  return "day01";
}

function readNumber(key: string, fallback: number): number {
  try {
    const value = Number(globalThis.localStorage?.getItem(key));
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
  } catch {
    return fallback;
  }
}
