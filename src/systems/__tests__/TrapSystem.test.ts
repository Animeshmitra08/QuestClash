import { cycleLength, HIDDEN_HEIGHT, phaseAt, TrapSystem } from "@/systems/TrapSystem";
import type { TrapPhase, TrapTiming } from "@/types/game";

const TIMING: TrapTiming = { hidden: 1.8, warning: 0.5, rising: 0.1, armed: 0.9, retracting: 0.3 };
const FRAME = 1 / 60;

describe("TrapSystem", () => {
  it("runs through the phases in order", () => {
    expect(cycleLength(TIMING)).toBeCloseTo(3.6);
    expect(phaseAt(TIMING, 0).phase).toBe("hidden");
    expect(phaseAt(TIMING, 2.0).phase).toBe("warning");
    expect(phaseAt(TIMING, 2.35).phase).toBe("rising");
    expect(phaseAt(TIMING, 3.0).phase).toBe("armed");
    expect(phaseAt(TIMING, 3.5).phase).toBe("retracting");
  });

  it("is dangerous for about a third of each cycle, and never during the warning", () => {
    const trap = new TrapSystem(TIMING);
    const frames = Math.round((2 * cycleLength(TIMING)) / FRAME);
    let lethalFrames = 0;
    const seen = new Set<TrapPhase>();

    for (let i = 0; i < frames; i++) {
      trap.update(FRAME);
      seen.add(trap.phase);
      if (trap.lethal) lethalFrames++;
      if (trap.phase === "warning" || trap.phase === "hidden") expect(trap.lethal).toBe(false);
      if (trap.phase === "armed") expect(trap.lethal).toBe(true);
    }

    expect(lethalFrames / frames).toBeGreaterThan(0.25);
    expect(lethalFrames / frames).toBeLessThan(0.4);
    expect(seen.size).toBe(5);
  });

  it("hides the spikes below the floor and raises them to it", () => {
    const trap = new TrapSystem(TIMING);
    expect(trap.height).toBe(HIDDEN_HEIGHT);
    trap.update(3.0); // armed
    expect(trap.height).toBe(0);
  });

  it("can start part-way through the cycle to stagger several traps", () => {
    expect(new TrapSystem(TIMING, 3.0).phase).toBe("armed");
  });

  it("doesn't move when no time passes (paused)", () => {
    const trap = new TrapSystem(TIMING, 2.0);
    const before = { phase: trap.phase, height: trap.height };
    trap.update(0);
    expect({ phase: trap.phase, height: trap.height }).toEqual(before);
  });
});
