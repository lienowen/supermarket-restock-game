import Phaser from "phaser";
import { Assets } from "./assets";
import { GameScene } from "./scenes/GameScene";
import { gameSession } from "./systems/GameSession";

const BOX_TEXTURES = [Assets.props.boxCola, Assets.props.boxWater, Assets.props.boxMilk] as const;
const BACKGROUND_MIN_CHANNEL = 96;
const BACKGROUND_MAX_SPREAD = 52;
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
  if (source instanceof HTMLCanvasElement && source.dataset.stockCaseTransparencyReady === "2") return;

  const scale = Math.min(1, MAX_TEXTURE_EDGE / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const total = width * height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.dataset.stockCaseTransparencyReady = "2";

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
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) enqueue(index - 1);
    if (x + 1 < width) enqueue(index + 1);
    if (y > 0) enqueue(index - width);
    if (y + 1 < height) enqueue(index + width);
  }

  for (let index = 0; index < total; index += 1) {
    if (connected[index]) pixels[index * 4 + 3] = 0;
  }

  // Remove a thin anti-aliased halo adjoining the connected background while
  // preserving labels and highlights inside the cardboard artwork.
  for (let pass = 0; pass < 3; pass += 1) {
    const next = connected.slice();
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const index = y * width + x;
        if (!candidate[index] || connected[index]) continue;
        if (
          connected[index - 1] ||
          connected[index + 1] ||
          connected[index - width] ||
          connected[index + width]
        ) {
          next[index] = 1;
          pixels[index * 4 + 3] = 0;
        }
      }
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
