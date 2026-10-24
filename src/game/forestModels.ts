import { Color, Matrix4, Object3D } from "three";

import type { BlockKind, LevelBlock, LevelTheme, Vec2 } from "@/types/game";

/**
 * The forest's models as plain data: for each nature block, the shapes ("parts") it is
 * made of, already placed. No React or rendering here (Forest.tsx draws them), so this
 * can be checked on its own.
 */

/** Block kinds drawn as models. The rest (wall, pillar, crate) are plain boxes, drawn by Room. */
export const NATURE_KINDS: ReadonlySet<BlockKind> = new Set<BlockKind>([
  "tree",
  "pine",
  "rock",
  "bush",
  "log",
  "stump",
  "treeline",
]);

/** Used when a level's theme doesn't give a colour for a kind. */
const DEFAULT_COLORS: Readonly<Record<"tree" | "pine" | "rock" | "bush" | "log" | "stump", string>> = {
  tree: "#4f8a3c",
  pine: "#2f6b45",
  rock: "#8d8a80",
  bush: "#5a9a45",
  log: "#7a5534",
  stump: "#8a6440",
};
const BARK = "#5a3d26";

/** Distance between neighbouring trees in a treeline. */
const TREELINE_SPACING = 2;

// Trees and tall rocks between the camera and the player fade out, so they never hide
// the player. The camera always looks from the south (+z), so "in the way" means a little
// south of the player, near the same x.
/** Only things taller than this ever get in the way. */
const FADE_MIN_HEIGHT = 1.6;
/** How far south of the player (toward the camera) something can be and still fade. */
const FADE_SOUTH = 5.5;
/** How far north of the player; crowns just behind them don't cover them. */
const FADE_NORTH = 0.4;
/** Side to side, measured from the edge of the crown. */
const FADE_HALF_WIDTH = 1.4;

/** The shared shapes every model is built from. Forest.tsx has the geometry for each. */
export type PartName = "trunk" | "leaves" | "needles" | "stone" | "shrub" | "logWood" | "stumpWood";
export const PART_NAMES: readonly PartName[] = ["trunk", "leaves", "needles", "stone", "shrub", "logWood", "stumpWood"];

export interface PartInstance {
  matrix: Matrix4;
  color: Color;
  /** Where the whole model stands, for fading. */
  anchor: Vec2;
  /** How far the model reaches sideways from its anchor. */
  radius: number;
  fades: boolean;
}

export type Parts = Record<PartName, PartInstance[]>;

// --- Building the models ------------------------------------------------------------------

/** The same pseudo-random numbers for a block on every device, so the forest looks the same for everyone. */
function randomFor(id: string) {
  let seed = 2166136261;
  for (let i = 0; i < id.length; i++) seed = Math.imul(seed ^ id.charCodeAt(i), 16777619);
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const placer = new Object3D();

/** Builds the parts of every nature block. Pure: the same blocks give the same forest. */
export function buildForest(blocks: LevelBlock[], theme: LevelTheme): Parts {
  const parts = Object.fromEntries(PART_NAMES.map((name) => [name, []])) as unknown as Parts;
  const colorOf = (kind: keyof typeof DEFAULT_COLORS) => theme.blockColors[kind] ?? DEFAULT_COLORS[kind];

  for (const block of blocks) {
    if (!NATURE_KINDS.has(block.kind)) continue;
    const random = randomFor(block.id);
    const angle = () => random() * Math.PI * 2;
    const tint = (hex: string, spread = 0.12) => new Color(hex).multiplyScalar(1 - spread + random() * spread * 2);

    const anchor = block.center;
    const fades = block.height > FADE_MIN_HEIGHT;
    /** Adds one shape: centred at (x, y, z), scaled, turned. */
    const add = (
      part: PartName,
      color: Color,
      radius: number,
      [x, y, z]: [number, number, number],
      [sx, sy, sz]: [number, number, number],
      [rx, ry, rz]: [number, number, number] = [0, angle(), 0],
      at: Vec2 = anchor,
      fade = fades,
    ) => {
      placer.position.set(x, y, z);
      placer.rotation.set(rx, ry, rz);
      placer.scale.set(sx, sy, sz);
      placer.updateMatrix();
      parts[part].push({ matrix: placer.matrix.clone(), color, anchor: at, radius, fades: fade });
    };

    const leafyTree = (at: Vec2, trunkWidth: number, height: number, leafColor: string) => {
      const trunkRadius = trunkWidth * 0.28;
      const trunkHeight = height * 0.45;
      const crown = height * 0.3;
      const crownY = height - crown * 0.9;
      const fade = height > FADE_MIN_HEIGHT;
      add("trunk", tint(BARK), crown, [at.x, trunkHeight / 2, at.z], [trunkRadius, trunkHeight, trunkRadius], undefined, at, fade);
      add("leaves", tint(leafColor), crown, [at.x, crownY, at.z], [crown, crown * 0.9, crown], undefined, at, fade);
      if (random() < 0.65) {
        // A second, smaller clump to one side, so trees aren't all lollipops.
        const side = angle();
        const offset = crown * 0.55;
        const x = at.x + Math.cos(side) * offset;
        const z = at.z + Math.sin(side) * offset;
        add("leaves", tint(leafColor), crown, [x, crownY - crown * 0.35, z], [crown * 0.7, crown * 0.65, crown * 0.7], undefined, at, fade);
      }
    };

    const pineTree = (at: Vec2, trunkWidth: number, height: number, needleColor: string) => {
      const trunkRadius = trunkWidth * 0.25;
      const trunkHeight = height * 0.3;
      const widest = height * 0.24;
      const fade = height > FADE_MIN_HEIGHT;
      add("trunk", tint(BARK), widest, [at.x, trunkHeight / 2, at.z], [trunkRadius, trunkHeight, trunkRadius], undefined, at, fade);
      // Three stacked cones, narrower toward the top.
      const color = tint(needleColor, 0.08);
      for (let tier = 0; tier < 3; tier++) {
        const base = height * (0.18 + 0.22 * tier);
        const tall = height * (0.44 - 0.06 * tier);
        const radius = widest * (1 - 0.22 * tier);
        add("needles", color, widest, [at.x, base + tall / 2, at.z], [radius, tall, radius], undefined, at, fade);
      }
    };

    const { x: cx, z: cz } = block.center;
    const { x: width, z: depth } = block.size;
    const height = block.height;

    switch (block.kind) {
      case "tree":
        leafyTree(block.center, Math.min(width, depth), height, colorOf("tree"));
        break;

      case "pine":
        pineTree(block.center, Math.min(width, depth), height, colorOf("pine"));
        break;

      case "rock": {
        const tilt = () => (random() - 0.5) * 0.3;
        add(
          "stone",
          tint(colorOf("rock"), 0.1),
          Math.max(width, depth) / 2,
          [cx, height * 0.4, cz],
          [width * 0.58, height * 0.62, depth * 0.58],
          [tilt(), angle(), tilt()],
        );
        break;
      }

      case "bush": {
        const color = colorOf("bush");
        add("shrub", tint(color), Math.max(width, depth) / 2, [cx, height * 0.5, cz], [width * 0.52, height * 0.6, depth * 0.52]);
        for (let i = 0; i < 2; i++) {
          const side = angle();
          const x = cx + Math.cos(side) * width * 0.28;
          const z = cz + Math.sin(side) * depth * 0.28;
          add("shrub", tint(color), Math.max(width, depth) / 2, [x, height * 0.35, z], [width * 0.32, height * 0.42, depth * 0.32]);
        }
        break;
      }

      case "log": {
        const alongX = width >= depth;
        const length = Math.max(width, depth);
        const radius = height / 2;
        // Cylinders stand on end; lay this one down along its long side.
        const rotation: [number, number, number] = alongX ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0];
        add("logWood", tint(colorOf("log")), length / 2, [cx, radius, cz], [radius, length, radius], rotation);
        break;
      }

      case "stump": {
        const radius = Math.min(width, depth) / 2;
        add("stumpWood", tint(colorOf("stump")), radius, [cx, height / 2, cz], [radius, height, radius]);
        break;
      }

      case "treeline": {
        // Fill the band with a loose grid of trees, nudged off the grid so it looks grown, not planted.
        const columns = Math.max(1, Math.round(width / TREELINE_SPACING));
        const rows = Math.max(1, Math.round(depth / TREELINE_SPACING));
        const cellX = width / columns;
        const cellZ = depth / rows;
        const leafColor = theme.blockColors.treeline ?? colorOf("tree");
        const needleColor = theme.blockColors.treeline ?? colorOf("pine");
        for (let row = 0; row < rows; row++) {
          for (let column = 0; column < columns; column++) {
            const at = {
              x: cx - width / 2 + (column + 0.5 + (random() - 0.5) * 0.7) * cellX,
              z: cz - depth / 2 + (row + 0.5 + (random() - 0.5) * 0.7) * cellZ,
            };
            const treeHeight = height * (0.8 + random() * 0.4);
            if (random() < 0.5) pineTree(at, 0.8, treeHeight * 1.1, needleColor);
            else leafyTree(at, 0.9, treeHeight, leafColor);
          }
        }
        break;
      }

      default:
        break;
    }
  }
  return parts;
}


/** True if this part is between the camera and the player at `focus`, so it should be see-through. */
export function inFadeZone(instance: PartInstance, focus: Vec2) {
  const south = instance.anchor.z - focus.z;
  return (
    instance.fades &&
    south > -FADE_NORTH &&
    south < FADE_SOUTH &&
    Math.abs(instance.anchor.x - focus.x) < FADE_HALF_WIDTH + instance.radius
  );
}
