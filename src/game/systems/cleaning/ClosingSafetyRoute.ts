export function resolveClosingSafetyRouteChoices(
  totalSpills: number,
  completedIndexes: ReadonlySet<number>,
  warningRequiredIndexes: ReadonlySet<number>
): readonly number[] {
  const remaining = Array.from({ length: totalSpills }, (_, index) => index)
    .filter((index) => !completedIndexes.has(index));
  const dangerous = remaining.filter((index) => warningRequiredIndexes.has(index));
  return Object.freeze(dangerous.length > 0 ? dangerous : remaining);
}
