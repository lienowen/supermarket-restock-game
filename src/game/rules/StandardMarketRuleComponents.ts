import {
  createRuleComponentRegistry,
  type RuleComponentRegistry
} from "./RuleComponentRegistry";
import type {
  ActionComponent,
  BehaviorComponent,
  ConditionComponent,
  ModifierComponent,
  RuleExecutionContext,
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
  validate: (params: RuleParams) => validateNumber(params, "ratio", { min: 0, max: 1 }),
  evaluate: (context: RuleExecutionContext<StandardMarketRuleState>, params: RuleParams) => {
    const ratio = requiredNumber(params, "ratio", { min: 0, max: 1 });
    if (context.state.total <= 0) return ratio <= 0;
    return context.state.progress / context.state.total >= ratio;
  }
});

export const GRANT_COINS_ACTION: ActionComponent<StandardMarketRuleState> = Object.freeze({
  kind: "action",
  type: "economy.grant-coins",
  validate: (params: RuleParams) => validateNumber(params, "amount", { min: 0 }),
  execute: (context: RuleExecutionContext<StandardMarketRuleState>, params: RuleParams) => {
    const amount = Math.floor(requiredNumber(params, "amount", { min: 0 }));
    const next = Object.freeze({ ...context.state, coins: context.state.coins + amount });
    context.emit({ type: "economy.coins-granted", payload: { amount, coins: next.coins } });
    return next;
  }
});

export const MULTIPLY_NUMBER_MODIFIER: ModifierComponent<unknown, StandardMarketRuleState> = Object.freeze({
  kind: "modifier",
  type: "number.multiply",
  validate: (params: RuleParams) => validateNumber(params, "multiplier", { min: 0 }),
  apply: (
    value: unknown,
    _context: RuleExecutionContext<StandardMarketRuleState>,
    params: RuleParams
  ) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error("number.multiply requires a finite numeric value");
    }
    return value * requiredNumber(params, "multiplier", { min: 0 });
  }
});

export const COUNTDOWN_BEHAVIOR: BehaviorComponent<StandardMarketRuleState> = Object.freeze({
  kind: "behavior",
  type: "timer.countdown",
  validate: (params: RuleParams) => validateNumber(params, "rate", { min: 0 }),
  tick: (
    context: RuleExecutionContext<StandardMarketRuleState>,
    params: RuleParams,
    deltaMs: number
  ) => {
    const rate = requiredNumber(params, "rate", { min: 0 });
    const remainingMs = Math.max(0, context.state.remainingMs - Math.max(0, deltaMs) * rate);
    if (context.state.remainingMs > 0 && remainingMs === 0) {
      context.emit({ type: "timer.expired" });
    }
    return Object.freeze({ ...context.state, remainingMs });
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
