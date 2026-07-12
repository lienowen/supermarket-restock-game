import Phaser from "phaser";
import { AssetPaths, Assets } from "./assets";
import { OpeningScene } from "./scenes/OpeningScene";

type OpeningPrototype = {
  preload: () => void;
  create: () => void;
};

type DeliveryTruckState = "ARRIVE" | "OPEN" | "EMPTY" | "LEAVE";

type CaseVisual = {
  image: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
};

type CompositionRefs = {
  instruction?: Phaser.GameObjects.Text;
  receivingLabel?: Phaser.GameObjects.Text;
  truckShadow?: Phaser.GameObjects.Ellipse;
  workerShadow?: Phaser.GameObjects.Ellipse;
  caseVisuals: CaseVisual[];
};

const prototype = OpeningScene.prototype as unknown as OpeningPrototype;
const originalPreload = prototype.preload;
const originalCreate = prototype.create;

prototype.preload = function preloadReleaseDeliveryArt(): void {
  originalPreload.call(this);
  const scene = this as unknown as Phaser.Scene;

  Object.values(Assets.delivery).forEach((rawKey) => {
    const key = rawKey as keyof typeof AssetPaths;
    if (!scene.textures.exists(key)) scene.load.image(key, AssetPaths[key]);
  });
};

prototype.create = function createWithReleaseDeliveryArt(): void {
  originalCreate.call(this);
  const scene = this as unknown as Phaser.Scene;
  installLoadingBayBackground(scene);

  const truck = replaceVectorTruck(scene);
  const worker = findOpeningWorker(scene);
  const refs = installSpatialComposition(scene, truck, worker);

  let truckState: DeliveryTruckState | undefined;
  let workerTexture = "";
  let leaving = false;

  const sync = (): void => {
    if (!scene.scene.isActive()) return;

    replaceDeliveryCaseTextures(scene, refs.caseVisuals);
    syncContactShadows(truck, worker, refs);

    const title = findOperationTitle(scene)?.text ?? "";
    const nextTruckState = resolveTruckState(title);
    if (truck && nextTruckState !== truckState) {
      truckState = nextTruckState;
      const image = findTruckImage(truck);
      if (image) {
        image.setTexture(textureForTruckState(nextTruckState));
        fitContain(image, 590, 340);
      }
    }

    if (truck && truckState === "LEAVE" && !leaving) {
      leaving = true;
      scene.tweens.killTweensOf(truck);
      scene.tweens.add({
        targets: truck,
        x: 1640,
        duration: 1150,
        ease: "Cubic.In"
      });
    }

    if (worker?.active) {
      const nextWorkerTexture = textureForWorkerState(title);
      if (nextWorkerTexture !== workerTexture) {
        workerTexture = nextWorkerTexture;
        worker.setTexture(nextWorkerTexture);
        fitContain(worker, 205, 360);
      }
    }
  };

  sync();
  const timer = scene.time.addEvent({ delay: 70, loop: true, callback: sync });
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    timer.remove(false);
    refs.caseVisuals.forEach(({ shadow }) => shadow.destroy());
  });
};

function installLoadingBayBackground(scene: Phaser.Scene): void {
  const background = scene.children.list.find((child) =>
    child instanceof Phaser.GameObjects.Image && child.texture.key === Assets.storefront.day
  ) as Phaser.GameObjects.Image | undefined;
  if (!background) return;

  background.setTexture(Assets.delivery.loadingBay);
  coverImage(background, 1330, 1182);

  scene.add.rectangle(665, 655, 1330, 1054, 0x061012, 0.18)
    .setDepth(1);
  scene.add.rectangle(665, 1118, 1330, 128, 0x061012, 0.34)
    .setDepth(2);
}

function installSpatialComposition(
  scene: Phaser.Scene,
  truck: Phaser.GameObjects.Container | undefined,
  worker: Phaser.GameObjects.Image | undefined
): CompositionRefs {
  const refs: CompositionRefs = { caseVisuals: [] };

  const mainPanel = scene.children.list.find((child) =>
    child instanceof Phaser.GameObjects.Rectangle &&
    child.width >= 1000 &&
    child.height >= 700 &&
    child.y > 300
  ) as Phaser.GameObjects.Rectangle | undefined;
  mainPanel?.setFillStyle(0x071416, 0.28).setStrokeStyle(3, 0x8eaf79, 0.58);

  const portraitPanel = scene.children.list.find((child) =>
    child instanceof Phaser.GameObjects.Rectangle &&
    child.width >= 300 &&
    child.width <= 330 &&
    child.height >= 390
  ) as Phaser.GameObjects.Rectangle | undefined;
  portraitPanel?.setVisible(false);

  const receivingFloor = scene.children.list.find((child) =>
    child instanceof Phaser.GameObjects.Rectangle &&
    child.width >= 650 &&
    child.width <= 700 &&
    child.height >= 200 &&
    child.height <= 240
  ) as Phaser.GameObjects.Rectangle | undefined;
  receivingFloor?.setVisible(false);

  scene.add.rectangle(252, 365, 360, 320, 0x081719, 0.72)
    .setStrokeStyle(2, 0xe9d995, 0.48)
    .setDepth(5);
  scene.add.rectangle(820, 282, 690, 180, 0x081719, 0.62)
    .setStrokeStyle(2, 0x7da38b, 0.4)
    .setDepth(5);

  const receivingZone = scene.add.polygon(870, 900, [
    -245, -75,
    250, -75,
    205, 95,
    -285, 95
  ], 0x18363a, 0.38)
    .setStrokeStyle(4, 0x94b8be, 0.58)
    .setDepth(5);
  receivingZone.setData("releaseReceivingZone", true);

  const floorLines = scene.add.graphics().setDepth(4);
  floorLines.lineStyle(2, 0xd2b75f, 0.22);
  floorLines.lineBetween(665, 560, 490, 1110);
  floorLines.lineBetween(665, 560, 850, 1110);
  floorLines.lineBetween(665, 560, 1170, 1110);
  floorLines.lineStyle(2, 0xffffff, 0.09);
  floorLines.lineBetween(380, 955, 1190, 955);
  floorLines.lineBetween(420, 1040, 1140, 1040);

  const checklistTitle = findText(scene, "OPENING CHECKLIST");
  checklistTitle?.setPosition(98, 220).setFontSize(21).setDepth(7);

  const checklist = scene.children.list.find((child) =>
    child instanceof Phaser.GameObjects.Text && child.text.includes("Clock in") && child.text.includes("Unload delivery")
  ) as Phaser.GameObjects.Text | undefined;
  checklist?.setPosition(98, 270).setFontSize(19).setLineSpacing(15).setDepth(7);

  const title = findOperationTitle(scene);
  title?.setPosition(820, 215).setFontSize(34).setDepth(7);

  refs.instruction = scene.children.list.find((child) =>
    child instanceof Phaser.GameObjects.Text && child.x === 765 && child.y === 315
  ) as Phaser.GameObjects.Text | undefined;
  refs.instruction?.setPosition(820, 285).setFontSize(20).setWordWrapWidth(640).setDepth(7);

  const dockLabel = findText(scene, "RECEIVING BAY");
  dockLabel?.setPosition(880, 430).setFontSize(20).setDepth(7);

  refs.receivingLabel = scene.children.list.find((child) =>
    child instanceof Phaser.GameObjects.Text && child.text.startsWith("UNLOADED CASES")
  ) as Phaser.GameObjects.Text | undefined;
  refs.receivingLabel?.setPosition(875, 1030).setFontSize(20).setDepth(8);

  if (truck) {
    truck.setY(760).setDepth(9);
    refs.truckShadow = scene.add.ellipse(truck.x, 928, 540, 82, 0x000000, 0.28)
      .setDepth(8);
  }

  if (worker) {
    worker.setPosition(930, 945).setDepth(17);
    fitContain(worker, 205, 360);
    refs.workerShadow = scene.add.ellipse(worker.x, worker.y - 8, 132, 36, 0x000000, 0.3)
      .setDepth(15);
  }

  return refs;
}

function replaceVectorTruck(scene: Phaser.Scene): Phaser.GameObjects.Container | undefined {
  const truck = scene.children.list.find((child) =>
    child instanceof Phaser.GameObjects.Container &&
    child.list.some((item) => item instanceof Phaser.GameObjects.Text && item.text.includes("FRESH MART"))
  ) as Phaser.GameObjects.Container | undefined;
  if (!truck) return undefined;

  truck.list.forEach((child) => {
    const displayObject = child as Phaser.GameObjects.GameObject & { setVisible?: (visible: boolean) => unknown };
    displayObject.setVisible?.(false);
  });

  const image = scene.add.image(0, 0, Assets.delivery.truckArrive).setOrigin(0.5);
  fitContain(image, 590, 340);
  image.setData("releaseDeliveryTruck", true);
  truck.addAt(image, 0);
  return truck;
}

function findTruckImage(truck: Phaser.GameObjects.Container): Phaser.GameObjects.Image | undefined {
  return truck.list.find((child) =>
    child instanceof Phaser.GameObjects.Image && child.getData("releaseDeliveryTruck") === true
  ) as Phaser.GameObjects.Image | undefined;
}

function findOpeningWorker(scene: Phaser.Scene): Phaser.GameObjects.Image | undefined {
  return scene.children.list.find((child) =>
    child instanceof Phaser.GameObjects.Image &&
    child.texture.key === Assets.characters.workerIdle &&
    child.x < 430
  ) as Phaser.GameObjects.Image | undefined;
}

function findOperationTitle(scene: Phaser.Scene): Phaser.GameObjects.Text | undefined {
  const knownTitles = [
    "CLOCK IN FOR YOUR SHIFT",
    "DELIVERY TRUCK ARRIVING",
    "UNLOAD THE DELIVERY",
    "DELIVERY UNLOADED",
    "DELIVERY ACCEPTED",
    "STOCK IS IN THE BACKROOM"
  ];
  return scene.children.list.find((child) =>
    child instanceof Phaser.GameObjects.Text && knownTitles.includes(child.text)
  ) as Phaser.GameObjects.Text | undefined;
}

function findText(scene: Phaser.Scene, text: string): Phaser.GameObjects.Text | undefined {
  return scene.children.list.find((child) =>
    child instanceof Phaser.GameObjects.Text && child.text === text
  ) as Phaser.GameObjects.Text | undefined;
}

function replaceDeliveryCaseTextures(scene: Phaser.Scene, visuals: CaseVisual[]): void {
  scene.children.list.forEach((child) => {
    if (!(child instanceof Phaser.GameObjects.Image)) return;

    const replacement = child.texture.key === Assets.props.boxCola
      ? Assets.delivery.boxCola
      : child.texture.key === Assets.props.boxWater
        ? Assets.delivery.boxWater
        : child.texture.key === Assets.props.boxMilk
          ? Assets.delivery.boxMilk
          : undefined;
    if (!replacement) return;

    const index = visuals.length;
    const cargoPositions = [
      { x: 440, y: 735 },
      { x: 565, y: 735 },
      { x: 455, y: 835 },
      { x: 585, y: 835 }
    ];
    const position = cargoPositions[index] ?? cargoPositions[cargoPositions.length - 1];

    child.setTexture(replacement)
      .setPosition(position.x, position.y)
      .setDepth(14)
      .setData("releaseDeliveryCase", true);
    fitContain(child, 118, 104);

    const shadow = scene.add.ellipse(child.x, child.y - 3, 94, 24, 0x000000, 0.27)
      .setDepth(13);
    visuals.push({ image: child, shadow });

    child.on("pointerover", () => {
      if (!child.input?.enabled) return;
      scene.tweens.add({ targets: child, scaleX: child.scaleX * 1.06, scaleY: child.scaleY * 1.06, duration: 90 });
    });
    child.on("pointerout", () => {
      if (!child.active) return;
      fitContain(child, 118, 104);
    });
  });
}

function syncContactShadows(
  truck: Phaser.GameObjects.Container | undefined,
  worker: Phaser.GameObjects.Image | undefined,
  refs: CompositionRefs
): void {
  if (truck && refs.truckShadow?.active) {
    refs.truckShadow.setPosition(truck.x, truck.y + 168).setAlpha(truck.alpha * 0.28);
  }

  if (worker?.active && refs.workerShadow?.active) {
    refs.workerShadow.setPosition(worker.x, worker.y - 7).setAlpha(worker.alpha * 0.3);
  }

  refs.caseVisuals.forEach(({ image, shadow }) => {
    if (!image.active) {
      shadow.destroy();
      return;
    }
    shadow.setPosition(image.x, image.y - 3).setAlpha(image.alpha * 0.27);
  });
}

function resolveTruckState(title: string): DeliveryTruckState {
  if (title === "STOCK IS IN THE BACKROOM") return "LEAVE";
  if (title === "DELIVERY ACCEPTED") return "EMPTY";
  if (title === "UNLOAD THE DELIVERY" || title === "DELIVERY UNLOADED") return "OPEN";
  return "ARRIVE";
}

function textureForTruckState(state: DeliveryTruckState): string {
  if (state === "OPEN") return Assets.delivery.truckDoorOpen;
  if (state === "EMPTY") return Assets.delivery.truckEmpty;
  if (state === "LEAVE") return Assets.delivery.truckLeave;
  return Assets.delivery.truckArrive;
}

function textureForWorkerState(title: string): string {
  if (title === "UNLOAD THE DELIVERY") return Assets.delivery.workerCarry;
  if (title === "DELIVERY ACCEPTED" || title === "STOCK IS IN THE BACKROOM") return Assets.delivery.workerPush;
  return Assets.delivery.workerIdle;
}

function fitContain(image: Phaser.GameObjects.Image, maxWidth: number, maxHeight: number): void {
  const width = Math.max(1, image.width);
  const height = Math.max(1, image.height);
  image.setScale(Math.min(maxWidth / width, maxHeight / height));
}

function coverImage(image: Phaser.GameObjects.Image, width: number, height: number): void {
  const sourceWidth = Math.max(1, image.width);
  const sourceHeight = Math.max(1, image.height);
  image.setScale(Math.max(width / sourceWidth, height / sourceHeight));
}
