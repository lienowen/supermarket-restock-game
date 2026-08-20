import type { LevelDefinition } from "../GameContent";

export type LevelPrimaryInput = "tap" | "hold" | "drag" | "timing" | "sequence" | "mixed";

export interface LevelChecklistStepSpec {
  readonly id: string;
  readonly label: string;
  readonly action?: string;
  readonly tracksProgress?: boolean;
}

export interface LevelChecklistSpec {
  readonly eyebrow: string;
  readonly heading: string;
  readonly steps: readonly LevelChecklistStepSpec[];
}

export interface GuidedDragActionSpec {
  readonly unlockAfterAction: string;
  readonly confirmAction: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly instruction: string;
  readonly sourceLabel: string;
  readonly targetLabel: string;
}

export interface CheckoutScanExperienceSpec {
  readonly itemCountPattern: readonly number[];
  readonly productAssetKeys: readonly string[];
  readonly scannerLabel: string;
  readonly paymentLabel: string;
}

export interface HoldWorkExperienceSpec {
  readonly action: string;
  readonly durationMs: number;
  readonly title: string;
  readonly instruction: string;
  readonly holdLabel: string;
}

export interface FindItemsSearchDecoySpec {
  readonly id: string;
  readonly assetKey: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface FindItemsSearchExperienceSpec {
  readonly decoys: readonly FindItemsSearchDecoySpec[];
}

export interface LevelExperienceSpec {
  readonly levelId: string;
  readonly mode: LevelDefinition["mode"];
  readonly modeLabel: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly objective: string;
  readonly mechanic: string;
  readonly control: string;
  readonly successMetric: string;
  readonly primaryInput: LevelPrimaryInput;
  readonly checklist?: LevelChecklistSpec;
  readonly guidedDrag?: GuidedDragActionSpec;
  readonly checkoutScan?: CheckoutScanExperienceSpec;
  readonly holdWork?: HoldWorkExperienceSpec;
  readonly findItemsSearch?: FindItemsSearchExperienceSpec;
}

const define = (spec: LevelExperienceSpec): LevelExperienceSpec => Object.freeze(spec);

export const STARTER_LEVEL_EXPERIENCE_SPECS: readonly LevelExperienceSpec[] = Object.freeze([
  define({
    levelId: "starter-level-001",
    mode: "restock",
    modeLabel: "GUIDED DELIVERY",
    eyebrow: "TRAINING SHIFT",
    title: "First Delivery",
    objective: "Move the cola case to the cooler and stock all six shelf slots.",
    mechanic: "The shelf order is fixed and there is no shelf timeout in this training level.",
    control: "Move with a floor tap or the arrow keys, drag the case onto the cart, then stock each shelf.",
    successMetric: "Finish the full delivery with as few wrong shelf taps as possible.",
    primaryInput: "mixed",
    checklist: Object.freeze({
      eyebrow: "FIRST DELIVERY",
      heading: "Shift checklist",
      steps: Object.freeze([
        Object.freeze({ id: "pickup", label: "Pick up the cola case", action: "PICK_BOX" }),
        Object.freeze({ id: "load", label: "Load the case onto the cart", action: "LOAD_CART" }),
        Object.freeze({ id: "deliver", label: "Deliver the cart to the cooler", action: "PUSH_CART" }),
        Object.freeze({ id: "open", label: "Open the case at the cooler", action: "OPEN_BOX" }),
        Object.freeze({ id: "stock", label: "Stock the cooler shelves", tracksProgress: true })
      ])
    }),
    guidedDrag: Object.freeze({
      unlockAfterAction: "PICK_BOX",
      confirmAction: "LOAD_CART",
      eyebrow: "HANDS-ON STEP",
      title: "Load the restock cart",
      instruction: "Drag the cola case into the empty cart. A normal tap will not complete this step.",
      sourceLabel: "COLA CASE",
      targetLabel: "RESTOCK CART"
    })
  }),
  define({
    levelId: "starter-level-002",
    mode: "restock",
    modeLabel: "PROMOTION MEMORY",
    eyebrow: "SHELF CHALLENGE",
    title: "Promotion Restock",
    objective: "Memorize the six-slot water display, then stock the cooler in that exact order.",
    mechanic: "The numbered pattern appears once, disappears before play, and never changes after a mistake.",
    control: "Read both cooler doors during the preview, then tap the remembered shelf sequence.",
    successMetric: "Complete the hidden sequence with high accuracy before the shelf timers expire.",
    primaryInput: "sequence"
  }),
  define({
    levelId: "starter-level-003",
    mode: "checkout",
    modeLabel: "CHECKOUT BASICS",
    eyebrow: "CUSTOMER SERVICE",
    title: "Checkout Rush",
    objective: "Scan every item in each waiting basket and confirm payment for every customer.",
    mechanic: "Items must physically cross the scanner; the payment button stays locked until the basket is empty.",
    control: "Drag each product into the scan zone, then press the POS payment button.",
    successMetric: "Serve every customer without skipping an item or attempting an early payment.",
    primaryInput: "drag",
    checkoutScan: Object.freeze({
      itemCountPattern: Object.freeze([2, 3, 2, 3, 2, 3]),
      productAssetKeys: Object.freeze([
        "product-milk-bottle",
        "product-apple",
        "product-cereal-box",
        "product-oats-canister",
        "product-chips-bag"
      ]),
      scannerLabel: "SCAN ZONE",
      paymentLabel: "CONFIRM PAYMENT"
    })
  }),
  define({
    levelId: "starter-level-004",
    mode: "clean",
    modeLabel: "SPILL PATROL",
    eyebrow: "STORE SAFETY",
    title: "Spill Patrol",
    objective: "Collect the cleaning tools and scrub every marked spill until the floor is dry.",
    mechanic: "Each spill needs sustained cleaning pressure; releasing early pauses the work instead of completing it.",
    control: "Move close to the highlighted spill, then hold the cleaning control until the progress ring is full.",
    successMetric: "Clean every spill without repeatedly releasing the tool early.",
    primaryInput: "hold",
    holdWork: Object.freeze({
      action: "CLEAN_SPOT",
      durationMs: 1300,
      title: "Scrub the spill",
      instruction: "Press and hold until the cleaning ring reaches 100%. Releasing early interrupts the scrub.",
      holdLabel: "HOLD TO CLEAN"
    })
  }),
  define({
    levelId: "starter-level-005",
    mode: "find-items",
    modeLabel: "ORDER HUNT",
    eyebrow: "PICKING TASK",
    title: "Order Hunt",
    objective: "Find the milk, apple and cereal hidden among eight visible store products.",
    mechanic: "Five believable decoy products share the shelf area; every wrong selection removes time from the order.",
    control: "Read the order ticket, inspect the full shelf and tap only the three requested products.",
    successMetric: "Complete the order before the countdown expires with no more than one wrong product.",
    primaryInput: "tap",
    findItemsSearch: Object.freeze({
      decoys: Object.freeze([
        Object.freeze({ id: "decoy-oats", assetKey: "product-oats-canister", x: 675, y: 632, width: 58, height: 82 }),
        Object.freeze({ id: "decoy-yogurt", assetKey: "product-yogurt-cup", x: 575, y: 655, width: 58, height: 58 }),
        Object.freeze({ id: "decoy-chips", assetKey: "product-chips-bag", x: 940, y: 646, width: 68, height: 82 }),
        Object.freeze({ id: "decoy-detergent", assetKey: "product-detergent-bottle", x: 1045, y: 706, width: 62, height: 94 }),
        Object.freeze({ id: "decoy-paper-towels", assetKey: "product-paper-towels", x: 735, y: 724, width: 82, height: 76 })
      ])
    })
  }),
  define({
    levelId: "starter-level-006",
    mode: "restock",
    modeLabel: "CART CAPACITY",
    eyebrow: "CLOSING LOAD",
    title: "Closing Stock Sprint",
    objective: "Use the two-slot restock cart to deliver both cola cases needed for the closing refill.",
    mechanic: "Three cases are available, but the cart holds only two; the water case is a wrong load and must stay behind.",
    control: "Drag both cola cases into the two cart slots, reject the water case, then complete the cooler refill.",
    successMetric: "Leave the backroom with two correct cola cases and finish the cooler without a loading mistake.",
    primaryInput: "mixed"
  }),
  define({
    levelId: "starter-level-007",
    mode: "checkout",
    modeLabel: "PATIENCE & WEIGHT",
    eyebrow: "PEAK SERVICE",
    title: "Evening Checkout",
    objective: "Serve all eight evening customers before their individual patience bars expire.",
    mechanic: "Every basket combines a standard scan with an apple weight decision; a wrong weight removes three seconds of patience.",
    control: "Drag the standard item through the scanner, match the produce label to the correct weight, then take payment.",
    successMetric: "Complete all eight orders with no abandoned customers and as few weight mistakes as possible.",
    primaryInput: "mixed"
  }),
  define({
    levelId: "starter-level-008",
    mode: "clean",
    modeLabel: "CLOSING SAFETY",
    eyebrow: "FINAL FLOOR CHECK",
    title: "Closing Clean-up",
    objective: "Collect the cleaning cart and clear all six closing-time floor hazards.",
    mechanic: "Water, juice and oil hazards require a wet-floor sign before scrubbing; dry marks can be cleaned immediately.",
    control: "Tap a hazard to walk over and place the safety sign when required, then drag across the spill until it reaches 100% clean.",
    successMetric: "Clear all six stops and place a safety sign on every liquid hazard before scrubbing it.",
    primaryInput: "mixed"
  }),
  define({
    levelId: "starter-level-009",
    mode: "find-items",
    modeLabel: "PRIORITY ORDER",
    eyebrow: "EXPRESS PICK",
    title: "Priority Order",
    objective: "Collect the priority cereal, milk and apple order before time runs out.",
    mechanic: "The order uses a different required sequence with a stronger mistake penalty.",
    control: "Read the ticket, tap only requested products and avoid repeat selections.",
    successMetric: "Clear the order with time remaining and zero mistakes.",
    primaryInput: "tap"
  }),
  define({
    levelId: "starter-level-010",
    mode: "restock",
    modeLabel: "FINAL MEMORY RUSH",
    eyebrow: "CHAPTER FINALE",
    title: "Final Cooler Rush",
    objective: "Finish the final water delivery by clearing two memorized three-shelf waves.",
    mechanic: "Each wave previews three shelf positions, then removes every target glow while the rush clock is active. A mistake keeps the route intact so you can recover instead of guessing a new answer.",
    control: "Memorize Wave 1, stock its three shelves from memory, then repeat the process for Wave 2.",
    successMetric: "Clear both blind routes with a strong streak and as few route mistakes as possible.",
    primaryInput: "sequence"
  })
]);

const SPECS_BY_LEVEL_ID: ReadonlyMap<string, LevelExperienceSpec> = new Map(
  STARTER_LEVEL_EXPERIENCE_SPECS.map((spec) => [spec.levelId, spec])
);

export function resolveLevelExperienceSpec(level: LevelDefinition): LevelExperienceSpec {
  const spec = SPECS_BY_LEVEL_ID.get(level.id);
  if (!spec) throw new Error(`Missing level experience spec for ${level.id}`);
  if (spec.mode !== level.mode) {
    throw new Error(`Level experience spec ${level.id} expects ${spec.mode}, received ${level.mode}`);
  }
  return spec;
}

export function validateLevelExperienceSpecs(levels: readonly LevelDefinition[]): readonly string[] {
  const errors: string[] = [];
  const levelIds = new Set(levels.map((level) => level.id));
  const specIds = new Set<string>();

  for (const spec of STARTER_LEVEL_EXPERIENCE_SPECS) {
    if (specIds.has(spec.levelId)) errors.push(`Duplicate level experience spec: ${spec.levelId}`);
    specIds.add(spec.levelId);
    if (!levelIds.has(spec.levelId)) errors.push(`Experience spec references missing level: ${spec.levelId}`);
    if (!spec.modeLabel.trim()) errors.push(`Experience spec ${spec.levelId} requires a mode label`);
    if (!spec.objective.trim()) errors.push(`Experience spec ${spec.levelId} requires an objective`);
    if (!spec.mechanic.trim()) errors.push(`Experience spec ${spec.levelId} requires a mechanic explanation`);
    if (!spec.control.trim()) errors.push(`Experience spec ${spec.levelId} requires a control explanation`);
    if (!spec.successMetric.trim()) errors.push(`Experience spec ${spec.levelId} requires a success metric`);

    if (spec.checklist) {
      const stepIds = new Set<string>();
      if (!spec.checklist.heading.trim()) errors.push(`Experience spec ${spec.levelId} checklist requires a heading`);
      if (spec.checklist.steps.length < 2) errors.push(`Experience spec ${spec.levelId} checklist requires at least two steps`);
      spec.checklist.steps.forEach((step) => {
        if (stepIds.has(step.id)) errors.push(`Experience spec ${spec.levelId} has duplicate checklist step ${step.id}`);
        stepIds.add(step.id);
        if (!step.label.trim()) errors.push(`Experience spec ${spec.levelId} checklist step ${step.id} requires a label`);
        if (!step.action && !step.tracksProgress) errors.push(`Experience spec ${spec.levelId} checklist step ${step.id} has no completion signal`);
      });
    }

    if (spec.guidedDrag) {
      if (!spec.guidedDrag.unlockAfterAction.trim()) errors.push(`Experience spec ${spec.levelId} guided drag requires an unlock action`);
      if (!spec.guidedDrag.confirmAction.trim()) errors.push(`Experience spec ${spec.levelId} guided drag requires a confirm action`);
      if (spec.guidedDrag.unlockAfterAction === spec.guidedDrag.confirmAction) errors.push(`Experience spec ${spec.levelId} guided drag actions must differ`);
    }

    if (spec.checkoutScan) {
      if (spec.mode !== "checkout") errors.push(`Experience spec ${spec.levelId} scan interaction requires checkout mode`);
      if (spec.checkoutScan.itemCountPattern.length === 0) errors.push(`Experience spec ${spec.levelId} scan interaction requires an item count pattern`);
      if (spec.checkoutScan.itemCountPattern.some((count) => !Number.isInteger(count) || count < 1 || count > 5)) errors.push(`Experience spec ${spec.levelId} scan item counts must be integers from 1 to 5`);
      if (new Set(spec.checkoutScan.productAssetKeys).size < 3) errors.push(`Experience spec ${spec.levelId} scan interaction requires at least three product assets`);
    }

    if (spec.holdWork) {
      if (spec.mode !== "clean") errors.push(`Experience spec ${spec.levelId} hold interaction requires clean mode`);
      if (!spec.holdWork.action.trim()) errors.push(`Experience spec ${spec.levelId} hold interaction requires an action`);
      if (!Number.isFinite(spec.holdWork.durationMs) || spec.holdWork.durationMs < 800) errors.push(`Experience spec ${spec.levelId} hold interaction must last at least 800ms`);
    }

    if (spec.findItemsSearch) {
      if (spec.mode !== "find-items") errors.push(`Experience spec ${spec.levelId} visual search requires find-items mode`);
      if (spec.findItemsSearch.decoys.length < 4) errors.push(`Experience spec ${spec.levelId} visual search requires at least four decoys`);
      const decoyIds = new Set<string>();
      const occupiedPositions = new Set<string>();
      spec.findItemsSearch.decoys.forEach((decoy) => {
        if (!decoy.id.trim()) errors.push(`Experience spec ${spec.levelId} has a decoy without an id`);
        if (decoyIds.has(decoy.id)) errors.push(`Experience spec ${spec.levelId} has duplicate decoy ${decoy.id}`);
        decoyIds.add(decoy.id);
        if (!decoy.assetKey.trim()) errors.push(`Experience spec ${spec.levelId} decoy ${decoy.id} requires an asset`);
        if (![decoy.x, decoy.y, decoy.width, decoy.height].every(Number.isFinite)) errors.push(`Experience spec ${spec.levelId} decoy ${decoy.id} requires finite geometry`);
        if (decoy.width < 36 || decoy.height < 36) errors.push(`Experience spec ${spec.levelId} decoy ${decoy.id} is too small to select`);
        const positionKey = `${decoy.x}:${decoy.y}`;
        if (occupiedPositions.has(positionKey)) errors.push(`Experience spec ${spec.levelId} has overlapping decoy centres at ${positionKey}`);
        occupiedPositions.add(positionKey);
      });
    }
  }

  for (const level of levels) {
    const spec = SPECS_BY_LEVEL_ID.get(level.id);
    if (!spec) errors.push(`Level ${level.id} has no experience spec`);
    else if (spec.mode !== level.mode) errors.push(`Level ${level.id} experience mode does not match level mode`);
  }

  return Object.freeze(errors);
}
