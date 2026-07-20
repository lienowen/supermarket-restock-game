export interface VisualPoint {
  readonly x: number;
  readonly y: number;
}

export interface VisualSize {
  readonly width: number;
  readonly height: number;
}

export interface VisualRect extends VisualPoint, VisualSize {}

export interface VisualTargetValidationResult {
  readonly errors: readonly string[];
}

export const STARTER_MARKET_VISUAL_SPEC = {
  logicalSize: {
    width: 1600,
    height: 900
  },
  camera: {
    mode: "fixed-third-person",
    vanishingPoint: { x: 800, y: 300 },
    horizonY: 300,
    foregroundStartY: 560
  },
  composition: {
    produceZone: { x: 0, y: 150, width: 500, height: 750 },
    backroomZone: { x: 500, y: 165, width: 500, height: 515 },
    beverageZone: { x: 1000, y: 145, width: 600, height: 755 },
    centreDepthAxis: { x: 650, y: 170, width: 320, height: 610 }
  },
  actor: {
    spawn: { x: 890, y: 625 },
    coolerPosition: { x: 1080, y: 630 },
    pushSize: { width: 180, height: 280 },
    carrySize: { width: 172, height: 270 },
    idleSize: { width: 165, height: 260 },
    navigationBounds: { x: 470, y: 430, width: 750, height: 340 },
    safeBounds: { x: 470, y: 430, width: 750, height: 340 },
    shadowOffset: { x: 0, y: 92 }
  },
  backroom: {
    centre: { x: 750, y: 390 },
    opening: { x: 555, y: 190, width: 390, height: 390 },
    sign: { x: 645, y: 166, width: 210, height: 46 }
  },
  produce: {
    sign: { x: 60, y: 150, width: 350, height: 58 },
    displayCentres: [
      { x: 185, y: 430 },
      { x: 210, y: 610 }
    ]
  },
  cooler: {
    centre: { x: 1325, y: 505 },
    displaySize: { width: 440, height: 610 },
    sign: { x: 1140, y: 150, width: 370, height: 58 },
    rowYs: [300, 375, 450, 525, 600, 675],
    activeStockBounds: { x: 1215, y: 260, width: 220, height: 455 },
    ambientLeftXs: [1169, 1211, 1253],
    ambientRightXs: [1397, 1439, 1481],
    restockStartX: 1249,
    restockStepX: 38,
    restockItemCount: 5
  },
  hud: {
    dayPanel: { x: 20, y: 18, width: 225, height: 70 },
    walletPanel: { x: 1360, y: 18, width: 220, height: 58 },
    objectivePanel: { x: 520, y: 18, width: 560, height: 78 },
    instructionPanel: { x: 250, y: 822, width: 1100, height: 58 },
    worldSafeArea: { x: 150, y: 105, width: 1300, height: 705 },
    departmentSignSafeArea: { x: 1110, y: 110, width: 430, height: 70 }
  },
  targeting: {
    color: 0xffc94f,
    singleActiveTarget: true,
    arrowOffsetY: 18
  },
  lighting: {
    environment: "warm-store",
    cooler: "cool-refrigerator",
    direction: "upper-left"
  },
  language: "en",
  realism: "stylized-cartoon-3d"
} as const;

const intersects = (a: VisualRect, b: VisualRect): boolean => (
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y
);

export function validateStarterMarketVisualSpec(): VisualTargetValidationResult {
  const spec = STARTER_MARKET_VISUAL_SPEC;
  const errors: string[] = [];

  if (spec.logicalSize.width !== 1600 || spec.logicalSize.height !== 900) {
    errors.push("The approved logical canvas must remain 1600x900");
  }
  if (spec.camera.mode !== "fixed-third-person") {
    errors.push("The camera must remain fixed third-person");
  }
  if (spec.actor.spawn.y < spec.camera.foregroundStartY) {
    errors.push("The employee must remain in the foreground composition");
  }
  if (spec.composition.produceZone.x >= spec.composition.backroomZone.x) {
    errors.push("Produce must remain left of the backroom");
  }
  if (spec.composition.backroomZone.x >= spec.composition.beverageZone.x) {
    errors.push("The backroom must remain left of the beverage zone");
  }
  if (spec.cooler.rowYs.length !== 6) {
    errors.push("The beverage cooler must expose six independently controlled rows");
  }
  if (intersects(spec.hud.objectivePanel, spec.hud.departmentSignSafeArea)) {
    errors.push("The objective HUD must not cover the beverage department sign");
  }
  if (intersects(spec.actor.safeBounds, spec.hud.instructionPanel)) {
    errors.push("The foreground employee must not be covered by the instruction HUD");
  }
  if (
    spec.actor.spawn.x < spec.actor.navigationBounds.x ||
    spec.actor.spawn.x > spec.actor.navigationBounds.x + spec.actor.navigationBounds.width ||
    spec.actor.spawn.y < spec.actor.navigationBounds.y ||
    spec.actor.spawn.y > spec.actor.navigationBounds.y + spec.actor.navigationBounds.height
  ) {
    errors.push("The employee spawn must remain inside the walkable floor bounds");
  }
  if (spec.language !== "en") {
    errors.push("Production presentation must remain English-only");
  }
  if (!spec.targeting.singleActiveTarget) {
    errors.push("Only one active yellow target is allowed");
  }

  return Object.freeze({ errors: Object.freeze(errors) });
}
