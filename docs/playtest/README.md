# Playtest — Rung 1: the crafting loop

A runnable, self-contained ore → ingot scenario for exercising the crafting loop by
hand. Dev/playtest only — it creates throwaway content and cleans up after itself.
Maps to Rung 1 of the playtest ladder (epic #41).

## Run it

In a GM session, paste into a **script macro** (or the console):

```js
// Build the scenario: a "Playtest Keep" stocked with 20 ore + a 2-ore→1-ingot recipe.
const { keepId } = await game.modules.get("automate-fvtt").api.dev.setupCraftPlaytest({ ore: 20 });

// Look at the Keep — empty-ish stockpile with 20 ore.
game.modules.get("automate-fvtt").api.keeps.open(keepId);
```

Then drive crafting two ways:

- **Manual:** craft through Fabricate's UI, or
  `await game.fabricate.craft(game.actors.get(keepId), "automate-fvtt-craft-playtest-smelt")`.
- **Tick-driven:** advance world time (the **Time Controls** panel, or
  `game.time.advance(3600)`). The registered CRAFT rule smelts ore → ingot on the
  tick; the Keep panel's stockpile updates (ore down, ingot up).

## Tear it down

```js
await game.modules.get("automate-fvtt").api.dev.teardownCraftPlaytest();
```

Removes the Keep, the crafting system + recipe, the source items, the economy rule,
and the component map. Safe to run even if nothing is set up.

## What it demonstrates / notes

- The full loop: ingredients on the Keep → `craft()` consumes them → the result item
  is created → the stockpile projection reflects it.
- **Crafted output is matched by name** (Fabricate stamps no source reference on it),
  so the components use distinct, stable names. Keep this in mind when authoring real
  example trees.
- The tick-driven path caps each craft by the ore on hand at the start of the tick;
  ore harvested *this* tick feeds crafts on the *next* (gathering is Rung 2).
- Verified by `tests/fabricate-craft.spec.js` (the engine loop) and
  `tests/fabricate-playtest.spec.js` (this harness end-to-end).
