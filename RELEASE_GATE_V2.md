# Supermarket Restock Game — Release Gate v2.0

A release has only two states:

- **PASS** — every hard gate below passes; the build may ship.
- **FAIL** — any hard gate fails; the build must not ship.

CI success alone is never sufficient. Actual player readability, mobile interaction and continuous play are release requirements.

## 1. Build gate

All of the following must pass:

- TypeScript/build
- release bundle verification
- required automated tests
- production deployment
- no release-blocking runtime error

## 2. Level gate

Every campaign level, Level 1 through Level 10, must complete through the real player flow:

`enter -> understand objective -> interact -> complete -> results -> next level`

No debug state injection, hidden bypass or forced completion may be used as proof of playability.

Any level that can deadlock, require refresh, or become impossible to continue is **FAIL**.

## 3. Three-second comprehension rule

Within roughly three seconds of entering a playable state, a first-time player must be able to identify:

1. what the current task is;
2. what object matters now;
3. where the next action happens.

Only **one primary objective/prompt** may compete for attention at a time.

## 4. Scene composition rule

The authored background owns environmental richness. Independent runtime objects are allowed only when they are required by the current gameplay or provide indispensable state feedback.

Decorative layering is forbidden when it does not improve the current task.

An independent asset must satisfy all of these:

- consistent perspective;
- consistent lighting;
- believable scale;
- clean edges/no white matte;
- believable floor/contact relationship;
- no translucent/ghost appearance;
- no obvious duplicate of an object already baked into the background.

If it cannot satisfy those requirements, remove it or bake it into the background.

## 5. Visual hierarchy rule

Each playable screen should have:

- one primary gameplay focus;
- at most two secondary information regions;
- no redundant instruction systems.

HUD, arrows, contextual buttons and world labels may not repeat the same instruction simultaneously.

Critical gameplay must remain readable without scanning the whole screen.

## 6. Level 1 rule

Level 1 is deliberately minimal:

- authored background;
- player;
- task case/box;
- task cart;
- task cooler/shelf interaction;
- essential HUD only.

No ambient shelf, customer, shopping cart or decorative runtime fill is permitted.

## 7. Level 2 rule

Level 2 is a focused memory-restock level. Runtime scene dressing is restricted to gameplay-essential elements:

- player;
- restock box/cart;
- water inventory feedback;
- cooler/shelf targets;
- one current objective guide;
- one contextual PLACE control only when it is actionable;
- compact memory preview;
- essential HUD only.

Forbidden in Level 2:

- ambient customers;
- decorative produce/backroom/dairy/cleaning/checkout fixtures;
- decorative shopping carts;
- duplicate cooler art;
- legacy bottle strips;
- simultaneous world PLACE prompt and PLACE action button.

The cart may display no more than six compact inventory batch indicators.

## 8. Mobile interaction gate

Landscape mobile is a primary acceptance target. All required interactions must work with touch:

- start;
- joystick/player movement;
- tap targets;
- box drag/drop;
- product drag/drop;
- cleaning/scrub gesture;
- checkout actions;
- level-complete actions.

Hard failures include:

- visual target and hit area mismatch;
- reversed drag direction;
- pointer offset after software landscape rotation;
- significant drag lag;
- invisible interception layer;
- pixel-perfect drop requirement with no reasonable tolerance.

## 9. Feedback gate

Every accepted or rejected player action must produce perceptible feedback immediately enough to feel connected to the action (target: within about 150 ms for local feedback).

A player must never finish an action and be unsure whether it registered.

## 10. Complexity gate

A level may introduce only one major new cognitive burden at a time. Supporting navigation or setup must not become a second competing game mechanic.

## 11. Severity gate

Release requires:

- P0 = 0
- P1 = 0

P0 examples: deadlock, black screen, broken button, impossible completion, mandatory refresh.

P1 examples: unreadable core objective, severe scene clutter, ghost assets, major UI overflow, serious touch mismatch.

Minor polish issues may remain only when classified P2 and they do not affect comprehension or control.

## 12. Performance gate

Under the project mobile network profile (10 Mbps class connection):

- effective game image target: <= 5 s;
- usable interaction target: <= 8 s.

Do not loosen the budget to make CI pass. Defer or compress assets that are not required for the first playable moment.

## 13. Continuous campaign gate

Before release, the campaign must complete continuously:

`L1 -> L2 -> L3 -> L4 -> L5 -> L6 -> L7 -> L8 -> L9 -> L10`

During that run:

- uncaught runtime errors = 0;
- missing required assets/404s = 0;
- black/blank screens = 0;
- progression deadlocks = 0;
- corrupted cross-level state = 0.

## 14. Final decision

A build is **PASS / shippable** only when all hard gates pass.

If any gate is not demonstrated or is known to fail, the release decision is **FAIL / do not ship**.
