/**
 * Shared game types.
 *
 * World axes (Three.js convention):
 *   x → right, y → up, z → toward the camera ("south").
 * The level is a flat floor at y = 0, so most gameplay math only needs x and z.
 */

/** A point or direction on the floor plane. */
export interface Vec2 {
  x: number;
  z: number;
}

/**
 * Stick deflection from the virtual joystick, each axis in [-1, 1].
 * x → right, y → up (away from the player's thumb). Length is at most 1.
 */
export interface JoystickVector {
  x: number;
  y: number;
}

/** Everything the game needs to know about the player each frame. */
export interface PlayerState {
  position: Vec2;
  velocity: Vec2;
  /** Rotation around the y axis, in radians. 0 = facing +z (toward the camera). */
  facing: number;
  /** Current speed as a fraction of max speed, 0..1. Drives the walk animation. */
  moveAmount: number;
  /** Game time (seconds) of the last interaction press, or -Infinity if never. */
  lastInteractTime: number;
  /** Seconds of gameplay since the stage started. */
  time: number;
}

export type BlockKind = "wall" | "pillar" | "crate";

/** An axis-aligned rectangle on the floor plane. */
export interface Rect {
  /** Center of the rectangle on the floor plane. */
  center: Vec2;
  /** Full width (x) and depth (z). */
  size: Vec2;
}

/** A rectangle the player cannot walk through. */
export interface CollisionBox extends Rect {
  id: string;
}

/**
 * A solid, axis-aligned box standing on the floor.
 * The same data is used to draw the box and for collision.
 */
export interface LevelBlock extends CollisionBox {
  kind: BlockKind;
  /** Height above the floor. */
  height: number;
}

/** A position plus the direction to face there. */
export interface SpawnPoint {
  position: Vec2;
  facing: number;
}

// ---------------------------------------------------------------------------
// Interactables: things the USE button acts on.
// ---------------------------------------------------------------------------

interface InteractableBase {
  id: string;
  position: Vec2;
  /** Visual rotation around the y axis, in radians. */
  facing: number;
  /** How close (center to center) the player must be to use it. */
  reach: number;
  /** Short verb shown next to the USE button, e.g. "Read". */
  prompt: string;
  /** Footprint size if the object is solid; omit for objects the player can walk over. */
  collider?: Vec2;
}

/** Something the player can examine; shows a message. */
export interface InspectInteractable extends InteractableBase {
  kind: "inspect";
  title: string;
  message: string;
}

/** An item lying in the world that goes into the inventory when used. */
export interface PickupInteractable extends InteractableBase {
  kind: "pickup";
  item: InventoryItem;
}

/** A door that opens once the player holds an item and has solved a puzzle. */
export interface DoorInteractable extends InteractableBase {
  kind: "door";
  requiredItemId: string;
  requiredPuzzleId: string;
  /** Door panel size: width along its face, and height. Thickness comes from `collider`. */
  width: number;
  height: number;
}

/** A mechanism that asks the player a question. */
export interface PuzzleInteractable extends InteractableBase {
  kind: "puzzle";
  puzzleId: string;
}

export type Interactable =
  | InspectInteractable
  | PickupInteractable
  | DoorInteractable
  | PuzzleInteractable;

export interface InventoryItem {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Triggers: areas that react when the player steps into them.
// ---------------------------------------------------------------------------

export interface TriggerZone extends Rect {
  id: string;
  kind: "trap" | "exit";
}

/** A multiple-choice question; multiple choice is far easier than typing on a phone. */
export interface PuzzleDefinition {
  id: string;
  title: string;
  question: string;
  options: string[];
  correctOptionIndex: number;
  /** Shown after a wrong answer. */
  wrongAnswerHint: string;
}

export interface LevelDefinition {
  id: string;
  name: string;
  /** Size of the floor plane (x by z), centered on the origin. */
  floorSize: Vec2;
  /** Where the player starts. */
  playerSpawn: SpawnPoint;
  /** Where the player reappears after a trap. */
  checkpoint: SpawnPoint;
  blocks: LevelBlock[];
  interactables: Interactable[];
  triggers: TriggerZone[];
  puzzles: PuzzleDefinition[];
}
