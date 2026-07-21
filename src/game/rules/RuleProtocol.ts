export type RuleComponentKind = "condition" | "action" | "modifier" | "behavior";

export type RuleParams = Readonly<Record<string, unknown>>;

export interface RuleReferenceDefinition {
  readonly id: string;
  readonly kind: RuleComponentKind;
  readonly type: string;
  readonly params?: RuleParams;
}

export interface RuleEvent {
  readonly type: string;
  readonly payload?: unknown;
}

export interface RuleExecutionContext<State> {
  readonly state: State;
  readonly nowMs: number;
  readonly random: () => number;
  readonly emit: (event: RuleEvent) => void;
}

interface BaseRuleComponent {
  readonly kind: RuleComponentKind;
  readonly type: string;
  validate(params: RuleParams): readonly string[];
}

export interface ConditionComponent<State = unknown> extends BaseRuleComponent {
  readonly kind: "condition";
  evaluate(context: RuleExecutionContext<State>, params: RuleParams): boolean;
}

export interface ActionComponent<State = unknown> extends BaseRuleComponent {
  readonly kind: "action";
  execute(context: RuleExecutionContext<State>, params: RuleParams): State;
}

export interface ModifierComponent<Value = number, State = unknown> extends BaseRuleComponent {
  readonly kind: "modifier";
  apply(value: Value, context: RuleExecutionContext<State>, params: RuleParams): Value;
}

export interface BehaviorComponent<State = unknown> extends BaseRuleComponent {
  readonly kind: "behavior";
  tick(context: RuleExecutionContext<State>, params: RuleParams, deltaMs: number): State;
}

export type RuleComponent<State = unknown> =
  | ConditionComponent<State>
  | ActionComponent<State>
  | ModifierComponent<unknown, State>
  | BehaviorComponent<State>;
