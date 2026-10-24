import { useFrame } from "@react-three/fiber/native";
import { type ReactNode, useLayoutEffect, useMemo, useRef } from "react";
import { type InstancedMesh, Matrix4 } from "three";

import type { LevelBlock, LevelTheme, Vec2 } from "@/types/game";

import { buildForest, inFadeZone, PART_NAMES, type PartInstance, type PartName } from "./forestModels";

const FADED_OPACITY = 0.25;

/**
 * Every model is made of a few shared shapes ("parts", see forestModels.ts). Each part is
 * drawn as two InstancedMeshes, normal and faded, so a whole forest costs a handful of draw calls.
 */
const PART_GEOMETRY: Record<PartName, () => ReactNode> = {
  trunk: () => <cylinderGeometry args={[0.75, 1, 1, 6]} />,
  leaves: () => <icosahedronGeometry args={[1, 1]} />,
  needles: () => <coneGeometry args={[1, 1, 7]} />,
  stone: () => <dodecahedronGeometry args={[1, 0]} />,
  shrub: () => <icosahedronGeometry args={[1, 0]} />,
  logWood: () => <cylinderGeometry args={[1, 1, 1, 8]} />,
  stumpWood: () => <cylinderGeometry args={[0.85, 1, 1, 8]} />,
};

const HIDDEN = new Matrix4().makeScale(0, 0, 0);

/** One part (e.g. every trunk in the level): a normal mesh, and a see-through one for what's in the way. */
function PartMeshes({ part, instances, focus }: { part: PartName; instances: PartInstance[]; focus: Vec2 }) {
  const solidRef = useRef<InstancedMesh>(null);
  const fadedRef = useRef<InstancedMesh>(null);
  /** Which instances are currently faded. */
  const faded = useRef<boolean[]>([]);

  // Place every instance once. After this, only instances moving between the two meshes change.
  useLayoutEffect(() => {
    const solid = solidRef.current;
    const ghost = fadedRef.current;
    if (!solid || !ghost) return;
    instances.forEach((instance, index) => {
      solid.setMatrixAt(index, instance.matrix);
      solid.setColorAt(index, instance.color);
      // Colours must exist before the first draw, or the material is built without them.
      ghost.setColorAt(index, instance.color);
    });
    solid.instanceMatrix.needsUpdate = true;
    if (solid.instanceColor) solid.instanceColor.needsUpdate = true;
    if (ghost.instanceColor) ghost.instanceColor.needsUpdate = true;
    // Bounds must cover every instance, not just one, or parts get culled while on screen.
    solid.computeBoundingSphere();
    ghost.count = 0;
    faded.current = instances.map(() => false);
  }, [instances]);

  useFrame(() => {
    const solid = solidRef.current;
    const ghost = fadedRef.current;
    if (!solid || !ghost) return;

    let changed = false;
    for (let index = 0; index < instances.length; index++) {
      const fade = inFadeZone(instances[index], focus);
      if (fade !== faded.current[index]) {
        faded.current[index] = fade;
        changed = true;
      }
    }
    if (!changed) return;

    // Move faded instances out of the solid mesh (scaled to nothing) and into the see-through one.
    let ghostCount = 0;
    for (let index = 0; index < instances.length; index++) {
      const instance = instances[index];
      if (faded.current[index]) {
        solid.setMatrixAt(index, HIDDEN);
        ghost.setMatrixAt(ghostCount, instance.matrix);
        ghost.setColorAt(ghostCount, instance.color);
        ghostCount++;
      } else {
        solid.setMatrixAt(index, instance.matrix);
      }
    }
    ghost.count = ghostCount;
    solid.instanceMatrix.needsUpdate = true;
    ghost.instanceMatrix.needsUpdate = true;
    if (ghost.instanceColor) ghost.instanceColor.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={solidRef} args={[undefined, undefined, instances.length]}>
        {PART_GEOMETRY[part]()}
        <meshStandardMaterial flatShading roughness={0.95} />
      </instancedMesh>
      {/* Few instances, always near the player: not worth culling. */}
      <instancedMesh ref={fadedRef} args={[undefined, undefined, instances.length]} frustumCulled={false}>
        {PART_GEOMETRY[part]()}
        <meshStandardMaterial flatShading roughness={0.95} transparent opacity={FADED_OPACITY} depthWrite={false} />
      </instancedMesh>
    </>
  );
}

interface ForestProps {
  blocks: LevelBlock[];
  theme: LevelTheme;
  /** The local player's floor position, read every frame: what's in front of it fades. */
  focus: Vec2;
}

/** Trees, pines, rocks, bushes, logs, stumps and treelines, as low-poly models. Rendering only. */
export function Forest({ blocks, theme, focus }: ForestProps) {
  const parts = useMemo(() => buildForest(blocks, theme), [blocks, theme]);
  return (
    <group>
      {PART_NAMES.map((part) =>
        parts[part].length > 0 ? <PartMeshes key={part} part={part} instances={parts[part]} focus={focus} /> : null,
      )}
    </group>
  );
}
