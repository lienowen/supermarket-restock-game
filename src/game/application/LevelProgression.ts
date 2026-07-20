export type LevelProgressionKind = "next-level" | "replay-campaign";

export interface LevelProgressionDecision {
  readonly kind: LevelProgressionKind;
  readonly targetLevelId: string;
  readonly actionLabel: string;
  readonly statusLabel: string;
}

export function resolveLevelProgression(
  currentLevelId: string,
  nextLevelId: string | undefined,
  firstLevelId: string
): LevelProgressionDecision {
  if (!currentLevelId.trim()) throw new Error("Current level ID is required");
  if (!firstLevelId.trim()) throw new Error("First campaign level ID is required");

  if (nextLevelId) {
    return Object.freeze({
      kind: "next-level" as const,
      targetLevelId: nextLevelId,
      actionLabel: "NEXT LEVEL",
      statusLabel: "LEVEL COMPLETE"
    });
  }

  return Object.freeze({
    kind: "replay-campaign" as const,
    targetLevelId: firstLevelId,
    actionLabel: "PLAY AGAIN",
    statusLabel: "CAMPAIGN COMPLETE"
  });
}
