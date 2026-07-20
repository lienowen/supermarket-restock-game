export type LevelProgressionKind = "next-level" | "replay-level";

export interface LevelProgressionDecision {
  readonly kind: LevelProgressionKind;
  readonly targetLevelId: string;
  readonly actionLabel: string;
  readonly statusLabel: string;
}

export function resolveLevelProgression(
  currentLevelId: string,
  nextLevelId?: string
): LevelProgressionDecision {
  if (!currentLevelId.trim()) throw new Error("Current level ID is required");

  if (nextLevelId) {
    return Object.freeze({
      kind: "next-level" as const,
      targetLevelId: nextLevelId,
      actionLabel: "NEXT LEVEL",
      statusLabel: "LEVEL COMPLETE"
    });
  }

  return Object.freeze({
    kind: "replay-level" as const,
    targetLevelId: currentLevelId,
    actionLabel: "PLAY AGAIN",
    statusLabel: "CAMPAIGN COMPLETE"
  });
}
