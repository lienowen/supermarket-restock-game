export interface SoftwareLandscapePoint {
  readonly x: number;
  readonly y: number;
}

export interface SoftwareLandscapeRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface SoftwareLandscapeMappingInput {
  readonly clientX: number;
  readonly clientY: number;
  readonly bodyRect: SoftwareLandscapeRect;
  readonly canvasRect: SoftwareLandscapeRect;
  readonly logicalWidth: number;
  readonly logicalHeight: number;
}

const finitePositive = (value: number): boolean => Number.isFinite(value) && value > 0;

/**
 * Inverse of the project software-landscape transform:
 *   rotate(90deg) translateY(-100%)
 *
 * bodyRect is the body's post-transform client-space rectangle. Using its real
 * rendered bounds keeps the mapping correct when mobile browser chrome changes
 * the dynamic viewport while the page is open.
 */
export function inverseSoftwareLandscapeClientPoint(
  clientX: number,
  clientY: number,
  bodyRect: SoftwareLandscapeRect
): SoftwareLandscapePoint | undefined {
  if (
    !Number.isFinite(clientX) ||
    !Number.isFinite(clientY) ||
    !Number.isFinite(bodyRect.left) ||
    !Number.isFinite(bodyRect.top) ||
    !finitePositive(bodyRect.width) ||
    !finitePositive(bodyRect.height)
  ) {
    return undefined;
  }

  const localClientX = clientX - bodyRect.left;
  const localClientY = clientY - bodyRect.top;

  return Object.freeze({
    x: localClientY,
    y: bodyRect.width - localClientX
  });
}

/**
 * Converts a portrait-browser client point into Phaser's logical landscape
 * coordinate space using the canvas that is actually rendered on screen.
 *
 * The previous implementation recomputed Phaser.Scale.FIT from window.inner*
 * values. Android browser chrome, WebViews and dynamic viewport units can make
 * those values temporarily disagree with the CSS-rendered canvas. Reading the
 * real body/canvas rectangles avoids that drift and also accounts for the
 * letterbox offset introduced by Phaser.Scale.FIT.
 */
export function mapSoftwareLandscapeClientPoint(
  input: SoftwareLandscapeMappingInput
): SoftwareLandscapePoint | undefined {
  const {
    clientX,
    clientY,
    bodyRect,
    canvasRect,
    logicalWidth,
    logicalHeight
  } = input;

  if (
    !finitePositive(logicalWidth) ||
    !finitePositive(logicalHeight) ||
    !finitePositive(canvasRect.width) ||
    !finitePositive(canvasRect.height)
  ) {
    return undefined;
  }

  const stagePoint = inverseSoftwareLandscapeClientPoint(clientX, clientY, bodyRect);
  const canvasCentre = inverseSoftwareLandscapeClientPoint(
    canvasRect.left + canvasRect.width / 2,
    canvasRect.top + canvasRect.height / 2,
    bodyRect
  );
  if (!stagePoint || !canvasCentre) return undefined;

  // A 90-degree body rotation swaps the canvas client-space width/height.
  const canvasStageWidth = canvasRect.height;
  const canvasStageHeight = canvasRect.width;
  const canvasLeft = canvasCentre.x - canvasStageWidth / 2;
  const canvasTop = canvasCentre.y - canvasStageHeight / 2;

  const x = ((stagePoint.x - canvasLeft) / canvasStageWidth) * logicalWidth;
  const y = ((stagePoint.y - canvasTop) / canvasStageHeight) * logicalHeight;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;

  return Object.freeze({ x, y });
}
