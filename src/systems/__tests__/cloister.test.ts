import { CLOISTER_IDS, cloisterLevel } from "@/levels/cloister";
import { templeLevel } from "@/levels/temple";
import { isDoorOpen, isPuzzleSolved } from "@/systems/gameState";
import { calculateScore, resolveScoring } from "@/systems/ScoreSystem";
import { StageManager } from "@/systems/StageManager";
import { createSimulation, FRAME } from "@/testing/simulation";
import type { GameEvent } from "@/types/state";

const exitZone = cloisterLevel.triggers.find((t) => t.id === CLOISTER_IDS.exit)!;

describe("Moonlit Cloister: full playthrough on the same systems as the temple", () => {
  const sim = createSimulation(cloisterLevel);
  const { stage } = sim;
  const state = () => stage.getState();

  /** Wait until a trap has just retracted, so there's a full safe window to cross it. */
  function waitForSafeWindow(trapId: string) {
    const trap = stage.getTrap(trapId)!;
    let sawDanger = false;
    for (let i = 0; i < 10 / FRAME; i++) {
      sim.frame();
      if (trap.lethal) sawDanger = true;
      else if (sawDanger && trap.phase === "hidden") return;
    }
    throw new Error(`${trapId} never cycled`);
  }

  it("1. picks up the silver key tucked behind the crates", () => {
    expect(sim.walkTo(-3, 8.5) && sim.walkTo(-5.8, 8.5)).toBe(true);
    expect(sim.use()?.targetId).toBe(CLOISTER_IDS.key);
    expect(state().inventory.map((item) => item.id)).toEqual([CLOISTER_IDS.silverKeyItem]);
  });

  it("2. reads the clue on the east wall", () => {
    sim.walkTo(0, 5);
    sim.walkTo(5.4, 5);
    sim.walkTo(5.4, 2);
    expect(sim.use()?.result).toMatchObject({ type: "message", title: "Moonlit Tablet" });
  });

  it("3. a key-only door opens with just the key", () => {
    sim.walkTo(0, 0.5);
    sim.walkTo(0, 0);
    expect(sim.use()?.targetId).toBe(CLOISTER_IDS.gate);
    expect(isDoorOpen(state(), CLOISTER_IDS.gate)).toBe(true);
    expect(state().inventory).toEqual([]);
  });

  it("4. times the near spikes and answers the moon altar", () => {
    sim.walkTo(0, -2.1);
    waitForSafeWindow(CLOISTER_IDS.nearSpikes);
    sim.walkTo(-3.6, -5, 3);
    expect(sim.use()?.result.type).toBe("puzzle");
    expect(stage.answerPuzzle(CLOISTER_IDS.moonPuzzle, 1)).toBe(true);
    expect(isPuzzleSolved(state(), CLOISTER_IDS.moonPuzzle)).toBe(true);
  });

  it("5. times the far spikes and leaves through the now-open moon gate", () => {
    waitForSafeWindow(CLOISTER_IDS.farSpikes);
    sim.walkTo(exitZone.center.x, exitZone.center.z, 4);
    expect(state().status).toBe("completed");
    expect(state().trapHits).toBe(0);
    expect(state().elapsedSeconds).toBeLessThan(cloisterLevel.timeLimitSeconds!);
  });

  it("6. scores with the cloister's own rules and awards stars", () => {
    const score = calculateScore(state(), resolveScoring(cloisterLevel));
    expect(resolveScoring(cloisterLevel).parTimeSeconds).toBe(90);
    expect(score.stars).toBeGreaterThanOrEqual(1);
    expect(score.total).toBeGreaterThan(0);
  });
});

describe("Moonlit Cloister rules", () => {
  it("the exit stays shut until the altar is answered, saying so once per visit", () => {
    const stage = new StageManager(cloisterLevel);
    const events: GameEvent[] = [];
    stage.onEvent((event) => events.push(event));

    for (let i = 0; i < 30; i++) stage.update(FRAME, exitZone.center); // stand in the exit
    expect(stage.getState().status).toBe("playing");
    expect(events.filter((e) => e.type === "exitLocked")).toHaveLength(1);
    expect(stage.getState().notice?.text).toMatch(/sealed/);

    stage.update(FRAME, { x: 0, z: 0 }); // step out…
    stage.update(FRAME, exitZone.center); // …and back in
    expect(events.filter((e) => e.type === "exitLocked")).toHaveLength(2);

    stage.answerPuzzle(CLOISTER_IDS.moonPuzzle, 1);
    stage.update(FRAME, exitZone.center);
    expect(stage.getState().status).toBe("completed");
  });

  it("running out of time fails the level, once, and freezes everything", () => {
    const stage = new StageManager(cloisterLevel);
    const events: string[] = [];
    stage.onEvent((event) => events.push(event.type));

    for (let i = 0; i < 125 / FRAME; i++) stage.update(FRAME, { x: 0, z: 7 });
    const failed = stage.getState();
    expect(failed.status).toBe("failed");
    expect(failed.elapsedSeconds).toBe(120);
    expect(events.filter((type) => type === "levelFailed")).toHaveLength(1);

    stage.pause();
    stage.update(FRAME, exitZone.center);
    expect(stage.getState()).toBe(failed);
  });

  it("a level without a time limit never runs out", () => {
    const stage = new StageManager(templeLevel);
    for (let i = 0; i < 300 / FRAME; i++) stage.update(FRAME, { x: 0, z: 10 });
    expect(stage.getState().status).toBe("playing");
  });

  it("its two traps run out of step, thanks to startOffset", () => {
    const stage = new StageManager(cloisterLevel);
    const near = stage.getTrap(CLOISTER_IDS.nearSpikes)!;
    const far = stage.getTrap(CLOISTER_IDS.farSpikes)!;
    let differentFrames = 0;
    for (let i = 0; i < 3 / FRAME; i++) {
      stage.update(FRAME, { x: 0, z: 7 });
      if (near.lethal !== far.lethal) differentFrames++;
    }
    expect(differentFrames).toBeGreaterThan(0.3 / FRAME);
  });
});
