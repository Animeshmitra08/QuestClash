import { TEMPLE_IDS, templeLevel } from "@/levels/temple";
import { checkDoor } from "@/systems/DoorSystem";
import { createInitialMatchState, hasRead, isInspected, withPlayer } from "@/systems/gameState";
import { type InteractionOutcome, interactionRules, runInteraction } from "@/systems/interactionRules";
import { addItem, hasItem, MAX_INVENTORY_SLOTS, removeItem } from "@/systems/InventorySystem";
import { addPlayer } from "@/systems/PlayerRegistry";
import { answerPuzzle, getPuzzle, INITIAL_PUZZLE_STATE } from "@/systems/PuzzleSystem";
import type { DoorInteractable, Interactable, ItemDefinition } from "@/types/game";
import type { MatchState, PuzzleState } from "@/types/state";

const byId = (id: string) => templeLevel.interactables.find((item) => item.id === id) as Interactable;
const door = byId(TEMPLE_IDS.door) as DoorInteractable;
const puzzle = getPuzzle(templeLevel.puzzles, TEMPLE_IDS.sunPuzzle);
const key: ItemDefinition = { id: TEMPLE_IDS.bronzeKeyItem, name: "Bronze Key" };
const SOLVED: PuzzleState = { status: "solved", wrongAttempts: 0, solvedBy: "ana" };

/** A match with the given players registered (no positions; these are pure rule tests). */
function match(...ids: string[]): MatchState {
  let state = createInitialMatchState(templeLevel);
  for (const id of ids) {
    const joined = addPlayer(state, { id, name: id.toUpperCase() }, null);
    if (!joined.ok) throw new Error(joined.reason);
    state = joined.state;
  }
  return state;
}
const withSolvedDial = (state: MatchState): MatchState => ({
  ...state,
  world: { ...state.world, puzzles: { ...state.world.puzzles, [TEMPLE_IDS.sunPuzzle]: SOLVED } },
});
const run = (target: Interactable, state: MatchState, actor: string) =>
  runInteraction(target, { state, level: templeLevel, actor });
function accepted(outcome: InteractionOutcome) {
  if (!outcome.accepted) throw new Error(`rejected: ${outcome.reason}`);
  return outcome;
}

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
  it("counts wrong answers and records who solved it", () => {
    const wrong = answerPuzzle(puzzle, INITIAL_PUZZLE_STATE, 0, "ana");
    expect(wrong).toEqual({ kind: "wrong", state: { status: "unsolved", wrongAttempts: 1, solvedBy: null } });
    if (wrong.kind !== "wrong") return;

    const right = answerPuzzle(puzzle, wrong.state, puzzle.correctOptionIndex, "bo");
    expect(right).toEqual({ kind: "correct", state: { status: "solved", wrongAttempts: 1, solvedBy: "bo" } });
  });

  it("rejects answers once solved, without counting them", () => {
    expect(answerPuzzle(puzzle, SOLVED, 0, "bo")).toEqual({ kind: "rejected", reason: "alreadySolved" });
  });

  it.each([-1, 4, 1.5, Number.NaN])("rejects option %p as invalid, without counting it", (option) => {
    expect(answerPuzzle(puzzle, INITIAL_PUZZLE_STATE, option, "ana")).toEqual({ kind: "rejected", reason: "invalidAnswer" });
  });

  it("throws for an unknown puzzle id", () => {
    expect(() => getPuzzle(templeLevel.puzzles, "missing")).toThrow('Unknown puzzle "missing"');
  });
});

describe("DoorSystem", () => {
  it("checks requirements in the order the level lists them, against the actor's own items", () => {
    const [itemRequirement, puzzleRequirement] = door.requirements;
    const base = match("ana");
    const blocked = (requirement: unknown) => ({ canOpen: false, reason: "requirement", requirement });

    expect(checkDoor(door, base, "ana")).toEqual(blocked(itemRequirement));
    expect(checkDoor(door, withSolvedDial(base), "ana")).toEqual(blocked(itemRequirement));
    const anaHasKey = withPlayer(base, "ana", { inventory: [key] });
    expect(checkDoor(door, anaHasKey, "ana")).toEqual(blocked(puzzleRequirement));
    expect(checkDoor(door, withSolvedDial(anaHasKey), "ana")).toEqual({ canOpen: true });
  });

  it("keys are personal: a teammate's key doesn't open the door for you", () => {
    const state = withSolvedDial(withPlayer(match("ana", "bo"), "ana", { inventory: [key] }));
    expect(checkDoor(door, state, "bo")).toMatchObject({ canOpen: false, reason: "requirement" });
    expect(checkDoor(door, state, "ana")).toEqual({ canOpen: true });
  });

  it("a door with no requirements opens on use; a non-consumed item is kept", () => {
    const base = match("ana");
    expect(checkDoor({ ...door, requirements: [] }, base, "ana")).toEqual({ canOpen: true });

    const keepsKey: DoorInteractable = {
      ...door,
      requirements: [{ kind: "item", itemId: key.id, consume: false, blockedMessage: { title: "", message: "" } }],
    };
    const outcome = accepted(run(keepsKey, withPlayer(base, "ana", { inventory: [key] }), "ana"));
    expect(outcome.state.world.doors[door.id]).toEqual({ status: "open", openedBy: "ana" });
    expect(outcome.state.players.ana.inventory).toEqual([key]);
    expect(outcome.events.map((e) => e.type)).toEqual(["doorOpened"]);
  });

  it("reports an open door as already open, for everyone", () => {
    const open: MatchState = { ...match("ana"), world: { ...match("ana").world, doors: { [door.id]: { status: "open", openedBy: "bo" } } } };
    expect(checkDoor(door, open, "ana")).toEqual({ canOpen: false, reason: "alreadyOpen" });
  });
});

describe("interaction rules", () => {
  it("has a handler for every kind of object in the level", () => {
    for (const item of templeLevel.interactables) {
      expect(typeof interactionRules[item.kind]).toBe("function");
    }
  });

  it("never changes the state it is given", () => {
    const state = match("ana", "bo");
    const before = JSON.stringify(state);
    for (const item of templeLevel.interactables) run(item, state, "ana");
    expect(JSON.stringify(state)).toBe(before);
  });

  it("clues are personal: reading one only marks it read for that player", () => {
    const outcome = accepted(run(byId(TEMPLE_IDS.tablet), match("ana", "bo"), "ana"));
    expect(hasRead(outcome.state, "ana", TEMPLE_IDS.tablet)).toBe(true);
    expect(hasRead(outcome.state, "bo", TEMPLE_IDS.tablet)).toBe(false);
    expect(isInspected(outcome.state, TEMPLE_IDS.tablet)).toBe(true); // the team objective counts it
  });

  it("pickup: the world object is shared, the item goes to the collector only", () => {
    const outcome = accepted(run(byId(TEMPLE_IDS.key), match("ana", "bo"), "bo"));
    expect(outcome.state.world.collectedPickups[TEMPLE_IDS.key]).toBe("bo");
    expect(outcome.state.players.bo.inventory).toEqual([key]);
    expect(outcome.state.players.ana.inventory).toEqual([]);
    expect(outcome.notices).toEqual([
      { to: "bo", text: "You found the Bronze Key!", tone: "success" },
      { to: "ana", text: "BO found the Bronze Key.", tone: "info" },
    ]);
  });

  it("pickup: a second collector is rejected and told who has it", () => {
    const taken = accepted(run(byId(TEMPLE_IDS.key), match("ana", "bo"), "bo")).state;
    const second = run(byId(TEMPLE_IDS.key), taken, "ana");
    expect(second).toMatchObject({ accepted: false, reason: "alreadyCollected" });
    expect(second.notices[0].text).toBe("BO already took the Bronze Key.");
  });

  it("pickup: a full inventory leaves the item in the world", () => {
    const full = withPlayer(match("ana"), "ana", {
      inventory: Array.from({ length: MAX_INVENTORY_SLOTS }, (_, i) => ({ id: `item-${i}`, name: "x" })),
    });
    expect(run(byId(TEMPLE_IDS.key), full, "ana")).toMatchObject({ accepted: false, reason: "inventoryFull" });
  });

  it("door: shows the message for the missing requirement", () => {
    const outcome = accepted(run(door, match("ana"), "ana"));
    expect(outcome.result).toEqual({ type: "message", ...door.requirements[0].blockedMessage });
    expect(outcome.events).toEqual([{ type: "doorBlocked", playerId: "ana", doorId: door.id, reason: "missingItem" }]);
  });

  it("door: opening uses up the opener's key and records who opened it", () => {
    const ready = withSolvedDial(withPlayer(match("ana"), "ana", { inventory: [key] }));
    const outcome = accepted(run(door, ready, "ana"));
    expect(outcome.state.world.doors[door.id]).toEqual({ status: "open", openedBy: "ana" });
    expect(outcome.state.players.ana.inventory).toEqual([]);
    expect(outcome.events.map((e) => e.type)).toEqual(["itemUsed", "doorOpened"]);
  });

  it("puzzle object: opens the puzzle until solved, then shows the solved message", () => {
    const dial = byId(TEMPLE_IDS.sunDial);
    expect(accepted(run(dial, match("ana"), "ana")).result).toEqual({ type: "puzzle", puzzle });
    expect(accepted(run(dial, withSolvedDial(match("ana")), "ana")).result.type).toBe("message");
  });
});
