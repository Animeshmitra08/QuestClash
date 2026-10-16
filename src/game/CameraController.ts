import { useRef } from "react";
import { Vector3 } from "three";

import type { Vec2 } from "@/types/game";

import { useGameFrame } from "./gameClock";

/**
 * Fixed-angle third-person camera: it sits behind and above the player
 * (toward +z / "south") and looks down at them. Keeping the angle fixed is what
 * makes the game read as 2.5D, and it keeps camera-relative movement simple.
 */
export const CAMERA_OFFSET = new Vector3(0, 11, 8);
export const CAMERA_FOV = 45;

/** Point the camera aims at, measured up from the player's feet (roughly chest height). */
const LOOK_AT_HEIGHT = 1;
/** How quickly the camera catches up with the player. Higher is snappier. */
const FOLLOW_SHARPNESS = 6;
/** Clamp long frames (e.g. after the app resumes) so the camera never overshoots. */
const MAX_FRAME_DELTA = 0.1;

// Reused every frame so the follow logic allocates nothing.
const lookAtPoint = new Vector3();

interface CameraControllerProps {
  /** Floor position to follow. Read every frame, so it can be a live, mutable object. */
  target: Vec2;
}

/**
 * Smoothly follows `target`. Renders nothing; it only moves the scene camera.
 * Mount it after the PlayerController so it follows this frame's position.
 */
export function CameraController({ target }: CameraControllerProps) {
  const focus = useRef<Vector3 | null>(null);

  useGameFrame((state, delta) => {
    if (!focus.current) {
      // First frame: snap to the player instead of gliding in from the origin.
      focus.current = new Vector3(target.x, 0, target.z);
    } else {
      // Frame-rate independent smoothing: same feel at 30, 60 or 120 fps.
      const t = 1 - Math.exp(-FOLLOW_SHARPNESS * Math.min(delta, MAX_FRAME_DELTA));
      focus.current.x += (target.x - focus.current.x) * t;
      focus.current.z += (target.z - focus.current.z) * t;
    }

    state.camera.position.copy(focus.current).add(CAMERA_OFFSET);
    lookAtPoint.copy(focus.current);
    lookAtPoint.y += LOOK_AT_HEIGHT;
    state.camera.lookAt(lookAtPoint);
  });

  return null;
}
