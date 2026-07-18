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
    vanishingPoint: { x: 800, y: 298 },
    horizonY: 298,
    foregroundStartY: 565
  },
  composition: {
    produceZone: { x: 0, y: 155, width: 545, height: 745 },
    backroomZone: { x: 545, y: 170, width: 430, height: 500 },
    beverageZone: { x: 975, y: 120, width: 625, height: 780 },
    centreDepthAxis: { x: 625, y: 170, width: 350, height: 620 }
  },
  actor: {
    spawn: { x: 890, y: 625 },
    coolerPosition: { x: 1055, y: 625 },
    pushSize: { width: 250, height: 375 },
    carrySize: { width: 220, height: 330 },
    safeBounds: { x: 600, y: 435, width: 520, height: 375 },
    shadowOffset: { x: 8, y: 86 }
  },
  backroom: {
    centre: { x: 760, y: 382 },
    opening: { x: 562, y: 190, width: 396, height: 380 },
    sign: { x: 635, y: 157, width: 250, height: 52 }
  },
  produce: {
    sign: { x: 73, y: 144, width: 370, height: 66 },
    displayCentres: [
      { x: 175, y: 395 },
      { x: 190, y: 550 },
      { x: 210, y: 725 }
    ]
  },
  cooler: {
    centre: { x: 1325, y: 495 },
    displaySize: { width: 535, height: 640 },
    sign: { x: 1110, y: 86, width: 430, height: 62 },
    rowYs: [286, 364, 442, 520, 598, 676],
    activeStockBounds: { x: 1230, y: 250, width: 190, height: 465 },
    ambientLeftXs: [1110, 1140, 1170, 1200],
    ambientRightXs: [1450, 1480, 1510, 1540],
    restockStartX: 1262,
    restockStepX: 26,
    restockItemCount: 6
  },
  hud: {
    dayPanel: { x: 20, y: 20, width: 150, height: 84 },
    walletPanel: { x: 1340, y: 17, width: 240, height: 62 },
    objectivePanel: { x: 1230, y: 156, width: 350, height: 112 },
    instructionPanel: { x: 170, y: 817, width: 1260, height: 66 },
    worldSafeArea: { x: 170, y: 80, width: 1060, height: 737 },
    departmentSignSafeArea: { x: 1080, y: 80, width: 480, height: 72 }
  },
  targeting: {
    color: 0xf1c441,
    singleActiveTarget: true,
    arrowOffsetY: 25
  },
  lighting: {
    environment: "warm-store",
    cooler: "cool-refrigerator",
    direction: "upper-left"
  },
  language: "en",
  realism: "semi-realistic-to-realistic"
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

  if (spec.language !== "en") {
    errors.push("Production presentation must remain English-only");
  }

  if (!spec.targeting.singleActiveTarget) {
    errors.push("Only one active yellow target is allowed");
  }

  return Object.freeze({ errors: Object.freeze(errors) });
}
