import Phaser from "phaser";
import { Assets } from "./assets";
import { StorefrontScene } from "./scenes/StorefrontScene";

const UNUSED_STOREFRONT_BUTTON_TEXTURES = new Set<string>([
  Assets.storefront.startShift,
  Assets.storefront.days,
  Assets.storefront.upgrades,
  Assets.storefront.store,
  Assets.storefront.collection,
  Assets.storefront.settings
]);

type StorefrontPrototype = {
  preload: (...args: unknown[]) => void;
};

type ImageLoader = Phaser.Loader.LoaderPlugin["image"];

const prototype = StorefrontScene.prototype as unknown as StorefrontPrototype;
const originalPreload = prototype.preload;

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
