export function resolveClosingSafetyRouteChoices(
  totalSpills: number,
  completedIndexes: ReadonlySet<number>,
  warningRequiredIndexes: ReadonlySet<number>
): readonly number[] {
  const remaining = Array.from({ length: totalSpills }, (_, index) => index)
    .filter((index) => !completedIndexes.has(index));

  // Keep dangerous spills visually prioritized, but never hard-lock the player
  // out of another visible cleaning stop. The previous danger-only gate could
  // leave L8 looking clickable while every visible target was disabled.
  const dangerous = remaining.filter((index) => warningRequiredIndexes.has(index));
  const regular = remaining.filter((index) => !warningRequiredIndexes.has(index));
  return Object.freeze([...dangerous, ...regular]);
}
