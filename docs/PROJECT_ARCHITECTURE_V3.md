# Supermarket Restock Game — Project Architecture V3

## 1. Product definition

This project is a fixed-camera, third-person supermarket work and management simulation for web and mobile landscape play.

The architecture is project-wide. Days, shifts, tutorials, missions, and events are content. They must never define the code structure.

The reference supermarket image supplied by the product owner is the visual acceptance target. Production UI and in-world signs are English-only.

## 2. Core rules

1. A gameplay system must not know which day or shift is active.
2. A mission may combine reusable systems, but must not contain rendering code.
3. A Phaser scene may present state, but must not own economy, inventory, mission, or progression rules.
4. Assets are catalogued independently from missions and shifts.
5. Content files reference stable IDs, never physical image dimensions or scene coordinates embedded in business logic.
6. New gameplay must be implemented as a reusable system or content configuration, not an integration patch.
7. `src/game-v2/` is a temporary compatibility layer only. New production architecture belongs in `src/game/`.

## 3. Target source tree

```text
src/game/
  bootstrap.ts
  config/
  core/
  entities/
  systems/
  interactions/
  missions/
  economy/
  progression/
  world/
  content/
  assets/
  presentation/
  infrastructure/
  platform/
  testing/
```

### Core

Owns startup, lifecycle, events, commands, time, save orchestration, and module registration.

### Entities

Owns stateful domain objects such as worker, customer, cart, case, product, fixture, shelf, cooler, checkout, pallet, and door.

### Systems

Owns reusable gameplay capabilities: movement, carrying, inventory, cart loading, stocking, shelving, checkout, ordering, delivery, cleaning, customer behaviour, pricing, scoring, audio cues, and time.

### Interactions

Resolves context-sensitive actions from actor state, target state, distance, permissions, and mission constraints.

### Missions

Tracks objectives, conditions, sequences, optional objectives, failure conditions, rewards, and completion. Missions call systems through commands and observe domain events.

### Economy and progression

Own wallets, revenue, expenses, pricing, upgrades, store level, reputation, unlocks, achievements, and long-term progression.

### World

Owns store zones, navigation, interaction points, spawn points, camera bounds, fixture placement, and store expansion layout.

### Content

Contains data definitions for products, fixtures, stores, workers, customers, missions, shifts, campaigns, dialogue, and events. A day or shift is a content record only.

### Assets

Contains the typed asset catalogue, preload groups, anchors, scales, depth policy, production status, and validation metadata.

### Presentation

Owns Phaser scenes, entity views, animation, camera, lighting, effects, HUD, prompts, and feedback. It observes state and events but does not decide game rules.

### Infrastructure and platform

Owns persistence, platform SDKs, analytics, asset loading, pathfinding adapters, device capabilities, and web-host integration.

## 4. Dependency direction

```text
Content -> Missions/Application -> Systems -> Entities
                         |
                         v
                   Domain events
                         |
                         v
                   Presentation

Infrastructure implements ports declared by the core/domain layers.
```

Forbidden dependencies:

- Domain entities importing Phaser.
- HUD modifying inventory or wallet state directly.
- Scene objects deciding mission completion.
- Mission IDs embedded in worker, cart, shelf, or product classes.
- Asset filenames acting as business state.
- Day-specific gameplay classes.

## 5. Universal gameplay model

The first playable scenario validates the architecture, but does not define it:

```text
Pick up case -> load cart -> push cart -> park -> open case -> stock fixture -> receive reward
```

The same systems must later support beverages, produce, snacks, frozen goods, household products, checkout, cleaning, receiving, pricing, and customer service without duplicating the flow.

## 6. Content model

A shift is a content composition:

```json
{
  "id": "starter-shift-001",
  "storeId": "starter-market",
  "startTime": "09:00",
  "missionIds": ["restock-cola-cooler"],
  "unlockIds": ["produce-restocking"]
}
```

A mission is system-oriented rather than day-oriented:

```json
{
  "id": "restock-cola-cooler",
  "title": "Restock the Cola Section",
  "objectives": [
    {
      "type": "transfer-product",
      "productId": "cola-can",
      "targetFixtureId": "beverage-cooler-a",
      "amount": 24
    }
  ],
  "rewards": { "coins": 100, "stars": 1 }
}
```

## 7. Migration policy

1. Freeze legacy behaviour; do not add features to old integration files.
2. Route startup through `src/game/bootstrap.ts`.
3. Introduce stable core contracts, entity models, system contracts, interaction resolution, and content schemas.
4. Move the existing restock vertical slice behind those contracts.
5. Replace temporary geometry and reused art with catalogue-driven production assets.
6. Delete compatibility adapters only after equivalent browser tests pass.

## 8. Definition of architecture complete

The architecture milestone is complete only when:

- Startup no longer imports `game-v2` directly from `main.ts`.
- Mission content can be changed without editing a Phaser scene.
- Restocking works for at least two product categories through the same system.
- Worker, cart, case, fixture, inventory, wallet, and mission state are independently testable.
- Assets load exclusively from the typed catalogue.
- Browser regression tests exercise the actual interaction flow.
- No new day-specific or `*Integration.ts` modules are introduced.
