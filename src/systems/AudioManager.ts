import type { GameEvent, GameEventType } from "@/types/state";

/** Every sound the game can ask for. Each needs a file once a real backend is plugged in. */
export type SoundId =
  | "pickup"
  | "doorOpen"
  | "doorLocked"
  | "puzzleOpen"
  | "puzzleSolved"
  | "puzzleWrong"
  | "trapHit"
  | "levelComplete"
  | "levelFailed"
  | "pause";

/**
 * Whatever actually plays audio. Kept as an interface so game code never imports an
 * audio library directly. The silent backend below needs no dependency; an
 * expo-audio backend can replace it later (see docs/ASSETS_AND_CONFIG.md).
 */
export interface SoundBackend {
  play(sound: SoundId): void;
  dispose?(): void;
}

export const silentBackend: SoundBackend = { play() {} };

/** Which sound each game event makes. Events not listed are silent. */
export const EVENT_SOUNDS: Partial<Record<GameEventType, SoundId>> = {
  itemCollected: "pickup",
  doorOpened: "doorOpen",
  doorBlocked: "doorLocked",
  puzzleOpened: "puzzleOpen",
  puzzleSolved: "puzzleSolved",
  puzzleFailed: "puzzleWrong",
  trapHit: "trapHit",
  exitLocked: "doorLocked",
  levelCompleted: "levelComplete",
  levelFailed: "levelFailed",
  levelPaused: "pause",
};

/** Anything that emits GameEvents (StageManager does). */
export interface GameEventSource {
  onEvent(listener: (event: GameEvent) => void): () => void;
}

/**
 * Turns game events into sounds. Game rules never call it directly: it listens
 * to StageManager's events, so adding or changing sounds never touches gameplay.
 */
export class AudioManager {
  private muted = false;

  constructor(private readonly backend: SoundBackend = silentBackend) {}

  /** Start playing sounds for `source`'s events. Returns a function that stops listening. */
  attach(source: GameEventSource): () => void {
    return source.onEvent((event) => {
      const sound = EVENT_SOUNDS[event.type];
      if (sound) this.play(sound);
    });
  }

  play(sound: SoundId) {
    if (!this.muted) this.backend.play(sound);
  }

  setMuted(muted: boolean) {
    this.muted = muted;
  }

  get isMuted() {
    return this.muted;
  }

  dispose() {
    this.backend.dispose?.();
  }
}
