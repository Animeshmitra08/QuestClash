/**
 * Runtime state types: what has happened so far in a run.
 *
 * GameState is immutable: every change produces a new object, which is what
 * React needs to re-render the HUD. It only holds things that change at human
 * speed (pickups, doors, puzzles…). Per-frame data such as player position and
 * spike height lives in mutable objects outside React (see PlayerState, TrapState).
 */
import type { ItemDefinition, MessageContent, PuzzleDefinition, SpawnPoint, TrapPhase } from "./game";

export type { TrapPhase };

// --- State machines ------------------------------------------------------------

/** Level flow: playing ⇄ paused; playing → completed or failed (both final). */
export type LevelStatus = "playing" | "paused" | "completed" | "failed";
export type LevelEvent = "pause" | "resume" | "complete" | "fail";

/** unsolved → solved. Wrong answers stay unsolved but are counted. */
export type PuzzleStatus = "unsolved" | "solved";
export type PuzzleEvent = "answerCorrect" | "answerWrong";

export interface PuzzleState {
  status: PuzzleStatus;
  wrongAttempts: number;
}

/** locked → open. Opening needs every one of the door's requirements. */
export type DoorStatus = "locked" | "open";
export type DoorEvent = "unlock";

/** Why a locked door didn't open. */
export type DoorBlockReason = "missingItem" | "puzzleUnsolved";

/** Per-frame trap state, read by the renderer. Mutable; never React state. */
export interface TrapState {
  readonly phase: TrapPhase;
  /** Spike offset from the floor: 0 = fully up, negative = sunk below the floor. */
  readonly height: number;
  /** True while touching the trap hurts. */
  readonly lethal: boolean;
}

// --- Game state ----------------------------------------------------------------

/** A short message that pops up over the game for a moment. */
export interface Notice {
  /** Increases with every notice, so the UI can tell two identical texts apart. */
  id: number;
  text: string;
  tone: "info" | "success" | "danger";
}

export interface GameState {
  status: LevelStatus;
  inventory: readonly ItemDefinition[];
  /** Pickups removed from the world (stays true after the item is used up). */
  collectedPickupIds: readonly string[];
  /** Inspectables the player has read (e.g. the clue). */
  inspectedIds: readonly string[];
  puzzles: Readonly<Record<string, PuzzleState>>;
  doors: Readonly<Record<string, DoorStatus>>;
  trapHits: number;
  /**
   * Play time. While playing it is published in whole seconds only, so the HUD
   * re-renders once per second rather than every frame. Exact once completed.
   */
  elapsedSeconds: number;
  notice: Notice | null;
}

// --- Results and events ----------------------------------------------------------

/** What the screen should show after the player uses something. */
export type InteractionResult =
  | { type: "none" }
  | ({ type: "message" } & MessageContent)
  | { type: "puzzle"; puzzle: PuzzleDefinition };

/** What the scene must do after a frame of stage logic. */
export interface FrameResult {
  /** Move the player here (after a trap hit). */
  respawnAt: SpawnPoint | null;
}

/**
 * Something that happened, for listeners such as AudioManager. Events describe
 * facts; they don't change state. Add new ones freely: listeners ignore unknown types.
 */
export type GameEvent =
  | { type: "itemCollected"; item: ItemDefinition; pickupId: string }
  | { type: "itemUsed"; item: ItemDefinition }
  | { type: "inspected"; interactableId: string; firstTime: boolean }
  | { type: "puzzleOpened"; puzzleId: string }
  | { type: "puzzleSolved"; puzzleId: string }
  | { type: "puzzleFailed"; puzzleId: string }
  | { type: "doorOpened"; doorId: string }
  | { type: "doorBlocked"; doorId: string; reason: DoorBlockReason }
  | { type: "trapHit"; trapId: string }
  | { type: "exitLocked"; exitId: string }
  | { type: "levelPaused" }
  | { type: "levelResumed" }
  | { type: "levelCompleted"; elapsedSeconds: number }
  | { type: "levelFailed"; reason: "timeUp" };

export type GameEventType = GameEvent["type"];
