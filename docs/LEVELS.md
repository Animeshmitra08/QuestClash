# Creating levels

A level is one object of type `LevelDefinition` (defined in `src/types/game.ts`). The gameplay systems and the 3D scene read it; you never copy or change game code to make a new level.

A level can be a **JSON file** (like `src/levels/cloister.json`) or a **TypeScript file** (like `src/levels/temple.ts`):

| | JSON | TypeScript |
|---|---|---|
| Checked while you type | Yes, against `src/levels/level.schema.json` in VS Code | Yes, by TypeScript |
| Builder helpers (`forestEdge`, `tree`, `rock`, `wallWithGap`, …) and shared constants | No: every block is written out | Yes |
| Comments | No | Yes |
| Could be loaded from a server or written by a tool | Yes | No |

## Steps

1. Create the level:
   - **JSON:** copy `src/levels/cloister.json` to `src/levels/<name>.json`. It uses most features; most of its length is the scattered trees and rocks in the `blocks` list. VS Code autocompletes field names, shows what each one means, and underlines mistakes.
   - **TypeScript:** create `src/levels/<name>.ts` exporting a `LevelDefinition`, like `temple.ts`.
2. Add it to `LEVEL_CATALOG` in `src/levels/catalog.ts` (the order there is the order on the start screen). Wrap a JSON level in `jsonLevel(...)`, as the cloister is.
3. Point the previous level's `nextLevelId` at the new level's `id`.
4. If it uses art, put the file under `assets/`, register it in `src/levels/assets.ts`, and reference its key from `assets`.
5. **For online play, do the same in the server:** copy the level file into `server/src/shared/levels/` and add it to the catalog there. Both catalogs must list the same levels.
6. Run `npx tsc --noEmit`, then open the level in the app. Every level is validated when it starts, so a broken reference is reported instead of loading.

### Writing levels in JSON

- Positions are on the floor plane: `x` runs west (−) to east (+), `z` runs north (−) to south (+), and `(0, 0)` is the middle of the floor. Sizes are full widths, not half widths.
- `facing` is in radians: `0` faces north, `3.141592653589793` (π) faces south, `1.5707963267948966` (π/2) and `-1.5707963267948966` turn a quarter either way.
- The edge of the map is four `treeline` blocks around the floor (`forest-north`, `-south`, `-west`, `-east` in `cloister.json`). A barrier with a doorway is a `treeline` thicket or `wall` on each side of a gap, plus a `door` interactable filling the gap. Copy them from `cloister.json`.
- After changing `LevelDefinition` in `src/types/game.ts`, regenerate the schema with `npm run levels:schema`.

### Map of the Moonlit Cloister (`cloister.json`)

60 × 64 m. A pine forest in the south, a thicket across the middle with the iron gate, and the walled cloister behind it.

```
  z=-32 ┌──────────────────── forest edge ─────────────────────┐
        │ ▓▓▓▓▓▓▓▓▓▓▓▓▓ ║  ┌ ◎ moon gate ┐  ║ ▓▓▓▓▓▓▓▓▓▓▓▓▓ │  ← exit, opens once the altar is answered
        │ ▓▓▓ grove ▓▓▓ ║ ^^^ far spikes ^^^ ║ ▓▓▓ grove ▓▓▓ │  ← z ∈ [-20.2, -18.6]
        │ ▓▓▓▓▓▓▓▓▓▓▓▓▓ ║  ☾ altar          ║ ▓▓▓▓▓▓▓▓▓▓▓▓▓ │  ← safe band between the traps
        │ ▓▓▓▓▓▓▓▓▓▓▓▓▓ ║ ^^ near spikes ^^^ ║ ▓▓▓▓▓▓▓▓▓▓▓▓▓ │  ← z ∈ [-13.4, -11.8], out of sync with the far ones
        │ ▓▓▓▓▓▓▓▓▓▓▓▓▓ ║  + gate checkpoint ║ ▓▓▓▓▓▓▓▓▓▓▓▓▓ │
  z=-6  │ ▓▓▓▓▓ thicket ▓▓▓▓▓▓▓ ═╡GATE╞═ ▓▓▓▓▓▓▓ thicket ▓▓▓▓▓ │  ← needs the silver key
        │                                            ▤ tablet │  ← against a boulder in the east
        │          moonlit pine forest:                       │
        │  ⚷ key   pines, trees, rocks, bushes, logs, stumps  │  ← key tucked behind a log and a rock
        │                     ● spawn                         │
  z=32  └──────────────────── forest edge ─────────────────────┘
      x=-30                                                 x=30
```

It uses features the temple doesn't: a key-only door, an exit locked behind a puzzle, two staggered traps, a time limit and its own scoring.

### Forests and open maps

- **Obstacles:** `tree`, `pine`, `rock`, `bush`, `log`, `stump` and `treeline` are drawn as low-poly models, each one a little different in shape and shade. Every kind still collides as its rectangle. For `tree` and `pine` the rectangle is just the trunk (about 0.8 × 0.8), so the player can walk under the crown's edge. A `log` lies along the longer side of its rectangle, and its `height` is its thickness.
- **Boundaries:** a `treeline` fills its rectangle with a dense band of trees (about one every 2 m) that nobody can pass. Use it for the edge of the map and for thickets.
- **Trees never hide the player:** anything taller than 1.6 m standing between the camera and the player turns see-through while the player is behind it. You don't need to keep tall things out of the south of the map.
- **Keep it playable:** leave a clear path from the spawn to each objective and some room around every interactable. A trap only works if it spans the whole way across (wall to wall, or thicket to thicket); otherwise players walk around it. The loader reports a spawn point inside an obstacle, and an unknown block `kind`.
- **Performance:** everything of one shape is drawn in a single batch, so a few hundred trees are fine. The current levels have about 450 trees each, including the treelines, and draw about 50k triangles in 14 draw calls.
- **Floor:** `theme.floorAccent` blends soft patches of a second colour into the floor, such as bare earth in grass.

## Fields

| Field | Meaning |
|---|---|
| `id`, `name`, `description` | Stable id (used by `nextLevelId` and the `/game?level=` URL), display name, one-line summary for the start screen. |
| `floorSize`, `blocks` | The map: floor size, plus solid obstacles. Built kinds drawn as boxes: `wall`, `pillar`, `crate`. Nature drawn as models: `tree`, `pine`, `rock`, `bush`, `log`, `stump`, `treeline` (see *Forests and open maps*). In TypeScript, use the helpers in `src/levels/builders.ts`: `forestEdge`, `treeLine`, `tree`, `pine`, `rock`, `bush`, `log`, `stump`, `outerWalls`, `wallWithGap`, `pillar`, `crate`. |
| `theme` | Colours and lights: background/fog, floor (plus optional `floorAccent` patches), a colour per block kind (kinds left out get a natural default), ambient light, sun. Rendering only. |
| `assets` | Optional art, by registry key. Currently `floorTexture` (the `cloister-floor` flagstones are registered; neither level uses them now). |
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

Every block, interactable and trigger needs an id unique within the level. They share one namespace, because collision switches boxes off by id when a door opens. Spawn points, puzzles, items and objectives each have their own namespace. In a TypeScript level, keep ids in a constant at the top of the file (like `TEMPLE_IDS` in `temple.ts`) and refer to them through it. In JSON, write them out; the loader reports any reference to an id that doesn't exist.

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
