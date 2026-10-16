import { useRef } from "react";
import type { Group, Mesh, MeshBasicMaterial } from "three";

import type { PlayerState } from "@/types/game";

import { useGameFrame } from "./gameClock";
import { PLAYER_RADIUS } from "./MovementController";

const BODY_LENGTH = 0.7;
const BODY_CENTER_Y = PLAYER_RADIUS + BODY_LENGTH / 2;
const HEAD_Y = PLAYER_RADIUS * 2 + BODY_LENGTH + 0.2;

// Placeholder animation tuning.
const WALK_CYCLES_PER_METRE = 0.9;
const WALK_BOB_HEIGHT = 0.09;
const WALK_LEAN = 0.14; // radians of forward lean at full speed
const IDLE_BREATH_SPEED = 2.2;
const IDLE_BREATH_AMOUNT = 0.02;
const INTERACT_PULSE_SECONDS = 0.35;

interface PlayerProps {
  /** Read every frame; never copied into React state. */
  state: PlayerState;
}

/**
 * Placeholder character built from primitives until a rigged GLB model is available.
 * The model faces local +z; the gold visor shows which way it is looking.
 *
 * Each frame it copies position and facing from `state` onto the 3D objects and
 * plays a procedural idle/walk animation. It never changes `state` itself.
 */
export function Player({ state }: PlayerProps) {
  const rootRef = useRef<Group>(null);
  const bodyRef = useRef<Group>(null);
  const pulseRef = useRef<Mesh>(null);
  const pulseMaterialRef = useRef<MeshBasicMaterial>(null);
  const walkPhase = useRef(0);

  useGameFrame((_, delta) => {
    const root = rootRef.current;
    const body = bodyRef.current;
    if (!root || !body) return;

    root.position.set(state.position.x, 0, state.position.z);
    root.rotation.y = state.facing;

    // Walk: bounce once per step and lean into the movement.
    // Idle: a slow "breathing" stretch so the character never looks frozen.
    const speed = Math.hypot(state.velocity.x, state.velocity.z);
    walkPhase.current += speed * WALK_CYCLES_PER_METRE * Math.PI * Math.min(delta, 0.1);
    const walk = state.moveAmount;
    const idle = 1 - walk;

    body.position.y = Math.abs(Math.sin(walkPhase.current)) * WALK_BOB_HEIGHT * walk;
    body.rotation.x = WALK_LEAN * walk;
    body.scale.y = 1 + Math.sin(state.time * IDLE_BREATH_SPEED) * IDLE_BREATH_AMOUNT * idle;

    // Interaction feedback: a ring that expands and fades at the player's feet.
    const pulse = pulseRef.current;
    const pulseMaterial = pulseMaterialRef.current;
    if (pulse && pulseMaterial) {
      const progress = (state.time - state.lastInteractTime) / INTERACT_PULSE_SECONDS;
      const active = progress >= 0 && progress < 1;
      pulse.visible = active;
      if (active) {
        const scale = 0.6 + progress * 1.4;
        pulse.scale.set(scale, scale, scale);
        pulseMaterial.opacity = 0.8 * (1 - progress);
      }
    }
  });

  return (
    <group ref={rootRef} position={[state.position.x, 0, state.position.z]} rotation={[0, state.facing, 0]}>
      {/* Fake "blob" shadow: much cheaper than real shadow maps on mobile GPUs. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[PLAYER_RADIUS * 1.2, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.35} depthWrite={false} />
      </mesh>

      <mesh ref={pulseRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} visible={false}>
        <ringGeometry args={[0.55, 0.7, 32]} />
        <meshBasicMaterial ref={pulseMaterialRef} color="#f2c230" transparent depthWrite={false} />
      </mesh>

      {/* Everything that bobs and leans while walking. */}
      <group ref={bodyRef}>
        <mesh position={[0, BODY_CENTER_Y, 0]}>
          <capsuleGeometry args={[PLAYER_RADIUS, BODY_LENGTH, 6, 16]} />
          <meshStandardMaterial color="#2f6fb3" roughness={0.6} />
        </mesh>

        <mesh position={[0, HEAD_Y, 0]}>
          <sphereGeometry args={[0.28, 16, 12]} />
          <meshStandardMaterial color="#e0b48a" roughness={0.7} />
        </mesh>

        <mesh position={[0, HEAD_Y, 0.22]}>
          <boxGeometry args={[0.32, 0.1, 0.12]} />
          <meshStandardMaterial color="#f2c230" roughness={0.3} metalness={0.4} />
        </mesh>
      </group>
    </group>
  );
}
