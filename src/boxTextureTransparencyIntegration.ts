import Phaser from "phaser";
import { Assets } from "./assets";
import { GameScene } from "./scenes/GameScene";
import { gameSession } from "./systems/GameSession";

const BOX_TEXTURES = [Assets.props.boxCola, Assets.props.boxWater, Assets.props.boxMilk] as const;
const BACKGROUND_MIN_CHANNEL = 72;
const BACKGROUND_MAX_SPREAD = 72;
const MAX_TEXTURE_EDGE = 1024;

type BatchDay = "day04" | "day05";

type GamePrototype = {
  create: (...args: unknown[]) => void;
};

const prototype = GameScene.prototype as unknown as GamePrototype;
const originalCreate = prototype.create;

prototype.create = function createWithCleanStockCases(...args: unknown[]): void {
  const scene = this as unknown as Phaser.Scene;
  BOX_TEXTURES.forEach((textureKey) => removeConnectedLightBackground(scene, textureKey));
  originalCreate.apply(this, args);

  scene.time.delayedCall(900, () => {
    if (!scene.scene.isActive() || !isBatchDay(gameSession.day)) return;
    assertNoVisibleMissingTextures(scene);
  });
};

function removeConnectedLightBackground(scene: Phaser.Scene, textureKey: string): void {
  const texture = scene.textures.get(textureKey);
  const source = texture?.getSourceImage() as CanvasImageSource & {
    width?: number;
    height?: number;
    dataset?: DOMStringMap;
  };

  if (!source || !source.width || !source.height) return;
  if (source instanceof HTMLCanvasElement && source.dataset.stockCaseTransparencyReady === "3") return;

  const scale = Math.min(1, MAX_TEXTURE_EDGE / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const total = width * height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.dataset.stockCaseTransparencyReady = "3";

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return;
  context.clearRect(0, 0, width, height);
  context.drawImage(source, 0, 0, width, height);

  const imageData = context.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  const candidate = new Uint8Array(total);
  const connected = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  for (let index = 0; index < total; index += 1) {
    const offset = index * 4;
    if (pixels[offset + 3] === 0) continue;
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

  const forEachNeighbor = (index: number, visit: (neighbor: number) => void): void => {
    const x = index % width;
    const y = Math.floor(index / width);
    for (let deltaY = -1; deltaY <= 1; deltaY += 1) {
      for (let deltaX = -1; deltaX <= 1; deltaX += 1) {
        if (deltaX === 0 && deltaY === 0) continue;
        const nextX = x + deltaX;
        const nextY = y + deltaY;
        if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
        visit(nextY * width + nextX);
      }
    }
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (head < tail) {
    const index = queue[head++];
    forEachNeighbor(index, enqueue);
  }

  for (let index = 0; index < total; index += 1) {
    if (connected[index]) pixels[index * 4 + 3] = 0;
  }

  // Remove anti-aliased and diagonally connected checker remnants while keeping
  // labels and highlights that are enclosed inside the cardboard artwork.
  for (let pass = 0; pass < 4; pass += 1) {
    const next = connected.slice();
    for (let index = 0; index < total; index += 1) {
      if (!candidate[index] || connected[index]) continue;
      let touchesBackground = false;
      forEachNeighbor(index, (neighbor) => {
        if (connected[neighbor]) touchesBackground = true;
      });
      if (!touchesBackground) continue;
      next[index] = 1;
      pixels[index * 4 + 3] = 0;
    }
    connected.set(next);
  }

  context.putImageData(imageData, 0, 0);
  scene.textures.remove(textureKey);
  scene.textures.addCanvas(textureKey, canvas);
}

function assertNoVisibleMissingTextures(scene: Phaser.Scene): void {
  if (new URLSearchParams(globalThis.location?.search ?? "").get("test") !== "1") return;
  const missing = scene.children.list.filter((child) =>
    child instanceof Phaser.GameObjects.Image &&
    child.active &&
    child.visible &&
    child.alpha > 0.01 &&
    child.texture.key === "__MISSING"
  );
  if (missing.length > 0) {
    throw new Error(`Batch floor contains ${missing.length} visible missing texture object(s).`);
  }
}

function isBatchDay(value: unknown): value is BatchDay {
  return value === "day04" || value === "day05";
}
