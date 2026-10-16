import { type StageSnapshot, wholeSeconds } from "./StageManager";

/** Points for each milestone. Tuning lives here, in one place. */
export const SCORE_RULES = {
  keyFound: 100,
  clueRead: 50,
  puzzleSolved: 200,
  doorOpened: 100,
  exitReached: 500,
  perTrapHit: -50,
  perWrongAnswer: -25,
  /** Finishing faster than this earns a bonus; slower earns none. */
  parTimeSeconds: 180,
  timeBonusPerSecond: 5,
} as const;

export interface ScoreLine {
  label: string;
  points: number;
}

export interface ScoreBreakdown {
  lines: ScoreLine[];
  total: number;
}

/**
 * The score is calculated from progress instead of being stored, so it can
 * never disagree with what actually happened. Pure function: easy to test.
 *
 * The time bonus only counts once the stage is completed.
 */
export function calculateScore(snapshot: StageSnapshot): ScoreBreakdown {
  const lines: ScoreLine[] = [];
  const add = (label: string, points: number) => {
    if (points !== 0) lines.push({ label, points });
  };

  add("Key found", snapshot.collectedIds.length * SCORE_RULES.keyFound);
  add("Clue read", snapshot.inspectedIds.length * SCORE_RULES.clueRead);
  add("Puzzle solved", snapshot.solvedPuzzleIds.length * SCORE_RULES.puzzleSolved);
  add("Door opened", snapshot.openedDoorIds.length * SCORE_RULES.doorOpened);
  add(`Trap hits ×${snapshot.trapHits}`, snapshot.trapHits * SCORE_RULES.perTrapHit);
  add(`Wrong answers ×${snapshot.wrongAnswers}`, snapshot.wrongAnswers * SCORE_RULES.perWrongAnswer);

  if (snapshot.status === "completed") {
    add("Escaped the temple", SCORE_RULES.exitReached);
    const secondsUnderPar = Math.max(0, SCORE_RULES.parTimeSeconds - wholeSeconds(snapshot.elapsedSeconds));
    add("Time bonus", secondsUnderPar * SCORE_RULES.timeBonusPerSecond);
  }

  const sum = lines.reduce((total, line) => total + line.points, 0);
  // Never show a negative score; that just feels bad.
  return { lines, total: Math.max(0, sum) };
}

/** 83.4 → "1:23" */
export function formatTime(seconds: number): string {
  const whole = wholeSeconds(seconds);
  const minutes = Math.floor(whole / 60);
  return `${minutes}:${String(whole % 60).padStart(2, "0")}`;
}
