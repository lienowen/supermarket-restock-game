import Phaser from "phaser";
import { createTrimmedTexture } from "./TrimmedTexture";

const DEFAULT_ALPHA_THRESHOLD = 18;

/**
 * Some early production character renders contain both semi-transparent body
 * pixels and a large transparent canvas. The mature pass fixes both at runtime:
 * crop to the real visible bounds, then normalize visible pixels to full alpha.
 */
export function createOpaqueCutoutTexture(
  scene: Phaser.Scene,
  sourceKey: string,
  alphaThreshold = DEFAULT_ALPHA_THRESHOLD
): string {
  return createTrimmedTexture(scene, sourceKey, {
    alphaThreshold,
    opaque: true,
    suffix: "--opaque-cutout",
    padding: 2
  });
}
