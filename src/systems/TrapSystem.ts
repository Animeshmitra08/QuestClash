/**
 * Timing for the spike trap. Pure logic: the renderer reads `height` to draw
 * the spikes, and the stage logic reads `lethal` to decide whether stepping
 * on the trap hurts.
 *
 * One cycle (3.6 s):
 *   hidden 1.8 s → warning 0.5 s (tips peek out, harmless)
 *   → rise 0.1 s → up 0.9 s → retract 0.3 s
 */
const HIDDEN_END = 1.8;
const WARNING_END = 2.3;
const RISE_END = 2.4;
const UP_END = 3.3;
const CYCLE = 3.6;

/** Spike offset from the floor: 0 = fully up, HIDDEN_HEIGHT = out of sight. */
export const HIDDEN_HEIGHT = -0.7;
const WARNING_HEIGHT = -0.45;
/** While retracting, spikes stop hurting once they sink below this. */
const LETHAL_HEIGHT = -0.25;

function lerp(from: number, to: number, t: number) {
  return from + (to - from) * t;
}

export class TrapSystem {
  private time = 0;
  /** Current spike offset from the floor (≤ 0). */
  height = HIDDEN_HEIGHT;
  /** True while the spikes are up far enough to hurt. */
  lethal = false;
  /** True during the harmless "about to fire" phase, for a shake effect. */
  warning = false;

  update(delta: number) {
    this.time = (this.time + delta) % CYCLE;
    const t = this.time;

    if (t < HIDDEN_END) {
      this.height = HIDDEN_HEIGHT;
    } else if (t < WARNING_END) {
      this.height = WARNING_HEIGHT;
    } else if (t < RISE_END) {
      this.height = lerp(WARNING_HEIGHT, 0, (t - WARNING_END) / (RISE_END - WARNING_END));
    } else if (t < UP_END) {
      this.height = 0;
    } else {
      this.height = lerp(0, HIDDEN_HEIGHT, (t - UP_END) / (CYCLE - UP_END));
    }

    this.warning = t >= HIDDEN_END && t < WARNING_END;
    this.lethal = t >= WARNING_END && this.height > LETHAL_HEIGHT;
  }
}
