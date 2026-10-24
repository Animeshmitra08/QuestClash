import { useLoader } from "@react-three/fiber/native";
import { type ReactNode, Suspense, useEffect, useMemo } from "react";
import { BufferAttribute, Color, PlaneGeometry, RepeatWrapping, SRGBColorSpace, TextureLoader } from "three";

import { findAsset } from "@/levels/assets";
import type { LevelBlock, LevelDefinition, LevelTheme, Vec2 } from "@/types/game";

import { AssetBoundary } from "./AssetBoundary";
import { Forest } from "./Forest";
import { NATURE_KINDS } from "./forestModels";

/** World units covered by one copy of a floor texture (the cloister tile shows 4×4 flagstones). */
const FLOOR_TEXTURE_WORLD_SIZE = 6;

/** Used when a level's theme doesn't give a colour for a box kind. */
const DEFAULT_BOX_COLOR = "#9c8660";

/** Floor accent patches: about this many world units across, plus finer detail. */
const PATCH_SIZE = 9;
const DETAIL_SIZE = 3.5;
/** Floor mesh resolution for the accent pattern: one vertex every this many units. */
const FLOOR_VERTEX_SPACING = 1;

function Block({ block, theme }: { block: LevelBlock; theme: LevelTheme }) {
  return (
    <mesh position={[block.center.x, block.height / 2, block.center.z]}>
      <boxGeometry args={[block.size.x, block.height, block.size.z]} />
      <meshStandardMaterial color={theme.blockColors[block.kind] ?? DEFAULT_BOX_COLOR} roughness={0.9} />
    </mesh>
  );
}

/** Smooth noise in 0..1, the same everywhere (no randomness between devices or runs). */
function valueNoise(x: number, z: number) {
  const hash = (ix: number, iz: number) => {
    const n = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453;
    return n - Math.floor(n);
  };
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const top = hash(ix, iz) + (hash(ix + 1, iz) - hash(ix, iz)) * sx;
  const bottom = hash(ix, iz + 1) + (hash(ix + 1, iz + 1) - hash(ix, iz + 1)) * sx;
  return top + (bottom - top) * sz;
}

/** Plain floor colour with soft patches of the accent colour (e.g. grass with bare earth). */
function PatchyFloor({ level, accent }: { level: LevelDefinition; accent: string }) {
  const geometry = useMemo(() => {
    const { x: width, z: depth } = level.floorSize;
    const plane = new PlaneGeometry(
      width,
      depth,
      Math.ceil(width / FLOOR_VERTEX_SPACING),
      Math.ceil(depth / FLOOR_VERTEX_SPACING),
    );
    const base = new Color(level.theme.floorColor);
    const patch = new Color(accent);
    const mixed = new Color();
    const positions = plane.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getY(i);
      const amount = valueNoise(x / PATCH_SIZE, z / PATCH_SIZE) * 0.75 + valueNoise(x / DETAIL_SIZE, z / DETAIL_SIZE) * 0.25;
      // Mostly base colour, with distinct patches where the noise is high.
      const t = Math.min(Math.max((amount - 0.45) / 0.35, 0), 1);
      mixed.copy(base).lerp(patch, t * t * (3 - 2 * t));
      mixed.toArray(colors, i * 3);
    }
    plane.setAttribute("color", new BufferAttribute(colors, 3));
    return plane;
  }, [level.floorSize, level.theme.floorColor, accent]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} geometry={geometry}>
      <meshStandardMaterial vertexColors roughness={1} />
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
  const accent = level.theme.floorAccent;
  const plain = accent ? <PatchyFloor level={level} accent={accent} /> : <PlainFloor level={level} />;
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

/**
 * Draws the floor and every solid block of a level, in the level's theme. Rendering only.
 * `focus` is the local player's position: trees in front of it fade so they never hide the player.
 */
export function Room({ level, focus }: { level: LevelDefinition; focus: Vec2 }) {
  return (
    <group>
      <Floor level={level} />
      {level.blocks.map((block) =>
        NATURE_KINDS.has(block.kind) ? null : <Block key={block.id} block={block} theme={level.theme} />,
      )}
      <Forest blocks={level.blocks} theme={level.theme} focus={focus} />
    </group>
  );
}
