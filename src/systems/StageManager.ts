import type { Interactable, LevelDefinition, TriggerZone, Vec2 } from "@/types/game";
import type {
  FrameResult,
  GameEvent,
  GameState,
  InteractionResult,
  LevelEvent,
  LevelStatus,
  Notice,
  TrapState,
} from "@/types/state";

import { circleOverlapsRect } from "./CollisionSystem";
import { createInitialGameState, getSpawnPoint } from "./gameState";
import { runInteraction } from "./interactionRules";
import { validateLevel } from "./levelValidation";
import { isConditionMet } from "./ObjectiveSystem";
import { answerPuzzle, getPuzzle } from "./PuzzleSystem";
import { wholeSeconds } from "./ScoreSystem";
import { nextState, type TransitionTable } from "./stateMachine";
import { TrapSystem } from "./TrapSystem";

/**
 * playing --pause--> paused --resume--> playing
 * playing --complete--> completed (final)
 * playing --fail--> failed (final; e.g. time ran out)
 */
export const LEVEL_TRANSITIONS: TransitionTable<LevelStatus, LevelEvent> = {
  playing: { pause: "paused", complete: "completed", fail: "failed" },
  paused: { resume: "playing" },
  completed: {},
  failed: {},
};

const NOTICE_SECONDS = 2.5;
/**
 * How much of the player's body must touch a trigger. Smaller than the collision
 * radius so a toe brushing the spike strip doesn't count; that feels fairer.
 */
const TRIGGER_RADIUS = 0.25;
const NO_RESPAWN: FrameResult = { respawnAt: null };

type Listener<T> = (value: T) => void;

/**
 * Runs one attempt at a level. Pure TypeScript: no React, no Three.js.
 *
 * - The scene reports what happened (USE on an object, a frame of play at some
 *   position); StageManager applies the rules from the systems and stores the result.
 * - React reads `getState()` through `subscribe` (shaped for useSyncExternalStore).
 * - Listeners such as AudioManager receive GameEvents through `onEvent`.
 *
 * Per-frame values (trap heights) live in mutable TrapSystem objects, read by the
 * renderer through `getTrap`, so they never trigger React renders.
 */
export class StageManager {
  private state: GameState;
  private readonly stateListeners = new Set<() => void>();
  private readonly eventListeners = new Set<Listener<GameEvent>>();
  private readonly traps = new Map<string, TrapSystem>();
  private noticeCounter = 0;
  private noticeTimeLeft = 0;
  private elapsed = 0;
  /** Triggers the player stood in last frame, to tell "stepped in" from "still standing". */
  private triggersOccupied = new Set<string>();

  constructor(readonly level: LevelDefinition) {
    const problems = validateLevel(level);
    if (problems.length > 0) {
      throw new Error(`Level "${level.id}" is invalid:\n- ${problems.join("\n- ")}`);
    }
    this.state = createInitialGameState(level);
    for (const trigger of level.triggers) {
      if (trigger.kind === "trap") {
        this.traps.set(trigger.id, new TrapSystem(trigger.timing, trigger.startOffset));
      }
    }
  }

  // --- Subscriptions ----------------------------------------------------------

  getState = (): GameState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  };

  onEvent(listener: Listener<GameEvent>): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /** True while the game world should advance (not paused, not finished). */
  get isRunning() {
    return this.state.status === "playing";
  }

  /** Live trap state for the renderer. */
  getTrap(trapId: string): TrapState | undefined {
    return this.traps.get(trapId);
  }

  // --- Level flow (state machine) ---------------------------------------------

  pause() {
    if (this.transition("pause")) this.emit({ type: "levelPaused" });
  }

  resume() {
    if (this.transition("resume")) this.emit({ type: "levelResumed" });
  }

  // --- Events reported by the game -----------------------------------------------

  /**
   * One frame of play: timers, traps, and the trigger zones the player stands in.
   * Does nothing unless the level is running.
   */
  update(dt: number, playerPosition: Vec2): FrameResult {
    if (!this.isRunning) return NO_RESPAWN;

    this.tickTimers(dt);
    if (!this.isRunning) return NO_RESPAWN; // the time limit just ran out
    this.traps.forEach((trap) => trap.update(dt));

    const inside = new Set<string>();
    let result = NO_RESPAWN;
    for (const trigger of this.level.triggers) {
      if (!circleOverlapsRect(playerPosition, TRIGGER_RADIUS, trigger)) continue;
      inside.add(trigger.id);
      const outcome = this.inTrigger(trigger);
      if (outcome) {
        result = outcome;
        break;
      }
    }
    this.triggersOccupied = inside;
    return result;
  }

  /** The time limit in seconds, if the level has one. */
  get timeLimitSeconds(): number | null {
    return this.level.timeLimitSeconds ?? null;
  }

  /** The player pressed USE on `target`. */
  interact(target: Interactable): InteractionResult {
    if (!this.isRunning) return { type: "none" };
    const outcome = runInteraction(target, this.state, this.level);
    this.commit(outcome.state, outcome.events, outcome.notice);
    return outcome.result;
  }

  /** The player chose an answer in the puzzle dialog. Returns true if it was right. */
  answerPuzzle(puzzleId: string, optionIndex: number): boolean {
    if (!this.isRunning) return false;
    const puzzle = getPuzzle(this.level.puzzles, puzzleId);
    const current = this.state.puzzles[puzzleId];
    const outcome = answerPuzzle(puzzle, current, optionIndex);
    if (outcome.correct === null) return false;

    const state = { ...this.state, puzzles: { ...this.state.puzzles, [puzzleId]: outcome.state } };
    if (outcome.correct) {
      this.commit(state, [{ type: "puzzleSolved", puzzleId }], { text: puzzle.solvedNotice, tone: "success" });
    } else {
      this.commit(state, [{ type: "puzzleFailed", puzzleId }]);
    }
    return outcome.correct;
  }

  // --- Internals -------------------------------------------------------------

  /** The player is standing in `trigger` this frame. Returns a result to stop checking others. */
  private inTrigger(trigger: TriggerZone): FrameResult | null {
    switch (trigger.kind) {
      case "trap": {
        if (!this.traps.get(trigger.id)?.lethal) return null;
        this.commit(
          { ...this.state, trapHits: this.state.trapHits + 1 },
          [{ type: "trapHit", trapId: trigger.id }],
          { text: trigger.hitMessage, tone: "danger" },
        );
        return { respawnAt: getSpawnPoint(this.level, trigger.respawnPointId) };
      }
      case "exit": {
        if (trigger.requires && !isConditionMet(trigger.requires, this.state)) {
          // Say so once when the player steps in, not on every frame they stand there.
          if (!this.triggersOccupied.has(trigger.id)) {
            this.commit(
              this.state,
              [{ type: "exitLocked", exitId: trigger.id }],
              trigger.lockedMessage ? { text: trigger.lockedMessage, tone: "info" } : undefined,
            );
          }
          return null;
        }
        if (this.transition("complete", { elapsedSeconds: this.elapsed, notice: null })) {
          this.emit({ type: "levelCompleted", elapsedSeconds: this.elapsed });
        }
        return NO_RESPAWN;
      }
    }
  }

  /** Apply a level-flow event if it is allowed. Returns false (and changes nothing) if not. */
  private transition(event: LevelEvent, changes: Partial<GameState> = {}): boolean {
    const status = nextState(LEVEL_TRANSITIONS, this.state.status, event);
    if (status === null) return false;
    this.commit({ ...this.state, ...changes, status });
    return true;
  }

  private tickTimers(dt: number) {
    const previousSeconds = wholeSeconds(this.elapsed);
    this.elapsed += dt;
    const changes: Partial<GameState> = {};

    if (wholeSeconds(this.elapsed) !== previousSeconds) changes.elapsedSeconds = wholeSeconds(this.elapsed);
    if (this.state.notice) {
      this.noticeTimeLeft -= dt;
      if (this.noticeTimeLeft <= 0) changes.notice = null;
    }
    if (Object.keys(changes).length > 0) this.commit({ ...this.state, ...changes });

    const limit = this.level.timeLimitSeconds;
    if (limit !== undefined && this.elapsed >= limit) {
      if (this.transition("fail", { elapsedSeconds: limit, notice: null })) {
        this.emit({ type: "levelFailed", reason: "timeUp" });
      }
    }
  }

  /** Store a new state (if it changed), tell React, then tell event listeners. */
  private commit(next: GameState, events: GameEvent[] = [], notice?: { text: string; tone: Notice["tone"] }) {
    if (notice) {
      this.noticeTimeLeft = NOTICE_SECONDS;
      next = { ...next, notice: { id: ++this.noticeCounter, ...notice } };
    }
    if (next !== this.state) {
      this.state = next;
      this.stateListeners.forEach((listener) => listener());
    }
    events.forEach((event) => this.emit(event));
  }

  private emit(event: GameEvent) {
    this.eventListeners.forEach((listener) => listener(event));
  }
}
