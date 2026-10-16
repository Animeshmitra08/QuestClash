import type {
  Interactable,
  LevelBlock,
  LevelDefinition,
  PuzzleDefinition,
  TriggerZone,
} from "@/types/game";

/**
 * Layout of the first temple stage (top view, north is up, camera looks from the south):
 *
 *   z=-14 ┌───────────── north wall ─────────────┐
 *         │                 ◎ exit                │
 *         │ ^^^^^^^^^^^^ spike trap ^^^^^^^^^^^^^ │  ← z ∈ [-9, -7], timed spikes
 *         │     ▪                         ▪       │
 *         │              + checkpoint             │
 *   z=-3  ├──────────────┐ DOOR ┌────────────────┤  ← locked door fills the gap x ∈ [-1.5, 1.5]
 *         │                         ☼ sun dial    │
 *         │   ▪              ▪                    │
 *         │ ▤ tablet (clue)                       │
 *         │   ▪              ▪                    │
 *         │               ● spawn      ▫▫ crates  │
 *   z=14  └────────── low south wall ──────── ⚷ ─┘  ← key hidden behind the crates
 *       x=-10                                  x=10
 *
 * Sequence: find the key → read the clue → solve the sun dial → open the door
 *           → cross the spikes → reach the exit.
 *
 * The south wall is kept low so it never blocks the camera's view of the player.
 */

const WALL_THICKNESS = 1;
const OUTER_WALL_HEIGHT = 3;
const INNER_WALL_HEIGHT = 2.4;
const CAMERA_SIDE_WALL_HEIGHT = 0.8;

const ROOM_HALF_WIDTH = 10; // outer edge of the side walls, on x
const ROOM_HALF_DEPTH = 14; // outer edge of the north/south walls, on z
const ROOM_INNER_HALF_WIDTH = ROOM_HALF_WIDTH - WALL_THICKNESS;

const DOOR_HALF_WIDTH = 1.5;
const INNER_WALL_Z = -3;

const innerWallPieceWidth = ROOM_INNER_HALF_WIDTH - DOOR_HALF_WIDTH;
const innerWallPieceCenterX = DOOR_HALF_WIDTH + innerWallPieceWidth / 2;

const walls: LevelBlock[] = [
  {
    id: "wall-north",
    kind: "wall",
    center: { x: 0, z: -ROOM_HALF_DEPTH + WALL_THICKNESS / 2 },
    size: { x: ROOM_HALF_WIDTH * 2, z: WALL_THICKNESS },
    height: OUTER_WALL_HEIGHT,
  },
  {
    id: "wall-south",
    kind: "wall",
    center: { x: 0, z: ROOM_HALF_DEPTH - WALL_THICKNESS / 2 },
    size: { x: ROOM_HALF_WIDTH * 2, z: WALL_THICKNESS },
    height: CAMERA_SIDE_WALL_HEIGHT,
  },
  {
    id: "wall-west",
    kind: "wall",
    center: { x: -ROOM_HALF_WIDTH + WALL_THICKNESS / 2, z: 0 },
    size: { x: WALL_THICKNESS, z: ROOM_HALF_DEPTH * 2 },
    height: OUTER_WALL_HEIGHT,
  },
  {
    id: "wall-east",
    kind: "wall",
    center: { x: ROOM_HALF_WIDTH - WALL_THICKNESS / 2, z: 0 },
    size: { x: WALL_THICKNESS, z: ROOM_HALF_DEPTH * 2 },
    height: OUTER_WALL_HEIGHT,
  },
  {
    id: "wall-inner-west",
    kind: "wall",
    center: { x: -innerWallPieceCenterX, z: INNER_WALL_Z },
    size: { x: innerWallPieceWidth, z: WALL_THICKNESS },
    height: INNER_WALL_HEIGHT,
  },
  {
    id: "wall-inner-east",
    kind: "wall",
    center: { x: innerWallPieceCenterX, z: INNER_WALL_Z },
    size: { x: innerWallPieceWidth, z: WALL_THICKNESS },
    height: INNER_WALL_HEIGHT,
  },
];

function pillar(id: string, x: number, z: number): LevelBlock {
  return { id, kind: "pillar", center: { x, z }, size: { x: 1.2, z: 1.2 }, height: 3 };
}

function crate(id: string, x: number, z: number, size = 1): LevelBlock {
  return { id, kind: "crate", center: { x, z }, size: { x: size, z: size }, height: size };
}

const obstacles: LevelBlock[] = [
  pillar("pillar-sw", -5, 7),
  pillar("pillar-se", 5, 7),
  pillar("pillar-nw", -5, 1),
  pillar("pillar-ne", 5, 1),
  pillar("pillar-north-w", -5.5, -5.2),
  pillar("pillar-north-e", 5.5, -5.2),
  crate("crate-1", 7, 11),
  crate("crate-2", 7.6, 9.8, 0.8),
  crate("crate-3", -7.2, -0.8),
];

export const BRONZE_KEY = { id: "bronze-key", name: "Bronze Key" };
const SUN_PUZZLE_ID = "sun-dial";

const interactables: Interactable[] = [
  {
    id: "key",
    kind: "pickup",
    // Tucked behind the crates in the south-east corner.
    position: { x: 8.2, z: 12.2 },
    facing: 0,
    reach: 1.2,
    prompt: "Pick up",
    item: BRONZE_KEY,
  },
  {
    id: "tablet-clue",
    kind: "inspect",
    // Against the west wall (inner face at x = -9), facing east into the room.
    position: { x: -8.2, z: 4 },
    facing: Math.PI / 2,
    reach: 1.6,
    collider: { x: 0.5, z: 1.1 },
    prompt: "Read",
    title: "Weathered Tablet",
    message:
      "Three suns rise over the temple gate.\nOnly those who remember their number may pass.",
  },
  {
    id: "sun-dial",
    kind: "puzzle",
    position: { x: 3.4, z: -1.2 },
    facing: Math.PI,
    reach: 1.5,
    collider: { x: 0.9, z: 0.9 },
    prompt: "Inspect",
    puzzleId: SUN_PUZZLE_ID,
  },
  {
    id: "temple-door",
    kind: "door",
    position: { x: 0, z: INNER_WALL_Z },
    facing: 0,
    reach: 1.8,
    // Fills the gap in the inner wall exactly, so it blocks the way until opened.
    collider: { x: DOOR_HALF_WIDTH * 2, z: 0.6 },
    prompt: "Open",
    width: DOOR_HALF_WIDTH * 2,
    height: INNER_WALL_HEIGHT,
    requiredItemId: BRONZE_KEY.id,
    requiredPuzzleId: SUN_PUZZLE_ID,
  },
];

const puzzles: PuzzleDefinition[] = [
  {
    id: SUN_PUZZLE_ID,
    title: "The Sun Dial",
    question: "The dial has a ring of sun symbols. How many suns must you set?",
    options: ["One", "Two", "Three", "Four"],
    correctOptionIndex: 2,
    wrongAnswerHint: "The dial clicks back into place. Perhaps something in the temple holds a hint.",
  },
];

export const SPIKE_TRAP_ID = "spike-trap";

const triggers: TriggerZone[] = [
  {
    id: SPIKE_TRAP_ID,
    kind: "trap",
    // A full-width strip: there is no way around it, only timing.
    center: { x: 0, z: -8 },
    size: { x: ROOM_INNER_HALF_WIDTH * 2, z: 2 },
  },
  {
    id: "exit",
    kind: "exit",
    center: { x: 0, z: -12.2 },
    size: { x: 3, z: 1.6 },
  },
];

export const templeLevel: LevelDefinition = {
  id: "temple-1",
  name: "Forgotten Temple",
  floorSize: { x: ROOM_HALF_WIDTH * 2 + 2, z: ROOM_HALF_DEPTH * 2 + 2 },
  // Models face +z at angle 0; π turns the player to face north, into the temple.
  playerSpawn: { position: { x: 0, z: 10 }, facing: Math.PI },
  // Just through the door: a trap sends you back here, not to the very start.
  checkpoint: { position: { x: 0, z: -4.6 }, facing: Math.PI },
  blocks: [...walls, ...obstacles],
  interactables,
  triggers,
  puzzles,
};
