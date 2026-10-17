import type { LevelDefinition, ObjectiveCondition, ObjectiveDefinition } from "@/types/game";
import type { GameState } from "@/types/state";

import { isDoorOpen, isInspected, isPickupCollected, isPuzzleSolved } from "./gameState";

export function isConditionMet(condition: ObjectiveCondition, state: GameState): boolean {
  switch (condition.kind) {
    case "pickupCollected":
      return isPickupCollected(state, condition.pickupId);
    case "inspected":
      return isInspected(state, condition.interactableId);
    case "puzzleSolved":
      return isPuzzleSolved(state, condition.puzzleId);
    case "doorOpened":
      return isDoorOpen(state, condition.doorId);
    case "levelCompleted":
      return state.status === "completed";
    case "any":
      return condition.of.some((inner) => isConditionMet(inner, state));
  }
}

export interface ObjectiveProgress {
  /** The first objective not yet done, or null once all are done. */
  current: ObjectiveDefinition | null;
  completed: number;
  total: number;
}

/**
 * The objective to show is the first one, in level order, that isn't done.
 * Objectives are data in the level, so a new level brings its own list
 * without any change here or in the HUD.
 */
export function getObjectiveProgress(level: LevelDefinition, state: GameState): ObjectiveProgress {
  const done = level.objectives.map((objective) => isConditionMet(objective.completeWhen, state));
  const currentIndex = done.indexOf(false);
  return {
    current: currentIndex === -1 ? null : level.objectives[currentIndex],
    completed: done.filter(Boolean).length,
    total: level.objectives.length,
  };
}
