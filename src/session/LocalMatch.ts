import type { ClientCommand } from "@/net/protocol";
import { StageManager } from "@/systems/StageManager";
import type { CommandResult, GameCommand } from "@/types/commands";
import type { LevelDefinition, PlayerState, SpawnPoint } from "@/types/game";
import type { GameEvent, MatchState, PlayerId, TrapState } from "@/types/state";

import type { MatchSource } from "./MatchSource";

/** The player on this device in single player. */
export const LOCAL_PLAYER = { id: "local", name: "You" } as const;

/** Single player: the match runs on this device, with one player. */
export class LocalMatch implements MatchSource {
  readonly online = false;
  readonly canPause = true;
  readonly localPlayerId: PlayerId = LOCAL_PLAYER.id;
  readonly stage: StageManager;

  constructor(readonly level: LevelDefinition) {
    this.stage = new StageManager(level);
    this.stage.addPlayer(LOCAL_PLAYER);
  }

  getState = (): MatchState => this.stage.getState();
  subscribe = (listener: () => void) => this.stage.subscribe(listener);
  onEvent = (listener: (event: GameEvent) => void) => this.stage.onEvent(listener);

  get isRunning() {
    return this.stage.isRunning;
  }

  getTrap(trapId: string): TrapState | undefined {
    return this.stage.getTrap(trapId);
  }

  spawnPoint(): SpawnPoint {
    return this.stage.spawnPointFor(this.localPlayerId);
  }

  frame(dt: number, body: PlayerState): SpawnPoint | null {
    return this.stage.update(dt, { [this.localPlayerId]: body.position }).respawns[this.localPlayerId] ?? null;
  }

  getRemoteBody(): PlayerState | undefined {
    return undefined; // nobody else here
  }

  dispatch(command: ClientCommand): Promise<CommandResult> {
    return Promise.resolve(this.stage.dispatch({ ...command, playerId: this.localPlayerId } as GameCommand));
  }

  pause() {
    this.stage.pause();
  }

  resume() {
    this.stage.resume();
  }
}
