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
  index: number;
};

type CompositionRefs = {
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
  hideLegacyStagePanels(scene);

  const truck = replaceVectorTruck(scene);
  const worker = findOpeningWorker(scene);
  const refs = installSpatialComposition(scene, truck, worker);

  let truckState: DeliveryTruckState | undefined;
  let leaving = false;

  const sync = (): void => {
    if (!scene.scene.isActive()) return;

    replaceDeliveryCaseTextures(scene, refs.caseVisuals);
    settleUnloadedCases(scene, refs.caseVisuals);

    const title = findOperationTitle(scene)?.text ?? "";
    const nextTruckState = resolveTruckState(title);

    if (truck && nextTruckState !== truckState) {
      truckState = nextTruckState;
      const image = findTruckImage(truck);
      if (image) {
        image.setTexture(textureForTruckState(nextTruckState));
        fitContain(image, 520, 310);
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

    enforceWorkerScaleAndPosition(worker, title);
    syncContactShadows(truck, worker, refs);
  };

  sync();
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, sync);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, sync);
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

  scene.add.rectangle(665, 650, 1330, 1060, 0x061012, 0.07).setDepth(1);
  scene.add.rectangle(665, 1135, 1330, 94, 0x061012, 0.2).setDepth(2);
}

function hideLegacyStagePanels(scene: Phaser.Scene): void {
  scene.children.list.forEach((child) => {
    if (!(child instanceof Phaser.GameObjects.Rectangle)) return;

    const isMainPanel = child.width >= 1000 && child.height >= 700 && child.y > 300;
    const isPortraitPanel = child.width >= 300 && child.width <= 330 && child.height >= 390;
    const isReceivingFloor = child.width >= 650 && child.width <= 700 && child.height >= 200 && child.height <= 240;

    if (isMainPanel || isPortraitPanel || isReceivingFloor) child.setVisible(false);
  });
}

function installSpatialComposition(
  scene: Phaser.Scene,
  truck: Phaser.GameObjects.Container | undefined,
  worker: Phaser.GameObjects.Image | undefined
): CompositionRefs {
  const refs: CompositionRefs = { caseVisuals: [] };

  // Only compact HUD cards remain. The loading bay itself is the play space.
  scene.add.rectangle(215, 382, 350, 310, 0x071416, 0.78)
    .setStrokeStyle(2, 0xd7c879, 0.58)
    .setDepth(24);
  scene.add.rectangle(820, 312, 720, 190, 0x071416, 0.72)
    .setStrokeStyle(2, 0x789d89, 0.5)
    .setDepth(24);
  scene.add.rectangle(1060, 515, 285, 58, 0x102b2e, 0.9)
    .setStrokeStyle(2, 0x78a997, 0.4)
    .setDepth(24);
  scene.add.rectangle(1090, 930, 340, 64, 0x071416, 0.82)
    .setStrokeStyle(2, 0x93adb0, 0.4)
    .setDepth(24);

  // A very subtle floor target replaces the old debug-looking trapezoid and guide lines.
  scene.add.polygon(895, 890, [
    -220, -60,
    235, -60,
    195, 90,
    -255, 90
  ], 0x17383b, 0.1).setDepth(4);

  const checklistTitle = findText(scene, "OPENING CHECKLIST");
  checklistTitle?.setPosition(70, 255).setFontSize(20).setDepth(25);

  const checklist = scene.children.list.find((child) =>
    child instanceof Phaser.GameObjects.Text && child.text.includes("Clock in") && child.text.includes("Unload delivery")
  ) as Phaser.GameObjects.Text | undefined;
  checklist?.setPosition(70, 305).setFontSize(18).setLineSpacing(14).setDepth(25);

  const title = findOperationTitle(scene);
  title?.setPosition(820, 255).setFontSize(32).setDepth(25);

  const instruction = scene.children.list.find((child) =>
    child instanceof Phaser.GameObjects.Text && child.x === 765 && child.y === 315
  ) as Phaser.GameObjects.Text | undefined;
  instruction?.setPosition(820, 325).setFontSize(19).setWordWrapWidth(650).setDepth(25);

  const dockLabel = findText(scene, "RECEIVING BAY");
  dockLabel?.setPosition(1060, 515).setFontSize(18).setDepth(25);

  const receivingLabel = scene.children.list.find((child) =>
    child instanceof Phaser.GameObjects.Text && child.text.startsWith("UNLOADED CASES")
  ) as Phaser.GameObjects.Text | undefined;
  receivingLabel?.setPosition(1090, 930).setFontSize(18).setDepth(25);

  const progressText = scene.children.list.find((child) =>
    child instanceof Phaser.GameObjects.Text && /^\d\/4$/.test(child.text)
  ) as Phaser.GameObjects.Text | undefined;
  progressText?.setX(1205);

  if (truck) {
    truck.setY(835).setDepth(9);
    refs.truckShadow = scene.add.ellipse(truck.x, 985, 470, 60, 0x000000, 0.24).setDepth(8);
  }

  if (worker) {
    worker.setOrigin(0.5, 1).setPosition(835, 1000).setDepth(14);
    fitContain(worker, 150, 285);
    refs.workerShadow = scene.add.ellipse(worker.x, 993, 102, 28, 0x000000, 0.27).setDepth(13);
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
  fitContain(image, 520, 310);
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
      { x: 425, y: 775 },
      { x: 525, y: 775 },
      { x: 440, y: 860 },
      { x: 540, y: 860 }
    ];
    const position = cargoPositions[index] ?? cargoPositions[cargoPositions.length - 1];

    child.setTexture(replacement)
      .setOrigin(0.5, 1)
      .setPosition(position.x, position.y)
      .setDepth(12)
      .setData("releaseDeliveryCase", true);
    fitContain(child, 98, 88);

    const shadow = scene.add.ellipse(child.x, child.y - 2, 76, 19, 0x000000, 0.24).setDepth(11);
    visuals.push({ image: child, shadow, index });

    child.on("pointerover", () => {
      if (!child.input?.enabled) return;
      child.setTint(0xfff0b8);
    });
    child.on("pointerout", () => {
      if (!child.active) return;
      child.clearTint();
    });
  });
}

function settleUnloadedCases(scene: Phaser.Scene, visuals: CaseVisual[]): void {
  const floorTargets = [
    { x: 710, y: 935 },
    { x: 815, y: 905 },
    { x: 920, y: 940 },
    { x: 1025, y: 910 }
  ];

  visuals.forEach(({ image, index }) => {
    if (!image.active || image.getData("releaseDeliveryPlaced") === true) return;
    if (image.input?.enabled !== false || scene.tweens.isTweening(image)) return;

    image.setData("releaseDeliveryPlaced", true);
    const target = floorTargets[index] ?? floorTargets[floorTargets.length - 1];
    scene.tweens.add({
      targets: image,
      x: target.x,
      y: target.y,
      duration: 180,
      ease: "Sine.Out"
    });
  });
}

function enforceWorkerScaleAndPosition(worker: Phaser.GameObjects.Image | undefined, title: string): void {
  if (!worker?.active) return;

  const expectedTexture = textureForWorkerState(title);
  if (worker.texture.key !== expectedTexture) worker.setTexture(expectedTexture);

  worker.setOrigin(0.5, 1).setDepth(14);
  fitContain(worker, 150, 285);

  if (title === "UNLOAD THE DELIVERY") {
    worker.x = Phaser.Math.Clamp(worker.x, 675, 930);
  } else if (title === "DELIVERY ACCEPTED" || title === "STOCK IS IN THE BACKROOM") {
    worker.x = 850;
  } else {
    worker.x = 835;
  }
  worker.y = 1000;
}

function syncContactShadows(
  truck: Phaser.GameObjects.Container | undefined,
  worker: Phaser.GameObjects.Image | undefined,
  refs: CompositionRefs
): void {
  if (truck && refs.truckShadow?.active) {
    refs.truckShadow.setPosition(truck.x, truck.y + 150).setAlpha(truck.alpha * 0.24);
  }

  if (worker?.active && refs.workerShadow?.active) {
    refs.workerShadow.setPosition(worker.x, worker.y - 7).setAlpha(worker.alpha * 0.27);
  }

  refs.caseVisuals.forEach(({ image, shadow }) => {
    if (!image.active) {
      shadow.destroy();
      return;
    }
    shadow.setPosition(image.x, image.y - 2).setAlpha(image.alpha * 0.24);
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
  const width = Math.max(1, image.frame.realWidth || image.width);
  const height = Math.max(1, image.frame.realHeight || image.height);
  image.setScale(Math.min(maxWidth / width, maxHeight / height));
}

function coverImage(image: Phaser.GameObjects.Image, width: number, height: number): void {
  const sourceWidth = Math.max(1, image.frame.realWidth || image.width);
  const sourceHeight = Math.max(1, image.frame.realHeight || image.height);
  image.setScale(Math.max(width / sourceWidth, height / sourceHeight));
}
