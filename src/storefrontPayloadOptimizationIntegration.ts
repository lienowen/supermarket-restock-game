import Phaser from "phaser";
import { Assets } from "./assets";
import type { LevelId } from "./domain/gameTypes";
import { StorefrontScene } from "./scenes/StorefrontScene";

const UNUSED_STOREFRONT_BUTTON_TEXTURES = new Set<string>([
  Assets.storefront.startShift,
  Assets.storefront.days,
  Assets.storefront.upgrades,
  Assets.storefront.store,
  Assets.storefront.collection,
  Assets.storefront.settings
]);

type RuntimeStorefront = Phaser.Scene & {
  __openingAssetsLoading?: boolean;
};

type StorefrontPrototype = {
  preload: (...args: unknown[]) => void;
  create: (...args: unknown[]) => void;
  startShift: (day: LevelId) => void;
};

type ImageLoader = Phaser.Loader.LoaderPlugin["image"];

const prototype = StorefrontScene.prototype as unknown as StorefrontPrototype;
const originalPreload = prototype.preload;
const originalCreate = prototype.create;
const originalStartShift = prototype.startShift;

prototype.preload = function preloadWithoutUnusedButtonPngs(...args: unknown[]): void {
  const scene = this as unknown as Phaser.Scene;
  const loader = scene.load;
  const originalImage = loader.image;

  loader.image = function skipUnusedStorefrontButton(
    key: Parameters<ImageLoader>[0],
    url?: Parameters<ImageLoader>[1],
    xhrSettings?: Parameters<ImageLoader>[2]
  ): Phaser.Loader.LoaderPlugin {
    if (typeof key === "string" && UNUSED_STOREFRONT_BUTTON_TEXTURES.has(key)) {
      return loader;
    }
    return originalImage.call(loader, key, url, xhrSettings);
  } as ImageLoader;

  try {
    originalPreload.apply(this, args);
  } finally {
    loader.image = originalImage;
  }
};

prototype.create = function createWithoutIdleOpeningPreload(...args: unknown[]): void {
  originalCreate.apply(this, args);

  // uiRuntimePolish schedules the complete delivery asset set while the player is
  // still reading the lobby. Mark that preload as already in progress so its idle
  // callback exits; the real Start action clears the guard and loads on demand.
  const scene = this as unknown as RuntimeStorefront;
  scene.__openingAssetsLoading = true;
};

prototype.startShift = function startShiftWithOnDemandOpeningAssets(day: LevelId): void {
  const scene = this as unknown as RuntimeStorefront;
  scene.__openingAssetsLoading = false;
  originalStartShift.call(this, day);
};
