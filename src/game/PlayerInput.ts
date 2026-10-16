import type { JoystickVector } from "@/types/game";

/**
 * The bridge between the touch controls (React Native views) and the game loop
 * (inside the 3D canvas).
 *
 * Controls write to it as touches happen; the game loop reads it once per frame.
 * It is a plain mutable object rather than React state on purpose: joystick
 * updates arrive dozens of times per second, and routing them through React
 * would re-render the HUD and scene on every touch move.
 */
export class PlayerInput {
  private moveX = 0;
  private moveY = 0;
  private interactRequested = false;
  private locked = false;

  /**
   * While locked (e.g. a dialog is open) all input is ignored, even from a
   * finger that was already holding the joystick when the dialog appeared.
   */
  setLocked(locked: boolean) {
    this.locked = locked;
    if (locked) this.reset();
  }

  /** Set the stick deflection. Values are clamped to the unit circle. */
  setMove(x: number, y: number) {
    if (this.locked) return;
    const length = Math.hypot(x, y);
    const scale = length > 1 ? 1 / length : 1;
    this.moveX = x * scale;
    this.moveY = y * scale;
  }

  clearMove() {
    this.moveX = 0;
    this.moveY = 0;
  }

  /** Copy the current stick deflection into `out` (avoids allocating every frame). */
  readMove(out: JoystickVector): JoystickVector {
    out.x = this.moveX;
    out.y = this.moveY;
    return out;
  }

  /** Called when the interaction button is pressed. */
  requestInteract() {
    if (this.locked) return;
    this.interactRequested = true;
  }

  /**
   * Returns true once per button press. The game loop calls this every frame;
   * a press is "used up" when read, so one tap never triggers two interactions.
   */
  consumeInteract(): boolean {
    const requested = this.interactRequested;
    this.interactRequested = false;
    return requested;
  }

  reset() {
    this.clearMove();
    this.interactRequested = false;
  }
}
