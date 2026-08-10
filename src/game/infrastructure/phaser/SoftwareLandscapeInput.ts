import Phaser from "phaser";

interface MutableInputManager {
  transformPointer: (
    pointer: Phaser.Input.Pointer,
    pageX: number,
    pageY: number,
    wasMove: boolean
  ) => void;
  __softwareLandscapeInputInstalled?: boolean;
}

/**
 * Phaser's ScaleManager assumes the canvas is axis-aligned in the page. Our
 * portrait fallback rotates the complete landscape stage by 90 degrees in CSS,
 * so the default pointer transform swaps the wrong axes. This adapter performs
 * the inverse rotation before mapping the pointer into the 1600x900 game space.
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

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const stageWidth = viewportHeight;
    const stageHeight = viewportWidth;

    const clientX = pageX - window.scrollX;
    const clientY = pageY - window.scrollY;

    // Inverse of: rotate(90deg) translateY(-100%).
    const stageX = clientY;
    const stageY = viewportWidth - clientX;

    const fitScale = Math.min(
      stageWidth / logicalWidth,
      stageHeight / logicalHeight
    );
    const canvasWidth = logicalWidth * fitScale;
    const canvasHeight = logicalHeight * fitScale;
    const canvasLeft = (stageWidth - canvasWidth) / 2;
    const canvasTop = (stageHeight - canvasHeight) / 2;

    const x = (stageX - canvasLeft) / fitScale;
    const y = (stageY - canvasTop) / fitScale;

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

  document.body.dataset.softwareLandscapeInput = "mapped";
}
