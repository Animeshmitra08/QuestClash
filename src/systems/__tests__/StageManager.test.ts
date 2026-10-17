import { TEMPLE_IDS, templeLevel } from "@/levels/temple";
import { getSpawnPoint, isDoorOpen, isPuzzleSolved } from "@/systems/gameState";
import { StageManager } from "@/systems/StageManager";
import { createSimulation, FRAME } from "@/testing/simulation";
import type { Interactable } from "@/types/game";

const byId = (id: string) => templeLevel.interactables.find((item) => item.id === id) as Interactable;
const trapZone = templeLevel.triggers.find((t) => t.id === TEMPLE_IDS.spikeTrap)!;
const checkpoint = getSpawnPoint(templeLevel, TEMPLE_IDS.northCheckpoint).position;

describe("full playthrough of the temple (real systems, no rendering)", () => {
  const sim = createSimulation(templeLevel);
  const { stage, position } = sim;
  const state = () => stage.getState();

  it("1. picks up the key hidden behind the crates", () => {
    expect(sim.walkTo(0, 12.3) && sim.walkTo(8.2, 12.3)).toBe(true);
    expect(sim.use()?.targetId).toBe(TEMPLE_IDS.key);
    expect(state().inventory.map((i) => i.id)).toEqual([TEMPLE_IDS.bronzeKeyItem]);
    expect(state().notice?.tone).toBe("success");
    sim.frame();
    expect(sim.interaction.focused).toBeNull(); // the key is gone from the world
  });

  it("2. the door stays sealed without the puzzle, and blocks the way", () => {
    sim.walkTo(3, 12.3);
    sim.walkTo(3, 3);
    sim.walkTo(0, 3);
    sim.walkTo(0, -2.2);
    const used = sim.use();
    expect(used?.targetId).toBe(TEMPLE_IDS.door);
    expect(used?.result).toMatchObject({ type: "message", title: "Sealed Door" });
    sim.walkTo(0, -6, 2);
    expect(position.z).toBeGreaterThan(-2.5);
  });

  it("3. reads the clue on the tablet", () => {
    sim.walkTo(0, 4);
    sim.walkTo(-7.4, 4);
    expect(sim.use()?.result).toMatchObject({ type: "message", title: "Weathered Tablet" });
    expect(state().inspectedIds).toContain(TEMPLE_IDS.tablet);
  });

  it("4. solves the sun dial after one wrong answer", () => {
    sim.walkTo(-3, 3);
    sim.walkTo(2.3, -1.2);
    expect(sim.use()?.result.type).toBe("puzzle");
    expect(stage.answerPuzzle(TEMPLE_IDS.sunPuzzle, 0)).toBe(false);
    expect(stage.answerPuzzle(TEMPLE_IDS.sunPuzzle, 2)).toBe(true);
    expect(isPuzzleSolved(state(), TEMPLE_IDS.sunPuzzle)).toBe(true);
    expect(stage.answerPuzzle(TEMPLE_IDS.sunPuzzle, 2)).toBe(false); // already solved
  });

  it("5. opens the door, which uses up the key and clears the way", () => {
    sim.walkTo(0, -2.2);
    sim.use();
    expect(isDoorOpen(state(), TEMPLE_IDS.door)).toBe(true);
    expect(state().inventory).toEqual([]);
    expect(sim.walkTo(checkpoint.x, checkpoint.z)).toBe(true);
  });

  it("6. standing on the spikes sends the player back to the checkpoint", () => {
    // Walk onto the spike strip (z between -9 and -7) and wait there until they fire.
    let zAfterHit: number | null = null;
    for (let i = 0; i < 8 / FRAME; i++) {
      sim.frame(position.z > -7.2 ? { x: 0, y: 1 } : undefined);
      if (state().trapHits > 0) {
        zAfterHit = position.z;
        break;
      }
    }
    expect(state().trapHits).toBe(1);
    expect(zAfterHit).toBeCloseTo(checkpoint.z, 1);
    expect(state().notice?.tone).toBe("danger");
  });

  it("7. a well-timed run crosses the spikes and completes the stage", () => {
    sim.walkTo(0, -5.8);
    const trap = stage.getTrap(TEMPLE_IDS.spikeTrap)!;
    // Wait until the spikes have just gone down again.
    let sawDanger = false;
    for (let i = 0; i < 10 / FRAME; i++) {
      sim.frame();
      if (trap.lethal) sawDanger = true;
      else if (sawDanger && trap.phase === "hidden") break;
    }
    sim.walkTo(0, -12.2, 4);
    expect(state().trapHits).toBe(1);
    expect(state().status).toBe("completed");
  });

  it("8. emitted the expected events, in order", () => {
    expect(sim.events.map((e) => e.type)).toEqual([
      "itemCollected",
      "doorBlocked",
      "inspected",
      "puzzleOpened",
      "puzzleFailed",
      "puzzleSolved",
      "itemUsed",
      "doorOpened",
      "trapHit",
      "levelCompleted",
    ]);
  });

  it("9. nothing changes after completion", () => {
    const finished = state();
    stage.pause();
    stage.interact(byId(TEMPLE_IDS.tablet));
    stage.update(FRAME, trapZone.center);
    expect(state()).toBe(finished);
  });
});

describe("StageManager flow", () => {
  it("pausing freezes the timer, traps and notices, and blocks interaction", () => {
    const stage = new StageManager(templeLevel);
    stage.interact(byId(TEMPLE_IDS.key)); // gives a notice
    for (let i = 0; i < 60; i++) stage.update(FRAME, { x: 0, z: 10 });
    const trap = stage.getTrap(TEMPLE_IDS.spikeTrap)!;
    const trapHeight = trap.height;

    stage.pause();
    const paused = stage.getState();
    for (let i = 0; i < 600; i++) stage.update(FRAME, trapZone.center); // 10 s standing on the trap
    stage.interact(byId(TEMPLE_IDS.tablet));

    expect(stage.getState()).toBe(paused);
    expect(paused.notice).not.toBeNull();
    expect(trap.height).toBe(trapHeight);
    expect(stage.answerPuzzle(TEMPLE_IDS.sunPuzzle, 2)).toBe(false);

    stage.resume();
    expect(stage.getState().status).toBe("playing");
  });

  it("publishes the timer once per second, not every frame", () => {
    const stage = new StageManager(templeLevel);
    let renders = 0;
    stage.subscribe(() => renders++);
    for (let i = 0; i < 180; i++) stage.update(FRAME, { x: 0, z: 10 });
    expect(stage.getState().elapsedSeconds).toBe(3);
    expect(renders).toBe(3);
  });

  it("notices disappear after about 2.5 s", () => {
    const stage = new StageManager(templeLevel);
    stage.interact(byId(TEMPLE_IDS.key));
    for (let i = 0; i < 3 / FRAME; i++) stage.update(FRAME, { x: 0, z: 10 });
    expect(stage.getState().notice).toBeNull();
  });

  it("records the exact completion time", () => {
    const stage = new StageManager(templeLevel);
    for (let i = 0; i < 60 / FRAME; i++) stage.update(FRAME, { x: 0, z: 10 });
    stage.update(FRAME, { x: 0, z: -12.2 });
    expect(stage.getState().status).toBe("completed");
    expect(stage.getState().elapsedSeconds).toBeCloseTo(60, 1);
  });

  it("never mutates a previous state object", () => {
    const stage = new StageManager(templeLevel);
    const before = stage.getState();
    const snapshot = JSON.stringify(before);
    stage.interact(byId(TEMPLE_IDS.key));
    stage.interact(byId(TEMPLE_IDS.tablet));
    expect(JSON.stringify(before)).toBe(snapshot);
    expect(stage.getState()).not.toBe(before);
  });

  it("can stop listening to events", () => {
    const stage = new StageManager(templeLevel);
    const seen: string[] = [];
    const stop = stage.onEvent((e) => seen.push(e.type));
    stage.pause();
    stop();
    stage.resume();
    expect(seen).toEqual(["levelPaused"]);
  });
});
