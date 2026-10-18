import type { MatchSource } from "@/session/MatchSource";
import { getSpawnPoint } from "@/systems/gameState";
import { spawnFor } from "@/systems/PlayerRegistry";
import { TrapSystem } from "@/systems/TrapSystem";
import type { CommandResult, GameCommand } from "@/types/commands";
import type { LevelDefinition, PlayerState, SpawnPoint } from "@/types/game";
import type { GameEvent, MatchState, PlayerId, TrapState } from "@/types/state";

import {
  CLIENT_SEND_HZ,
  type ClientCommand,
  type ClientMessages,
  type ServerMessages,
  type SyncedRoomState,
} from "./protocol";

/** How long to wait for the server to answer a command. */
const COMMAND_TIMEOUT_MS = 5000;
/** How quickly other players' bodies glide to their latest reported position. */
const REMOTE_SMOOTHING = 12;

/** The bits of a Colyseus room this class uses; keeps it testable and SDK-version tolerant. */
export interface RoomLink {
  readonly sessionId: string;
  readonly state: SyncedRoomState;
  send<K extends keyof ClientMessages>(type: K, message: ClientMessages[K]): void;
  readonly connected: boolean;
}

function smoothing(dt: number) {
  return 1 - Math.exp(-REMOTE_SMOOTHING * dt);
}

function dampAngle(current: number, target: number, t: number) {
  let delta = (target - current) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return current + delta * t;
}

/**
 * An online match as seen from this device. The server runs the rules; this
 * class mirrors its decisions for the scene and HUD (MatchSource):
 *  - match state arrives in `match` messages; commands go out and their results
 *    come back by request id;
 *  - the local player's position is reported 15×/s; respawns come back from the server;
 *  - other players' bodies come from the synced room state, smoothed for drawing;
 *  - traps are re-created locally and kept on the server's clock (drawing only:
 *    whether they hurt is decided by the server).
 */
export class OnlineMatch implements MatchSource {
  readonly online = true;
  readonly canPause = false;
  readonly localPlayerId: PlayerId;

  private state: MatchState;
  private readonly stateListeners = new Set<() => void>();
  private readonly eventListeners = new Set<(event: GameEvent) => void>();
  private readonly traps = new Map<string, TrapSystem>();
  private readonly remoteBodies = new Map<PlayerId, PlayerState>();
  private readonly pending = new Map<number, { resolve: (result: CommandResult) => void; timer: ReturnType<typeof setTimeout> }>();
  private nextRequestId = 1;
  private pendingRespawn: SpawnPoint | null = null;
  private respawnSeq = 0;
  private sendTimer = 0;
  private serverTime = 0;
  private serverTimeReceivedAt = 0;

  constructor(
    readonly level: LevelDefinition,
    private readonly room: RoomLink,
    initialState: MatchState,
    readonly matchNumber: number,
  ) {
    this.localPlayerId = room.sessionId;
    this.state = initialState;
    for (const trigger of level.triggers) {
      if (trigger.kind === "trap") this.traps.set(trigger.id, new TrapSystem(trigger.timing, trigger.startOffset));
    }
  }

  // --- Fed by OnlineSession from server messages ------------------------------------

  applyState(state: MatchState) {
    this.state = state;
    this.stateListeners.forEach((listener) => listener());
  }

  applyRespawn(message: ServerMessages["respawn"]) {
    this.respawnSeq = Math.max(this.respawnSeq, message.seq);
    this.pendingRespawn = { position: { x: message.x, z: message.z }, facing: message.facing };
  }

  applyCommandResult(message: ServerMessages["commandResult"]) {
    const request = this.pending.get(message.requestId);
    if (!request) return;
    clearTimeout(request.timer);
    this.pending.delete(message.requestId);
    request.resolve(message.result);
  }

  applyEvents(events: readonly GameEvent[]) {
    for (const event of events) this.eventListeners.forEach((listener) => listener(event));
  }

  /** The connection is gone for good: answer every waiting command. */
  dispose() {
    for (const [, request] of this.pending) {
      clearTimeout(request.timer);
      request.resolve(this.notConnected());
    }
    this.pending.clear();
  }

  // --- MatchSource ---------------------------------------------------------------

  getState = (): MatchState => this.state;

  subscribe = (listener: () => void) => {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  };

  onEvent = (listener: (event: GameEvent) => void) => {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  };

  get isRunning() {
    return this.state.status === "playing";
  }

  getTrap(trapId: string): TrapState | undefined {
    return this.traps.get(trapId);
  }

  spawnPoint(): SpawnPoint {
    const slot = this.state.players[this.localPlayerId]?.slot ?? 0;
    return slot >= 0 ? spawnFor(this.level, this.level.playerSpawnId, slot) : getSpawnPoint(this.level, this.level.playerSpawnId);
  }

  frame(dt: number, body: PlayerState): SpawnPoint | null {
    this.followServerClock();
    this.updateRemoteBodies(dt);

    // Report where we are, a few times a second (not every frame).
    this.sendTimer += dt;
    if (this.sendTimer >= 1 / CLIENT_SEND_HZ && this.room.connected) {
      this.sendTimer = 0;
      this.room.send("move", {
        x: body.position.x,
        z: body.position.z,
        facing: body.facing,
        moveAmount: body.moveAmount,
        respawnSeq: this.respawnSeq,
      });
    }

    const respawn = this.pendingRespawn;
    this.pendingRespawn = null;
    return respawn;
  }

  getRemoteBody(playerId: PlayerId): PlayerState | undefined {
    if (playerId === this.localPlayerId) return undefined;
    let body = this.remoteBodies.get(playerId);
    if (!body) {
      const synced = this.room.state.players.get(playerId);
      body = {
        position: { x: synced?.x ?? 0, z: synced?.z ?? 0 },
        velocity: { x: 0, z: 0 },
        facing: synced?.facing ?? 0,
        moveAmount: 0,
        lastInteractTime: -Infinity,
        time: 0,
      };
      this.remoteBodies.set(playerId, body);
    }
    return body;
  }

  dispatch(command: ClientCommand): Promise<CommandResult> {
    if (!this.room.connected) return Promise.resolve(this.notConnected(command));
    const requestId = this.nextRequestId++;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        resolve(this.notConnected(command));
      }, COMMAND_TIMEOUT_MS);
      this.pending.set(requestId, { resolve, timer });
      this.room.send("command", { requestId, command });
    });
  }

  pause() {} // online matches don't pause

  resume() {}

  // --- Internals -------------------------------------------------------------------

  private notConnected(command?: ClientCommand): CommandResult {
    const full = { ...(command ?? { type: "interact", targetId: "" }), playerId: this.localPlayerId } as GameCommand;
    return { accepted: false, command: full, reason: "notConnected" };
  }

  /** Keep the local trap copies on the server's clock, extrapolating between updates. */
  private followServerClock() {
    const now = Date.now();
    const synced = this.room.state.matchTime;
    if (synced !== this.serverTime) {
      this.serverTime = synced;
      this.serverTimeReceivedAt = now;
    }
    const matchTime = this.isRunning ? this.serverTime + (now - this.serverTimeReceivedAt) / 1000 : this.serverTime;
    this.traps.forEach((trap) => trap.setMatchTime(matchTime));
  }

  private updateRemoteBodies(dt: number) {
    if (dt <= 0) return;
    const t = smoothing(dt);
    this.room.state.players.forEach((synced, id) => {
      if (id === this.localPlayerId) return;
      const body = this.getRemoteBody(id)!;
      const previous = { ...body.position };
      body.position.x += (synced.x - body.position.x) * t;
      body.position.z += (synced.z - body.position.z) * t;
      body.velocity.x = (body.position.x - previous.x) / dt;
      body.velocity.z = (body.position.z - previous.z) / dt;
      body.facing = dampAngle(body.facing, synced.facing, t);
      body.moveAmount = synced.moveAmount;
      body.time += dt;
    });
  }
}
