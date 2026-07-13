import Phaser from "phaser";
import { Assets } from "./assets";
import { OpeningScene } from "./scenes/OpeningScene";

const TARGET_SIZE = 512;
const BACKGROUND_MIN_CHANNEL = 202;
const BACKGROUND_MAX_SPREAD = 32;

const prototype = OpeningScene.prototype as unknown as {
  create: (...args: unknown[]) => void;
};
const originalCreate = prototype.create;

prototype.create = function createWithTransparentMilkCase(...args: unknown[]): void {
  const scene = this as unknown as Phaser.Scene;
  removeConnectedCheckerboard(scene);
  originalCreate.apply(this, args);
};

function removeConnectedCheckerboard(scene: Phaser.Scene): void {
  const texture = scene.textures.get(Assets.delivery.boxMilk);
  const source = texture?.getSourceImage() as CanvasImageSource & {
    width?: number;
    height?: number;
    dataset?: DOMStringMap;
  };

  if (!source || !source.width || !source.height) return;
  if (source instanceof HTMLCanvasElement && source.dataset.milkTransparencyReady === "1") {
    document.body.dataset.milkTextureTransparent = "ready";
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.width = TARGET_SIZE;
  canvas.height = TARGET_SIZE;
  canvas.dataset.milkTransparencyReady = "1";

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return;

  context.clearRect(0, 0, TARGET_SIZE, TARGET_SIZE);
  context.drawImage(source, 0, 0, TARGET_SIZE, TARGET_SIZE);

  const imageData = context.getImageData(0, 0, TARGET_SIZE, TARGET_SIZE);
  const pixels = imageData.data;
  const total = TARGET_SIZE * TARGET_SIZE;
  const candidate = new Uint8Array(total);
  const connected = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  for (let index = 0; index < total; index += 1) {
    const offset = index * 4;
    const red = pixels[offset];
    const green = pixels[offset + 1];
    const blue = pixels[offset + 2];
    const minimum = Math.min(red, green, blue);
    const maximum = Math.max(red, green, blue);
    if (minimum >= BACKGROUND_MIN_CHANNEL && maximum - minimum <= BACKGROUND_MAX_SPREAD) {
      candidate[index] = 1;
    }
  }

  const enqueue = (index: number): void => {
    if (!candidate[index] || connected[index]) return;
    connected[index] = 1;
    queue[tail++] = index;
  };

  for (let x = 0; x < TARGET_SIZE; x += 1) {
    enqueue(x);
    enqueue((TARGET_SIZE - 1) * TARGET_SIZE + x);
  }
  for (let y = 0; y < TARGET_SIZE; y += 1) {
    enqueue(y * TARGET_SIZE);
    enqueue(y * TARGET_SIZE + TARGET_SIZE - 1);
  }

  while (head < tail) {
    const index = queue[head++];
    const x = index % TARGET_SIZE;
    const y = Math.floor(index / TARGET_SIZE);
    if (x > 0) enqueue(index - 1);
    if (x + 1 < TARGET_SIZE) enqueue(index + 1);
    if (y > 0) enqueue(index - TARGET_SIZE);
    if (y + 1 < TARGET_SIZE) enqueue(index + TARGET_SIZE);
  }

  for (let index = 0; index < total; index += 1) {
    if (!connected[index]) continue;
    pixels[index * 4 + 3] = 0;
  }

  // Remove the remaining one-pixel light halo around the connected background.
  for (let y = 1; y < TARGET_SIZE - 1; y += 1) {
    for (let x = 1; x < TARGET_SIZE - 1; x += 1) {
      const index = y * TARGET_SIZE + x;
      if (!candidate[index] || connected[index]) continue;
      if (
        connected[index - 1] ||
        connected[index + 1] ||
        connected[index - TARGET_SIZE] ||
        connected[index + TARGET_SIZE]
      ) {
        pixels[index * 4 + 3] = 0;
      }
    }
  }

  context.putImageData(imageData, 0, 0);
  scene.textures.remove(Assets.delivery.boxMilk);
  scene.textures.addCanvas(Assets.delivery.boxMilk, canvas);
  document.body.dataset.milkTextureTransparent = "ready";
}
