import type { BlockKind, LevelBlock, LevelDefinition } from "@/types/game";

const BLOCK_COLORS: Record<BlockKind, string> = {
  wall: "#b39b72",
  pillar: "#9c8660",
  crate: "#7a5230",
};

const FLOOR_COLOR = "#6e6253";

function Block({ block }: { block: LevelBlock }) {
  return (
    <mesh position={[block.center.x, block.height / 2, block.center.z]}>
      <boxGeometry args={[block.size.x, block.height, block.size.z]} />
      <meshStandardMaterial color={BLOCK_COLORS[block.kind]} roughness={0.9} />
    </mesh>
  );
}

/** Draws the floor and every solid block of a level. Rendering only — no game rules. */
export function Room({ level }: { level: LevelDefinition }) {
  return (
    <group>
      {/* PlaneGeometry is vertical by default; rotate it to lie flat on the floor. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[level.floorSize.x, level.floorSize.z]} />
        <meshStandardMaterial color={FLOOR_COLOR} roughness={1} />
      </mesh>

      {level.blocks.map((block) => (
        <Block key={block.id} block={block} />
      ))}
    </group>
  );
}
