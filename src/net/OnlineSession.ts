// Must stay the first import: installs built-ins Hermes lacks before the SDK loads.
import "./hermesPolyfills";

import { Client, CloseCode, type Room } from "@colyseus/sdk";

import { FIRST_LEVEL_ID, LEVEL_CATALOG } from "@/levels/catalog";

import { describeRawError, netLog } from "./netLog";
import { OnlineMatch, type RoomLink } from "./OnlineMatch";
import {
  APP_ERROR_CODES,
  type ClientMessages,
  type CreateRoomOptions,
  type JoinRoomOptions,
  NET_ERRORS,
  type NetErrorCode,
  normalizeRoomCode,
  PING_INTERVAL_MS,
  PROTOCOL_VERSION,
  ROOM_NAME,
  type RoomPhase,
  type ServerMessages,
  type SyncedRoomState,
} from "./protocol";

export type ConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "closed";

export interface LobbyPlayer {
  id: string;
  name: string;
  slot: number;
  ready: boolean;
  connected: boolean;
  isHost: boolean;
  isYou: boolean;
  /** Round trip to the server in ms, or null until measured. */
  ping: number | null;
}

/** Everything the online screens show, as one immutable snapshot (for useSyncExternalStore). */
export interface SessionView {
  status: ConnectionStatus;
  code: string | null;
  phase: RoomPhase | null;
  levelId: string;
  players: LobbyPlayer[];
  localId: string | null;
  isHost: boolean;
  /** A message for the player, or null. */
  error: string | null;
  /** The match being played (null in the lobby). Changes identity for every new match. */
  match: OnlineMatch | null;
}

const INITIAL_VIEW: SessionView = {
  status: "idle",
  code: null,
  phase: null,
  levelId: FIRST_LEVEL_ID,
  players: [],
  localId: null,
  isHost: false,
  error: null,
  match: null,
};

type SdkRoom = Room<unknown, SyncedRoomState>;

/** How long create/join waits for the first lobby state before carrying on anyway. */
const FIRST_SYNC_TIMEOUT_MS = 3000;

/** Turn a failed create/join into something a player can act on. */
export function describeJoinError(error: unknown): string {
  const code = (error as { code?: number })?.code;
  const message = String((error as { message?: string })?.message ?? error ?? "");
  if (code === APP_ERROR_CODES.roomFull || /full/i.test(message)) return NET_ERRORS.roomFull;
  if (code === APP_ERROR_CODES.matchInProgress || /locked/i.test(message)) return NET_ERRORS.matchInProgress;
  if (code === APP_ERROR_CODES.invalidName) return NET_ERRORS.invalidName;
  if (code === APP_ERROR_CODES.invalidLevel) return NET_ERRORS.invalidLevel;
  if (code === APP_ERROR_CODES.versionMismatch) return NET_ERRORS.versionMismatch;
  if (/not found|invalid room|no rooms/i.test(message) || code === 522) return NET_ERRORS.roomNotFound;
  return NET_ERRORS.serverUnreachable;
}

/**
 * The connection to the game server for one room: creating or joining by code,
 * the lobby (ready, level choice), matches, and reconnecting after a drop.
 * Plain TypeScript with no React Native imports.
 */
export class OnlineSession {
  private readonly client: Client;
  private readonly serverUrl: string;
  private room: SdkRoom | null = null;
  private view: SessionView = INITIAL_VIEW;
  private readonly listeners = new Set<() => void>();
  /** Last lobby fields published, to avoid re-rendering on every movement patch. */
  private lobbyKey = "";
  private onFirstSync: (() => void) | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  /** Our own latest round trip, shown straight away rather than after the server echoes it back. */
  private localPing: number | null = null;

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
    this.client = new Client(serverUrl);
  }

  // --- For React ----------------------------------------------------------------

  getView = (): SessionView => this.view;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private setView(changes: Partial<SessionView>) {
    this.view = { ...this.view, ...changes };
    this.listeners.forEach((listener) => listener());
  }

  // --- Joining ------------------------------------------------------------------

  /** Create a room and become its host. Resolves false (with `view.error` set) on failure. */
  create(name: string, levelId?: string): Promise<boolean> {
    const options: CreateRoomOptions = { name, levelId, protocolVersion: PROTOCOL_VERSION };
    return this.connect(`create "${ROOM_NAME}"`, () =>
      this.client.create<SyncedRoomState>(ROOM_NAME, options) as Promise<SdkRoom>,
    );
  }

  /** Join a friend's room by its code. */
  join(code: string, name: string): Promise<boolean> {
    const options: JoinRoomOptions = { name, protocolVersion: PROTOCOL_VERSION };
    const roomCode = normalizeRoomCode(code);
    return this.connect(`join ${roomCode}`, () =>
      this.client.joinById<SyncedRoomState>(roomCode, options) as Promise<SdkRoom>,
    );
  }

  private async connect(action: string, open: () => Promise<SdkRoom>): Promise<boolean> {
    if (this.room) return true;
    this.setView({ status: "connecting", error: null });
    const startedAt = Date.now();
    netLog.info(`${action}: connecting to ${this.serverUrl}`);
    try {
      const room = await open();
      netLog.info(`${action}: joined room ${room.roomId} as ${room.sessionId} (${Date.now() - startedAt} ms)`);
      const firstSync = new Promise<void>((resolve) => {
        this.onFirstSync = resolve;
        setTimeout(() => {
          if (this.onFirstSync === resolve) netLog.warn(`No lobby state after ${FIRST_SYNC_TIMEOUT_MS} ms; continuing`);
          resolve();
        }, FIRST_SYNC_TIMEOUT_MS); // don't hang if the first patch is slow
      });
      this.attach(room);
      await firstSync; // so the lobby (players, code) is ready before we report success
      return true;
    } catch (error) {
      const message = describeJoinError(error);
      netLog.error(`${action} failed after ${Date.now() - startedAt} ms → "${message}"`, {
        serverUrl: this.serverUrl,
        ...describeRawError(error),
      });
      this.setView({ status: "idle", error: message });
      return false;
    }
  }

  // --- Lobby and match actions ------------------------------------------------------

  setReady(ready: boolean) {
    this.send("ready", { ready });
  }

  selectLevel(levelId: string) {
    this.send("selectLevel", { levelId });
  }

  restart() {
    this.send("restart", {});
  }

  nextLevel() {
    this.send("nextLevel", {});
  }

  /** Host, after a match: everyone returns to the lobby to get ready again. */
  backToLobby() {
    this.send("backToLobby", {});
  }

  /** Leave the room on purpose (no reconnection). */
  async leave() {
    const room = this.room;
    this.detach();
    this.setView({ ...INITIAL_VIEW });
    if (room) await room.leave(true).catch(() => {});
  }

  clearError() {
    this.setView({ error: null });
  }

  // --- Internals -------------------------------------------------------------------

  private send<K extends keyof ClientMessages>(type: K, message: ClientMessages[K]) {
    if (!this.room || this.view.status !== "connected") {
      this.setView({ error: NET_ERRORS.connectionLost });
      return;
    }
    this.room.send(type, message);
  }

  private attach(room: SdkRoom) {
    this.room = room;
    this.lobbyKey = "";
    // The room id is the code, known immediately; the rest arrives with the first state sync.
    this.setView({ status: "connected", localId: room.sessionId, code: room.roomId, error: null });

    const link: RoomLink = {
      get sessionId() {
        return room.sessionId;
      },
      get state() {
        return room.state;
      },
      get connected() {
        return room.connection.isOpen;
      },
      send: (type, message) => room.send(type, message),
    };

    room.onStateChange(() => this.publishLobby());

    room.onMessage("match", (message: ServerMessages["match"]) => {
      const current = this.view.match;
      if (current && current.matchNumber === message.matchNumber) {
        current.applyState(message.state);
        return;
      }
      const level = LEVEL_CATALOG.find((candidate) => candidate.id === message.levelId);
      if (!level) {
        this.setView({ error: NET_ERRORS.invalidLevel });
        return;
      }
      current?.dispose();
      this.setView({ match: new OnlineMatch(level, link, message.state, message.matchNumber) });
    });
    room.onMessage("respawn", (message: ServerMessages["respawn"]) => this.view.match?.applyRespawn(message));
    room.onMessage("commandResult", (message: ServerMessages["commandResult"]) =>
      this.view.match?.applyCommandResult(message),
    );
    room.onMessage("events", (message: ServerMessages["events"]) => this.view.match?.applyEvents(message.events));
    room.onMessage("error", (message: ServerMessages["error"]) => {
      netLog.warn(`Server refused a request: ${message.code}`, message.message);
      this.setView({ error: NET_ERRORS[message.code as NetErrorCode] ?? message.message });
    });

    room.onDrop((code?: number, reason?: string) => {
      netLog.warn(`Connection dropped (code ${code}${reason ? `, ${reason}` : ""}); reconnecting…`);
      this.setView({ status: "reconnecting" });
    });
    room.onReconnect(() => {
      netLog.info(`Reconnected to room ${room.roomId}`);
      this.setView({ status: "connected", error: null });
    });
    room.onLeave((code: number, reason?: string) => {
      if (this.room !== room) return; // we left on purpose; already handled
      const consented = code === CloseCode.CONSENTED;
      const hostLeft = code === APP_ERROR_CODES.hostLeft;
      (consented || hostLeft ? netLog.info : netLog.warn)(
        `Left room ${room.roomId} (code ${code}${reason ? `, ${reason}` : ""})${hostLeft ? ": the host left" : ""}`,
      );
      this.stopPing();
      this.view.match?.dispose();
      this.room = null;
      // Back to the join screen, saying why.
      this.setView({
        ...INITIAL_VIEW,
        status: "closed",
        error: hostLeft ? NET_ERRORS.hostLeft : consented ? null : NET_ERRORS.connectionLost,
      });
    });
    room.onError((code: number, message?: string) => {
      netLog.error(`Room error ${code}`, message);
      this.setView({ error: message ?? NET_ERRORS.connectionLost });
    });

    this.measurePing(room);
    this.pingTimer = setInterval(() => this.measurePing(room), PING_INTERVAL_MS);
  }

  /** Time a round trip to the server, show it, and report it so the other players see it too. */
  private measurePing(room: SdkRoom) {
    if (this.room !== room || !room.connection.isOpen) return;
    room.ping((ms) => {
      if (this.room !== room) return;
      this.localPing = Math.max(1, Math.round(ms));
      if (room.connection.isOpen) room.send("reportPing", { ms: this.localPing });
      this.publishLobby();
    });
  }

  private detach() {
    this.stopPing();
    this.view.match?.dispose();
    this.room?.removeAllListeners();
    this.room = null;
  }

  private stopPing() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
    this.localPing = null;
  }

  /** Publish lobby fields (players, ready, phase…) only when they changed, not on every movement patch. */
  private publishLobby() {
    const room = this.room;
    if (!room) return;
    const state = room.state;
    const players: LobbyPlayer[] = [];
    state.players.forEach((player, id) => {
      players.push({
        id,
        name: player.name,
        slot: player.slot,
        ready: player.ready,
        connected: player.connected,
        isHost: id === state.hostId,
        isYou: id === room.sessionId,
        ping: id === room.sessionId && this.localPing !== null ? this.localPing : player.ping || null,
      });
    });
    players.sort((a, b) => a.slot - b.slot);
    const phase = (state.phase || "lobby") as RoomPhase;
    if (players.length > 0) {
      if (this.onFirstSync) netLog.info(`Lobby ready: room ${state.code || room.roomId}, ${players.length} player(s)`);
      this.onFirstSync?.();
      this.onFirstSync = null;
    }
    const key = JSON.stringify([state.code, phase, state.levelId, state.hostId, players]);
    if (key === this.lobbyKey) return;
    this.lobbyKey = key;
    // The host took everyone back to the lobby: leave the finished match. Only this
    // exact change clears the match, because a new match's first `match` message can
    // arrive before the phase patch that says "playing".
    const backInLobby = this.view.phase === "finished" && phase === "lobby";
    if (backInLobby) this.view.match?.dispose();
    this.setView({
      code: state.code || room.roomId,
      phase,
      levelId: state.levelId || FIRST_LEVEL_ID,
      players,
      isHost: state.hostId === room.sessionId,
      ...(backInLobby && { match: null }),
    });
  }
}
