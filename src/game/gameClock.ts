import { type RootState, useFrame } from "@react-three/fiber/native";
import { createContext, use } from "react";

/** Never advance more than this per frame (app resumed, debugger pause…), so nothing teleports. */
const MAX_FRAME_DELTA = 0.1;

/**
 * Decides how much game time passes each frame. While the stage is paused or
 * finished that is 0, so movement, traps, timers and animations all freeze
 * together, with no special pause handling in each component.
 */
export class GameClock {
  constructor(private readonly isRunning: () => boolean) {}

  step(rawDelta: number): number {
    return this.isRunning() ? Math.min(rawDelta, MAX_FRAME_DELTA) : 0;
  }
}

export const GameClockContext = createContext<GameClock | null>(null);

/**
 * Like R3F's useFrame, but the callback receives game time (`dt`), which is
 * 0 while paused. Use this for anything that should freeze with the game.
 */
export function useGameFrame(callback: (state: RootState, dt: number) => void) {
  const clock = use(GameClockContext);
  if (!clock) throw new Error("useGameFrame must be used inside <GameClockContext>");
  useFrame((state, delta) => callback(state, clock.step(delta)));
}
