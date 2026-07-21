import type {
  GameContentCatalogue,
  LevelDefinition,
  MissionDefinition,
  ShiftDefinition
} from "../content/GameContent";
import {
  resolveCheckoutLevelRuntime,
  validateCheckoutLevelRuntime,
  type CheckoutLevelRuntimeContent
} from "./CheckoutLevelRuntimeContent";
import {
  resolveRestockShiftRuntime,
  validateRestockShiftRuntime,
  type RestockShiftRuntimeContent
} from "./ShiftRuntimeContent";
import {
  resolveCleanLevelRuntime,
  resolveFindItemsLevelRuntime,
  validateUtilityLevelRuntime,
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

type GameplayRuntimeValidator = (
  runtime: PlayableLevelRuntimeContent
) => readonly string[];

interface GameplayModeAdapter {
  readonly resolve: GameplayRuntimeResolver;
  readonly validate: GameplayRuntimeValidator;
}

const GAMEPLAY_MODE_ADAPTERS: Readonly<Record<LevelDefinition["mode"], GameplayModeAdapter>> = Object.freeze({
  restock: Object.freeze({
    resolve: ({ catalogue, level, shift, mission }) => {
      if (level.mode !== "restock") throw new Error("Restock resolver received a different mode");
      return resolveRestockShiftRuntime(catalogue, shift.id, {
        missionId: mission.id,
        slotCount: level.tuning.slotCount,
        progressRewardRatio: level.tuning.progressRewardRatio
      });
    },
    validate: (runtime) => (
      "product" in runtime
        ? validateRestockShiftRuntime(runtime)
        : Object.freeze(["Restock mode resolved the wrong runtime type"])
    )
  }),
  checkout: Object.freeze({
    resolve: ({ catalogue, level, shift, mission }) => {
      if (level.mode !== "checkout") throw new Error("Checkout resolver received a different mode");
      return resolveCheckoutLevelRuntime(catalogue, shift.id, mission.id, {
        serviceRewardRatio: level.tuning.serviceRewardRatio
      });
    },
    validate: (runtime) => (
      "customerCount" in runtime
        ? validateCheckoutLevelRuntime(runtime)
        : Object.freeze(["Checkout mode resolved the wrong runtime type"])
    )
  }),
  clean: Object.freeze({
    resolve: ({ catalogue, level, shift, mission }) => {
      if (level.mode !== "clean") throw new Error("Clean resolver received a different mode");
      return resolveCleanLevelRuntime(catalogue, shift.id, mission.id, {
        cleanDurationMs: level.tuning.cleanDurationMs,
        toolPoint: level.tuning.toolPoint,
        spotPositions: level.tuning.spotPositions
      });
    },
    validate: (runtime) => (
      "mode" in runtime && runtime.mode === "clean"
        ? validateUtilityLevelRuntime(runtime)
        : Object.freeze(["Clean mode resolved the wrong runtime type"])
    )
  }),
  "find-items": Object.freeze({
    resolve: ({ catalogue, level, shift, mission }) => {
      if (level.mode !== "find-items") throw new Error("Find-items resolver received a different mode");
      return resolveFindItemsLevelRuntime(catalogue, shift.id, mission.id, {
        itemTargets: level.tuning.itemTargets,
        timeLimitSeconds: level.tuning.timeLimitSeconds,
        mistakePenaltySeconds: level.tuning.mistakePenaltySeconds
      });
    },
    validate: (runtime) => (
      "mode" in runtime && runtime.mode === "find-items"
        ? validateUtilityLevelRuntime(runtime)
        : Object.freeze(["Find-items mode resolved the wrong runtime type"])
    )
  })
});

export function resolveGameplayRuntime(
  catalogue: GameContentCatalogue,
  level: LevelDefinition,
  shift: ShiftDefinition,
  mission: MissionDefinition
): PlayableLevelRuntimeContent {
  const adapter = GAMEPLAY_MODE_ADAPTERS[level.mode];
  if (!adapter) throw new Error(`No gameplay runtime resolver registered for ${level.mode}`);
  return adapter.resolve({ catalogue, level, shift, mission });
}

export function validateGameplayRuntime(
  level: LevelDefinition,
  runtime: PlayableLevelRuntimeContent
): readonly string[] {
  const adapter = GAMEPLAY_MODE_ADAPTERS[level.mode];
  if (!adapter) return Object.freeze([`No gameplay runtime validator registered for ${level.mode}`]);
  return adapter.validate(runtime).map((error) => `Level ${level.id}: ${error}`);
}

export function registeredGameplayModes(): readonly LevelDefinition["mode"][] {
  return Object.freeze(Object.keys(GAMEPLAY_MODE_ADAPTERS) as LevelDefinition["mode"][]);
}
