import { LEVEL_CATALOG } from "@/levels/catalog";
import { TEMPLE_IDS, templeLevel } from "@/levels/temple";
import { circleOverlapsRect, createLevelCollision } from "@/systems/CollisionSystem";
import { isDoorOpen, isPickupCollected } from "@/systems/gameState";
import { PLAYER_RADIUS } from "@/systems/MovementController";
import { MAX_PLAYERS, type PlayerProfile, spawnFor } from "@/systems/PlayerRegistry";
import { calculatePlayerScore, calculateScore } from "@/systems/ScoreSystem";
import { StageManager } from "@/systems/StageManager";
import { createMatchSimulation, FRAME, type MatchSimulation } from "@/testing/simulation";
import type { GameCommand } from "@/types/commands";
import type { LevelDefinition } from "@/types/game";

const ANA: PlayerProfile = { id: "ana", name: "Ana" };
const BO: PlayerProfile = { id: "bo", name: "Bo" };
const CY: PlayerProfile = { id: "cy", name: "Cy" };

const KEY_STAND = { x: 8.2, z: 12.3 };
const DOOR_STAND = { x: 0, z: -2.2 };
const DIAL_STAND = { x: 2.3, z: -1.2 };
const TRAP_CENTER = { x: 0, z: -8 };
const EXIT = { x: 0, z: -12.2 };

const collect = (playerId: string, sequence?: number): GameCommand => ({
  type: "collectItem",
  playerId,
  pickupId: TEMPLE_IDS.key,
  tick: 10,
  sequence,
});
const answer = (playerId: string, optionIndex: number, sequence?: number): GameCommand => ({
  type: "submitPuzzleAnswer",
  playerId,
  puzzleId: TEMPLE_IDS.sunPuzzle,
  optionIndex,
  tick: 10,
  sequence,
});

/** The temple with a door that needs nothing, to race two players at it. */
const freeDoorTemple: LevelDefinition = {
  ...templeLevel,
  interactables: templeLevel.interactables.map((i) => (i.kind === "door" ? { ...i, requirements: [] } : i)),
};

/** Keep a player standing on the spike strip until they've been hit `hits` times (or are out). */
function standOnSpikes(sim: MatchSimulation, playerId: string, hits: number) {
  for (let i = 0; i < 30 / FRAME && sim.player(playerId).status === "active" && sim.player(playerId).trapHits < hits; i++) {
    const { z } = sim.position(playerId);
    if (z > -7.2 || z < -8.8) sim.place(playerId, TRAP_CENTER.x, TRAP_CENTER.z);
    else sim.frame();
  }
}

describe("player registry", () => {
  it("accepts up to five players with stable, unique ids", () => {
    const stage = new StageManager(templeLevel);
    for (let i = 0; i < MAX_PLAYERS; i++) expect(stage.addPlayer({ id: `p${i}`, name: `P${i}` }).ok).toBe(true);
    expect(stage.addPlayer({ id: "p5", name: "One too many" })).toEqual({ ok: false, reason: "matchFull" });
    expect(stage.getState().playerOrder).toEqual(["p0", "p1", "p2", "p3", "p4"]);
    expect(Object.values(stage.getState().players).map((p) => p.slot)).toEqual([0, 1, 2, 3, 4]);
  });

  it("rejects duplicate and empty ids, including a returning player's old id", () => {
    const stage = new StageManager(templeLevel);
    stage.addPlayer(ANA);
    expect(stage.addPlayer({ id: "ana", name: "Impostor" })).toEqual({ ok: false, reason: "duplicateId" });
    expect(stage.addPlayer({ id: "", name: "Nobody" })).toEqual({ ok: false, reason: "invalidId" });
    stage.removePlayer("ana");
    expect(stage.addPlayer(ANA)).toEqual({ ok: false, reason: "duplicateId" });
  });

  it("frees a slot when a player leaves", () => {
    const stage = new StageManager(templeLevel);
    for (let i = 0; i < MAX_PLAYERS; i++) stage.addPlayer({ id: `p${i}`, name: `P${i}` });
    stage.removePlayer("p2");
    const joined = stage.addPlayer({ id: "late", name: "Late" });
    expect(joined.ok && joined.player.slot).toBe(2);
  });

  it.each(LEVEL_CATALOG.flatMap((level) => level.spawnPoints.map((spawn) => [level.id, spawn.id, level] as const)))(
    "%s / %s: all five slots spawn apart, clear of walls and traps",
    (_, spawnId, level) => {
      const collision = createLevelCollision(level);
      const traps = level.triggers.filter((t) => t.kind === "trap");
      const spots = Array.from({ length: MAX_PLAYERS }, (__, slot) => spawnFor(level, spawnId, slot).position);
      for (const spot of spots) {
        const pushed = { ...spot };
        collision.resolve(pushed, { x: 0, z: 0 }, PLAYER_RADIUS);
        expect(pushed).toEqual(spot); // not inside anything solid
        for (const trap of traps) expect(circleOverlapsRect(spot, 0.5, trap)).toBe(false);
      }
      for (let a = 0; a < spots.length; a++) {
        for (let b = a + 1; b < spots.length; b++) {
          expect(Math.hypot(spots[a].x - spots[b].x, spots[a].z - spots[b].z)).toBeGreaterThanOrEqual(PLAYER_RADIUS * 2);
        }
      }
    },
  );
});

describe("simultaneous interactions", () => {
  it("two players grabbing the same key in the same tick: the earlier command wins, the other is told who has it", () => {
    const sim = createMatchSimulation(templeLevel, [ANA, BO]);
    sim.place("ana", KEY_STAND.x, KEY_STAND.z);
    sim.place("bo", KEY_STAND.x - 0.5, KEY_STAND.z);

    const [first, second] = sim.resolve([collect("ana", 2), collect("bo", 1)]);
    expect(first).toMatchObject({ accepted: true, command: { playerId: "bo" } });
    expect(second).toMatchObject({ accepted: false, command: { playerId: "ana" }, reason: "alreadyCollected" });
    expect(sim.player("bo").inventory).toHaveLength(1);
    expect(sim.player("ana").inventory).toHaveLength(0);
    expect(sim.player("ana").notice?.text).toBe("Bo already took the Bronze Key.");
    expect(sim.events.filter((e) => e.type === "itemCollected")).toHaveLength(1);
  });

  it("resolution is deterministic: same batch in any order gives the same winner; ties go by player id", () => {
    const winner = (commands: GameCommand[]) => {
      const sim = createMatchSimulation(templeLevel, [ANA, BO]);
      sim.place("ana", KEY_STAND.x, KEY_STAND.z);
      sim.place("bo", KEY_STAND.x - 0.5, KEY_STAND.z);
      sim.resolve(commands);
      return sim.state().world.collectedPickups[TEMPLE_IDS.key];
    };
    expect(winner([collect("ana", 2), collect("bo", 1)])).toBe("bo");
    expect(winner([collect("bo", 1), collect("ana", 2)])).toBe("bo");
    expect(winner([collect("bo"), collect("ana")])).toBe("ana"); // no sequence: alphabetical
    expect(winner([collect("ana"), collect("bo")])).toBe("ana");
  });

  it("two players opening the same door at once: it opens once, for the first; the second is a harmless no-op", () => {
    const sim = createMatchSimulation(freeDoorTemple, [ANA, BO]);
    sim.place("ana", DOOR_STAND.x, DOOR_STAND.z);
    sim.place("bo", DOOR_STAND.x + 1, DOOR_STAND.z);
    const open = (playerId: string, sequence: number): GameCommand => ({
      type: "activateObject",
      playerId,
      objectId: TEMPLE_IDS.door,
      tick: 5,
      sequence,
    });

    const results = sim.resolve([open("bo", 2), open("ana", 1)]);
    expect(results.map((r) => r.accepted)).toEqual([true, false]);
    expect(results[1]).toMatchObject({ reason: "alreadyOpen" });
    expect(sim.state().world.doors[TEMPLE_IDS.door]).toEqual({ status: "open", openedBy: "ana" });
    expect(sim.events.filter((e) => e.type === "doorOpened")).toHaveLength(1);
  });

  it("puzzle answers in the same tick: a wrong answer before the right one counts; any answer after it is rejected, not counted", () => {
    const sim = createMatchSimulation(templeLevel, [ANA, BO, CY]);
    sim.place("ana", DIAL_STAND.x, DIAL_STAND.z);
    sim.place("bo", DIAL_STAND.x, DIAL_STAND.z + 0.6);
    sim.place("cy", DIAL_STAND.x - 0.6, DIAL_STAND.z);

    const results = sim.resolve([answer("cy", 2, 3), answer("bo", 2, 2), answer("ana", 0, 1)]);
    expect(results).toMatchObject([
      { accepted: true, correct: false, command: { playerId: "ana" } },
      { accepted: true, correct: true, command: { playerId: "bo" } },
      { accepted: false, reason: "alreadySolved", command: { playerId: "cy" } },
    ]);
    expect(sim.state().world.puzzles[TEMPLE_IDS.sunPuzzle]).toEqual({ status: "solved", wrongAttempts: 1, solvedBy: "bo" });
    expect([sim.player("ana").wrongAnswers, sim.player("bo").wrongAnswers, sim.player("cy").wrongAnswers]).toEqual([1, 0, 0]);
  });

  it("reading the same clue at the same time is not a conflict: both players learn it", () => {
    const sim = createMatchSimulation(templeLevel, [ANA, BO]);
    sim.place("ana", -7.4, 4);
    sim.place("bo", -7.4, 3.2);
    const read = (playerId: string): GameCommand => ({ type: "interact", playerId, targetId: TEMPLE_IDS.tablet, tick: 1 });
    expect(sim.resolve([read("ana"), read("bo")]).every((r) => r.accepted)).toBe(true);
    expect(sim.player("ana").inspectedIds).toEqual([TEMPLE_IDS.tablet]);
    expect(sim.player("bo").inspectedIds).toEqual([TEMPLE_IDS.tablet]);
  });
});

describe("duplicate and invalid commands", () => {
  it("collecting the same item twice gives one item and one rejection", () => {
    const sim = createMatchSimulation(templeLevel, [ANA]);
    sim.place("ana", KEY_STAND.x, KEY_STAND.z);
    expect(sim.dispatch(collect("ana"))).toMatchObject({ accepted: true });
    expect(sim.dispatch(collect("ana"))).toMatchObject({ accepted: false, reason: "alreadyCollected" });
    expect(sim.player("ana").inventory).toHaveLength(1);
    expect(sim.player("ana").notice?.text).toBe("You already took the Bronze Key.");
  });

  it.each([
    ["an option that doesn't exist", { optionIndex: 7 }, "invalidAnswer"],
    ["a negative option", { optionIndex: -1 }, "invalidAnswer"],
    ["a fractional option", { optionIndex: 1.5 }, "invalidAnswer"],
    ["an unknown puzzle", { puzzleId: "moon-puzzle" }, "unknownTarget"],
  ] as const)("rejects %s without counting a wrong answer", (_, change, reason) => {
    const sim = createMatchSimulation(templeLevel, [ANA]);
    sim.place("ana", DIAL_STAND.x, DIAL_STAND.z);
    expect(sim.dispatch({ ...answer("ana", 0), ...change })).toMatchObject({ accepted: false, reason });
    expect(sim.player("ana").wrongAnswers).toBe(0);
    expect(sim.state().world.puzzles[TEMPLE_IDS.sunPuzzle].wrongAttempts).toBe(0);
  });

  it("rejects answers from away from the puzzle, from unknown players, and the wrong command for an object", () => {
    const sim = createMatchSimulation(templeLevel, [ANA]);
    expect(sim.dispatch(answer("ana", 2))).toMatchObject({ accepted: false, reason: "outOfReach" });
    expect(sim.dispatch(answer("ghost", 2))).toMatchObject({ accepted: false, reason: "unknownPlayer" });
    sim.place("ana", DOOR_STAND.x, DOOR_STAND.z);
    expect(sim.dispatch({ type: "collectItem", playerId: "ana", pickupId: TEMPLE_IDS.door })).toMatchObject({
      accepted: false,
      reason: "wrongKind",
    });
    expect(sim.dispatch({ type: "interact", playerId: "ana", targetId: "nothing-here" })).toMatchObject({
      accepted: false,
      reason: "unknownTarget",
    });
    expect(sim.events.filter((e) => e.type === "commandRejected")).toHaveLength(4);
  });

  it("completeObjective: refuses unmet, already-credited and unknown objectives", () => {
    const sim = createMatchSimulation(templeLevel, [ANA]);
    const claim = (objectiveId: string) => sim.dispatch({ type: "completeObjective", playerId: "ana", objectiveId });
    expect(claim("find-key")).toMatchObject({ accepted: false, reason: "conditionNotMet" });
    sim.place("ana", KEY_STAND.x, KEY_STAND.z);
    sim.dispatch(collect("ana")); // credited automatically to Ana
    expect(claim("find-key")).toMatchObject({ accepted: false, reason: "alreadyCompleted" });
    expect(claim("no-such-objective")).toMatchObject({ accepted: false, reason: "unknownTarget" });
    expect(sim.state().world.completedObjectives["find-key"]).toBe("ana");
  });
});

describe("responsibility: every result names who did it", () => {
  it("records the collector, solver, opener, objective credit and personal score of each player", () => {
    const sim = createMatchSimulation(templeLevel, [ANA, BO]);
    sim.place("bo", KEY_STAND.x, KEY_STAND.z);
    sim.dispatch(collect("bo"));
    sim.place("ana", DIAL_STAND.x, DIAL_STAND.z);
    sim.dispatch(answer("ana", 2));
    sim.place("bo", DOOR_STAND.x, DOOR_STAND.z);
    sim.dispatch({ type: "activateObject", playerId: "bo", objectId: TEMPLE_IDS.door });

    const { world } = sim.state();
    expect(world.collectedPickups[TEMPLE_IDS.key]).toBe("bo");
    expect(world.puzzles[TEMPLE_IDS.sunPuzzle].solvedBy).toBe("ana");
    expect(world.doors[TEMPLE_IDS.door].openedBy).toBe("bo");
    expect(world.completedObjectives).toEqual({ "find-key": "bo", "find-clue": "ana", "solve-dial": "ana", "open-door": "bo" });
    expect(calculatePlayerScore(sim.state(), "ana").total).toBe(200);
    expect(calculatePlayerScore(sim.state(), "bo").total).toBe(200);
    expect(calculateScore(sim.state()).total).toBe(400);
  });

  it("only the key's holder can open the door with it; the door then opens for everyone", () => {
    const sim = createMatchSimulation(templeLevel, [ANA, BO]);
    sim.place("ana", KEY_STAND.x, KEY_STAND.z);
    sim.dispatch(collect("ana"));
    sim.place("bo", DIAL_STAND.x, DIAL_STAND.z);
    sim.dispatch(answer("bo", 2));

    sim.place("bo", DOOR_STAND.x, DOOR_STAND.z);
    expect(sim.dispatch({ type: "activateObject", playerId: "bo", objectId: TEMPLE_IDS.door })).toMatchObject({
      accepted: true,
      result: { type: "message", title: "Locked Door" },
    });
    sim.place("ana", DOOR_STAND.x + 1, DOOR_STAND.z);
    sim.dispatch({ type: "activateObject", playerId: "ana", objectId: TEMPLE_IDS.door });
    expect(isDoorOpen(sim.state(), TEMPLE_IDS.door)).toBe(true);

    expect(sim.walkTo("bo", 0, -5)).toBe(true); // Bo walks through the door Ana opened
  });

  it("pop-ups go only to the players they're for", () => {
    const sim = createMatchSimulation(templeLevel, [ANA, BO]);
    sim.place("ana", -7.4, 4);
    sim.dispatch({ type: "interact", playerId: "ana", targetId: TEMPLE_IDS.tablet });
    sim.place("bo", KEY_STAND.x, KEY_STAND.z);
    sim.dispatch(collect("bo"));
    expect(sim.player("bo").notice?.text).toBe("You found the Bronze Key!");
    expect(sim.player("ana").notice?.text).toBe("Bo found the Bronze Key.");
  });
});

describe("player elimination", () => {
  it("losing every life eliminates a player; their key goes back to where it was found", () => {
    const sim = createMatchSimulation(templeLevel, [ANA, BO], { livesPerPlayer: 2 });
    sim.place("ana", KEY_STAND.x, KEY_STAND.z);
    sim.dispatch(collect("ana"));
    expect(isPickupCollected(sim.state(), TEMPLE_IDS.key)).toBe(true);

    standOnSpikes(sim, "ana", 1);
    expect(sim.player("ana")).toMatchObject({ status: "active", livesRemaining: 1, trapHits: 1 });
    standOnSpikes(sim, "ana", 2);

    expect(sim.player("ana")).toMatchObject({ status: "eliminated", livesRemaining: 0, inventory: [] });
    expect(isPickupCollected(sim.state(), TEMPLE_IDS.key)).toBe(false);
    expect(sim.player("bo").notice?.text).toBe("Ana's Bronze Key is back where it was found.");
    expect(sim.events.map((e) => e.type)).toContain("playerEliminated");
    expect(sim.state().status).toBe("playing"); // Bo is still in

    // Eliminated players can't act, and their position no longer counts.
    expect(sim.dispatch(collect("ana"))).toMatchObject({ accepted: false, reason: "playerNotActive" });
    sim.place("bo", KEY_STAND.x, KEY_STAND.z);
    expect(sim.dispatch(collect("bo"))).toMatchObject({ accepted: true }); // the returned key can be taken again
  });

  it("the match fails when every player is eliminated", () => {
    const sim = createMatchSimulation(templeLevel, [ANA, BO], { livesPerPlayer: 1 });
    standOnSpikes(sim, "ana", 1);
    expect(sim.state().status).toBe("playing");
    standOnSpikes(sim, "bo", 1);
    expect(sim.state()).toMatchObject({ status: "failed", failReason: "allEliminated" });
  });

  it("with unlimited lives (the default) a player is never eliminated", () => {
    const sim = createMatchSimulation(templeLevel, [ANA]);
    standOnSpikes(sim, "ana", 4);
    expect(sim.player("ana")).toMatchObject({ status: "active", livesRemaining: null, trapHits: 4 });
  });
});

describe("stage completion", () => {
  it("each player escapes on their own; the match completes when nobody is left inside", () => {
    const sim = createMatchSimulation(freeDoorTemple, [ANA, BO, CY]);
    sim.stage.update(FRAME, { ana: EXIT });
    expect(sim.player("ana").status).toBe("escaped");
    expect(sim.state().status).toBe("playing");
    expect(sim.dispatch({ type: "interact", playerId: "ana", targetId: TEMPLE_IDS.key })).toMatchObject({
      reason: "playerNotActive",
    });

    sim.stage.update(FRAME, { bo: EXIT, cy: EXIT });
    expect(sim.state().status).toBe("completed");
    expect(sim.state().world.completedObjectives.escape).toBe("cy"); // the last one out completed it
  });

  it("completes with some players eliminated, as long as someone escaped", () => {
    const sim = createMatchSimulation(templeLevel, [ANA, BO], { livesPerPlayer: 1 });
    standOnSpikes(sim, "bo", 1);
    sim.stage.update(FRAME, { ana: EXIT });
    expect(sim.state().status).toBe("completed");
    expect(calculatePlayerScore(sim.state(), "ana").total).toBeGreaterThan(0);
    expect(calculatePlayerScore(sim.state(), "bo").total).toBe(0);
  });

  it("a player leaving can end the match: completed if the rest escaped, failed if nobody did", () => {
    const escaped = createMatchSimulation(templeLevel, [ANA, BO]);
    escaped.stage.update(FRAME, { ana: EXIT });
    escaped.stage.removePlayer("bo");
    expect(escaped.state().status).toBe("completed");

    const abandoned = createMatchSimulation(templeLevel, [ANA, BO]);
    abandoned.stage.removePlayer("ana");
    abandoned.stage.removePlayer("bo");
    expect(abandoned.state()).toMatchObject({ status: "failed", failReason: "allEliminated" });
  });

  it("a five-player match: positions of players who aren't active are ignored", () => {
    const players = Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
    const sim = createMatchSimulation(freeDoorTemple, players);
    sim.stage.update(FRAME, { p0: EXIT });
    sim.stage.update(FRAME, { p0: TRAP_CENTER, ghost: TRAP_CENTER }); // escaped and unknown: no effect
    expect(sim.player("p0")).toMatchObject({ status: "escaped", trapHits: 0 });
    sim.stage.update(FRAME, { p1: EXIT, p2: EXIT, p3: EXIT, p4: EXIT });
    expect(sim.state().status).toBe("completed");
  });
});
