import { useSyncExternalStore } from "react";

import type { MatchSource } from "@/session/MatchSource";

import { Player, playerColor } from "./Player";

/**
 * Draws every other active player in the match. The list re-renders only when
 * players join, leave, escape or are eliminated; their bodies move every frame
 * through objects the match source updates in place (never React state).
 * In single player there is nobody else, so this draws nothing.
 */
export function RemotePlayers({ source }: { source: MatchSource }) {
  const state = useSyncExternalStore(source.subscribe, source.getState);
  const others = state.playerOrder
    .map((id) => state.players[id])
    .filter((player) => player.id !== source.localPlayerId && player.status === "active");

  return (
    <>
      {others.map((player) => {
        const body = source.getRemoteBody(player.id);
        return body ? <Player key={player.id} state={body} color={playerColor(player.slot)} /> : null;
      })}
    </>
  );
}
