import { CLOISTER_IDS, cloisterLevel } from "@/levels/cloister";
import { templeLevel } from "@/levels/temple";
import { isDoorOpen, isPuzzleSolved } from "@/systems/gameState";
import { calculateScore, resolveScoring } from "@/systems/ScoreSystem";
import { createMatchSimulation, FRAME, type MatchSimulation, SOLO } from "@/testing/simulation";

const exitZone = cloisterLevel.triggers.find((t) => t.id === CLOISTER_IDS.exit)!;
const altarStand = { x: -3.6, z: -5 };
const id = SOLO.id;

/** Wait until a trap has just retracted, so there's a full safe window to cross it. */
function waitForSafeWindow(sim: MatchSimulation, trapId: string) {
  const trap = sim.stage.getTrap(trapId)!;
  let sawDanger = false;
  for (let i = 0; i < 10 / FRAME; i++) {
    sim.frame();
    if (trap.lethal) sawDanger = true;
    else if (sawDanger && trap.phase === "hidden") return;
  }
  throw new Error(`${trapId} never cycled`);
}

describe("Moonlit Cloister: full playthrough on the same systems as the temple", () => {
  const sim = createMatchSimulation(cloisterLevel);
  const me = () => sim.player(id);
  const state = () => sim.state();

  it("1. picks up the silver key tucked behind the crates", () => {
    expect(sim.walkTo(id, -3, 8.5) && sim.walkTo(id, -5.8, 8.5)).toBe(true);
    expect(sim.use(id)).toMatchObject({ accepted: true, command: { targetId: CLOISTER_IDS.key } });
    expect(me().inventory.map((item) => item.id)).toEqual([CLOISTER_IDS.silverKeyItem]);
  });

  it("2. reads the clue on the east wall", () => {
    sim.walkTo(id, 0, 5);
    sim.walkTo(id, 5.4, 5);
    sim.walkTo(id, 5.4, 2);
    expect(sim.use(id)).toMatchObject({ accepted: true, result: { type: "message", title: "Moonlit Tablet" } });
  });

  it("3. a key-only door opens with just the key", () => {
    sim.walkTo(id, 0, 0.5);
    sim.walkTo(id, 0, 0);
    expect(sim.use(id)).toMatchObject({ accepted: true, command: { targetId: CLOISTER_IDS.gate } });
    expect(isDoorOpen(state(), CLOISTER_IDS.gate)).toBe(true);
    expect(me().inventory).toEqual([]);
  });

  it("4. times the near spikes and answers the moon altar", () => {
    sim.walkTo(id, 0, -2.1);
    waitForSafeWindow(sim, CLOISTER_IDS.nearSpikes);
    sim.walkTo(id, altarStand.x, altarStand.z, 3);
    expect(sim.use(id)).toMatchObject({ accepted: true, result: { type: "puzzle" } });
    expect(
      sim.dispatch({ type: "submitPuzzleAnswer", playerId: id, puzzleId: CLOISTER_IDS.moonPuzzle, optionIndex: 1 }),
    ).toMatchObject({ accepted: true, correct: true });
    expect(isPuzzleSolved(state(), CLOISTER_IDS.moonPuzzle)).toBe(true);
  });

  it("5. times the far spikes and leaves through the now-open moon gate", () => {
    waitForSafeWindow(sim, CLOISTER_IDS.farSpikes);
    sim.walkTo(id, exitZone.center.x, exitZone.center.z, 4);
    expect(state().status).toBe("completed");
    expect(me().trapHits).toBe(0);
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
    const sim = createMatchSimulation(cloisterLevel);
    const stand = (position: { x: number; z: number }) => sim.stage.update(FRAME, { [id]: position });
    const lockedCount = () => sim.events.filter((e) => e.type === "exitLocked").length;

    for (let i = 0; i < 30; i++) stand(exitZone.center); // stand in the exit
    expect(sim.state().status).toBe("playing");
    expect(lockedCount()).toBe(1);
    expect(sim.player(id).notice?.text).toMatch(/sealed/);

    stand({ x: 0, z: 0 }); // step out…
    stand(exitZone.center); // …and back in
    expect(lockedCount()).toBe(2);

    stand(altarStand);
    sim.dispatch({ type: "submitPuzzleAnswer", playerId: id, puzzleId: CLOISTER_IDS.moonPuzzle, optionIndex: 1 });
    stand(exitZone.center);
    expect(sim.state().status).toBe("completed");
  });

  it("running out of time fails the level, once, and freezes everything", () => {
    const sim = createMatchSimulation(cloisterLevel);
    sim.wait(125);
    const failed = sim.state();
    expect(failed.status).toBe("failed");
    expect(failed.failReason).toBe("timeUp");
    expect(failed.elapsedSeconds).toBe(120);
    expect(sim.events.filter((e) => e.type === "levelFailed")).toHaveLength(1);

    sim.stage.pause();
    sim.stage.update(FRAME, { [id]: exitZone.center });
    expect(sim.state()).toBe(failed);
  });

  it("a level without a time limit never runs out", () => {
    const sim = createMatchSimulation(templeLevel);
    sim.wait(300);
    expect(sim.state().status).toBe("playing");
  });

  it("its two traps run out of step, thanks to startOffset", () => {
    const sim = createMatchSimulation(cloisterLevel);
    const near = sim.stage.getTrap(CLOISTER_IDS.nearSpikes)!;
    const far = sim.stage.getTrap(CLOISTER_IDS.farSpikes)!;
    let differentFrames = 0;
    for (let i = 0; i < 3 / FRAME; i++) {
      sim.frame();
      if (near.lethal !== far.lethal) differentFrames++;
    }
    expect(differentFrames).toBeGreaterThan(0.3 / FRAME);
  });
});
