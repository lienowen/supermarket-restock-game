import type { LevelDefinition } from "../GameContent";

export interface CheckoutPatienceExperienceSpec {
  readonly levelId: string;
  readonly mode: "checkout";
  readonly customerCount: number;
  readonly patienceDurationMs: number;
  readonly wrongWeightPenaltyMs: number;
  readonly standardProductAssetKeys: readonly string[];
  readonly weighedProductAssetKey: string;
  readonly scaleAssetKey: string;
  readonly happyCustomerAssetKey: string;
  readonly impatientCustomerAssetKey: string;
  readonly targetWeightsKg: readonly number[];
  readonly weightChoicesKg: readonly number[];
  readonly scannerLabel: string;
  readonly scaleLabel: string;
  readonly paymentLabel: string;
}

export const CHECKOUT_PATIENCE_EXPERIENCE_SPECS: readonly CheckoutPatienceExperienceSpec[] = Object.freeze([
  Object.freeze({
    levelId: "starter-level-007",
    mode: "checkout" as const,
    customerCount: 8,
    patienceDurationMs: 22000,
    wrongWeightPenaltyMs: 4500,
    standardProductAssetKeys: Object.freeze([
      "product-milk-bottle",
      "product-cereal-box",
      "product-oats-canister",
      "product-chips-bag",
      "product-yogurt-cup"
    ]),
    weighedProductAssetKey: "product-apple",
    scaleAssetKey: "equipment-produce-scale",
    happyCustomerAssetKey: "customer-evening-happy",
    impatientCustomerAssetKey: "customer-evening-impatient",
    targetWeightsKg: Object.freeze([0.5, 1, 1.5, 0.5, 1.5, 1, 0.5, 1.5]),
    weightChoicesKg: Object.freeze([0.5, 1, 1.5]),
    scannerLabel: "SCAN STANDARD ITEM",
    scaleLabel: "WEIGH PRODUCE",
    paymentLabel: "TAKE PAYMENT"
  })
]);

const BY_LEVEL_ID: ReadonlyMap<string, CheckoutPatienceExperienceSpec> = new Map(
  CHECKOUT_PATIENCE_EXPERIENCE_SPECS.map((spec) => [spec.levelId, spec])
);

export function resolveCheckoutPatienceExperienceSpec(
  level: LevelDefinition
): CheckoutPatienceExperienceSpec | undefined {
  const spec = BY_LEVEL_ID.get(level.id);
  if (!spec) return undefined;
  if (level.mode !== spec.mode) {
    throw new Error(`Checkout patience spec ${spec.levelId} expects ${spec.mode}, received ${level.mode}`);
  }
  return spec;
}

export function validateCheckoutPatienceExperienceSpecs(
  levels: readonly LevelDefinition[]
): readonly string[] {
  const errors: string[] = [];
  const levelIds = new Set(levels.map((level) => level.id));

  CHECKOUT_PATIENCE_EXPERIENCE_SPECS.forEach((spec) => {
    if (!levelIds.has(spec.levelId)) errors.push(`Checkout patience spec references missing level: ${spec.levelId}`);
    if (!Number.isInteger(spec.customerCount) || spec.customerCount < 4) {
      errors.push(`Checkout patience spec ${spec.levelId} requires at least four customers`);
    }
    if (!Number.isFinite(spec.patienceDurationMs) || spec.patienceDurationMs < 8000) {
      errors.push(`Checkout patience spec ${spec.levelId} requires at least eight seconds of patience`);
    }
    if (
      !Number.isFinite(spec.wrongWeightPenaltyMs) ||
      spec.wrongWeightPenaltyMs <= 0 ||
      spec.wrongWeightPenaltyMs >= spec.patienceDurationMs
    ) {
      errors.push(`Checkout patience spec ${spec.levelId} has an invalid wrong-weight penalty`);
    }
    if (spec.standardProductAssetKeys.length < 3) {
      errors.push(`Checkout patience spec ${spec.levelId} requires at least three standard product assets`);
    }
    if (spec.targetWeightsKg.length !== spec.customerCount) {
      errors.push(`Checkout patience spec ${spec.levelId} target weights must match customer count`);
    }
    const validWeights = new Set(spec.weightChoicesKg);
    if (spec.weightChoicesKg.length < 3 || spec.weightChoicesKg.some((weight) => weight <= 0)) {
      errors.push(`Checkout patience spec ${spec.levelId} requires three positive weight choices`);
    }
    if (spec.targetWeightsKg.some((weight) => !validWeights.has(weight))) {
      errors.push(`Checkout patience spec ${spec.levelId} uses a target weight outside its choices`);
    }
    const requiredAssetKeys = [
      spec.weighedProductAssetKey,
      spec.scaleAssetKey,
      spec.happyCustomerAssetKey,
      spec.impatientCustomerAssetKey
    ];
    if (requiredAssetKeys.some((assetKey) => !assetKey.trim())) {
      errors.push(`Checkout patience spec ${spec.levelId} requires produce, scale and customer mood assets`);
    }
  });

  return Object.freeze(errors);
}
