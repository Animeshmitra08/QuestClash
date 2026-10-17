import type { LevelDefinition, ScoringRules } from "@/types/game";
import type { GameState } from "@/types/state";

import { countOpenDoors, countSolvedPuzzles, countWrongAnswers } from "./gameState";

/** Scoring used by every level unless its config overrides a value. */
export const DEFAULT_SCORING: ScoringRules = {
  itemFound: 100,
  clueRead: 50,
  puzzleSolved: 200,
  doorOpened: 100,
  exitReached: 500,
  perTrapHit: -50,
  perWrongAnswer: -25,
  parTimeSeconds: 180,
  timeBonusPerSecond: 5,
  starThresholds: [700, 1100, 1400],
};

/** The level's scoring: its overrides on top of the defaults. */
export function resolveScoring(level: LevelDefinition): ScoringRules {
  return { ...DEFAULT_SCORING, ...level.scoring };
}

export interface ScoreLine {
  label: string;
  points: number;
}

export interface ScoreBreakdown {
  lines: ScoreLine[];
  total: number;
  /** 0–3, from the level's star thresholds. Only meaningful once completed. */
  stars: number;
}

/**
 * Floor to whole seconds, tolerating floating-point drift: adding 1/60 sixty
 * times gives 0.99999…, which should still count as 1 second.
 */
export function wholeSeconds(seconds: number) {
  return Math.floor(seconds + 1e-6);
}

export function starsFor(total: number, rules: ScoringRules): number {
  return rules.starThresholds.filter((threshold) => total >= threshold).length;
}

/**
 * The score is calculated from progress instead of being stored, so it can
 * never disagree with what actually happened. The exit points and time bonus
 * only count once the level is completed.
 */
export function calculateScore(state: GameState, rules: ScoringRules = DEFAULT_SCORING): ScoreBreakdown {
  const lines: ScoreLine[] = [];
  const add = (label: string, points: number) => {
    if (points !== 0) lines.push({ label, points });
  };

  const wrongAnswers = countWrongAnswers(state);
  add("Items found", state.collectedPickupIds.length * rules.itemFound);
  add("Clues read", state.inspectedIds.length * rules.clueRead);
  add("Puzzles solved", countSolvedPuzzles(state) * rules.puzzleSolved);
  add("Doors opened", countOpenDoors(state) * rules.doorOpened);
  add(`Trap hits ×${state.trapHits}`, state.trapHits * rules.perTrapHit);
  add(`Wrong answers ×${wrongAnswers}`, wrongAnswers * rules.perWrongAnswer);

  if (state.status === "completed") {
    add("Level complete", rules.exitReached);
    const secondsUnderPar = Math.max(0, rules.parTimeSeconds - wholeSeconds(state.elapsedSeconds));
    add("Time bonus", secondsUnderPar * rules.timeBonusPerSecond);
  }

  const sum = lines.reduce((total, line) => total + line.points, 0);
  // Never show a negative score; that just feels bad.
  const total = Math.max(0, sum);
  return { lines, total, stars: state.status === "completed" ? starsFor(total, rules) : 0 };
}

/** 83.4 → "1:23" */
export function formatTime(seconds: number): string {
  const whole = Math.max(0, wholeSeconds(seconds));
  const minutes = Math.floor(whole / 60);
  return `${minutes}:${String(whole % 60).padStart(2, "0")}`;
}
