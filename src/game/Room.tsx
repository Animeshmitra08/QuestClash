import { useLoader } from "@react-three/fiber/native";
import { type ReactNode, Suspense, useEffect, useMemo } from "react";
import { RepeatWrapping, SRGBColorSpace, TextureLoader } from "three";

import { findAsset } from "@/levels/assets";
import type { LevelBlock, LevelDefinition, LevelTheme } from "@/types/game";

import { AssetBoundary } from "./AssetBoundary";

/** World units covered by one copy of a floor texture (the cloister tile shows 4×4 flagstones). */
const FLOOR_TEXTURE_WORLD_SIZE = 6;

function Block({ block, theme }: { block: LevelBlock; theme: LevelTheme }) {
  return (
    <mesh position={[block.center.x, block.height / 2, block.center.z]}>
      <boxGeometry args={[block.size.x, block.height, block.size.z]} />
      <meshStandardMaterial color={theme.blockColors[block.kind]} roughness={0.9} />
    </mesh>
  );
}

function FloorMesh({ level, children }: { level: LevelDefinition; children: ReactNode }) {
  return (
    // PlaneGeometry is vertical by default; rotate it to lie flat on the floor.
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[level.floorSize.x, level.floorSize.z]} />
      {children}
    </mesh>
  );
}

function PlainFloor({ level }: { level: LevelDefinition }) {
  return (
    <FloorMesh level={level}>
      <meshStandardMaterial color={level.theme.floorColor} roughness={1} />
    </FloorMesh>
  );
}

/** Floor with a tiled texture. Suspends while loading; must be inside <Suspense>. */
function TexturedFloor({ level, source }: { level: LevelDefinition; source: string }) {
  const loaded = useLoader(TextureLoader, source);

  // Configure a copy: loaded textures are cached and shared, and hook results mustn't be changed.
  const texture = useMemo(() => {
    const copy = loaded.clone();
    copy.colorSpace = SRGBColorSpace;
    copy.wrapS = copy.wrapT = RepeatWrapping;
    copy.repeat.set(level.floorSize.x / FLOOR_TEXTURE_WORLD_SIZE, level.floorSize.z / FLOOR_TEXTURE_WORLD_SIZE);
    copy.needsUpdate = true;
    return copy;
  }, [loaded, level.floorSize.x, level.floorSize.z]);

  // Leaving the level frees the texture: the GPU copy, and R3F's loader cache entry.
  useEffect(
    () => () => {
      texture.dispose();
      useLoader.clear(TextureLoader, source);
    },
    [texture, source],
  );

  return (
    <FloorMesh level={level}>
      <meshStandardMaterial map={texture} roughness={1} />
    </FloorMesh>
  );
}

function Floor({ level }: { level: LevelDefinition }) {
  const key = level.assets?.floorTexture;
  const asset = key ? findAsset(key, "texture") : undefined;
  const plain = <PlainFloor level={level} />;
  if (!key || !asset) return plain;

  // Metro gives an asset id (a number); R3F native resolves it, but its types expect a URL string.
  const source = asset.source() as unknown as string;
  return (
    // While loading, and if loading fails, the plain floor is shown; the level stays playable.
    <AssetBoundary assetName={key} fallback={plain}>
      <Suspense fallback={plain}>
        <TexturedFloor level={level} source={source} />
      </Suspense>
    </AssetBoundary>
  );
}

/** Draws the floor and every solid block of a level, in the level's theme. Rendering only. */
export function Room({ level }: { level: LevelDefinition }) {
  return (
    <group>
      <Floor level={level} />
      {level.blocks.map((block) => (
        <Block key={block.id} block={block} theme={level.theme} />
      ))}
    </group>
  );
}
