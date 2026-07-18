import type {
  CampaignDefinition,
  GameContentCatalogue,
  MissionDefinition,
  ShiftDefinition,
  StoreDefinition
} from "../content/GameContent";

export interface CampaignShiftRuntime {
  readonly campaignId: string;
  readonly index: number;
  readonly dayNumber: number;
  readonly dayLabel: string;
  readonly shift: ShiftDefinition;
  readonly store: StoreDefinition;
  readonly missions: readonly MissionDefinition[];
  readonly previousShiftId?: string;
  readonly nextShiftId?: string;
}

export interface CampaignRuntime {
  readonly campaign: CampaignDefinition;
  readonly shifts: readonly CampaignShiftRuntime[];
}

const findRequired = <T extends { readonly id: string }>(
  collection: readonly T[],
  id: string,
  kind: string
): T => {
  const value = collection.find((entry) => entry.id === id);
  if (!value) throw new Error(`Missing ${kind}: ${id}`);
  return value;
};

export function resolveCampaignRuntime(
  catalogue: GameContentCatalogue,
  campaignId: string
): CampaignRuntime {
  const campaign = findRequired(catalogue.campaigns, campaignId, "campaign");
  const seenShiftIds = new Set<string>();

  const shifts = campaign.shiftIds.map((shiftId, index): CampaignShiftRuntime => {
    if (seenShiftIds.has(shiftId)) {
      throw new Error(`Campaign ${campaign.id} contains duplicate shift ${shiftId}`);
    }
    seenShiftIds.add(shiftId);

    const shift = findRequired(catalogue.shifts, shiftId, "shift");
    const store = findRequired(catalogue.stores, shift.storeId, "store");
    const missions = shift.missionIds.map((missionId) => (
      findRequired(catalogue.missions, missionId, "mission")
    ));

    if (missions.length === 0) {
      throw new Error(`Shift ${shift.id} must contain at least one mission`);
    }

    return Object.freeze({
      campaignId: campaign.id,
      index,
      dayNumber: index + 1,
      dayLabel: `DAY ${index + 1}`,
      shift,
      store,
      missions: Object.freeze(missions),
      previousShiftId: campaign.shiftIds[index - 1],
      nextShiftId: campaign.shiftIds[index + 1]
    });
  });

  return Object.freeze({
    campaign,
    shifts: Object.freeze(shifts)
  });
}

export function resolveCampaignShift(
  runtime: CampaignRuntime,
  shiftId: string
): CampaignShiftRuntime {
  const shift = runtime.shifts.find((entry) => entry.shift.id === shiftId);
  if (!shift) {
    throw new Error(`Shift ${shiftId} does not belong to campaign ${runtime.campaign.id}`);
  }
  return shift;
}

export function selectCampaignShift(
  runtime: CampaignRuntime,
  requestedShiftId?: string
): CampaignShiftRuntime {
  if (!requestedShiftId) {
    const first = runtime.shifts[0];
    if (!first) throw new Error(`Campaign ${runtime.campaign.id} has no shifts`);
    return first;
  }
  return resolveCampaignShift(runtime, requestedShiftId);
}

export function validateCampaignRuntime(runtime: CampaignRuntime): readonly string[] {
  const errors: string[] = [];

  if (runtime.shifts.length !== runtime.campaign.shiftIds.length) {
    errors.push("Campaign runtime shift count does not match campaign configuration");
  }

  runtime.shifts.forEach((entry, index) => {
    if (entry.dayNumber !== index + 1 || entry.dayLabel !== `DAY ${index + 1}`) {
      errors.push(`Campaign shift ${entry.shift.id} has an invalid day position`);
    }

    if (entry.shift.storeId !== entry.store.id) {
      errors.push(`Campaign shift ${entry.shift.id} does not resolve its configured store`);
    }

    const resolvedMissionIds = entry.missions.map((mission) => mission.id);
    if (
      resolvedMissionIds.length !== entry.shift.missionIds.length ||
      resolvedMissionIds.some((missionId, missionIndex) => missionId !== entry.shift.missionIds[missionIndex])
    ) {
      errors.push(`Campaign shift ${entry.shift.id} mission order does not match configuration`);
    }
  });

  return Object.freeze(errors);
}
