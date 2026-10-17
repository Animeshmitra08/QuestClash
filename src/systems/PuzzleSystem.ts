import type { PuzzleDefinition } from "@/types/game";
import type { PuzzleEvent, PuzzleState, PuzzleStatus } from "@/types/state";

import { nextState, type TransitionTable } from "./stateMachine";

/**
 * unsolved --answerCorrect--> solved
 * unsolved --answerWrong--> unsolved (attempt counted)
 * A solved puzzle accepts no further answers.
 */
export const PUZZLE_TRANSITIONS: TransitionTable<PuzzleStatus, PuzzleEvent> = {
  unsolved: { answerCorrect: "solved", answerWrong: "unsolved" },
  solved: {},
};

export const INITIAL_PUZZLE_STATE: PuzzleState = { status: "unsolved", wrongAttempts: 0 };

/** Look up a puzzle by id. Throws for an unknown id, since that is a level-data bug. */
export function getPuzzle(puzzles: readonly PuzzleDefinition[], id: string): PuzzleDefinition {
  const puzzle = puzzles.find((p) => p.id === id);
  if (!puzzle) throw new Error(`Unknown puzzle "${id}"`);
  return puzzle;
}

export function isCorrectAnswer(puzzle: PuzzleDefinition, optionIndex: number): boolean {
  return optionIndex === puzzle.correctOptionIndex;
}

export interface AnswerOutcome {
  state: PuzzleState;
  /** null when the answer wasn't accepted at all (puzzle already solved). */
  correct: boolean | null;
}

/** Apply an answer. Pure: returns the new puzzle state. */
export function answerPuzzle(
  puzzle: PuzzleDefinition,
  state: PuzzleState,
  optionIndex: number,
): AnswerOutcome {
  const correct = isCorrectAnswer(puzzle, optionIndex);
  const status = nextState(PUZZLE_TRANSITIONS, state.status, correct ? "answerCorrect" : "answerWrong");
  if (status === null) return { state, correct: null };

  return {
    state: { status, wrongAttempts: state.wrongAttempts + (correct ? 0 : 1) },
    correct,
  };
}
