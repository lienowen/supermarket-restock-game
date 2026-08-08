import type { LevelDefinition } from "../GameContent";
import {
  resolveLevelExperienceSpec,
  type LevelExperienceSpec
} from "./LevelExperienceSpec";

const LEVEL_FOUR_ID = "starter-level-004";

/**
 * Presentation/input overrides that are already part of the mature pass but do
 * not need to mutate the canonical campaign definition. Keep this layer small:
 * once a mature mechanic is frozen it can be folded back into the base spec.
 */
export function resolveMatureLevelExperienceSpec(
  level: LevelDefinition
): LevelExperienceSpec {
  const base = resolveLevelExperienceSpec(level);
  if (level.id !== LEVEL_FOUR_ID) return base;

  return Object.freeze({
    ...base,
    mechanic: "Each spill is cleaned directly on the floor. Scrub back and forth until the visible mess fades away.",
    control: "Move close to the highlighted spill, then drag across the spill repeatedly to scrub it clean.",
    successMetric: "Clear every water, juice and dirt spill by fully scrubbing the marked floor area.",
    primaryInput: "drag" as const,
    holdWork: undefined
  });
}
