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
    objective: "Collect the cleaning tools and clear every marked spill.",
    mechanic: "The spills are handled in a guided route so the player learns the cleaning workflow.",
    control: "Move near the highlighted tool or spill and confirm the action.",
    successMetric: "Clean every spill and finish the safety route.",
    primaryInput: "tap"
  }),
  define({
    levelId: "starter-level-005",
    mode: "find-items",
    modeLabel: "ORDER HUNT",
    eyebrow: "PICKING TASK",
    title: "Order Hunt",
    objective: "Find the milk, apple and cereal shown on the order ticket.",
    mechanic: "Wrong products remove time from the customer order countdown.",
    control: "Tap a requested product; the worker will walk to its shelf and collect it.",
    successMetric: "Complete the order before the countdown expires.",
    primaryInput: "tap"
  }),
  define({
    levelId: "starter-level-006",
    mode: "restock",
    modeLabel: "CLOSING SPRINT",
    eyebrow: "SPEED SHIFT",
    title: "Closing Stock Sprint",
    objective: "Complete the cola cooler before closing time.",
    mechanic: "Shelf windows are shorter and streak recovery is less forgiving.",
    control: "Track the active slot across both cooler doors and respond quickly.",
    successMetric: "Finish with a fast grade and a strong best streak.",
    primaryInput: "sequence"
  }),
  define({
    levelId: "starter-level-007",
    mode: "checkout",
    modeLabel: "EVENING CHECKOUT",
    eyebrow: "PEAK SERVICE",
    title: "Evening Checkout",
    objective: "Process the larger evening queue at the express lane.",
    mechanic: "More customers arrive while scan and queue transitions happen faster.",
    control: "Stay at the register and keep the service action moving.",
    successMetric: "Serve all eight customers and preserve the carried reputation.",
    primaryInput: "tap"
  }),
  define({
    levelId: "starter-level-008",
    mode: "clean",
    modeLabel: "CLOSING CLEAN-UP",
    eyebrow: "FINAL FLOOR CHECK",
    title: "Closing Clean-up",
    objective: "Collect the cart and clear all six closing-time spills.",
    mechanic: "A longer route and tighter interaction spacing demand deliberate movement.",
    control: "Move close to each marked spill before confirming the clean action.",
    successMetric: "Complete all six stops without skipping a spill.",
    primaryInput: "tap"
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
    modeLabel: "FINAL COOLER RUSH",
    eyebrow: "CHAPTER FINALE",
    title: "Final Cooler Rush",
    objective: "Finish the final water restock through the fastest shelf windows in the chapter.",
    mechanic: "The random shelf sequence reaches its minimum response window quickly.",
    control: "Follow the active shelf marker and commit to fast, accurate taps.",
    successMetric: "Complete the campaign and earn the best final rush grade possible.",
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
        if (!step.action && !step.tracksProgress) {
          errors.push(`Experience spec ${spec.levelId} checklist step ${step.id} has no completion signal`);
        }
      });
    }

    if (spec.guidedDrag) {
      if (!spec.guidedDrag.unlockAfterAction.trim()) {
        errors.push(`Experience spec ${spec.levelId} guided drag requires an unlock action`);
      }
      if (!spec.guidedDrag.confirmAction.trim()) {
        errors.push(`Experience spec ${spec.levelId} guided drag requires a confirm action`);
      }
      if (spec.guidedDrag.unlockAfterAction === spec.guidedDrag.confirmAction) {
        errors.push(`Experience spec ${spec.levelId} guided drag actions must differ`);
      }
    }

    if (spec.checkoutScan) {
      if (spec.mode !== "checkout") errors.push(`Experience spec ${spec.levelId} scan interaction requires checkout mode`);
      if (spec.checkoutScan.itemCountPattern.length === 0) {
        errors.push(`Experience spec ${spec.levelId} scan interaction requires an item count pattern`);
      }
      if (spec.checkoutScan.itemCountPattern.some((count) => !Number.isInteger(count) || count < 1 || count > 5)) {
        errors.push(`Experience spec ${spec.levelId} scan item counts must be integers from 1 to 5`);
      }
      if (new Set(spec.checkoutScan.productAssetKeys).size < 3) {
        errors.push(`Experience spec ${spec.levelId} scan interaction requires at least three product assets`);
      }
    }
  }

  for (const level of levels) {
    const spec = SPECS_BY_LEVEL_ID.get(level.id);
    if (!spec) errors.push(`Level ${level.id} has no experience spec`);
    else if (spec.mode !== level.mode) errors.push(`Level ${level.id} experience mode does not match level mode`);
  }

  return Object.freeze(errors);
}
