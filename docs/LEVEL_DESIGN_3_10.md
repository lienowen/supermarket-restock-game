# Level 3–10 Gameplay Design

Status: design lock candidate  
Scope: gameplay rules, player actions, feedback, difficulty curve  
Principle: one new rule per level; simple input; strong readable payoff; no character pathfinding dependency.

## Campaign rhythm

- Level 1 teaches the physical restock workflow.
- Level 2 turns restocking into a memory challenge.
- Levels 3–5 introduce the three other store skills: checkout, cleaning, and order picking.
- Levels 6–9 revisit those skills once, each with one meaningful twist.
- Level 10 is a short mixed-shift finale rather than another longer restock level.

A repeated mode must feel different on its second appearance. Difficulty comes from decisions, timing, and readable priorities—not extra movement controls.

## Shared interaction rules

1. Every level can be understood within five seconds from its opening instruction.
2. Each level uses no more than two primary gestures: tap, drag, or hold.
3. A correct action produces immediate object movement, sound, progress, and a short label.
4. A mistake never changes a hidden answer and never forces a full restart.
5. Completion feedback plays before the results panel.
6. Character presentation uses fixed grounded action poses; no free navigation is required for the core task.
7. Target playtime is 45–90 seconds per level.

---

## Level 3 — Checkout Basics

**Fantasy:** Run the register for the first customer wave.

**New rule:** Drag each product across the scanner, then tap payment.

**Core loop:**

1. A basket presents three clearly separated products.
2. Drag one product through the scanner beam.
3. The product moves into the bagging area and the price total increases.
4. After all products are scanned, tap the payment button.
5. Serve three customers.

**Player gestures:** drag + tap.

**Attraction / payoff:**

- Scanner beam flashes and prints a price for every successful scan.
- Consecutive clean scans build `SCAN x2`, `SCAN x3`.
- The bag visibly fills.
- Payment triggers a receipt, coin burst, and customer smile.

**Mistake rule:** Dropping outside the scanner returns the product to the basket without losing the customer.

**Difficulty:** Three customers; three items each; no timer.

---

## Level 4 — Spill Patrol

**Fantasy:** Clean the sales floor before shoppers reach the spills.

**New rule:** Press and hold until the cleaning ring is full.

**Core loop:**

1. Tap the cleaning cart to begin.
2. Hold on a spill while a circular progress ring fills.
3. The spill shrinks through three visible stages.
4. Clean four spills.

**Player gestures:** tap + hold.

**Attraction / payoff:**

- Dirt visibly disappears under the mop.
- The floor becomes glossy after each clean.
- Fast transitions between spills build `CLEAN STREAK`.
- Final completion sweeps a shine across the floor.

**Mistake rule:** Releasing early pauses progress briefly; it does not reset the spill.

**Difficulty:** Four spills with different hold durations; no navigation requirement.

---

## Level 5 — Order Hunt

**Fantasy:** Pick a customer order from the supermarket shelves.

**New rule:** Match the order card to products hidden among decoys.

**Core loop:**

1. The order card shows three product pictures.
2. Eight shelf products are selectable.
3. Tap the three requested products in any order.
4. Correct products fly into the order basket and tick off the card.

**Player gesture:** tap.

**Attraction / payoff:**

- Correct picks snap into the basket with a checklist stamp.
- The order basket visibly fills.
- Three correct picks without a mistake produce `PERFECT PICK`.

**Mistake rule:** A wrong product shakes red and stays on the shelf; the requested list does not change.

**Difficulty:** Three requested products among five decoys; generous time limit or no timer in the first version.

---

## Level 6 — Cart Capacity

**Fantasy:** Load the evening delivery without overfilling the cart.

**Revisited skill:** Restock logistics, but not shelf memory.

**New rule:** Fit boxes into three cart spaces by size.

**Core loop:**

1. Six boxes appear: small, medium, and large.
2. The cart exposes three capacity lanes.
3. Drag boxes into lanes; each lane has a visible capacity bar.
4. Build two valid cart loads, then send each cart to the floor.

**Player gesture:** drag.

**Attraction / payoff:**

- Boxes snap tightly into the cart.
- A perfect load displays `FULL · NO WASTE`.
- Sending the cart triggers a satisfying loaded-cart roll-off.

**Mistake rule:** An oversized box bounces back; existing valid boxes remain placed.

**Difficulty:** First load has an obvious solution; second load requires one decision but no trial-heavy puzzle.

**Why this replaces another stock sprint:** It reuses delivery assets while creating a genuinely different spatial puzzle instead of another six-shelf tapping round.

---

## Level 7 — Evening Checkout

**Fantasy:** Handle a busier checkout with produce and impatient customers.

**Revisited skill:** Checkout.

**New rule:** Produce must be weighed before payment while customer patience decreases.

**Core loop:**

1. Scan packaged products normally.
2. Drag produce onto the scale.
3. Tap once when the weight indicator enters the large green zone.
4. Complete payment before patience empties.
5. Serve four customers.

**Player gestures:** drag + tap.

**Attraction / payoff:**

- Accurate weighing awards `EXACT WEIGHT` and restores a little patience.
- Clean service builds a customer-satisfaction streak.
- Happy customers leave hearts and a larger coin burst.

**Mistake rule:** A poor weight reading can be retried immediately; it costs patience, not the whole customer.

**Difficulty:** Large green timing zone at first, slightly smaller by the final customer.

---

## Level 8 — Closing Clean-up

**Fantasy:** Finish the closing clean before the store clock expires.

**Revisited skill:** Cleaning.

**New rule:** Clean spots in the shown route to maintain a multiplier.

**Core loop:**

1. A two-second preview draws a route across six dirt spots.
2. Hold each spot to clean it.
3. Following the route keeps the shine multiplier.
4. A wrong spot remains available but resets the multiplier.

**Player gesture:** hold.

**Attraction / payoff:**

- Each correct clean sends a shine trail toward the next spot.
- The floor-light multiplier grows from `x1` to `x6`.
- Completion turns off the store lights row by row and reveals the polished floor.

**Mistake rule:** Wrong order resets only the multiplier; already cleaned spots remain clean.

**Difficulty:** Six spots; short route preview; no hidden route changes.

---

## Level 9 — Priority Order

**Fantasy:** Fulfil an urgent pickup order while substitutions appear.

**Revisited skill:** Visual order picking.

**New rule:** Choose the requested product, not the visually similar substitute.

**Core loop:**

1. The order card shows one target at a time with one defining detail: brand colour, size, or category.
2. Four similar products appear on the shelf.
3. Tap the exact match.
4. Complete five picks.

**Player gesture:** tap.

**Attraction / payoff:**

- Correct products launch into a packing bag.
- Rapid correct matches build `PICK COMBO`.
- The packed order seals with a large priority sticker.

**Mistake rule:** The wrong substitute receives a red `NOT THIS ONE` tag; the target remains unchanged.

**Difficulty:** Start with obvious colour differences, then add one close visual pair. Avoid tiny text-based distinctions.

---

## Level 10 — Grand Opening Finale

**Fantasy:** Complete one short mixed shift and prove mastery of the store.

**Finale rule:** Three compact rounds use familiar actions; no new control is introduced.

**Round 1 — Promotion shelf:** Remember and fill two shelf slots.

**Round 2 — VIP checkout:** Scan three items, weigh one produce item, and take payment.

**Round 3 — Closing save:** Clean two spills and pick one missing order product.

**Player gestures:** only previously learned tap, drag, and hold interactions.

**Attraction / payoff:**

- A large shift meter fills one-third after each round.
- Previous-level combo labels return in shorter form.
- The final store view lights every completed department.
- Stars count up, coins fly to the wallet, and the store receives a `READY FOR BUSINESS` banner.

**Mistake rule:** Mistakes reduce the final performance grade but never restart completed rounds.

**Difficulty:** Each round is shorter than its original level. The challenge is switching tasks, not increased action count.

---

## Difficulty curve

| Level | Skill | New mental demand | Pressure |
|---|---|---|---|
| 1 | Restock | Learn workflow | None |
| 2 | Restock | Remember order | Low |
| 3 | Checkout | Drag accurately | None |
| 4 | Clean | Hold to completion | Low |
| 5 | Pick | Visual matching | Low |
| 6 | Load cart | Capacity planning | Medium |
| 7 | Checkout | Timing + patience | Medium |
| 8 | Clean | Route memory + combo | Medium |
| 9 | Pick | Fine visual discrimination | Medium-high |
| 10 | Mixed shift | Task switching | High but forgiving |

## Production order

1. Build and freeze Level 3 checkout basics.
2. Build Level 4 hold-to-clean.
3. Build Level 5 visual order hunt.
4. Validate the first five levels as the onboarding arc.
5. Build the second-pass twists in Levels 6–9.
6. Build Level 10 only after the four base modes and their feedback systems are stable.

## Non-goals

- No free-roaming character requirement.
- No complicated keyboard controls.
- No random hidden answer changes after mistakes.
- No level that is only a larger quantity version of an earlier level.
- No result panel that interrupts the final physical payoff.
