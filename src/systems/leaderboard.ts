import type { ScoringRules } from "@/types/game";
import type { MatchState, PlayerId, PlayerStatus } from "@/types/state";

import { calculatePlayerScore, DEFAULT_SCORING, type ScoreBreakdown } from "./ScoreSystem";

/** What one player did in a match, for the results screen. */
export interface PlayerStats {
  itemsFound: number;
  cluesRead: number;
  puzzlesSolved: number;
  doorsOpened: number;
  trapHits: number;
  wrongAnswers: number;
}

export interface LeaderboardEntry {
  id: PlayerId;
  name: string;
  slot: number;
  status: PlayerStatus;
  score: ScoreBreakdown;
  stats: PlayerStats;
  /** 1-based. Players with the same score and status share a rank. */
  rank: number;
}

/** Escaped players rank above those still in, then the eliminated, then those who left. */
const STATUS_ORDER: Record<PlayerStatus, number> = { escaped: 0, active: 1, eliminated: 2, left: 3 };

export function playerStats(state: MatchState, playerId: PlayerId): PlayerStats {
  const player = state.players[playerId];
  const { world } = state;
  const owned = (owners: readonly (PlayerId | null)[]) => owners.filter((owner) => owner === playerId).length;
  return {
    itemsFound: owned(Object.values(world.collectedPickups)),
    cluesRead: player?.inspectedIds.length ?? 0,
    puzzlesSolved: owned(Object.values(world.puzzles).map((puzzle) => puzzle.solvedBy)),
    doorsOpened: owned(Object.values(world.doors).map((door) => door.openedBy)),
    trapHits: player?.trapHits ?? 0,
    wrongAnswers: player?.wrongAnswers ?? 0,
  };
}

/**
 * Every player in the match, best first: by personal score, then status (escaped
 * first), then fewer trap hits, then join order. Uses the same personal score as
 * calculatePlayerScore, so the numbers match what each player earned.
 */
export function rankPlayers(state: MatchState, rules: ScoringRules = DEFAULT_SCORING): LeaderboardEntry[] {
  const entries = state.playerOrder
    .map((id, joinIndex) => {
      const player = state.players[id];
      if (!player) return null;
      return {
        joinIndex,
        entry: {
          id,
          name: player.name,
          slot: player.slot,
          status: player.status,
          score: calculatePlayerScore(state, id, rules),
          stats: playerStats(state, id),
          rank: 0,
        } satisfies LeaderboardEntry,
      };
    })
    .filter((item) => item !== null);

  entries.sort(
    (a, b) =>
      b.entry.score.total - a.entry.score.total ||
      STATUS_ORDER[a.entry.status] - STATUS_ORDER[b.entry.status] ||
      a.entry.stats.trapHits - b.entry.stats.trapHits ||
      a.joinIndex - b.joinIndex,
  );

  // Ties share the rank of the first player in the group ("1, 1, 3").
  let previous: LeaderboardEntry | null = null;
  return entries.map(({ entry }, index) => {
    const tied = previous !== null && previous.score.total === entry.score.total && previous.status === entry.status;
    entry.rank = tied && previous ? previous.rank : index + 1;
    previous = entry;
    return entry;
  });
}
