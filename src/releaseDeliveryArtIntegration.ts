import Phaser from "phaser";
import { AssetPaths, Assets } from "./assets";
import { OpeningScene } from "./scenes/OpeningScene";

type OpeningPrototype = {
  preload: () => void;
  create: () => void;
};

type DeliveryTruckState = "ARRIVE" | "OPEN" | "EMPTY" | "LEAVE";

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

  let truckState: DeliveryTruckState | undefined;
  let workerTexture = "";
  let leaving = false;

  const sync = (): void => {
    if (!scene.scene.isActive()) return;
    replaceDeliveryCaseTextures(scene);

    const title = findOperationTitle(scene)?.text ?? "";
    const nextTruckState = resolveTruckState(title);
    if (truck && nextTruckState !== truckState) {
      truckState = nextTruckState;
      const image = findTruckImage(truck);
      if (image) {
        image.setTexture(textureForTruckState(nextTruckState));
        fitContain(image, 690, 390);
      }
    }

    if (truck && truckState === "LEAVE" && !leaving) {
      leaving = true;
      scene.tweens.killTweensOf(truck);
      scene.tweens.add({
        targets: truck,
        x: 1660,
        duration: 1150,
        ease: "Cubic.In"
      });
    }

    if (worker?.active) {
      const nextWorkerTexture = textureForWorkerState(title);
      if (nextWorkerTexture !== workerTexture) {
        workerTexture = nextWorkerTexture;
        worker.setTexture(nextWorkerTexture);
        fitContain(worker, 265, 430);
      }
    }
  };

  sync();
  const timer = scene.time.addEvent({ delay: 90, loop: true, callback: sync });
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => timer.remove(false));
};

function installLoadingBayBackground(scene: Phaser.Scene): void {
  const background = scene.children.list.find((child) =>
    child instanceof Phaser.GameObjects.Image && child.texture.key === Assets.storefront.day
  ) as Phaser.GameObjects.Image | undefined;
  if (!background) return;

  background.setTexture(Assets.delivery.loadingBay);
  coverImage(background, 1330, 1182);
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

  const image = scene.add.image(0, 45, Assets.delivery.truckArrive).setOrigin(0.5);
  fitContain(image, 690, 390);
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

function replaceDeliveryCaseTextures(scene: Phaser.Scene): void {
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
    child.setTexture(replacement);
    fitContain(child, 138, 120);
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
