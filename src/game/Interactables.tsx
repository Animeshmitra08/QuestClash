import { type RefObject, useRef } from "react";
import type { Group, Mesh, MeshStandardMaterial } from "three";

import type { StageManager } from "@/systems/StageManager";
import type {
  DoorInteractable,
  InspectInteractable,
  Interactable,
  PickupInteractable,
  PuzzleInteractable,
} from "@/types/game";

import { useGameFrame } from "./gameClock";
import type { InteractionSystem } from "./InteractionSystem";

const GOLD = "#f2c230";
const MARKER_HEIGHT = 2.1;
const MARKER_BOB = 0.12;
/** How quickly glows fade in/out when focus changes. */
const GLOW_SHARPNESS = 10;
const DOOR_OPEN_SECONDS = 1.5;

function smoothing(sharpness: number, delta: number) {
  return 1 - Math.exp(-sharpness * Math.min(delta, 0.1));
}

/** A 0 → 1 value that eases toward 1 while `id` is the focused object. */
function useFocusAmount(interaction: InteractionSystem, id: string) {
  const amount = useRef(0);
  useGameFrame((_, delta) => {
    const target = interaction.focused?.id === id ? 1 : 0;
    amount.current += (target - amount.current) * smoothing(GLOW_SHARPNESS, delta);
  });
  return amount;
}

/** Spinning gold diamond above an object, hinting that it can be used. */
function FloatingMarker({
  focus,
  isHidden,
}: {
  focus: RefObject<number>;
  isHidden?: () => boolean;
}) {
  const markerRef = useRef<Mesh>(null);
  const elapsed = useRef(0);

  useGameFrame((_, delta) => {
    const marker = markerRef.current;
    if (!marker) return;
    elapsed.current += delta;
    marker.visible = !isHidden?.();
    marker.position.y = MARKER_HEIGHT + Math.sin(elapsed.current * 2.5) * MARKER_BOB;
    marker.rotation.y = elapsed.current * 1.5;
    const scale = 1 + focus.current * 0.4;
    marker.scale.set(scale, scale, scale);
  });

  return (
    <mesh ref={markerRef} position={[0, MARKER_HEIGHT, 0]}>
      <octahedronGeometry args={[0.14]} />
      <meshBasicMaterial color={GOLD} />
    </mesh>
  );
}

interface ItemProps<T extends Interactable> {
  item: T;
  interaction: InteractionSystem;
  stage: StageManager;
}

/** Stone tablet with a glowing carving. */
function Tablet({ item, interaction }: ItemProps<InspectInteractable>) {
  const focus = useFocusAmount(interaction, item.id);
  const runeMaterialRef = useRef<MeshStandardMaterial>(null);

  useGameFrame(() => {
    if (runeMaterialRef.current) runeMaterialRef.current.emissiveIntensity = 0.25 + focus.current * 1.15;
  });

  return (
    <group position={[item.position.x, 0, item.position.z]} rotation={[0, item.facing, 0]}>
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[1.1, 0.2, 0.5]} />
        <meshStandardMaterial color="#8a7654" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.9, 0]}>
        <boxGeometry args={[0.95, 1.4, 0.3]} />
        <meshStandardMaterial color="#a8946c" roughness={0.9} />
      </mesh>
      {/* Carved face, on the side facing the room (local +z) */}
      <mesh position={[0, 0.95, 0.16]}>
        <planeGeometry args={[0.6, 0.9]} />
        <meshStandardMaterial ref={runeMaterialRef} color="#3a3020" emissive={GOLD} emissiveIntensity={0.25} />
      </mesh>
      <FloatingMarker focus={focus} />
    </group>
  );
}

/** A floating, spinning key. Disappears once collected. */
function KeyPickup({ item, interaction, stage }: ItemProps<PickupInteractable>) {
  const focus = useFocusAmount(interaction, item.id);
  const groupRef = useRef<Group>(null);
  const materialRef = useRef<MeshStandardMaterial>(null);
  const elapsed = useRef(0);

  useGameFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    group.visible = !stage.getSnapshot().collectedIds.includes(item.id);
    if (!group.visible) return;

    elapsed.current += delta;
    group.position.y = 0.8 + Math.sin(elapsed.current * 2.5) * 0.1;
    group.rotation.y = elapsed.current * 1.8;
    if (materialRef.current) materialRef.current.emissiveIntensity = 0.4 + focus.current * 1.2;
  });

  return (
    <group position={[item.position.x, 0, item.position.z]}>
      {/* Glow on the floor so the key is easy to spot from above. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.45, 24]} />
        <meshBasicMaterial color={GOLD} transparent opacity={0.25} depthWrite={false} />
      </mesh>
      <group ref={groupRef} position={[0, 0.8, 0]}>
        {/* Bow (ring), shaft and teeth */}
        <mesh position={[0, 0.2, 0]}>
          <torusGeometry args={[0.13, 0.045, 8, 20]} />
          <meshStandardMaterial ref={materialRef} color={GOLD} emissive={GOLD} emissiveIntensity={0.4} metalness={0.6} roughness={0.35} />
        </mesh>
        <mesh position={[0, -0.08, 0]}>
          <boxGeometry args={[0.06, 0.38, 0.06]} />
          <meshStandardMaterial color={GOLD} metalness={0.6} roughness={0.35} />
        </mesh>
        <mesh position={[0.07, -0.22, 0]}>
          <boxGeometry args={[0.1, 0.06, 0.06]} />
          <meshStandardMaterial color={GOLD} metalness={0.6} roughness={0.35} />
        </mesh>
      </group>
    </group>
  );
}

/** Pedestal with a sun disc. The disc lights up for good once the puzzle is solved. */
function SunDial({ item, interaction, stage }: ItemProps<PuzzleInteractable>) {
  const focus = useFocusAmount(interaction, item.id);
  const discMaterialRef = useRef<MeshStandardMaterial>(null);
  const isSolved = () => stage.getSnapshot().solvedPuzzleIds.includes(item.puzzleId);

  useGameFrame(() => {
    const disc = discMaterialRef.current;
    if (disc) disc.emissiveIntensity = isSolved() ? 1.6 : 0.2 + focus.current * 0.9;
  });

  return (
    <group position={[item.position.x, 0, item.position.z]} rotation={[0, item.facing, 0]}>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.3, 0.4, 1, 12]} />
        <meshStandardMaterial color="#8a7654" roughness={0.95} />
      </mesh>
      <mesh position={[0, 1.04, 0]}>
        <cylinderGeometry args={[0.45, 0.45, 0.08, 24]} />
        <meshStandardMaterial ref={discMaterialRef} color="#5a4a30" emissive={GOLD} emissiveIntensity={0.2} />
      </mesh>
      {/* Gnomon: the fin that casts the dial's shadow */}
      <mesh position={[0, 1.2, 0]}>
        <boxGeometry args={[0.04, 0.25, 0.3]} />
        <meshStandardMaterial color="#3a3020" />
      </mesh>
      <FloatingMarker focus={focus} isHidden={isSolved} />
    </group>
  );
}

/** Stone door with a sun emblem. Sinks into the floor once opened. */
function Door({ item, interaction, stage }: ItemProps<DoorInteractable>) {
  const focus = useFocusAmount(interaction, item.id);
  const panelRef = useRef<Group>(null);
  const emblemMaterialRef = useRef<MeshStandardMaterial>(null);
  const openProgress = useRef(0);
  const thickness = item.collider?.z ?? 0.6;

  useGameFrame((_, delta) => {
    const panel = panelRef.current;
    if (!panel) return;

    const isOpen = stage.getSnapshot().openedDoorIds.includes(item.id);
    if (isOpen && openProgress.current < 1) {
      openProgress.current = Math.min(openProgress.current + delta / DOOR_OPEN_SECONDS, 1);
    }
    // Ease out: fast at first, settling gently at the bottom.
    const eased = 1 - (1 - openProgress.current) ** 3;
    panel.position.y = -item.height * eased;
    panel.visible = openProgress.current < 1;

    if (emblemMaterialRef.current) {
      emblemMaterialRef.current.emissiveIntensity = 0.3 + focus.current * 1.0;
    }
  });

  return (
    <group position={[item.position.x, 0, item.position.z]} rotation={[0, item.facing, 0]}>
      <group ref={panelRef}>
        <mesh position={[0, item.height / 2, 0]}>
          <boxGeometry args={[item.width, item.height, thickness]} />
          <meshStandardMaterial color="#7d6a4a" roughness={0.85} />
        </mesh>
        {/* Sun emblem on the south face (local +z), toward the camera */}
        <mesh position={[0, item.height * 0.55, thickness / 2 + 0.01]}>
          <circleGeometry args={[0.38, 24]} />
          <meshStandardMaterial ref={emblemMaterialRef} color="#3a3020" emissive={GOLD} emissiveIntensity={0.3} />
        </mesh>
      </group>
    </group>
  );
}

interface InteractablesProps {
  items: Interactable[];
  interaction: InteractionSystem;
  stage: StageManager;
}

/** Draws every usable object in the level. Rendering only; behaviour lives in StageManager. */
export function Interactables({ items, interaction, stage }: InteractablesProps) {
  return (
    <group>
      {items.map((item) => {
        const shared = { interaction, stage };
        switch (item.kind) {
          case "inspect":
            return <Tablet key={item.id} item={item} {...shared} />;
          case "pickup":
            return <KeyPickup key={item.id} item={item} {...shared} />;
          case "puzzle":
            return <SunDial key={item.id} item={item} {...shared} />;
          case "door":
            return <Door key={item.id} item={item} {...shared} />;
        }
      })}
    </group>
  );
}
