# Market Release Gates

Status: mandatory production standard  
Goal: finish ten polished levels, publish the first market version, then iterate from player data without rebuilding the core controls.

## Release strategy

- Version 1 ships only after Levels 1–10 form a complete, playable campaign.
- The first release must feel coherent even though later updates will add levels, variants, products, rewards, and store upgrades.
- New content must reuse stable interaction systems instead of introducing a new control model for every level.
- A level is not complete because its logic works. It is complete only when assets, interaction feel, feedback, performance, and regression checks all pass.

## Asset readiness gate

Before coding a level, create an asset inventory with three groups:

1. **Ready** — production-quality asset exists and matches the required state, angle, scale, transparency, and product identity.
2. **Reusable with edits** — an existing asset can be cropped, cleaned, recoloured, or recomposed without lowering quality.
3. **Missing** — a new asset is required.

Missing assets must be reported before implementation begins. Development must not quietly replace them with an unrelated product, an incorrect pose, a white-background cutout, or a temporary placeholder that reaches the release branch.

Every interactive object must include all visible states required by the gameplay. Examples:

- idle / selected / active / success / mistake;
- closed / opened / empty / filled;
- basket / scanner / bagging / payment states;
- clean / dirty / partially cleaned;
- customer waiting / happy / impatient;
- worker idle / carry / scan / clean / pick poses where the character is visible.

A temporary asset is allowed only when it is explicitly marked in the level inventory and has a replacement task before the level freeze.

## Interaction smoothness gate

Each primary action must pass all of these checks:

- The target is visually obvious within five seconds.
- Input starts immediately; no unexplained dead click or delayed response.
- Tap, drag, and hold zones are forgiving on desktop and mobile.
- Dragged objects stay under the pointer and snap cleanly to valid targets.
- Invalid drops return quickly without losing unrelated progress.
- Hold actions show continuous progress and preserve partial progress when designed to do so.
- Animation duration supports the next action instead of blocking it.
- The player cannot trigger duplicate actions during a transition.
- Completion feedback finishes before the results panel appears.
- Character and props stay grounded, aligned, correctly layered, and free of white edges.

Target response guidance:

- visual acknowledgement after input: within 100 ms;
- simple snap or placement: about 150–300 ms;
- reward beat: about 500–1200 ms;
- no mandatory transition should feel longer than its visual payoff justifies.

## Gameplay quality gate

Each level must have:

- one sentence that explains the objective;
- one main decision or skill;
- no more than two primary gestures;
- a clear success rhythm and an attractive final payoff;
- a mistake rule that is understandable and does not secretly change the answer;
- a target playtime of roughly 45–90 seconds;
- a reason to exist beyond increasing the quantity from an earlier level.

The second appearance of a mode must add a meaningful twist. Examples include memory, capacity, timing, patience, route order, visual similarity, or task switching.

## Per-level freeze checklist

A level can be frozen only after:

- required assets are present and approved;
- no unrelated placeholder is visible;
- all character and object states match the logic;
- the complete level can be played with the intended gestures;
- mistakes recover correctly;
- feedback is readable but does not obscure the next target;
- the level completes exactly once;
- rewards and campaign progression are correct;
- desktop and mobile interaction areas are usable;
- production build succeeds;
- automated regression covers the current flow rather than an obsolete interaction model;
- a manual full playthrough has no obvious clipping, white edges, floating objects, layering errors, or long pauses.

## Ten-level market gate

Before publishing the first market build:

- Levels 1–10 are individually frozen.
- A fresh player can understand Levels 1–3 without external instructions.
- The campaign preserves coins, stars, reputation, and unlock progress.
- Repeated modes feel meaningfully different.
- The final level closes the campaign and provides a satisfying store-wide payoff.
- Loading size and first-interaction time meet platform budgets.
- Audio, pause, resume, focus loss, and mobile scaling are checked.
- All platform SDK lifecycle and completion events pass.
- No known P0 or P1 issue remains.

## Post-release iteration hooks

The first version must leave room to add:

- new products and visual themes;
- harder variants of proven mechanics;
- daily or challenge levels;
- store upgrades and cosmetic progression;
- reward tuning and difficulty tuning;
- new campaigns that reuse checkout, restock, cleaning, picking, and mixed-shift systems.

Iteration should improve or recombine stable systems. It should not require rewriting the first ten levels because their controls or assets were treated as temporary.

## Working rule

For every new level, the order is:

**asset audit → interaction prototype → feel pass → full gameplay → completion feedback → automated and manual acceptance → freeze**.

When assets are insufficient, report the exact missing files and required states before gameplay implementation continues.
