import { DOOR_TRANSITIONS } from "@/systems/DoorSystem";
import { PLAYER_TRANSITIONS } from "@/systems/PlayerRegistry";
import { PUZZLE_TRANSITIONS } from "@/systems/PuzzleSystem";
import { LEVEL_TRANSITIONS } from "@/systems/StageManager";
import { nextState } from "@/systems/stateMachine";

describe("level flow", () => {
  it.each([
    ["playing", "pause", "paused"],
    ["paused", "resume", "playing"],
    ["playing", "complete", "completed"],
    ["playing", "fail", "failed"],
  ] as const)("%s --%s--> %s", (from, event, to) => {
    expect(nextState(LEVEL_TRANSITIONS, from, event)).toBe(to);
  });

  it.each([
    ["playing", "resume"],
    ["paused", "pause"],
    ["paused", "complete"], // can't finish while paused
    ["completed", "pause"],
    ["completed", "resume"],
    ["completed", "complete"],
    ["completed", "fail"],
    ["paused", "fail"], // the clock doesn't run while paused
    ["failed", "resume"],
    ["failed", "complete"],
  ] as const)("rejects %s --%s", (from, event) => {
    expect(nextState(LEVEL_TRANSITIONS, from, event)).toBeNull();
  });
});

describe("puzzle", () => {
  it("unsolved → solved on a correct answer, stays unsolved on a wrong one", () => {
    expect(nextState(PUZZLE_TRANSITIONS, "unsolved", "answerCorrect")).toBe("solved");
    expect(nextState(PUZZLE_TRANSITIONS, "unsolved", "answerWrong")).toBe("unsolved");
  });

  it("a solved puzzle accepts no answers", () => {
    expect(nextState(PUZZLE_TRANSITIONS, "solved", "answerCorrect")).toBeNull();
    expect(nextState(PUZZLE_TRANSITIONS, "solved", "answerWrong")).toBeNull();
  });
});

describe("player status", () => {
  it.each([
    ["active", "eliminate", "eliminated"],
    ["active", "escape", "escaped"],
    ["active", "leave", "left"],
    ["eliminated", "leave", "left"],
    ["escaped", "leave", "left"],
  ] as const)("%s --%s--> %s", (from, event, to) => {
    expect(nextState(PLAYER_TRANSITIONS, from, event)).toBe(to);
  });

  it.each([
    ["eliminated", "escape"], // no escaping once out
    ["escaped", "eliminate"], // no trap can reach you outside
    ["left", "leave"],
    ["left", "escape"],
  ] as const)("rejects %s --%s", (from, event) => {
    expect(nextState(PLAYER_TRANSITIONS, from, event)).toBeNull();
  });
});

describe("door", () => {
  it("locked → open, and an open door stays open", () => {
    expect(nextState(DOOR_TRANSITIONS, "locked", "unlock")).toBe("open");
    expect(nextState(DOOR_TRANSITIONS, "open", "unlock")).toBeNull();
  });
});
