import type {
  GameContentCatalogue,
  LevelDefinition,
  MissionDefinition,
  ShiftDefinition
} from "../content/GameContent";
import {
  resolveCheckoutLevelRuntime,
  type CheckoutLevelRuntimeContent
} from "./CheckoutLevelRuntimeContent";
import {
  resolveRestockShiftRuntime,
  type RestockShiftRuntimeContent
} from "./ShiftRuntimeContent";
import {
  resolveCleanLevelRuntime,
  resolveFindItemsLevelRuntime,
  type CleanLevelRuntimeContent,
  type FindItemsLevelRuntimeContent
} from "./UtilityLevelRuntimeContent";

export type PlayableLevelRuntimeContent =
  | RestockShiftRuntimeContent
  | CheckoutLevelRuntimeContent
  | CleanLevelRuntimeContent
  | FindItemsLevelRuntimeContent;

interface GameplayRuntimeResolverContext {
  readonly catalogue: GameContentCatalogue;
  readonly level: LevelDefinition;
  readonly shift: ShiftDefinition;
  readonly mission: MissionDefinition;
}

type GameplayRuntimeResolver = (
  context: GameplayRuntimeResolverContext
) => PlayableLevelRuntimeContent;

const GAMEPLAY_RUNTIME_RESOLVERS: Readonly<Record<LevelDefinition["mode"], GameplayRuntimeResolver>> = Object.freeze({
  restock: ({ catalogue, level, shift, mission }) => {
    if (level.mode !== "restock") throw new Error("Restock resolver received a different mode");
    return resolveRestockShiftRuntime(catalogue, shift.id, {
      missionId: mission.id,
      slotCount: level.tuning.slotCount,
      progressRewardRatio: level.tuning.progressRewardRatio
    });
  },
  checkout: ({ catalogue, level, shift, mission }) => {
    if (level.mode !== "checkout") throw new Error("Checkout resolver received a different mode");
    return resolveCheckoutLevelRuntime(catalogue, shift.id, mission.id, {
      serviceRewardRatio: level.tuning.serviceRewardRatio
    });
  },
  clean: ({ catalogue, level, shift, mission }) => {
    if (level.mode !== "clean") throw new Error("Clean resolver received a different mode");
    return resolveCleanLevelRuntime(catalogue, shift.id, mission.id, {
      cleanDurationMs: level.tuning.cleanDurationMs,
      toolPoint: level.tuning.toolPoint,
      spotPositions: level.tuning.spotPositions
    });
  },
  "find-items": ({ catalogue, level, shift, mission }) => {
    if (level.mode !== "find-items") throw new Error("Find-items resolver received a different mode");
    return resolveFindItemsLevelRuntime(catalogue, shift.id, mission.id, {
      itemTargets: level.tuning.itemTargets,
      timeLimitSeconds: level.tuning.timeLimitSeconds,
      mistakePenaltySeconds: level.tuning.mistakePenaltySeconds
    });
  }
});

export function resolveGameplayRuntime(
  catalogue: GameContentCatalogue,
  level: LevelDefinition,
  shift: ShiftDefinition,
  mission: MissionDefinition
): PlayableLevelRuntimeContent {
  const resolver = GAMEPLAY_RUNTIME_RESOLVERS[level.mode];
  if (!resolver) throw new Error(`No gameplay runtime resolver registered for ${level.mode}`);
  return resolver({ catalogue, level, shift, mission });
}

export function registeredGameplayModes(): readonly LevelDefinition["mode"][] {
  return Object.freeze(Object.keys(GAMEPLAY_RUNTIME_RESOLVERS) as LevelDefinition["mode"][]);
}
