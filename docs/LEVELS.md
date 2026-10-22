# Creating levels

A level is one TypeScript object of type `LevelDefinition` (defined in `src/types/game.ts`). The gameplay systems and the 3D scene read it; you never copy or change game code to make a new level.

## Steps

1. Create `src/levels/<name>.ts` exporting a `LevelDefinition`. Copy `cloister.ts` as a starting point; it's short and uses most features.
2. Add it to `LEVEL_CATALOG` in `src/levels/catalog.ts` (the order there is the order on the start screen).
3. Point the previous level's `nextLevelId` at the new level's `id`.
4. If it uses art, put the file under `assets/`, register it in `src/levels/assets.ts`, and reference its key from `assets`.
5. Run `npx tsc --noEmit`, then open the level in the app. Every level is validated when it starts, so a broken reference is reported instead of loading.

## Fields

| Field | Meaning |
|---|---|
| `id`, `name`, `description` | Stable id (used by `nextLevelId` and the `/game?level=` URL), display name, one-line summary for the start screen. |
| `floorSize`, `blocks` | The map: floor size, plus solid boxes (`wall`, `pillar`, `crate`). Use `outerWalls`, `wallWithGap`, `pillar` and `crate` from `src/levels/builders.ts`. |
| `theme` | Colours and lights: background/fog, floor, block colours, ambient light, sun. Rendering only. |
| `assets` | Optional art, by registry key. Currently `floorTexture`. |
| `spawnPoints`, `playerSpawnId` | Named positions with a facing; the player starts at `playerSpawnId`. |
| `interactables` | Objects for the USE button: `pickup` (a key or other item), `inspect` (a clue), `puzzle`, `door`. |
| `puzzles` | Multiple-choice questions, referenced by `puzzle` objects and door requirements. |
| `triggers` | Floor zones: `trap` (timing, `startOffset`, `respawnPointId`) and `exit` (optional `requires` condition and `lockedMessage`). |
| `objectives` | Ordered goals; the HUD shows the first one not yet done. Conditions: `pickupCollected`, `inspected`, `puzzleSolved`, `doorOpened`, `levelCompleted`, `any`. |
| `timeLimitSeconds` | Optional. Running out fails the level, and the HUD counts down. |
| `scoring` | Optional overrides of `DEFAULT_SCORING` in `src/systems/ScoreSystem.ts`: points, par time, time bonus, and `starThresholds` for 1–3 stars. |
| `nextLevelId` | Where "Next level" leads after completion; `null` for the last level. |

### Doors and prerequisites

A door's `requirements` are checked in order. The first one not met shows its `blockedMessage`:

```ts
requirements: [
  { kind: "item", itemId: "silver-key", consume: true, blockedMessage: { title: "Gate", message: "It's locked." } },
  { kind: "puzzle", puzzleId: "moon-puzzle", blockedMessage: { title: "Gate", message: "A seal holds it." } },
],
```

`consume: true` removes the item from the inventory when the door opens. An empty list means the door opens on use.

## Ids

Every block, interactable and trigger needs an id unique within the level. They share one namespace, because collision switches boxes off by id when a door opens. Spawn points, puzzles, items and objectives each have their own namespace. Keep ids in a constant at the top of the file (like `CLOISTER_IDS`) and refer to them through it.

## What happens when something is wrong

The level loader (`src/levels/levelLoader.ts`) checks a level before anything is created for it.

| Problem | Result |
|---|---|
| Unknown level id; missing or malformed fields; duplicate ids; a reference to a spawn point, item, puzzle, door or object that doesn't exist; out-of-range numbers | **Error:** the level doesn't start, and the screen lists the problems with *Back to menu* and *Try again*. |
| Unknown asset key | **Warning:** the floor uses its plain theme colour. |
| `nextLevelId` not in the catalog | **Warning:** the level is treated as the last one. |
| An asset that fails to load at runtime | Caught in the scene, which shows the plain-colour fallback. The level stays playable. |

Warnings are printed to the Metro console.

## Assets and memory

Levels name assets by key, never by file path. Each registry entry's `source` is a function, so a file is only loaded while a level that uses it is on screen. When the level closes, its texture is disposed and removed from React Three Fiber's loader cache, and the whole 3D scene (with its GPU memory) is torn down. So only the current level's art is held in memory.
