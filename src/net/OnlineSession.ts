import { Client, CloseCode, type Room } from "@colyseus/sdk";

import { FIRST_LEVEL_ID, LEVEL_CATALOG } from "@/levels/catalog";

import { OnlineMatch, type RoomLink } from "./OnlineMatch";
import {
  APP_ERROR_CODES,
  type ClientMessages,
  type CreateRoomOptions,
  type JoinRoomOptions,
  NET_ERRORS,
  type NetErrorCode,
  normalizeRoomCode,
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
  if (/not found|invalid room|no rooms/i.test(message) || code === 522) return NET_ERRORS.roomNotFound;
  return NET_ERRORS.serverUnreachable;
}

/**
 * The connection to the game server for one room: creating or joining by code,
 * the lobby (ready, level choice), matches, and reconnecting after a drop.
 * Plain TypeScript with no React Native imports, so the server's tests drive it
 * exactly as the app does.
 */
export class OnlineSession {
  private readonly client: Client;
  private room: SdkRoom | null = null;
  private view: SessionView = INITIAL_VIEW;
  private readonly listeners = new Set<() => void>();
  /** Last lobby fields published, to avoid re-rendering on every movement patch. */
  private lobbyKey = "";
  private onFirstSync: (() => void) | null = null;

  constructor(serverUrl: string) {
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
    const options: CreateRoomOptions = { name, levelId };
    return this.connect(() => this.client.create<SyncedRoomState>(ROOM_NAME, options) as Promise<SdkRoom>);
  }

  /** Join a friend's room by its code. */
  join(code: string, name: string): Promise<boolean> {
    const options: JoinRoomOptions = { name };
    return this.connect(() => this.client.joinById<SyncedRoomState>(normalizeRoomCode(code), options) as Promise<SdkRoom>);
  }

  private async connect(open: () => Promise<SdkRoom>): Promise<boolean> {
    if (this.room) return true;
    this.setView({ status: "connecting", error: null });
    try {
      const room = await open();
      const firstSync = new Promise<void>((resolve) => {
        this.onFirstSync = resolve;
        setTimeout(resolve, FIRST_SYNC_TIMEOUT_MS); // don't hang if the first patch is slow
      });
      this.attach(room);
      await firstSync; // so the lobby (players, code) is ready before we report success
      return true;
    } catch (error) {
      this.setView({ status: "idle", error: describeJoinError(error) });
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
    room.onMessage("error", (message: ServerMessages["error"]) =>
      this.setView({ error: NET_ERRORS[message.code as NetErrorCode] ?? message.message }),
    );

    room.onDrop(() => this.setView({ status: "reconnecting" }));
    room.onReconnect(() => this.setView({ status: "connected", error: null }));
    room.onLeave((code: number) => {
      if (this.room !== room) return; // we left on purpose; already handled
      this.view.match?.dispose();
      this.room = null;
      this.setView({
        status: "closed",
        error: code === CloseCode.CONSENTED ? null : NET_ERRORS.connectionLost,
      });
    });
    room.onError((_code: number, message?: string) => this.setView({ error: message ?? NET_ERRORS.connectionLost }));
  }

  private detach() {
    this.view.match?.dispose();
    this.room?.removeAllListeners();
    this.room = null;
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
      });
    });
    players.sort((a, b) => a.slot - b.slot);
    const phase = (state.phase || "lobby") as RoomPhase;
    if (players.length > 0) {
      this.onFirstSync?.();
      this.onFirstSync = null;
    }
    const key = JSON.stringify([state.code, phase, state.levelId, state.hostId, players]);
    if (key === this.lobbyKey) return;
    this.lobbyKey = key;
    this.setView({
      code: state.code || room.roomId,
      phase,
      levelId: state.levelId || FIRST_LEVEL_ID,
      players,
      isHost: state.hostId === room.sessionId,
      // `match` is deliberately not touched here: the first `match` message can arrive
      // before the phase patch, and a room never goes back to the lobby.
    });
  }
}
