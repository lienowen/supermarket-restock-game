# Mature Pass V1

## Product direction

The campaign is one supermarket job game, not a collection of unrelated minigames.

The strongest existing interaction is **visual search**: read a task, inspect the store, move through the scene, identify the correct object, pick it up, and receive immediate feedback. Mature Pass V1 uses that interaction as the product spine.

Every mature campaign level should contain at least one meaningful **observe / find / decide / move** action before the final task action.

## Golden level

Level 5 (`starter-level-005`, Order Hunt) is the golden level.

Do not bulk-polish Levels 1-7 until Level 5 reaches the visual and interaction quality expected from a released browser game. Once accepted, its shared rules become campaign standards.

### Golden level presentation rules

1. Use the verified 1672x941 HD supermarket environment instead of the 1280x720 prototype background.
2. Interactive products must sit on visible store fixtures; no floating products in empty screen space.
3. The worker must read as a solid physical character. Semi-transparent character body pixels are normalized to an opaque cutout for the golden pass.
4. Character, fixture, basket and product sizes must share one world scale.
5. Search decoys should be category-similar:
   - apple -> banana / grapes
   - cereal -> oats / peanut butter
   - milk -> yogurt
6. Keep the existing proven movement, countdown, mistake penalty and item-pick controller until the mature presentation is approved.

## World-scale baseline

The 1600x900 logical canvas remains fixed.

For the golden level:

- Worker display canvas: approximately 360x390 (source art contains transparent padding; visible character is smaller).
- Main shelf fixture: approximately 600x360.
- Produce fixture: approximately 360x250.
- Grocery item display height: approximately 64-100 px depending on real-world product form.
- Shopping basket: approximately 104x68.
- Actor feet, fixture base and product anchors must share the same floor/depth system.

These are baseline values, not arbitrary per-level scale knobs. After visual acceptance they should be extracted into reusable campaign scale rules.

## Mature gameplay target

Level 5 V1 flow:

1. Read a compact order ticket.
2. Inspect two believable store fixture zones.
3. Distinguish three requested products from five category-similar decoys.
4. Walk to the selected product.
5. Pick the product and animate it into the order basket.
6. Receive immediate correct / wrong feedback.
7. Finish before the order timer expires.

Later mature passes can add multi-order routing, NPC traffic and richer pickup animations, but they must not block the first golden freeze.

## Freeze rules

A level is not frozen because CI is green.

A level can freeze only when all four gates pass:

### Visual gate
- no ghosted characters
- no visibly blurred gameplay background
- no floating props
- believable human / fixture / cart / box / product scale
- correct ground contact and depth ordering

### Gameplay gate
- the player makes repeated meaningful decisions
- no long section is only a progress bar, one repeated click, or passive waiting
- interaction remains understandable without developer explanation

### Feedback gate
- pick, place, mistake and completion actions have immediate readable feedback
- the world visually changes when progress is made

### Technical gate
- production build passes
- core CI / architecture / release verification passes
- dedicated browser interaction audit passes
- screenshot evidence is manually inspected

## Rollout after Level 5 approval

1. Freeze Level 5 golden presentation rules.
2. Apply the shared visual scale and solid-character treatment to Levels 1-4 and 6-7.
3. Upgrade boring interactions around the same observe/find/decide/move spine.
4. Run a continuous Level 1 -> Level 7 playthrough.
5. Fix only P0/P1 release blockers.
6. Tag the first campaign slice as `freeze-levels-1-7-v1`.

Levels 8-10 remain out of scope until the Level 1-7 mature slice is stable.
