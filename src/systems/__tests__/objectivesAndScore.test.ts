import { TEMPLE_IDS, templeLevel } from "@/levels/temple";
import { createInitialMatchState, withPlayer } from "@/systems/gameState";
import { creditObjectives, getObjectiveProgress, newlyCompletedObjectives } from "@/systems/ObjectiveSystem";
import { addPlayer } from "@/systems/PlayerRegistry";
import { calculatePlayerScore, calculateScore, DEFAULT_SCORING, formatTime, wholeSeconds } from "@/systems/ScoreSystem";
import type { MatchState, WorldState } from "@/types/state";

function match(...ids: string[]): MatchState {
  let state = createInitialMatchState(templeLevel);
  for (const id of ids) {
    const joined = addPlayer(state, { id, name: id }, null);
    if (!joined.ok) throw new Error(joined.reason);
    state = joined.state;
  }
  return state;
}
const withWorld = (state: MatchState, world: Partial<WorldState>): MatchState => ({ ...state, world: { ...state.world, ...world } });
const solvedBy = (playerId: string) => ({ [TEMPLE_IDS.sunPuzzle]: { status: "solved", wrongAttempts: 0, solvedBy: playerId } }) as const;
const objective = (state: MatchState) => getObjectiveProgress(templeLevel, state).current?.id ?? null;

describe("ObjectiveSystem (shared team objectives)", () => {
  it("follows the intended route, whoever does each step", () => {
    let state = match("ana", "bo");
    expect(objective(state)).toBe("find-key");

    state = withWorld(state, { collectedPickups: { [TEMPLE_IDS.key]: "bo" } });
    expect(objective(state)).toBe("find-clue");

    state = withPlayer(state, "ana", { inspectedIds: [TEMPLE_IDS.tablet] }); // one reader is enough for the team
    expect(objective(state)).toBe("solve-dial");

    state = withWorld(state, { puzzles: solvedBy("ana") });
    expect(objective(state)).toBe("open-door");

    state = withWorld(state, { doors: { [TEMPLE_IDS.door]: { status: "open", openedBy: "bo" } } });
    expect(objective(state)).toBe("escape");

    state = { ...state, status: "completed" };
    expect(getObjectiveProgress(templeLevel, state)).toEqual({ current: null, completed: 5, total: 5 });
  });

  it("skips the clue objective if the dial was solved without reading it", () => {
    const state = withWorld(match("ana"), { collectedPickups: { [TEMPLE_IDS.key]: "ana" }, puzzles: solvedBy("ana") });
    expect(objective(state)).toBe("open-door");
  });

  it("still asks for the key if the dial was solved first", () => {
    expect(objective(withWorld(match("ana"), { puzzles: solvedBy("ana") }))).toBe("find-key");
  });

  it("credits newly met objectives once, and credit is permanent", () => {
    let state = withWorld(match("ana", "bo"), { collectedPickups: { [TEMPLE_IDS.key]: "bo" } });
    const met = newlyCompletedObjectives(templeLevel, state).map((o) => o.id);
    expect(met).toEqual(["find-key"]);

    state = creditObjectives(state, met, "bo");
    expect(newlyCompletedObjectives(templeLevel, state)).toEqual([]);

    // The key returns to the world (its holder was eliminated): the objective shows again, the credit stays.
    state = withWorld(state, { collectedPickups: {} });
    expect(objective(state)).toBe("find-key");
    expect(state.world.completedObjectives["find-key"]).toBe("bo");
  });
});

describe("ScoreSystem", () => {
  it("starts at zero", () => {
    expect(calculateScore(match("ana"))).toEqual({ lines: [], total: 0, stars: 0 });
  });

  it("team score counts each milestone once and sums everyone's penalties", () => {
    let state = withWorld(match("ana", "bo"), {
      collectedPickups: { [TEMPLE_IDS.key]: "bo" },
      puzzles: { [TEMPLE_IDS.sunPuzzle]: { status: "solved", wrongAttempts: 1, solvedBy: "ana" } },
      doors: { [TEMPLE_IDS.door]: { status: "open", openedBy: "bo" } },
    });
    // Both read the clue (counted once for the team); Ana answered wrong once; Bo hit the trap.
    state = withPlayer(state, "ana", { inspectedIds: [TEMPLE_IDS.tablet], wrongAnswers: 1 });
    state = withPlayer(state, "bo", { inspectedIds: [TEMPLE_IDS.tablet], trapHits: 1 });
    expect(calculateScore(state).total).toBe(100 + 50 + 200 + 100 - 50 - 25);
  });

  it("personal score credits the player responsible for each milestone", () => {
    let state = withWorld(match("ana", "bo"), {
      collectedPickups: { [TEMPLE_IDS.key]: "bo" },
      puzzles: solvedBy("ana"),
      doors: { [TEMPLE_IDS.door]: { status: "open", openedBy: "bo" } },
    });
    state = withPlayer(state, "ana", { inspectedIds: [TEMPLE_IDS.tablet] });
    state = withPlayer(state, "bo", { inspectedIds: [TEMPLE_IDS.tablet], trapHits: 1 });

    expect(calculatePlayerScore(state, "ana").total).toBe(50 + 200); // clue + puzzle
    expect(calculatePlayerScore(state, "bo").total).toBe(100 + 50 + 100 - 50); // key + clue + door − hit
  });

  it("the exit and time bonus go to the team on completion, and to each escaped player", () => {
    let state: MatchState = { ...match("ana", "bo"), status: "completed", elapsedSeconds: 60 };
    state = withPlayer(state, "ana", { status: "escaped" });
    state = withPlayer(state, "bo", { status: "eliminated" });
    const bonus = DEFAULT_SCORING.exitReached + (DEFAULT_SCORING.parTimeSeconds - 60) * DEFAULT_SCORING.timeBonusPerSecond;

    expect(calculateScore(state).total).toBe(bonus);
    expect(calculatePlayerScore(state, "ana").total).toBe(bonus);
    expect(calculatePlayerScore(state, "bo").total).toBe(0);
  });

  it("gives no time bonus beyond par and never goes negative", () => {
    const slow: MatchState = { ...match("ana"), status: "completed", elapsedSeconds: 600 };
    expect(calculateScore(slow).lines.some((line) => line.label === "Time bonus")).toBe(false);
    expect(calculateScore(withPlayer(match("ana"), "ana", { trapHits: 20 })).total).toBe(0);
  });

  it("formats time and tolerates floating-point drift", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(83.7)).toBe("1:23");
    expect(formatTime(59.99999999)).toBe("1:00");
    let sum = 0;
    for (let i = 0; i < 180; i++) sum += 1 / 60;
    expect(wholeSeconds(sum)).toBe(3);
  });
});
