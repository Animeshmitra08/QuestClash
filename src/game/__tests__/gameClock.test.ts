import { GameClock } from "@/game/gameClock";

// gameClock imports useFrame; the real renderer isn't needed to test the clock itself.
jest.mock("@react-three/fiber/native", () => ({ useFrame: jest.fn() }));

describe("GameClock", () => {
  it("passes frame time through while running, capped for long frames", () => {
    const clock = new GameClock(() => true);
    expect(clock.step(1 / 60)).toBeCloseTo(1 / 60);
    expect(clock.step(5)).toBe(0.1);
  });

  it("stops time while paused or finished", () => {
    let running = true;
    const clock = new GameClock(() => running);
    running = false;
    expect(clock.step(1 / 60)).toBe(0);
  });
});
