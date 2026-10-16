import { Vector3 } from "three";

import type { Interactable, JoystickVector, Vec2 } from "@/types/game";

import { useGameFrame } from "./gameClock";
import type { InteractionSystem } from "./InteractionSystem";
import type { MovementController } from "./MovementController";
import type { PlayerInput } from "./PlayerInput";

// Reused every frame so the game loop allocates nothing.
const stick: JoystickVector = { x: 0, y: 0 };
const cameraForward: Vec2 = { x: 0, z: -1 };
const cameraDirection = new Vector3();

interface PlayerControllerProps {
  input: PlayerInput;
  movement: MovementController;
  interaction: InteractionSystem;
  /** Called only when the object in reach changes (not every frame). */
  onFocusChange?: (target: Interactable | null) => void;
  /** Called when USE is pressed while an object is in reach. */
  onInteract?: (target: Interactable) => void;
}

/**
 * Runs the player's game logic once per frame: reads touch input, works out
 * which way the camera faces, advances movement (with collision), and checks
 * what the player can interact with. Renders nothing.
 *
 * Must be mounted before <Player> and <CameraController> so that, within a
 * frame, the player moves first, then is drawn, then the camera catches up.
 */
export function PlayerController({
  input,
  movement,
  interaction,
  onFocusChange,
  onInteract,
}: PlayerControllerProps) {
  useGameFrame((state, delta) => {
    // Flatten the camera's view direction onto the floor for camera-relative movement.
    state.camera.getWorldDirection(cameraDirection);
    const flatLength = Math.hypot(cameraDirection.x, cameraDirection.z);
    if (flatLength > 0.001) {
      cameraForward.x = cameraDirection.x / flatLength;
      cameraForward.z = cameraDirection.z / flatLength;
    }

    movement.update(input.readMove(stick), cameraForward, delta);

    if (interaction.update(movement.state.position)) {
      onFocusChange?.(interaction.focused);
    }

    if (input.consumeInteract()) {
      movement.interact();
      const target = interaction.focused;
      if (target) onInteract?.(target);
    }
  });

  return null;
}
