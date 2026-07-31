# Shift Clock V1

## Scope

This is the first implementation step of the supermarket shift redesign.

- Day 1 is configured as a 120-second business shift.
- The countdown is driven by a pure controller and capped active frame deltas.
- A visible shift clock is rendered in the HUD safe area.
- The clock changes to warning and critical states near closing time.
- Completing the restock task stops the clock.
- Reaching zero blocks gameplay interaction and opens a retry overlay.
- Timeout does not award campaign progress or mission rewards.

## Deferred

Concurrent restock, checkout, cleaning, and order events are intentionally not included in this step.
