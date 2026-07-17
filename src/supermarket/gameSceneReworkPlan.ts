import { dayOneStoreMap } from "./immersiveStoreMap";

export type SceneReworkPhase =
  | "INTRO"
  | "FIND_EMPTY_SHELF"
  | "PICK_PRODUCT"
  | "PUSH_CART"
  | "RESTOCK"
  | "CUSTOMER_FEEDBACK";

export const DAY1_REWORK = {
  title: "My First Supermarket Day",
  phaseOrder: [
    "INTRO",
    "FIND_EMPTY_SHELF",
    "PICK_PRODUCT",
    "PUSH_CART",
    "RESTOCK",
    "CUSTOMER_FEEDBACK"
  ] as SceneReworkPhase[],
  map: dayOneStoreMap,
  immersionTargets: [
    "show supermarket zones immediately",
    "highlight empty shelf slots",
    "guide cart movement",
    "reward successful restock",
    "introduce customer reaction"
  ]
};

export function getFirstDayExperience(): SceneReworkPhase[] {
  return DAY1_REWORK.phaseOrder;
}
