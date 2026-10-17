import { TEMPLE_IDS, templeLevel } from "@/levels/temple";
import { createInitialGameState } from "@/systems/gameState";
import { getObjectiveProgress } from "@/systems/ObjectiveSystem";
import { calculateScore, formatTime, DEFAULT_SCORING, wholeSeconds } from "@/systems/ScoreSystem";
import type { GameState } from "@/types/state";

const initial = createInitialGameState(templeLevel);
const solved = { ...initial.puzzles, [TEMPLE_IDS.sunPuzzle]: { status: "solved", wrongAttempts: 0 } } as const;
const objective = (state: GameState) => getObjectiveProgress(templeLevel, state).current?.id ?? null;

describe("ObjectiveSystem", () => {
  it("follows the intended route", () => {
    let state: GameState = initial;
    expect(objective(state)).toBe("find-key");

    state = { ...state, collectedPickupIds: [TEMPLE_IDS.key] };
    expect(objective(state)).toBe("find-clue");

    state = { ...state, inspectedIds: [TEMPLE_IDS.tablet] };
    expect(objective(state)).toBe("solve-dial");

    state = { ...state, puzzles: solved };
    expect(objective(state)).toBe("open-door");

    state = { ...state, doors: { [TEMPLE_IDS.door]: "open" } };
    expect(objective(state)).toBe("escape");

    state = { ...state, status: "completed" };
    expect(getObjectiveProgress(templeLevel, state)).toEqual({ current: null, completed: 5, total: 5 });
  });

  it("skips the clue objective if the dial was solved without reading it", () => {
    const state: GameState = { ...initial, collectedPickupIds: [TEMPLE_IDS.key], puzzles: solved };
    expect(objective(state)).toBe("open-door");
  });

  it("still asks for the key if the dial was solved first", () => {
    expect(objective({ ...initial, puzzles: solved })).toBe("find-key");
  });
});

describe("ScoreSystem", () => {
  it("starts at zero", () => {
    expect(calculateScore(initial)).toEqual({ lines: [], total: 0, stars: 0 });
  });

  it("adds milestones and subtracts penalties while playing (no time bonus yet)", () => {
    const state: GameState = {
      ...initial,
      collectedPickupIds: [TEMPLE_IDS.key],
      inspectedIds: [TEMPLE_IDS.tablet],
      puzzles: { [TEMPLE_IDS.sunPuzzle]: { status: "solved", wrongAttempts: 1 } },
      doors: { [TEMPLE_IDS.door]: "open" },
      trapHits: 1,
    };
    expect(calculateScore(state).total).toBe(100 + 50 + 200 + 100 - 50 - 25);
  });

  it("adds the exit and time bonus once completed", () => {
    const state: GameState = { ...initial, status: "completed", elapsedSeconds: 60 };
    const expected = DEFAULT_SCORING.exitReached + (DEFAULT_SCORING.parTimeSeconds - 60) * DEFAULT_SCORING.timeBonusPerSecond;
    expect(calculateScore(state).total).toBe(expected);
  });

  it("gives no time bonus beyond par and never goes negative", () => {
    const slow: GameState = { ...initial, status: "completed", elapsedSeconds: 600 };
    expect(calculateScore(slow).lines.some((line) => line.label === "Time bonus")).toBe(false);
    expect(calculateScore({ ...initial, trapHits: 20 }).total).toBe(0);
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
