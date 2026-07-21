import {
  createRuleComponentRegistry,
  type RuleComponentRegistry
} from "./RuleComponentRegistry";
import type {
  ActionComponent,
  BehaviorComponent,
  ConditionComponent,
  ModifierComponent,
  RuleParams
} from "./RuleProtocol";

export interface StandardMarketRuleState {
  readonly progress: number;
  readonly total: number;
  readonly coins: number;
  readonly remainingMs: number;
}

const requiredNumber = (
  params: RuleParams,
  name: string,
  options: { readonly min?: number; readonly max?: number } = {}
): number => {
  const value = params[name];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`);
  }
  if (options.min !== undefined && value < options.min) {
    throw new Error(`${name} must be at least ${options.min}`);
  }
  if (options.max !== undefined && value > options.max) {
    throw new Error(`${name} must be at most ${options.max}`);
  }
  return value;
};

const validateNumber = (
  params: RuleParams,
  name: string,
  options: { readonly min?: number; readonly max?: number } = {}
): readonly string[] => {
  try {
    requiredNumber(params, name, options);
    return Object.freeze([]);
  } catch (error) {
    return Object.freeze([error instanceof Error ? error.message : String(error)]);
  }
};

export const PROGRESS_AT_LEAST_CONDITION: ConditionComponent<StandardMarketRuleState> = Object.freeze({
  kind: "condition",
  type: "progress.at-least",
  validate: (params) => validateNumber(params, "ratio", { min: 0, max: 1 }),
  evaluate: ({ state }, params) => {
    const ratio = requiredNumber(params, "ratio", { min: 0, max: 1 });
    if (state.total <= 0) return ratio <= 0;
    return state.progress / state.total >= ratio;
  }
});

export const GRANT_COINS_ACTION: ActionComponent<StandardMarketRuleState> = Object.freeze({
  kind: "action",
  type: "economy.grant-coins",
  validate: (params) => validateNumber(params, "amount", { min: 0 }),
  execute: ({ state, emit }, params) => {
    const amount = Math.floor(requiredNumber(params, "amount", { min: 0 }));
    const next = Object.freeze({ ...state, coins: state.coins + amount });
    emit({ type: "economy.coins-granted", payload: { amount, coins: next.coins } });
    return next;
  }
});

export const MULTIPLY_NUMBER_MODIFIER: ModifierComponent<unknown, StandardMarketRuleState> = Object.freeze({
  kind: "modifier",
  type: "number.multiply",
  validate: (params) => validateNumber(params, "multiplier", { min: 0 }),
  apply: (value, _context, params) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error("number.multiply requires a finite numeric value");
    }
    return value * requiredNumber(params, "multiplier", { min: 0 });
  }
});

export const COUNTDOWN_BEHAVIOR: BehaviorComponent<StandardMarketRuleState> = Object.freeze({
  kind: "behavior",
  type: "timer.countdown",
  validate: (params) => validateNumber(params, "rate", { min: 0 }),
  tick: ({ state, emit }, params, deltaMs) => {
    const rate = requiredNumber(params, "rate", { min: 0 });
    const remainingMs = Math.max(0, state.remainingMs - Math.max(0, deltaMs) * rate);
    if (state.remainingMs > 0 && remainingMs === 0) {
      emit({ type: "timer.expired" });
    }
    return Object.freeze({ ...state, remainingMs });
  }
});

export const STANDARD_MARKET_RULE_COMPONENTS = Object.freeze([
  PROGRESS_AT_LEAST_CONDITION,
  GRANT_COINS_ACTION,
  MULTIPLY_NUMBER_MODIFIER,
  COUNTDOWN_BEHAVIOR
]);

export const STANDARD_MARKET_RULE_REGISTRY: RuleComponentRegistry<StandardMarketRuleState> =
  createRuleComponentRegistry<StandardMarketRuleState>(STANDARD_MARKET_RULE_COMPONENTS);
