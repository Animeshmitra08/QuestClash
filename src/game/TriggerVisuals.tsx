import { useLayoutEffect, useRef } from "react";
import { Color, type Group, type InstancedMesh, type MeshStandardMaterial, Object3D } from "three";

import { isConditionMet } from "@/systems/ObjectiveSystem";
import type { StageManager } from "@/systems/StageManager";
import { HIDDEN_HEIGHT } from "@/systems/TrapSystem";
import type { ExitTrigger, TrapTrigger, TriggerZone } from "@/types/game";
import type { TrapState } from "@/types/state";

import { useGameFrame } from "./gameClock";

const SPIKE_SPACING = 0.6;
const SPIKE_HEIGHT = 0.6;
const SPIKE_RADIUS = 0.12;
const WARNING_SHAKE = 0.03;

/**
 * A field of spikes covering the trap zone. Drawn as one InstancedMesh, so ~90
 * spikes cost a single draw call. The whole field moves up and down together,
 * following the trap's live state; below the floor the spikes are simply hidden by it.
 */
function SpikeTrap({ zone, trap }: { zone: TrapTrigger; trap: TrapState }) {
  const columns = Math.floor(zone.size.x / SPIKE_SPACING);
  const rows = Math.floor(zone.size.z / SPIKE_SPACING);
  const count = columns * rows;

  const fieldRef = useRef<Group>(null);
  const spikesRef = useRef<InstancedMesh>(null);
  const elapsed = useRef(0);

  // Place every spike once. Their positions never change; only the parent group moves.
  useLayoutEffect(() => {
    const spikes = spikesRef.current;
    if (!spikes) return;
    const placer = new Object3D();
    const startX = -((columns - 1) * SPIKE_SPACING) / 2;
    const startZ = -((rows - 1) * SPIKE_SPACING) / 2;
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        // Offset every other row so the field looks less like a grid.
        const stagger = row % 2 === 0 ? 0 : SPIKE_SPACING / 2;
        placer.position.set(startX + column * SPIKE_SPACING + stagger, SPIKE_HEIGHT / 2, startZ + row * SPIKE_SPACING);
        placer.updateMatrix();
        spikes.setMatrixAt(row * columns + column, placer.matrix);
      }
    }
    spikes.instanceMatrix.needsUpdate = true;
    // Bounds must cover all spikes, not just one, or the field gets culled off-screen too early.
    spikes.computeBoundingSphere();
  }, [columns, rows]);

  useGameFrame((_, delta) => {
    const field = fieldRef.current;
    if (!field) return;
    elapsed.current += delta;
    field.position.y = trap.height;
    // A quick rattle warns the player just before the spikes shoot up.
    field.position.x = trap.phase === "warning" ? Math.sin(elapsed.current * 70) * WARNING_SHAKE : 0;
  });

  return (
    <group position={[zone.center.x, 0, zone.center.z]}>
      {/* Darker floor plate marking the danger zone, with a red edge. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[zone.size.x, zone.size.z]} />
        <meshStandardMaterial color="#3b2f26" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <planeGeometry args={[zone.size.x, zone.size.z + 0.3]} />
        <meshBasicMaterial color="#7a2a1a" />
      </mesh>

      <group ref={fieldRef} position={[0, HIDDEN_HEIGHT, 0]}>
        <instancedMesh ref={spikesRef} args={[undefined, undefined, count]}>
          <coneGeometry args={[SPIKE_RADIUS, SPIKE_HEIGHT, 6]} />
          <meshStandardMaterial color="#c9c3b8" metalness={0.7} roughness={0.3} />
        </instancedMesh>
      </group>
    </group>
  );
}

const PORTAL_OPEN = new Color("#3fe0b0");
const PORTAL_LOCKED = new Color("#4a5a7a");

/**
 * Stone archway with a portal against the north wall: glowing and pulsing when
 * the exit works, dim and still while its `requires` condition isn't met yet.
 */
function ExitPortal({ zone, stage }: { zone: ExitTrigger; stage: StageManager }) {
  const portalMaterialRef = useRef<MeshStandardMaterial>(null);
  const elapsed = useRef(0);
  const halfWidth = zone.size.x / 2;
  // Sit the arch at the back (north) edge of the exit zone.
  const backZ = -zone.size.z / 2;

  useGameFrame((_, delta) => {
    elapsed.current += delta;
    const portal = portalMaterialRef.current;
    if (!portal) return;
    const locked = zone.requires !== undefined && !isConditionMet(zone.requires, stage.getState());
    portal.emissive.copy(locked ? PORTAL_LOCKED : PORTAL_OPEN);
    portal.emissiveIntensity = locked ? 0.35 : 1.2 + Math.sin(elapsed.current * 2) * 0.4;
  });

  return (
    <group position={[zone.center.x, 0, zone.center.z]}>
      <mesh position={[-halfWidth - 0.25, 1.3, backZ]}>
        <boxGeometry args={[0.5, 2.6, 0.5]} />
        <meshStandardMaterial color="#9c8660" roughness={0.9} />
      </mesh>
      <mesh position={[halfWidth + 0.25, 1.3, backZ]}>
        <boxGeometry args={[0.5, 2.6, 0.5]} />
        <meshStandardMaterial color="#9c8660" roughness={0.9} />
      </mesh>
      <mesh position={[0, 2.8, backZ]}>
        <boxGeometry args={[zone.size.x + 1, 0.4, 0.5]} />
        <meshStandardMaterial color="#9c8660" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.3, backZ + 0.26]}>
        <planeGeometry args={[zone.size.x, 2.6]} />
        <meshStandardMaterial ref={portalMaterialRef} color="#0b2a24" emissive="#3fe0b0" emissiveIntensity={1.2} />
      </mesh>
      {/* Glow spilling onto the floor in front of the portal. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[zone.size.x, zone.size.z]} />
        <meshBasicMaterial color="#3fe0b0" transparent opacity={0.25} depthWrite={false} />
      </mesh>
    </group>
  );
}

interface TriggerVisualsProps {
  triggers: TriggerZone[];
  /** Source of each trap's live state. */
  stage: StageManager;
}

/** Draws the trap and exit zones. Rendering only; StageManager decides what they do. */
export function TriggerVisuals({ triggers, stage }: TriggerVisualsProps) {
  return (
    <group>
      {triggers.map((zone) => {
        switch (zone.kind) {
          case "trap": {
            const trap = stage.getTrap(zone.id);
            return trap ? <SpikeTrap key={zone.id} zone={zone} trap={trap} /> : null;
          }
          case "exit":
            return <ExitPortal key={zone.id} zone={zone} stage={stage} />;
        }
      })}
    </group>
  );
}
