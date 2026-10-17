import { TEMPLE_IDS, templeLevel } from "@/levels/temple";
import { checkDoor } from "@/systems/DoorSystem";
import { createInitialGameState } from "@/systems/gameState";
import { interactionRules, runInteraction } from "@/systems/interactionRules";
import { addItem, hasItem, MAX_INVENTORY_SLOTS, removeItem } from "@/systems/InventorySystem";
import { answerPuzzle, getPuzzle, INITIAL_PUZZLE_STATE } from "@/systems/PuzzleSystem";
import type { DoorInteractable, Interactable, ItemDefinition } from "@/types/game";
import type { GameState } from "@/types/state";

const byId = (id: string) => templeLevel.interactables.find((item) => item.id === id) as Interactable;
const door = byId(TEMPLE_IDS.door) as DoorInteractable;
const puzzle = getPuzzle(templeLevel.puzzles, TEMPLE_IDS.sunPuzzle);
const key: ItemDefinition = { id: TEMPLE_IDS.bronzeKeyItem, name: "Bronze Key" };

describe("InventorySystem", () => {
  it("adds, finds and removes items without changing the original list", () => {
    const empty: readonly ItemDefinition[] = [];
    const withKey = addItem(empty, key);
    expect(empty).toEqual([]);
    expect(hasItem(withKey, key.id)).toBe(true);
    expect(removeItem(withKey, key.id)).toEqual([]);
    expect(withKey).toHaveLength(1);
  });

  it("ignores duplicates, unknown removals and adding past the slot limit", () => {
    const withKey = addItem([], key);
    expect(addItem(withKey, key)).toBe(withKey);
    expect(removeItem(withKey, "nope")).toBe(withKey);

    let full: readonly ItemDefinition[] = [];
    for (let i = 0; i < MAX_INVENTORY_SLOTS; i++) full = addItem(full, { id: `item-${i}`, name: `Item ${i}` });
    expect(addItem(full, key)).toBe(full);
  });
});

describe("PuzzleSystem", () => {
  it("counts wrong answers and solves on the right one", () => {
    const wrong = answerPuzzle(puzzle, INITIAL_PUZZLE_STATE, 0);
    expect(wrong).toEqual({ correct: false, state: { status: "unsolved", wrongAttempts: 1 } });

    const right = answerPuzzle(puzzle, wrong.state, puzzle.correctOptionIndex);
    expect(right).toEqual({ correct: true, state: { status: "solved", wrongAttempts: 1 } });
  });

  it("does not accept answers once solved", () => {
    const solved = { status: "solved", wrongAttempts: 0 } as const;
    expect(answerPuzzle(puzzle, solved, 0)).toEqual({ correct: null, state: solved });
  });

  it("throws for an unknown puzzle id", () => {
    expect(() => getPuzzle(templeLevel.puzzles, "missing")).toThrow('Unknown puzzle "missing"');
  });
});

describe("DoorSystem", () => {
  const base = createInitialGameState(templeLevel);
  const solvedPuzzles = { ...base.puzzles, [TEMPLE_IDS.sunPuzzle]: { status: "solved", wrongAttempts: 0 } } as const;

  it("checks requirements in the order the level lists them (item, then puzzle)", () => {
    const [itemRequirement, puzzleRequirement] = door.requirements;
    expect(checkDoor(door, base)).toEqual({ canOpen: false, reason: "requirement", requirement: itemRequirement });
    expect(checkDoor(door, { ...base, puzzles: solvedPuzzles })).toEqual({
      canOpen: false,
      reason: "requirement",
      requirement: itemRequirement,
    });
    expect(checkDoor(door, { ...base, inventory: [key] })).toEqual({
      canOpen: false,
      reason: "requirement",
      requirement: puzzleRequirement,
    });
    expect(checkDoor(door, { ...base, inventory: [key], puzzles: solvedPuzzles })).toEqual({ canOpen: true });
  });

  it("a door with no requirements opens on use; a non-consumed item is kept", () => {
    const free: DoorInteractable = { ...door, requirements: [] };
    expect(checkDoor(free, base)).toEqual({ canOpen: true });

    const keepsKey: DoorInteractable = {
      ...door,
      requirements: [{ kind: "item", itemId: key.id, consume: false, blockedMessage: { title: "", message: "" } }],
    };
    const outcome = runInteraction(keepsKey, { ...base, inventory: [key] }, templeLevel);
    expect(outcome.state.doors[door.id]).toBe("open");
    expect(outcome.state.inventory).toEqual([key]);
    expect(outcome.events.map((e) => e.type)).toEqual(["doorOpened"]);
  });

  it("reports an open door as already open", () => {
    const open: GameState = { ...base, doors: { [door.id]: "open" } };
    expect(checkDoor(door, open)).toEqual({ canOpen: false, reason: "alreadyOpen" });
  });
});

describe("interaction rules", () => {
  it("has a handler for every kind of object in the level", () => {
    for (const item of templeLevel.interactables) {
      expect(typeof interactionRules[item.kind]).toBe("function");
    }
  });

  it("never changes the state it is given", () => {
    const state = createInitialGameState(templeLevel);
    const before = JSON.stringify(state);
    for (const item of templeLevel.interactables) runInteraction(item, state, templeLevel);
    expect(JSON.stringify(state)).toBe(before);
  });

  it("door: shows the message for the missing requirement", () => {
    const outcome = runInteraction(door, createInitialGameState(templeLevel), templeLevel);
    expect(outcome.result).toEqual({ type: "message", ...door.requirements[0].blockedMessage });
    expect(outcome.events).toEqual([{ type: "doorBlocked", doorId: door.id, reason: "missingItem" }]);
  });

  it("door: opening uses up the key", () => {
    const base = createInitialGameState(templeLevel);
    const ready: GameState = {
      ...base,
      inventory: [key],
      puzzles: { ...base.puzzles, [TEMPLE_IDS.sunPuzzle]: { status: "solved", wrongAttempts: 0 } },
    };
    const outcome = runInteraction(door, ready, templeLevel);
    expect(outcome.state.doors[door.id]).toBe("open");
    expect(outcome.state.inventory).toEqual([]);
    expect(outcome.events.map((e) => e.type)).toEqual(["itemUsed", "doorOpened"]);
  });

  it("puzzle object: opens the puzzle until solved, then shows the solved message", () => {
    const dial = byId(TEMPLE_IDS.sunDial);
    const base = createInitialGameState(templeLevel);
    expect(runInteraction(dial, base, templeLevel).result).toEqual({ type: "puzzle", puzzle });

    const solved: GameState = {
      ...base,
      puzzles: { ...base.puzzles, [TEMPLE_IDS.sunPuzzle]: { status: "solved", wrongAttempts: 0 } },
    };
    expect(runInteraction(dial, solved, templeLevel).result.type).toBe("message");
  });

  it("pickup: a full inventory leaves the item in the world", () => {
    const base = createInitialGameState(templeLevel);
    const full: GameState = {
      ...base,
      inventory: Array.from({ length: MAX_INVENTORY_SLOTS }, (_, i) => ({ id: `item-${i}`, name: "x" })),
    };
    const outcome = runInteraction(byId(TEMPLE_IDS.key), full, templeLevel);
    expect(outcome.state).toBe(full);
    expect(outcome.notice?.text).toMatch(/can't carry/);
  });
});
