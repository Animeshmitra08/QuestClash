import type {
  Interactable,
  InventoryItem,
  LevelDefinition,
  PuzzleDefinition,
} from "@/types/game";

import { getPuzzle, isCorrectAnswer } from "./PuzzleSystem";

export type StageStatus = "playing" | "paused" | "completed";

/** A short message that pops up over the game for a moment. */
export interface Notice {
  /** Increases with every notice, so the UI can tell two identical texts apart. */
  id: number;
  text: string;
  tone: "info" | "success" | "danger";
}

/**
 * Everything about stage progress, as an immutable snapshot.
 * A new object is created on every change, which is what React needs to re-render.
 */
export interface StageSnapshot {
  status: StageStatus;
  inventory: readonly InventoryItem[];
  /** Pickups that have been removed from the world. */
  collectedIds: readonly string[];
  /** Inspectables the player has read (e.g. the clue). */
  inspectedIds: readonly string[];
  solvedPuzzleIds: readonly string[];
  openedDoorIds: readonly string[];
  trapHits: number;
  wrongAnswers: number;
  /**
   * Play time. While playing it is published in whole seconds only, so the HUD
   * re-renders once per second rather than every frame. Exact once completed.
   */
  elapsedSeconds: number;
  notice: Notice | null;
}

/** What the screen should show after the player uses something. */
export type InteractionResult =
  | { type: "none" }
  | { type: "message"; title: string; message: string }
  | { type: "puzzle"; puzzle: PuzzleDefinition };

const NOTICE_SECONDS = 2.5;

/**
 * Floor to whole seconds, tolerating floating-point drift: adding 1/60 sixty
 * times gives 0.99999…, which should still count as 1 second.
 */
export function wholeSeconds(seconds: number) {
  return Math.floor(seconds + 1e-6);
}

function createInitialSnapshot(): StageSnapshot {
  return {
    status: "playing",
    inventory: [],
    collectedIds: [],
    inspectedIds: [],
    solvedPuzzleIds: [],
    openedDoorIds: [],
    trapHits: 0,
    wrongAnswers: 0,
    elapsedSeconds: 0,
    notice: null,
  };
}

/**
 * What the player should do next, worked out from progress and the level's
 * door requirements. The order matches the intended route through the temple.
 */
export function currentObjective(level: LevelDefinition, snapshot: StageSnapshot): string {
  if (snapshot.status === "completed") return "Stage complete";

  const door = level.interactables.find((item) => item.kind === "door");
  if (!door || snapshot.openedDoorIds.includes(door.id)) {
    return "Cross the spikes and reach the exit";
  }

  const hasKey = snapshot.inventory.some((item) => item.id === door.requiredItemId);
  if (!hasKey) return "Find the key to the temple door";

  if (!snapshot.solvedPuzzleIds.includes(door.requiredPuzzleId)) {
    return snapshot.inspectedIds.length > 0
      ? "Set the sun dial to break the seal"
      : "Find a clue to the sun dial";
  }

  return "Open the temple door";
}

/**
 * The rules of the stage. Pure TypeScript: no React, no Three.js.
 *
 * The 3D scene reports what happened (USE pressed on X, trap touched, exit
 * reached); this class decides what that means and updates the snapshot. The
 * HUD and the scene both read the snapshot to show the result.
 */
export class StageManager {
  private snapshot: StageSnapshot = createInitialSnapshot();
  private readonly listeners = new Set<() => void>();
  private noticeCounter = 0;
  private noticeTimeLeft = 0;
  private elapsed = 0;

  constructor(private readonly level: LevelDefinition) {}

  // --- Subscription (shaped for React's useSyncExternalStore) ---------------

  getSnapshot = (): StageSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private update(changes: Partial<StageSnapshot>) {
    this.snapshot = { ...this.snapshot, ...changes };
    this.listeners.forEach((listener) => listener());
  }

  private notify(text: string, tone: Notice["tone"]): Pick<StageSnapshot, "notice"> {
    this.noticeTimeLeft = NOTICE_SECONDS;
    return { notice: { id: ++this.noticeCounter, text, tone } };
  }

  // --- Queries ---------------------------------------------------------------

  hasItem(itemId: string) {
    return this.snapshot.inventory.some((item) => item.id === itemId);
  }

  isPuzzleSolved(puzzleId: string) {
    return this.snapshot.solvedPuzzleIds.includes(puzzleId);
  }

  /** True while the game world should advance (not paused, not finished). */
  get isRunning() {
    return this.snapshot.status === "playing";
  }

  // --- Flow ------------------------------------------------------------------

  pause() {
    if (this.snapshot.status === "playing") this.update({ status: "paused" });
  }

  resume() {
    if (this.snapshot.status === "paused") this.update({ status: "playing" });
  }

  // --- Events reported by the game ------------------------------------------

  /** Advance the stage timer and notice expiry. Called every frame; does nothing while paused. */
  tick(delta: number) {
    if (!this.isRunning) return;

    const previousWholeSeconds = wholeSeconds(this.elapsed);
    this.elapsed += delta;
    const changes: Partial<StageSnapshot> = {};

    if (wholeSeconds(this.elapsed) !== previousWholeSeconds) {
      changes.elapsedSeconds = wholeSeconds(this.elapsed);
    }
    if (this.snapshot.notice) {
      this.noticeTimeLeft -= delta;
      if (this.noticeTimeLeft <= 0) changes.notice = null;
    }
    if (Object.keys(changes).length > 0) this.update(changes);
  }

  /** The player pressed USE on `target`. */
  interact(target: Interactable): InteractionResult {
    if (this.snapshot.status !== "playing") return { type: "none" };

    switch (target.kind) {
      case "inspect": {
        const { inspectedIds } = this.snapshot;
        if (!inspectedIds.includes(target.id)) {
          this.update({ inspectedIds: [...inspectedIds, target.id] });
        }
        return { type: "message", title: target.title, message: target.message };
      }

      case "pickup": {
        if (this.snapshot.collectedIds.includes(target.id)) return { type: "none" };
        this.update({
          collectedIds: [...this.snapshot.collectedIds, target.id],
          inventory: [...this.snapshot.inventory, target.item],
          ...this.notify(`You found the ${target.item.name}!`, "success"),
        });
        return { type: "none" };
      }

      case "puzzle": {
        if (this.isPuzzleSolved(target.puzzleId)) {
          return {
            type: "message",
            title: "The Sun Dial",
            message: "The dial is locked in place. Its seal is already broken.",
          };
        }
        return { type: "puzzle", puzzle: getPuzzle(this.level.puzzles, target.puzzleId) };
      }

      case "door": {
        if (this.snapshot.openedDoorIds.includes(target.id)) return { type: "none" };
        const hasKey = this.hasItem(target.requiredItemId);
        const sealBroken = this.isPuzzleSolved(target.requiredPuzzleId);

        if (!hasKey) {
          return {
            type: "message",
            title: "Locked Door",
            message: "A heavy stone door with a bronze keyhole. It won't move without a key.",
          };
        }
        if (!sealBroken) {
          return {
            type: "message",
            title: "Sealed Door",
            message:
              "The key turns, but an ancient seal still holds the door shut. The sun dial nearby might release it.",
          };
        }

        // Both conditions met: the key is used up and the door opens.
        this.update({
          openedDoorIds: [...this.snapshot.openedDoorIds, target.id],
          inventory: this.snapshot.inventory.filter((item) => item.id !== target.requiredItemId),
          ...this.notify("The door grinds open…", "success"),
        });
        return { type: "none" };
      }
    }
  }

  /** The player chose an answer in the puzzle dialog. Returns true if it was right. */
  answerPuzzle(puzzleId: string, optionIndex: number): boolean {
    if (this.snapshot.status !== "playing" || this.isPuzzleSolved(puzzleId)) return false;

    const puzzle = getPuzzle(this.level.puzzles, puzzleId);
    if (!isCorrectAnswer(puzzle, optionIndex)) {
      this.update({ wrongAnswers: this.snapshot.wrongAnswers + 1 });
      return false;
    }

    this.update({
      solvedPuzzleIds: [...this.snapshot.solvedPuzzleIds, puzzleId],
      ...this.notify("The seal of the suns breaks!", "success"),
    });
    return true;
  }

  /** The player stood on an active trap. The caller moves them to the checkpoint. */
  hitTrap() {
    if (this.snapshot.status !== "playing") return;
    this.update({
      trapHits: this.snapshot.trapHits + 1,
      ...this.notify("The spikes got you! Back to the checkpoint.", "danger"),
    });
  }

  /** The player stepped into the exit. */
  reachExit() {
    if (this.snapshot.status !== "playing") return;
    this.update({ status: "completed", elapsedSeconds: this.elapsed, notice: null });
  }
}
