import type { LevelDefinition, SpawnPointDefinition } from "@/types/game";
import type { DoorStatus, GameState } from "@/types/state";

import { INITIAL_PUZZLE_STATE } from "./PuzzleSystem";

/** A fresh run: every puzzle unsolved, every door locked, nothing collected. */
export function createInitialGameState(level: LevelDefinition): GameState {
  const doors: Record<string, DoorStatus> = {};
  for (const item of level.interactables) {
    if (item.kind === "door") doors[item.id] = "locked";
  }

  return {
    status: "playing",
    inventory: [],
    collectedPickupIds: [],
    inspectedIds: [],
    puzzles: Object.fromEntries(level.puzzles.map((p) => [p.id, INITIAL_PUZZLE_STATE])),
    doors,
    trapHits: 0,
    elapsedSeconds: 0,
    notice: null,
  };
}

/** Look up a spawn point. Throws for an unknown id, since validateLevel rules that out. */
export function getSpawnPoint(level: LevelDefinition, id: string): SpawnPointDefinition {
  const spawn = level.spawnPoints.find((point) => point.id === id);
  if (!spawn) throw new Error(`Unknown spawn point "${id}"`);
  return spawn;
}

// --- Selectors: read GameState without depending on its exact shape ---------------

export const isPickupCollected = (state: GameState, pickupId: string) =>
  state.collectedPickupIds.includes(pickupId);

export const isInspected = (state: GameState, interactableId: string) =>
  state.inspectedIds.includes(interactableId);

export const isPuzzleSolved = (state: GameState, puzzleId: string) =>
  state.puzzles[puzzleId]?.status === "solved";

export const isDoorOpen = (state: GameState, doorId: string) => state.doors[doorId] === "open";

export const countSolvedPuzzles = (state: GameState) =>
  Object.values(state.puzzles).filter((p) => p.status === "solved").length;

export const countOpenDoors = (state: GameState) =>
  Object.values(state.doors).filter((status) => status === "open").length;

export const countWrongAnswers = (state: GameState) =>
  Object.values(state.puzzles).reduce((total, p) => total + p.wrongAttempts, 0);
