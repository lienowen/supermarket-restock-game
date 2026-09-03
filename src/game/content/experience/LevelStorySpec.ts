export interface LevelStoryBeat {
  readonly situation: string;
  readonly quickControl: string;
}

const story = (situation: string, quickControl: string): LevelStoryBeat => Object.freeze({
  situation,
  quickControl
});

const STORY_BY_LEVEL_ID: ReadonlyMap<string, LevelStoryBeat> = new Map<string, LevelStoryBeat>([
  ["starter-level-001", story(
    "It is your first shift. A late cola delivery has arrived and your supervisor wants the cooler ready before customers notice the gap.",
    "MOVE → PICK UP CASE → DRAG TO CART → STOCK THE COOLER"
  )],
  ["starter-level-002", story(
    "You are trusted with the cooler on your own. Remember the display plan and prove you can restock without constant supervision.",
    "MEMORIZE THE PATTERN → TAP SHELVES IN THE SAME ORDER"
  )],
  ["starter-level-003", story(
    "The checkout line is growing and the front-end team needs help. This is your first real customer-service rush.",
    "DRAG ITEMS THROUGH SCAN ZONE → CONFIRM PAYMENT"
  )],
  ["starter-level-004", story(
    "A spill has been reported on the sales floor. Clear it quickly so customers can keep shopping safely.",
    "MOVE TO THE SPILL → HOLD TO CLEAN UNTIL 100%"
  )],
  ["starter-level-005", story(
    "An online order is due for pickup soon. Find the requested products before the customer reaches the store.",
    "READ THE ORDER → FIND THE RIGHT PRODUCTS → AVOID DECOYS"
  )],
  ["starter-level-006", story(
    "You are now helping with dispatch. Two chilled orders must leave the back room correctly loaded and on time.",
    "LOAD 1 SMALL + 1 MEDIUM + 1 LARGE → VERIFY → DISPATCH"
  )],
  ["starter-level-007", story(
    "Peak hour has started and the checkout queue is building fast. Keep every customer moving before patience runs out.",
    "SCAN ALL ITEMS → MATCH PRODUCE WEIGHT → TAKE PAYMENT"
  )],
  ["starter-level-008", story(
    "Closing time is near. You are responsible for the final safety walk before the store can lock its doors.",
    "SECURE LIQUID HAZARDS → SCRUB → RECOVER SIGNS → FINISH DRY SPOTS"
  )],
  ["starter-level-009", story(
    "A priority customer order just dropped. Your senior role means speed matters, but the pick sequence must still be exact.",
    "READ THE PRIORITY ORDER → PICK IN SEQUENCE → AVOID MISTAKES"
  )],
  ["starter-level-010", story(
    "The shift leader is counting on you for the final cooler rush. Finish the last delivery and close the day like a supervisor.",
    "FOLLOW THE GLOWING SHELF → PLACE 3 ITEMS → KEEP THE STREAK"
  )]
]);

const FALLBACK_STORY: LevelStoryBeat = story(
  "A new store task needs your attention before the shift can move on.",
  "FOLLOW THE HIGHLIGHTED TASK AND COMPLETE THE OBJECTIVE"
);

export function resolveLevelStoryBeat(levelId: string): LevelStoryBeat {
  return STORY_BY_LEVEL_ID.get(levelId) ?? FALLBACK_STORY;
}
