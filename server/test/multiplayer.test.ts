/**
 * End-to-end multiplayer tests: the real server, and separate clients built from
 * the app's own network code (src/net/OnlineSession), talking over real WebSockets.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { type ColyseusTestServer, boot } from "@colyseus/testing";

import { TEMPLE_IDS } from "@/levels/temple";
import type { OnlineMatch } from "@/net/OnlineMatch";
import { OnlineSession } from "@/net/OnlineSession";
import { NET_ERRORS, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "@/net/protocol";
import type { PlayerState } from "@/types/game";

import { server } from "../src/app.ts";
import type { QuestRoom } from "../src/rooms/QuestRoom.ts";

// boot() always listens on @colyseus/testing's default port when given a server instance.
const PORT = 2568;
// 127.0.0.1, not localhost: Node resolves localhost to IPv6 first.
const URL = `http://127.0.0.1:${PORT}`;
const STEP_SECONDS = 0.05;
const WALK_SPEED = 4; // a little under MAX_SPEED, like a real player

let colyseus: ColyseusTestServer;
const sessions: OnlineSession[] = [];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(what: string, predicate: () => boolean, timeoutMs = 5000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error(`Timed out waiting for: ${what}`);
    await sleep(20);
  }
}

function newSession() {
  const session = new OnlineSession(URL);
  sessions.push(session);
  return session;
}

/** A player's body on their own device, as the scene would keep it. */
function bodyAt(x: number, z: number): PlayerState {
  return { position: { x, z }, velocity: { x: 0, z: 0 }, facing: Math.PI, moveAmount: 0, lastInteractTime: -Infinity, time: 0 };
}

/** Walk a body through points at walking speed, reporting each step like the scene does. */
async function walk(match: OnlineMatch, body: PlayerState, path: { x: number; z: number }[]) {
  for (const target of path) {
    for (;;) {
      const dx = target.x - body.position.x;
      const dz = target.z - body.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 0.05) break;
      const step = Math.min(distance, WALK_SPEED * STEP_SECONDS);
      body.position.x += (dx / distance) * step;
      body.position.z += (dz / distance) * step;
      body.moveAmount = 1;
      const respawn = match.frame(STEP_SECONDS, body);
      if (respawn) Object.assign(body.position, respawn.position);
      await sleep(STEP_SECONDS * 1000);
    }
  }
  body.moveAmount = 0;
  // A few still frames so the last position is reported.
  for (let i = 0; i < 4; i++) {
    match.frame(STEP_SECONDS, body);
    await sleep(STEP_SECONDS * 1000);
  }
}

/** Two players in a room, both ready, match started. */
async function startTwoPlayerMatch() {
  const ana = newSession();
  const bo = newSession();
  assert.equal(await ana.create("Ana"), true);
  const code = ana.getView().code!;
  assert.equal(await bo.join(code, "Bo"), true);
  await waitFor("both in lobby", () => ana.getView().players.length === 2 && bo.getView().players.length === 2);
  ana.setReady(true);
  bo.setReady(true);
  await waitFor("match on both", () => ana.getView().match !== null && bo.getView().match !== null);
  return { ana, bo, code, anaMatch: ana.getView().match!, boMatch: bo.getView().match! };
}

function serverRoom(code: string): QuestRoom {
  return colyseus.getRoomById(code) as unknown as QuestRoom;
}

before(async () => {
  colyseus = await boot(server, PORT);
});

after(async () => {
  await Promise.all(sessions.map((session) => session.leave()));
  await colyseus.shutdown();
});

describe("rooms, codes and the lobby", () => {
  it("creates a room with a short code that a second client joins", async () => {
    const ana = newSession();
    const bo = newSession();
    assert.equal(await ana.create("Ana"), true);
    const code = ana.getView().code;
    assert.ok(code && code.length === ROOM_CODE_LENGTH && [...code].every((c) => ROOM_CODE_ALPHABET.includes(c)), `bad code ${code}`);

    assert.equal(await bo.join(code!.toLowerCase(), "Bo"), true); // codes are case-insensitive
    await waitFor("both see two players", () => ana.getView().players.length === 2 && bo.getView().players.length === 2);
    assert.deepEqual(
      bo.getView().players.map((p) => [p.name, p.isHost, p.isYou]),
      [
        ["Ana", true, false],
        ["Bo", false, true],
      ],
    );
    assert.equal(ana.getView().isHost, true);
    assert.equal(bo.getView().phase, "lobby");
  });

  it("explains bad codes and bad names", async () => {
    const lost = newSession();
    assert.equal(await lost.join("ZZZZZ", "Lost"), false);
    assert.equal(lost.getView().error, NET_ERRORS.roomNotFound);

    const host = newSession();
    await host.create("Host");
    const nameless = newSession();
    assert.equal(await nameless.join(host.getView().code!, "   "), false);
    assert.equal(nameless.getView().error, NET_ERRORS.invalidName);
  });

  it("reports an unreachable server", async () => {
    const offline = new OnlineSession("http://localhost:1"); // nothing listens there
    assert.equal(await offline.create("Ana"), false);
    assert.equal(offline.getView().error, NET_ERRORS.serverUnreachable);
  });

  it("starts only when every player is ready, then refuses new joiners", async () => {
    const ana = newSession();
    const bo = newSession();
    await ana.create("Ana");
    const code = ana.getView().code!;
    await bo.join(code, "Bo");
    await waitFor("two players", () => ana.getView().players.length === 2);

    ana.setReady(true);
    await waitFor("Ana ready", () => bo.getView().players.find((p) => p.name === "Ana")?.ready === true);
    assert.equal(ana.getView().phase, "lobby");

    bo.setReady(true);
    await waitFor("playing", () => ana.getView().phase === "playing" && bo.getView().phase === "playing");

    const late = newSession();
    assert.equal(await late.join(code, "Late"), false);
    assert.equal(late.getView().error, NET_ERRORS.matchInProgress);
  });

  it("holds at most five players", async () => {
    const host = newSession();
    await host.create("P1");
    const code = host.getView().code!;
    for (let i = 2; i <= 5; i++) assert.equal(await newSession().join(code, `P${i}`), true);
    const sixth = newSession();
    assert.equal(await sixth.join(code, "P6"), false);
    assert.equal(sixth.getView().error, NET_ERRORS.roomFull);
  });

  it("only the host can choose the level", async () => {
    const ana = newSession();
    const bo = newSession();
    await ana.create("Ana");
    await bo.join(ana.getView().code!, "Bo");
    await waitFor("two players", () => bo.getView().players.length === 2);
    bo.selectLevel("cloister-2");
    await waitFor("Bo refused", () => bo.getView().error === NET_ERRORS.notHost);
    ana.selectLevel("cloister-2");
    await waitFor("level changed", () => bo.getView().levelId === "cloister-2");
  });
});

describe("a two-player match", () => {
  it("both clients get the same authoritative match, with both players", async () => {
    const { anaMatch, boMatch, ana, bo } = await startTwoPlayerMatch();
    const ids = [ana.getView().localId!, bo.getView().localId!];
    assert.deepEqual([...anaMatch.getState().playerOrder].sort(), [...ids].sort());
    assert.deepEqual(anaMatch.getState().playerOrder, boMatch.getState().playerOrder);
    assert.equal(anaMatch.isRunning, true);
    assert.equal(anaMatch.level.id, TEMPLE_IDS.level);
  });

  it("synchronises movement: each client sees the other walk", async () => {
    const { anaMatch, boMatch, ana } = await startTwoPlayerMatch();
    const anaId = ana.getView().localId!;
    const body = bodyAt(anaMatch.spawnPoint().position.x, anaMatch.spawnPoint().position.z);

    await walk(anaMatch, body, [{ x: 0, z: 7 }]);
    // Bo's copy of Ana glides to where Ana is.
    const remote = boMatch.getRemoteBody(anaId)!;
    for (let i = 0; i < 40; i++) {
      boMatch.frame(STEP_SECONDS, bodyAt(1, 10));
      await sleep(STEP_SECONDS * 1000);
    }
    assert.ok(Math.hypot(remote.position.x - body.position.x, remote.position.z - body.position.z) < 0.3, `remote at ${JSON.stringify(remote.position)}`);
  });

  it("the server, not the client, decides where a player can be: a teleport is clamped", async () => {
    const { anaMatch, ana, code } = await startTwoPlayerMatch();
    const anaId = ana.getView().localId!;
    const cheat = bodyAt(0, -12.2); // straight to the exit, through the locked door
    for (let i = 0; i < 5; i++) {
      anaMatch.frame(STEP_SECONDS, cheat);
      await sleep(STEP_SECONDS * 1000);
    }
    const accepted = serverRoom(code).state.players.get(anaId)!;
    assert.ok(accepted.z > 5, `server accepted z=${accepted.z}`);
    assert.equal(anaMatch.getState().players[anaId].status, "active"); // not escaped
  });

  it("the server decides item collection: out of reach is refused; a simultaneous grab has one winner", async () => {
    const { anaMatch, boMatch, ana, bo } = await startTwoPlayerMatch();
    const anaId = ana.getView().localId!;

    // Bo tries from the start, far from the key.
    const far = await boMatch.dispatch({ type: "collectItem", pickupId: TEMPLE_IDS.key });
    assert.deepEqual([far.accepted, !far.accepted && far.reason], [false, "outOfReach"]);

    // Both walk to the key, then grab at the same moment.
    const anaBody = bodyAt(anaMatch.spawnPoint().position.x, anaMatch.spawnPoint().position.z);
    const boBody = bodyAt(boMatch.spawnPoint().position.x, boMatch.spawnPoint().position.z);
    await Promise.all([
      walk(anaMatch, anaBody, [{ x: 0, z: 12.3 }, { x: 8.2, z: 12.3 }]),
      walk(boMatch, boBody, [{ x: 0.5, z: 12.4 }, { x: 7.6, z: 12.5 }]),
    ]);
    const [a, b] = await Promise.all([
      anaMatch.dispatch({ type: "collectItem", pickupId: TEMPLE_IDS.key }),
      boMatch.dispatch({ type: "collectItem", pickupId: TEMPLE_IDS.key }),
    ]);
    assert.equal([a, b].filter((r) => r.accepted).length, 1, JSON.stringify([a, b]));
    const loser = a.accepted ? b : a;
    assert.equal(!loser.accepted && loser.reason, "alreadyCollected");

    const winnerId = a.accepted ? anaId : bo.getView().localId!;
    await waitFor("both see who has the key", () =>
      [anaMatch, boMatch].every((m) => m.getState().world.collectedPickups[TEMPLE_IDS.key] === winnerId),
    );
    assert.equal(anaMatch.getState().players[winnerId].inventory.length, 1);
  });

  it("the server validates puzzle answers", async () => {
    const { anaMatch } = await startTwoPlayerMatch();
    const body = bodyAt(anaMatch.spawnPoint().position.x, anaMatch.spawnPoint().position.z);
    await walk(anaMatch, body, [{ x: 2.3, z: 8 }, { x: 2.3, z: -1.2 }]);

    const invalid = await anaMatch.dispatch({ type: "submitPuzzleAnswer", puzzleId: TEMPLE_IDS.sunPuzzle, optionIndex: 9 });
    assert.equal(!invalid.accepted && invalid.reason, "invalidAnswer");
    const wrong = await anaMatch.dispatch({ type: "submitPuzzleAnswer", puzzleId: TEMPLE_IDS.sunPuzzle, optionIndex: 0 });
    assert.deepEqual([wrong.accepted, wrong.accepted && wrong.correct], [true, false]);
    const right = await anaMatch.dispatch({ type: "submitPuzzleAnswer", puzzleId: TEMPLE_IDS.sunPuzzle, optionIndex: 2 });
    assert.deepEqual([right.accepted, right.accepted && right.correct], [true, true]);
    await waitFor("solved for everyone", () => anaMatch.getState().world.puzzles[TEMPLE_IDS.sunPuzzle].status === "solved");
  });
});

describe("disconnects", () => {
  it("a dropped player keeps their seat and comes back as the same player", async () => {
    const { ana, bo, boMatch } = await startTwoPlayerMatch();
    const boId = bo.getView().localId!;
    const room = (bo as unknown as { room: { reconnection: { minUptime: number }; connection: { transport: { ws: WebSocket } } } }).room;
    room.reconnection.minUptime = 0; // reconnect immediately in the test

    room.connection.transport.ws.close(); // the network drops (not a deliberate leave)
    await waitFor("Ana sees Bo disconnected", () => ana.getView().players.find((p) => p.id === boId)?.connected === false);
    await waitFor("Bo reconnected", () => bo.getView().status === "connected" && ana.getView().players.find((p) => p.id === boId)?.connected === true, 10000);

    assert.equal(bo.getView().localId, boId);
    assert.equal(bo.getView().match, boMatch); // same match continues
    assert.equal(boMatch.getState().players[boId].status, "active");
  });

  it("a player who leaves on purpose is removed from the match for everyone", async () => {
    const { ana, bo, anaMatch } = await startTwoPlayerMatch();
    const boId = bo.getView().localId!;
    await bo.leave();
    await waitFor("Ana sees Bo leave", () => anaMatch.getState().players[boId]?.status === "left");
    await waitFor("lobby list updated", () => !ana.getView().players.some((p) => p.id === boId));
    assert.equal(bo.getView().status, "idle");
  });

  it("commands fail cleanly when the connection is gone", async () => {
    const { bo, boMatch } = await startTwoPlayerMatch();
    await bo.leave();
    const result = await boMatch.dispatch({ type: "interact", targetId: TEMPLE_IDS.key });
    assert.equal(!result.accepted && result.reason, "notConnected");
  });
});

describe("stage progression", () => {
  it("completes when everyone escapes; only the host moves the room on to the next level", async () => {
    const { ana, bo, anaMatch, boMatch, code } = await startTwoPlayerMatch();
    const room = serverRoom(code);
    const exit = { x: 0, z: -12.2 };
    // Test shortcut: put both players at the exit on the server (walking the whole temple takes ~40 s).
    for (const id of [ana.getView().localId!, bo.getView().localId!]) {
      (room as unknown as { match: { guards: Map<string, { reset(p: object, t: number): void }> } }).match.guards.get(id)!.reset(exit, Date.now());
    }
    await waitFor("completed on both", () => anaMatch.getState().status === "completed" && boMatch.getState().status === "completed");
    await waitFor("room finished", () => ana.getView().phase === "finished");

    bo.nextLevel();
    await waitFor("non-host refused", () => bo.getView().error === NET_ERRORS.notHost);

    ana.nextLevel();
    await waitFor("next level on both", () => ana.getView().match?.level.id === "cloister-2" && bo.getView().match?.level.id === "cloister-2");
    assert.notEqual(ana.getView().match, anaMatch);
    await waitFor("room playing again", () => ana.getView().phase === "playing" && bo.getView().phase === "playing");
    assert.equal(ana.getView().match!.getState().status, "playing");
  });
});
