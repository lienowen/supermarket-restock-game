import Phaser from "phaser";
import { AssetPaths, Assets } from "./assets";
import type { ProductId } from "./gameConfig";
import { OpeningScene } from "./scenes/OpeningScene";

const ACTIVE_DAY_KEY = "supermarket.activeDay";
const HANDLING_UPGRADE_KEY = "supermarket.upgrade.handling";
const DELIVERY_READY_KEY = "supermarket.deliveryReady";
const CHECK = "\u2713";
const OPEN = "\u25CB";

type OpeningDay = "day01" | "day02" | "day03";

type RuntimeOpeningScene = Phaser.Scene & {
  finished: boolean;
  finishOpening: () => void;
};

type OpeningPrototype = {
  preload: () => void;
  create: () => void;
};

type DeliveryCase = {
  productId: ProductId;
  image: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  homeX: number;
  homeY: number;
  targetX: number;
  targetY: number;
  unloaded: boolean;
};

const DEPTH = {
  background: 0,
  shade: 1,
  floor: 3,
  truckShadow: 6,
  truck: 7,
  caseShadow: 9,
  case: 10,
  workerShadow: 11,
  worker: 12,
  hud: 30,
  button: 40,
  modal: 100
} as const;

const prototype = OpeningScene.prototype as unknown as OpeningPrototype;
const originalPreload = prototype.preload;

prototype.preload = function preloadUnifiedOpeningOperations(): void {
  originalPreload.call(this);
  const scene = this as unknown as Phaser.Scene;

  Object.values(Assets.delivery).forEach((rawKey) => {
    const key = rawKey as keyof typeof AssetPaths;
    if (!scene.textures.exists(key)) scene.load.image(key, AssetPaths[key]);
  });
};

prototype.create = function createUnifiedOpeningOperations(): void {
  const scene = this as unknown as RuntimeOpeningScene;
  scene.finished = false;

  const day = resolveDay();
  const dayNumber = Number(day.slice(-2));
  const handlingLevel = readNumber(HANDLING_UPGRADE_KEY, 0);
  const unloadDuration = Math.max(180, 430 - handlingLevel * 70);
  const deliveryOrder: ProductId[] = day === "day01"
    ? ["cola", "water", "milk"]
    : ["cola", "water", "milk", "cola"];

  const receivingBounds = new Phaser.Geom.Rectangle(790, 690, 470, 285);
  const deliveryCases: DeliveryCase[] = [];
  let completedSteps = 0;
  let unloadedCount = 0;
  let draggingCase: DeliveryCase | undefined;
  let actionButton: Phaser.GameObjects.Container | undefined;
  let invoicePanel: Phaser.GameObjects.Container | undefined;

  scene.cameras.main.setBackgroundColor("#0b1517");

  const background = scene.add.image(665, 591, Assets.delivery.loadingBay)
    .setDepth(DEPTH.background);
  coverImage(background, 1330, 1182);

  scene.add.rectangle(665, 591, 1330, 1182, 0x061012, 0.12)
    .setDepth(DEPTH.shade);

  scene.add.rectangle(665, 70, 1330, 140, 0x0b1719, 0.96)
    .setStrokeStyle(2, 0x3f5558)
    .setDepth(DEPTH.hud);

  scene.add.text(42, 25, `DAY ${dayNumber} · MORNING SHIFT`, {
    fontFamily: "Arial",
    fontSize: "34px",
    color: "#ffffff",
    fontStyle: "bold"
  }).setDepth(DEPTH.hud + 1);

  scene.add.text(42, 78, "PRE-OPENING OPERATIONS", {
    fontFamily: "Arial",
    fontSize: "20px",
    color: "#bfe88a",
    fontStyle: "bold",
    letterSpacing: 3
  }).setDepth(DEPTH.hud + 1);

  const progressText = scene.add.text(1240, 56, "0/4", {
    fontFamily: "Arial",
    fontSize: "31px",
    color: "#ffffff",
    fontStyle: "bold",
    backgroundColor: "#315f4b",
    padding: { x: 18, y: 10 }
  }).setOrigin(0.5).setDepth(DEPTH.hud + 1);

  scene.add.rectangle(215, 325, 350, 270, 0x071416, 0.82)
    .setStrokeStyle(2, 0xd7c879, 0.62)
    .setDepth(DEPTH.hud);

  scene.add.text(70, 225, "OPENING CHECKLIST", {
    fontFamily: "Arial",
    fontSize: "21px",
    color: "#f7e8a9",
    fontStyle: "bold"
  }).setDepth(DEPTH.hud + 1);

  const checklist = scene.add.text(70, 280, "", {
    fontFamily: "Arial",
    fontSize: "19px",
    color: "#dce9e4",
    lineSpacing: 16
  }).setDepth(DEPTH.hud + 1);

  scene.add.rectangle(835, 285, 760, 190, 0x071416, 0.77)
    .setStrokeStyle(2, 0x789d89, 0.54)
    .setDepth(DEPTH.hud);

  const title = scene.add.text(835, 235, "CLOCK IN FOR YOUR SHIFT", {
    fontFamily: "Arial",
    fontSize: "34px",
    color: "#ffffff",
    fontStyle: "bold",
    align: "center"
  }).setOrigin(0.5).setDepth(DEPTH.hud + 1);

  const instruction = scene.add.text(835, 310, "Press CLOCK IN to begin the receiving shift.", {
    fontFamily: "Arial",
    fontSize: "20px",
    color: "#d8e7df",
    align: "center",
    wordWrap: { width: 680 },
    lineSpacing: 8
  }).setOrigin(0.5).setDepth(DEPTH.hud + 1);

  scene.add.rectangle(
    receivingBounds.centerX,
    receivingBounds.centerY,
    receivingBounds.width,
    receivingBounds.height,
    0x173f35,
    0.28
  ).setStrokeStyle(4, 0x93c38f, 0.85)
    .setDepth(DEPTH.floor);

  scene.add.text(receivingBounds.centerX, receivingBounds.y + 36, "RECEIVING ZONE", {
    fontFamily: "Arial",
    fontSize: "22px",
    color: "#d9f3d2",
    fontStyle: "bold",
    backgroundColor: "#16342d",
    padding: { x: 18, y: 9 }
  }).setOrigin(0.5).setDepth(DEPTH.hud);

  const receivingLabel = scene.add.text(
    receivingBounds.centerX,
    receivingBounds.bottom - 35,
    `CASES RECEIVED 0/${deliveryOrder.length}`,
    {
      fontFamily: "Arial",
      fontSize: "21px",
      color: "#ffffff",
      fontStyle: "bold",
      backgroundColor: "#071416",
      padding: { x: 20, y: 10 }
    }
  ).setOrigin(0.5).setDepth(DEPTH.hud);

  const truckShadow = scene.add.ellipse(-430, 1010, 480, 58, 0x000000, 0.26)
    .setDepth(DEPTH.truckShadow);
  const truck = scene.add.image(-430, 1000, Assets.delivery.truckArrive)
    .setOrigin(0.5, 1)
    .setDepth(DEPTH.truck);
  fitImage(truck, 525, 320);

  const workerShadow = scene.add.ellipse(690, 1013, 94, 26, 0x000000, 0.25)
    .setDepth(DEPTH.workerShadow);
  const worker = scene.add.image(690, 1015, Assets.delivery.workerIdle)
    .setOrigin(0.5, 1)
    .setDepth(DEPTH.worker);
  fitImage(worker, 135, 255);

  const refreshChecklist = (): void => {
    const labels = ["Clock in", "Unload delivery", "Check invoice", "Move stock inside"];
    checklist.setText(labels.map((label, index) => `${index < completedSteps ? CHECK : OPEN} ${label}`).join("\n"));
    progressText.setText(`${completedSteps}/4`);
  };

  const setAction = (label: string, action: () => void, color = 0x5f9a56): void => {
    actionButton?.destroy(true);
    const backgroundButton = scene.add.rectangle(0, 0, 420, 84, color, 1)
      .setStrokeStyle(4, 0xd8efaf)
      .setInteractive({ useHandCursor: true });
    const labelText = scene.add.text(0, 0, label, {
      fontFamily: "Arial",
      fontSize: "25px",
      color: "#ffffff",
      fontStyle: "bold",
      align: "center"
    }).setOrigin(0.5);
    actionButton = scene.add.container(835, 1085, [backgroundButton, labelText])
      .setDepth(DEPTH.button);
    backgroundButton.on("pointerover", () => actionButton?.setScale(1.025));
    backgroundButton.on("pointerout", () => actionButton?.setScale(1));
    backgroundButton.on("pointerdown", action);
  };

  const updateInstruction = (): void => {
    const remaining = deliveryOrder.length - unloadedCount;
    if (remaining <= 0) {
      instruction.setText("All cases are in the receiving zone. Select CHECK DELIVERY to verify the invoice.");
      return;
    }
    instruction.setText(
      `Drag a case from the open truck into the green receiving zone. ${remaining} case${remaining === 1 ? "" : "s"} remaining.`
    );
  };

  const returnCaseHome = (deliveryCase: DeliveryCase): void => {
    scene.tweens.add({
      targets: deliveryCase.image,
      x: deliveryCase.homeX,
      y: deliveryCase.homeY,
      duration: 180,
      ease: "Sine.Out"
    });
  };

  const completeCaseDrop = (deliveryCase: DeliveryCase): void => {
    deliveryCase.unloaded = true;
    deliveryCase.image.disableInteractive();
    scene.tweens.add({
      targets: deliveryCase.image,
      x: deliveryCase.targetX,
      y: deliveryCase.targetY,
      duration: unloadDuration,
      ease: "Cubic.Out",
      onComplete: () => {
        unloadedCount += 1;
        receivingLabel.setText(`CASES RECEIVED ${unloadedCount}/${deliveryOrder.length}`);
        worker.setTexture(Assets.delivery.workerIdle);
        fitImage(worker, 135, 255);
        worker.setPosition(720, 1015);
        updateInstruction();

        if (unloadedCount >= deliveryOrder.length) {
          completedSteps = 2;
          refreshChecklist();
          title.setText("DELIVERY UNLOADED");
          truck.setTexture(Assets.delivery.truckEmpty);
          fitImage(truck, 525, 320);
          setAction("CHECK DELIVERY", showInvoice, 0x315f7d);
        }
      }
    });
  };

  const createDeliveryCases = (): void => {
    const truckHomes = [
      { x: 335, y: 810 },
      { x: 430, y: 810 },
      { x: 345, y: 895 },
      { x: 440, y: 895 }
    ];
    const receivingTargets = [
      { x: 865, y: 840 },
      { x: 985, y: 875 },
      { x: 1105, y: 840 },
      { x: 955, y: 955 }
    ];

    deliveryOrder.forEach((productId, index) => {
      const texture = productId === "cola"
        ? Assets.delivery.boxCola
        : productId === "water"
          ? Assets.delivery.boxWater
          : Assets.delivery.boxMilk;
      const home = truckHomes[index];
      const target = receivingTargets[index];
      const shadow = scene.add.ellipse(home.x, home.y - 2, 72, 18, 0x000000, 0.24)
        .setDepth(DEPTH.caseShadow);
      const image = scene.add.image(home.x, home.y, texture)
        .setOrigin(0.5, 1)
        .setDepth(DEPTH.case)
        .setInteractive({ useHandCursor: true });
      fitImage(image, 96, 86);
      scene.input.setDraggable(image);

      const deliveryCase: DeliveryCase = {
        productId,
        image,
        shadow,
        homeX: home.x,
        homeY: home.y,
        targetX: target.x,
        targetY: target.y,
        unloaded: false
      };
      deliveryCases.push(deliveryCase);

      image.on("dragstart", () => {
        if (deliveryCase.unloaded || draggingCase) return;
        draggingCase = deliveryCase;
        image.setDepth(DEPTH.case + 3).setTint(0xfff0b8);
        worker.setTexture(Assets.delivery.workerCarry);
        fitImage(worker, 140, 260);
        scene.tweens.add({
          targets: worker,
          x: 680,
          y: 1015,
          duration: 130,
          ease: "Sine.Out"
        });
      });

      image.on("drag", (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
        if (draggingCase !== deliveryCase || deliveryCase.unloaded) return;
        image.setPosition(dragX, dragY);
      });

      image.on("dragend", () => {
        if (draggingCase !== deliveryCase || deliveryCase.unloaded) return;
        draggingCase = undefined;
        image.clearTint().setDepth(DEPTH.case);

        if (Phaser.Geom.Rectangle.Contains(receivingBounds, image.x, image.y)) {
          completeCaseDrop(deliveryCase);
        } else {
          worker.setTexture(Assets.delivery.workerIdle);
          fitImage(worker, 135, 255);
          returnCaseHome(deliveryCase);
          instruction.setText("Drop the case inside the green receiving zone.");
        }
      });
    });
  };

  const syncShadows = (): void => {
    truckShadow.setPosition(truck.x, truck.y - 7).setAlpha(truck.alpha * 0.26);
    workerShadow.setPosition(worker.x, worker.y - 5).setAlpha(worker.alpha * 0.25);
    deliveryCases.forEach((deliveryCase) => {
      if (!deliveryCase.image.active) {
        deliveryCase.shadow.setVisible(false);
        return;
      }
      deliveryCase.shadow
        .setVisible(true)
        .setPosition(deliveryCase.image.x, deliveryCase.image.y - 2)
        .setAlpha(deliveryCase.image.alpha * 0.24);
    });
  };

  const shadowTimer = scene.time.addEvent({ delay: 50, loop: true, callback: syncShadows });
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => shadowTimer.remove(false));

  function showInvoice(): void {
    if (invoicePanel?.active) return;
    const counts = deliveryOrder.reduce<Record<ProductId, number>>((result, productId) => {
      result[productId] += 1;
      return result;
    }, { cola: 0, water: 0, milk: 0 });

    const shade = scene.add.rectangle(665, 591, 1330, 1182, 0x061012, 0.7)
      .setInteractive();
    const backgroundPanel = scene.add.rectangle(665, 600, 690, 590, 0xf2ead9, 0.995)
      .setStrokeStyle(7, 0x4b7259);
    const noteIcon = scene.add.image(665, 385, Assets.delivery.deliveryNote).setOrigin(0.5);
    fitImage(noteIcon, 155, 120);
    const invoiceTitle = scene.add.text(665, 455, "DELIVERY NOTE", {
      fontFamily: "Arial",
      fontSize: "37px",
      color: "#24352d",
      fontStyle: "bold"
    }).setOrigin(0.5);
    const invoiceText = scene.add.text(665, 590, [
      `COLA CASES       ${counts.cola}/${counts.cola}   ${CHECK}`,
      `WATER CASES      ${counts.water}/${counts.water}   ${CHECK}`,
      `MILK CASES       ${counts.milk}/${counts.milk}   ${CHECK}`,
      "",
      `TOTAL RECEIVED   ${deliveryOrder.length}/${deliveryOrder.length}`
    ].join("\n"), {
      fontFamily: "Arial",
      fontSize: "26px",
      color: "#273b31",
      fontStyle: "bold",
      lineSpacing: 18
    }).setOrigin(0.5);
    const acceptBg = scene.add.rectangle(665, 830, 360, 82, 0x4f8b4c, 1)
      .setInteractive({ useHandCursor: true });
    const acceptText = scene.add.text(665, 830, "ACCEPT DELIVERY", {
      fontFamily: "Arial",
      fontSize: "25px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5);

    invoicePanel = scene.add.container(0, 0, [
      shade,
      backgroundPanel,
      noteIcon,
      invoiceTitle,
      invoiceText,
      acceptBg,
      acceptText
    ]).setDepth(DEPTH.modal);

    const acceptDelivery = (): void => {
      invoicePanel?.destroy(true);
      invoicePanel = undefined;
      completedSteps = 3;
      refreshChecklist();
      title.setText("DELIVERY ACCEPTED");
      instruction.setText("The invoice matches. Move the received cases through the stockroom door.");
      setAction("MOVE STOCK INSIDE", moveStockInside, 0x8a5b18);
    };

    acceptBg.on("pointerdown", acceptDelivery);
    acceptText.setInteractive({ useHandCursor: true }).on("pointerdown", acceptDelivery);
  }

  function moveStockInside(): void {
    actionButton?.destroy(true);
    actionButton = undefined;
    worker.setTexture(Assets.delivery.workerPush);
    fitImage(worker, 150, 265);

    deliveryCases.forEach((deliveryCase, index) => {
      scene.tweens.add({
        targets: deliveryCase.image,
        x: 1210,
        y: 660 - index * 18,
        alpha: 0,
        duration: 480 + index * 90,
        ease: "Sine.In",
        onComplete: () => deliveryCase.image.destroy()
      });
    });

    scene.tweens.add({
      targets: worker,
      x: 1110,
      y: 880,
      duration: 680,
      ease: "Sine.InOut",
      onComplete: () => {
        completedSteps = 4;
        refreshChecklist();
        title.setText("STOCK IS IN THE BACKROOM");
        instruction.setText("Receiving is complete. Enter the backroom and prepare the sales floor.");
        truck.setTexture(Assets.delivery.truckLeave);
        fitImage(truck, 525, 320);
        scene.tweens.add({ targets: truck, x: -430, duration: 950, ease: "Cubic.In" });

        try {
          globalThis.localStorage?.setItem(DELIVERY_READY_KEY, day);
        } catch {
          // The scene completion state is also used as a fallback by the delivery gate.
        }

        setAction("ENTER BACKROOM", () => scene.finishOpening(), 0x5f9a56);
      }
    });
  }

  setAction("CLOCK IN", () => {
    completedSteps = 1;
    refreshChecklist();
    actionButton?.destroy(true);
    actionButton = undefined;
    title.setText("DELIVERY TRUCK ARRIVING");
    instruction.setText("Wait for the truck to stop. The rear door will open automatically.");

    scene.tweens.add({
      targets: truck,
      x: 350,
      duration: 950,
      ease: "Cubic.Out",
      onComplete: () => {
        truck.setTexture(Assets.delivery.truckDoorOpen);
        fitImage(truck, 525, 320);
        title.setText("UNLOAD THE DELIVERY");
        createDeliveryCases();
        updateInstruction();
      }
    });
  });

  refreshChecklist();
};

function fitImage(image: Phaser.GameObjects.Image, maxWidth: number, maxHeight: number): void {
  const width = Math.max(1, image.frame.realWidth || image.width);
  const height = Math.max(1, image.frame.realHeight || image.height);
  image.setScale(Math.min(maxWidth / width, maxHeight / height));
}

function coverImage(image: Phaser.GameObjects.Image, width: number, height: number): void {
  const sourceWidth = Math.max(1, image.frame.realWidth || image.width);
  const sourceHeight = Math.max(1, image.frame.realHeight || image.height);
  image.setScale(Math.max(width / sourceWidth, height / sourceHeight));
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
