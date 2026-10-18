import { TEMPLE_IDS, templeLevel } from "@/levels/temple";
import { getSpawnPoint, isDoorOpen, isPuzzleSolved } from "@/systems/gameState";
import { calculatePlayerScore, calculateScore } from "@/systems/ScoreSystem";
import { StageManager } from "@/systems/StageManager";
import { createMatchSimulation, FRAME, SOLO } from "@/testing/simulation";

const trapZone = templeLevel.triggers.find((t) => t.id === TEMPLE_IDS.spikeTrap)!;
const checkpoint = getSpawnPoint(templeLevel, TEMPLE_IDS.northCheckpoint).position;
const id = SOLO.id;

describe("single player: full playthrough of the temple (real systems, no rendering)", () => {
  const sim = createMatchSimulation(templeLevel);
  const me = () => sim.player(id);
  const state = () => sim.state();

  it("1. picks up the key hidden behind the crates", () => {
    expect(sim.walkTo(id, 0, 12.3) && sim.walkTo(id, 8.2, 12.3)).toBe(true);
    expect(sim.use(id)).toMatchObject({ accepted: true, command: { targetId: TEMPLE_IDS.key } });
    expect(me().inventory.map((i) => i.id)).toEqual([TEMPLE_IDS.bronzeKeyItem]);
    expect(me().notice?.tone).toBe("success");
    sim.frame();
    expect(sim.focused(id)).toBeNull(); // the key is gone from the world
  });

  it("2. the door stays sealed without the puzzle, and blocks the way", () => {
    sim.walkTo(id, 3, 12.3);
    sim.walkTo(id, 3, 3);
    sim.walkTo(id, 0, 3);
    sim.walkTo(id, 0, -2.2);
    expect(sim.use(id)).toMatchObject({ accepted: true, result: { type: "message", title: "Sealed Door" } });
    sim.walkTo(id, 0, -6, 2);
    expect(sim.position(id).z).toBeGreaterThan(-2.5);
  });

  it("3. reads the clue on the tablet", () => {
    sim.walkTo(id, 0, 4);
    sim.walkTo(id, -7.4, 4);
    expect(sim.use(id)).toMatchObject({ accepted: true, result: { type: "message", title: "Weathered Tablet" } });
    expect(me().inspectedIds).toContain(TEMPLE_IDS.tablet);
  });

  it("4. solves the sun dial after one wrong answer", () => {
    sim.walkTo(id, -3, 3);
    sim.walkTo(id, 2.3, -1.2);
    expect(sim.use(id)).toMatchObject({ accepted: true, result: { type: "puzzle" } });
    const answer = (optionIndex: number) =>
      sim.dispatch({ type: "submitPuzzleAnswer", playerId: id, puzzleId: TEMPLE_IDS.sunPuzzle, optionIndex });
    expect(answer(0)).toMatchObject({ accepted: true, correct: false });
    expect(answer(2)).toMatchObject({ accepted: true, correct: true });
    expect(isPuzzleSolved(state(), TEMPLE_IDS.sunPuzzle)).toBe(true);
    expect(answer(2)).toMatchObject({ accepted: false, reason: "alreadySolved" });
  });

  it("5. opens the door, which uses up the key and clears the way", () => {
    sim.walkTo(id, 0, -2.2);
    sim.use(id);
    expect(isDoorOpen(state(), TEMPLE_IDS.door)).toBe(true);
    expect(me().inventory).toEqual([]);
    expect(sim.walkTo(id, checkpoint.x, checkpoint.z)).toBe(true);
  });

  it("6. standing on the spikes sends the player back to the checkpoint", () => {
    let zAfterHit: number | null = null;
    for (let i = 0; i < 8 / FRAME; i++) {
      sim.frame(sim.position(id).z > -7.2 ? { [id]: { x: 0, y: 1 } } : {});
      if (me().trapHits > 0) {
        zAfterHit = sim.position(id).z;
        break;
      }
    }
    expect(me().trapHits).toBe(1);
    expect(zAfterHit).toBeCloseTo(checkpoint.z, 1);
    expect(me().notice?.tone).toBe("danger");
    expect(me().status).toBe("active"); // unlimited lives in single player
  });

  it("7. a well-timed run crosses the spikes and completes the stage", () => {
    sim.walkTo(id, 0, -5.8);
    const trap = sim.stage.getTrap(TEMPLE_IDS.spikeTrap)!;
    let sawDanger = false;
    for (let i = 0; i < 10 / FRAME; i++) {
      sim.frame();
      if (trap.lethal) sawDanger = true;
      else if (sawDanger && trap.phase === "hidden") break;
    }
    sim.walkTo(id, 0, -12.2, 4);
    expect(me().trapHits).toBe(1);
    expect(me().status).toBe("escaped");
    expect(state().status).toBe("completed");
  });

  it("8. emitted the expected gameplay events, in order, each naming the player", () => {
    const gameplay = sim.events.filter((e) => !["objectiveCompleted", "playerJoined", "commandRejected"].includes(e.type));
    expect(gameplay.map((e) => e.type)).toEqual([
      "itemCollected",
      "doorBlocked",
      "inspected",
      "puzzleOpened",
      "puzzleFailed",
      "puzzleSolved",
      "itemUsed",
      "doorOpened",
      "trapHit",
      "playerEscaped",
      "levelCompleted",
    ]);
    for (const event of gameplay) if ("playerId" in event) expect(event.playerId).toBe(id);
  });

  it("9. credited every objective to the player, and team score equals personal score", () => {
    expect(state().world.completedObjectives).toEqual({
      "find-key": id,
      "find-clue": id,
      "solve-dial": id,
      "open-door": id,
      escape: id,
    });
    expect(calculatePlayerScore(state(), id).total).toBe(calculateScore(state()).total);
  });

  it("10. nothing changes after completion", () => {
    const finished = state();
    sim.stage.pause();
    expect(sim.dispatch({ type: "interact", playerId: id, targetId: TEMPLE_IDS.tablet })).toMatchObject({
      accepted: false,
      reason: "playerNotActive",
    });
    sim.stage.update(FRAME, { [id]: trapZone.center });
    expect(state()).toBe(finished);
  });
});

describe("StageManager flow", () => {
  function soloAt(x: number, z: number) {
    const sim = createMatchSimulation(templeLevel);
    sim.place(id, x, z);
    return sim;
  }
  const keyStand = { x: 8.2, z: 12.3 };

  it("pausing freezes the timer, traps and notices, and rejects commands", () => {
    const sim = soloAt(keyStand.x, keyStand.z);
    sim.use(id); // gives a notice
    sim.wait(1);
    const trap = sim.stage.getTrap(TEMPLE_IDS.spikeTrap)!;
    const trapHeight = trap.height;

    sim.stage.pause();
    const paused = sim.state();
    for (let i = 0; i < 600; i++) sim.stage.update(FRAME, { [id]: trapZone.center }); // 10 s on the trap
    expect(sim.dispatch({ type: "interact", playerId: id, targetId: TEMPLE_IDS.key })).toMatchObject({
      accepted: false,
      reason: "matchNotRunning",
    });

    expect(sim.state()).toBe(paused);
    expect(paused.players[id].notice).not.toBeNull();
    expect(trap.height).toBe(trapHeight);

    sim.stage.resume();
    expect(sim.state().status).toBe("playing");
  });

  it("publishes the timer once per second, not every frame", () => {
    const sim = createMatchSimulation(templeLevel);
    let renders = 0;
    sim.stage.subscribe(() => renders++);
    for (let i = 0; i < 180; i++) sim.frame();
    expect(sim.state().elapsedSeconds).toBe(3);
    expect(renders).toBe(3);
  });

  it("notices disappear after about 2.5 s", () => {
    const sim = soloAt(keyStand.x, keyStand.z);
    sim.use(id);
    sim.wait(3);
    expect(sim.player(id).notice).toBeNull();
  });

  it("records the exact completion time", () => {
    const sim = createMatchSimulation(templeLevel);
    sim.wait(60);
    sim.stage.update(FRAME, { [id]: { x: 0, z: -12.2 } });
    expect(sim.state().status).toBe("completed");
    expect(sim.state().elapsedSeconds).toBeCloseTo(60, 1);
  });

  it("checks reach on the match side, not only on the player's screen", () => {
    const sim = createMatchSimulation(templeLevel); // at the start, far from the key
    expect(sim.dispatch({ type: "collectItem", playerId: id, pickupId: TEMPLE_IDS.key })).toMatchObject({
      accepted: false,
      reason: "outOfReach",
    });
    expect(sim.player(id).inventory).toEqual([]);
  });

  it("never mutates a previous state object", () => {
    const sim = soloAt(keyStand.x, keyStand.z);
    const before = sim.state();
    const snapshot = JSON.stringify(before);
    sim.use(id);
    expect(JSON.stringify(before)).toBe(snapshot);
    expect(sim.state()).not.toBe(before);
  });

  it("can stop listening to events", () => {
    const stage = new StageManager(templeLevel);
    stage.addPlayer(SOLO);
    const seen: string[] = [];
    const stop = stage.onEvent((e) => seen.push(e.type));
    stage.pause();
    stop();
    stage.resume();
    expect(seen).toEqual(["levelPaused"]);
  });

  it("an empty match (nobody joined yet) neither completes nor fails", () => {
    const stage = new StageManager(templeLevel);
    for (let i = 0; i < 60; i++) stage.update(FRAME, {});
    expect(stage.getState().status).toBe("playing");
  });
});
