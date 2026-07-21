import type {
  ActionComponent,
  BehaviorComponent,
  ConditionComponent,
  ModifierComponent,
  RuleComponent,
  RuleExecutionContext,
  RuleReferenceDefinition
} from "./RuleProtocol";

export interface RuleComponentRegistry<State = unknown> {
  readonly components: Readonly<Record<string, RuleComponent<State>>>;
  require(reference: RuleReferenceDefinition): RuleComponent<State>;
  validate(references: readonly RuleReferenceDefinition[]): readonly string[];
}

const componentKey = (kind: RuleReferenceDefinition["kind"], type: string): string => `${kind}:${type}`;

export function createRuleComponentRegistry<State = unknown>(
  components: readonly RuleComponent<State>[]
): RuleComponentRegistry<State> {
  const entries = components.map((component) => [
    componentKey(component.kind, component.type),
    component
  ] as const);
  const keys = entries.map(([key]) => key);
  if (new Set(keys).size !== keys.length) {
    throw new Error("Rule component registry contains duplicate kind/type entries");
  }
  const byKey = Object.freeze(Object.fromEntries(entries)) as Readonly<Record<string, RuleComponent<State>>>;

  return Object.freeze({
    components: byKey,
    require(reference: RuleReferenceDefinition): RuleComponent<State> {
      const component = byKey[componentKey(reference.kind, reference.type)];
      if (!component) {
        throw new Error(`Missing ${reference.kind} rule component: ${reference.type}`);
      }
      return component;
    },
    validate(references: readonly RuleReferenceDefinition[]): readonly string[] {
      const errors: string[] = [];
      const ids = new Set<string>();
      references.forEach((reference) => {
        if (!reference.id.trim()) errors.push("Rule reference id is required");
        if (ids.has(reference.id)) errors.push(`Duplicate rule reference id: ${reference.id}`);
        ids.add(reference.id);
        const component = byKey[componentKey(reference.kind, reference.type)];
        if (!component) {
          errors.push(`Missing ${reference.kind} rule component: ${reference.type}`);
          return;
        }
        component.validate(reference.params ?? {}).forEach((error) => (
          errors.push(`Rule ${reference.id}: ${error}`)
        ));
      });
      return Object.freeze(errors);
    }
  });
}

export class RulesEngine<State> {
  constructor(private readonly registry: RuleComponentRegistry<State>) {}

  evaluateConditions(
    references: readonly RuleReferenceDefinition[],
    context: RuleExecutionContext<State>
  ): boolean {
    return references
      .filter((reference) => reference.kind === "condition")
      .every((reference) => {
        const component = this.registry.require(reference) as ConditionComponent<State>;
        return component.evaluate(context, reference.params ?? {});
      });
  }

  executeActions(
    references: readonly RuleReferenceDefinition[],
    context: RuleExecutionContext<State>
  ): State {
    return references
      .filter((reference) => reference.kind === "action")
      .reduce((state, reference) => {
        const component = this.registry.require(reference) as ActionComponent<State>;
        return component.execute({ ...context, state }, reference.params ?? {});
      }, context.state);
  }

  applyModifiers<Value>(
    value: Value,
    references: readonly RuleReferenceDefinition[],
    context: RuleExecutionContext<State>
  ): Value {
    return references
      .filter((reference) => reference.kind === "modifier")
      .reduce((current, reference) => {
        const component = this.registry.require(reference) as ModifierComponent<Value, State>;
        return component.apply(current, context, reference.params ?? {});
      }, value);
  }

  tickBehaviors(
    references: readonly RuleReferenceDefinition[],
    context: RuleExecutionContext<State>,
    deltaMs: number
  ): State {
    return references
      .filter((reference) => reference.kind === "behavior")
      .reduce((state, reference) => {
        const component = this.registry.require(reference) as BehaviorComponent<State>;
        return component.tick({ ...context, state }, reference.params ?? {}, deltaMs);
      }, context.state);
  }
}

export const EMPTY_RULE_COMPONENT_REGISTRY = createRuleComponentRegistry([]);
