import Phaser from "phaser";
import { mapSoftwareLandscapeClientPoint } from "./SoftwareLandscapeGeometry";

interface MutableInputManager {
  transformPointer: (
    pointer: Phaser.Input.Pointer,
    pageX: number,
    pageY: number,
    wasMove: boolean
  ) => void;
  canvas?: HTMLCanvasElement | null;
  __softwareLandscapeInputInstalled?: boolean;
}

const applyPointerPosition = (
  pointer: Phaser.Input.Pointer,
  x: number,
  y: number,
  wasMove: boolean
): void => {
  const position = pointer.position;
  const previous = pointer.prevPosition;
  previous.x = position.x;
  previous.y = position.y;

  const smoothing = pointer.smoothFactor;
  if (!wasMove || smoothing === 0) {
    position.x = x;
    position.y = y;
    return;
  }

  position.x = x * smoothing + previous.x * (1 - smoothing);
  position.y = y * smoothing + previous.y * (1 - smoothing);
};

/**
 * Phaser 3.90's InputManager maps page coordinates through ScaleManager, which
 * assumes the canvas is axis-aligned. Our portrait fallback rotates the whole
 * game stage by 90 degrees in CSS, so software-landscape input needs an inverse
 * rotation before Phaser performs hit tests.
 *
 * Do not reconstruct the canvas size from window.innerWidth/innerHeight here.
 * Android browser chrome and embedded WebViews can change the dynamic viewport
 * independently of the layout viewport. Instead we derive the transform from
 * the body and canvas rectangles that are actually rendered for every event.
 */
export function installSoftwareLandscapeInput(
  game: Phaser.Game,
  logicalWidth: number,
  logicalHeight: number
): void {
  const manager = game.input as unknown as MutableInputManager;
  if (manager.__softwareLandscapeInputInstalled) return;
  manager.__softwareLandscapeInputInstalled = true;

  const defaultTransform = manager.transformPointer.bind(manager);

  manager.transformPointer = (
    pointer: Phaser.Input.Pointer,
    pageX: number,
    pageY: number,
    wasMove: boolean
  ): void => {
    if (document.body.dataset.softwareLandscape !== "true") {
      defaultTransform(pointer, pageX, pageY, wasMove);
      return;
    }

    const canvas = manager.canvas ?? game.canvas;
    if (!canvas) {
      document.body.dataset.softwareLandscapeInputFallback = "no-canvas";
      defaultTransform(pointer, pageX, pageY, wasMove);
      return;
    }

    const mapped = mapSoftwareLandscapeClientPoint({
      clientX: pageX - window.scrollX,
      clientY: pageY - window.scrollY,
      bodyRect: document.body.getBoundingClientRect(),
      canvasRect: canvas.getBoundingClientRect(),
      logicalWidth,
      logicalHeight
    });

    if (!mapped) {
      document.body.dataset.softwareLandscapeInputFallback = "invalid-geometry";
      defaultTransform(pointer, pageX, pageY, wasMove);
      return;
    }

    delete document.body.dataset.softwareLandscapeInputFallback;
    applyPointerPosition(pointer, mapped.x, mapped.y, wasMove);
  };

  document.body.dataset.softwareLandscapeInput = "canvas-geometry-v2";
}
