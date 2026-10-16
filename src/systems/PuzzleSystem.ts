import type { PuzzleDefinition } from "@/types/game";

/** Look up a puzzle by id. Throws for an unknown id, since that is a level-data bug. */
export function getPuzzle(puzzles: readonly PuzzleDefinition[], id: string): PuzzleDefinition {
  const puzzle = puzzles.find((p) => p.id === id);
  if (!puzzle) throw new Error(`Unknown puzzle "${id}"`);
  return puzzle;
}

export function isCorrectAnswer(puzzle: PuzzleDefinition, optionIndex: number): boolean {
  return optionIndex === puzzle.correctOptionIndex;
}
