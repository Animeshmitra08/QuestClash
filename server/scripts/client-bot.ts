/**
 * A scripted player, for testing with separate client processes against a running
 * server. Uses the app's own network code (src/net/OnlineSession).
 *
 *   npx tsx scripts/client-bot.ts host <serverUrl> <codeFile>   create a room, write its code to codeFile
 *   npx tsx scripts/client-bot.ts guest <serverUrl> <codeFile>  join the room whose code is in codeFile
 *
 * Both ready up; the host walks to the key and picks it up; the guest walks a few
 * steps. Each prints what it saw of the other as `RESULT <json>` lines.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { TEMPLE_IDS } from "@/levels/temple";
import type { OnlineMatch } from "@/net/OnlineMatch";
import { OnlineSession } from "@/net/OnlineSession";
import type { PlayerState } from "@/types/game";

const [role, serverUrl, codeFile] = process.argv.slice(2);
if ((role !== "host" && role !== "guest") || !serverUrl || !codeFile) {
  console.error("usage: client-bot.ts host|guest <serverUrl> <codeFile>");
  process.exit(2);
}

const STEP = 0.05;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const report = (data: object) => console.log(`RESULT ${JSON.stringify({ role, ...data })}`);

async function waitFor(what: string, predicate: () => boolean, timeoutMs = 15000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error(`${role}: timed out waiting for ${what}`);
    await sleep(25);
  }
}

async function walk(match: OnlineMatch, body: PlayerState, path: { x: number; z: number }[]) {
  for (const target of path) {
    for (;;) {
      const dx = target.x - body.position.x;
      const dz = target.z - body.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 0.05) break;
      const step = Math.min(distance, 4 * STEP);
      body.position.x += (dx / distance) * step;
      body.position.z += (dz / distance) * step;
      match.frame(STEP, body);
      await sleep(STEP * 1000);
    }
  }
}

async function idle(match: OnlineMatch, body: PlayerState, seconds: number) {
  for (let i = 0; i < seconds / STEP; i++) {
    match.frame(STEP, body);
    await sleep(STEP * 1000);
  }
}

const session = new OnlineSession(serverUrl);
try {
  if (role === "host") {
    if (!(await session.create("Host bot"))) throw new Error(`create failed: ${session.getView().error}`);
    writeFileSync(codeFile, session.getView().code!);
    report({ step: "created", code: session.getView().code });
  } else {
    await waitFor("room code file", () => existsSync(codeFile) && readFileSync(codeFile, "utf8").length > 0);
    const code = readFileSync(codeFile, "utf8").trim();
    if (!(await session.join(code, "Guest bot"))) throw new Error(`join failed: ${session.getView().error}`);
    report({ step: "joined", code });
  }

  await waitFor("two players in the lobby", () => session.getView().players.length === 2);
  session.setReady(true);
  await waitFor("match start", () => session.getView().match !== null);
  const match = session.getView().match!;
  const me = session.getView().localId!;
  const other = session.getView().players.find((p) => !p.isYou)!.id;
  const spawn = match.spawnPoint().position;
  const body: PlayerState = { position: { ...spawn }, velocity: { x: 0, z: 0 }, facing: Math.PI, moveAmount: 0, lastInteractTime: -Infinity, time: 0 };
  report({ step: "match started", players: match.getState().playerOrder.length, level: match.level.id });

  if (role === "host") {
    await walk(match, body, [{ x: 0, z: 12.3 }, { x: 8.2, z: 12.3 }]);
    await idle(match, body, 0.4);
    const result = await match.dispatch({ type: "collectItem", pickupId: TEMPLE_IDS.key });
    report({ step: "collect key", accepted: result.accepted, reason: result.accepted ? null : result.reason });
    await idle(match, body, 3);
  } else {
    await walk(match, body, [{ x: spawn.x, z: 6 }]);
    // Watch the shared world while the host plays: the host takes the key, then leaves,
    // and a player who leaves puts their items back in the world.
    let sawOtherTakeKey = false;
    let otherPositionWhileHolding: { x: number; z: number } | null = null;
    for (let i = 0; i < 9 / STEP; i++) {
      match.frame(STEP, body);
      if (match.getState().world.collectedPickups[TEMPLE_IDS.key] === other && !sawOtherTakeKey) {
        sawOtherTakeKey = true;
        const remote = match.getRemoteBody(other)!;
        otherPositionWhileHolding = { x: +remote.position.x.toFixed(2), z: +remote.position.z.toFixed(2) };
      }
      await sleep(STEP * 1000);
    }
    report({
      step: "watched",
      sawOtherTakeKey,
      otherPositionWhenKeyTaken: otherPositionWhileHolding,
      otherStatusAtEnd: match.getState().players[other]?.status,
      keyBackInWorldAfterOtherLeft: match.getState().world.collectedPickups[TEMPLE_IDS.key] === undefined,
    });
  }

  // What this client saw of the other player and of the shared world.
  const remote = match.getRemoteBody(other)!;
  const keyHolder = match.getState().world.collectedPickups[TEMPLE_IDS.key] ?? null;
  report({
    step: "observed",
    me,
    myPosition: body.position,
    otherPosition: { x: +remote.position.x.toFixed(2), z: +remote.position.z.toFixed(2) },
    keyHolder: keyHolder === null ? null : keyHolder === me ? "me" : keyHolder === other ? "other" : keyHolder,
  });
} catch (error) {
  console.error(`FAILED ${role}: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await session.leave();
}
