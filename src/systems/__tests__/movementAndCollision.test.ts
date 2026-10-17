import { TEMPLE_IDS, templeLevel } from "@/levels/temple";
import { circleOverlapsRect, createLevelCollision } from "@/systems/CollisionSystem";
import { InteractionSystem } from "@/systems/InteractionSystem";
import { MAX_SPEED, MovementController, PLAYER_RADIUS } from "@/systems/MovementController";
import type { JoystickVector, Vec2 } from "@/types/game";

const CAMERA_FORWARD: Vec2 = { x: 0, z: -1 };

/** Hold the stick for `seconds` at `fps`, with or without the temple's collision. */
function walk(start: Vec2, stick: JoystickVector, seconds: number, { fps = 60, collide = true } = {}) {
  const movement = new MovementController(start, Math.PI, collide ? createLevelCollision(templeLevel) : null);
  for (let i = 0; i < seconds * fps; i++) movement.update(stick, CAMERA_FORWARD, 1 / fps);
  return movement.state;
}

describe("MovementController (camera-relative)", () => {
  it.each([
    ["up moves into the screen (-z)", { x: 0, y: 1 }, (s: Vec2) => s.z < -3 && Math.abs(s.x) < 1e-9],
    ["down moves toward the camera (+z)", { x: 0, y: -1 }, (s: Vec2) => s.z > 3],
    ["right moves +x", { x: 1, y: 0 }, (s: Vec2) => s.x > 3 && Math.abs(s.z) < 1e-9],
  ])("stick %s", (_, stick, check) => {
    expect(check(walk({ x: 0, z: 0 }, stick, 1, { collide: false }).position)).toBe(true);
  });

  it("turns to face the direction of travel", () => {
    expect(walk({ x: 0, z: 0 }, { x: 1, y: 0 }, 1, { collide: false }).facing).toBeCloseTo(Math.PI / 2, 1);
  });

  it("reaches max speed with a full stick, slower with half", () => {
    const full = walk({ x: 0, z: 0 }, { x: 0, y: 1 }, 1, { collide: false });
    const half = walk({ x: 0, z: 0 }, { x: 0, y: 0.5 }, 1, { collide: false });
    expect(Math.hypot(full.velocity.x, full.velocity.z)).toBeCloseTo(MAX_SPEED, 2);
    expect(Math.hypot(half.velocity.x, half.velocity.z)).toBeLessThan(MAX_SPEED * 0.5);
  });

  it("ignores tiny stick movements (dead zone)", () => {
    const state = walk({ x: 0, z: 0 }, { x: 0.1, y: 0.05 }, 1, { collide: false });
    expect(state.position).toEqual({ x: 0, z: 0 });
  });

  it("feels the same at 30 and 120 fps", () => {
    const at30 = walk({ x: 0, z: 0 }, { x: 0, y: 1 }, 2, { fps: 30, collide: false }).position.z;
    const at120 = walk({ x: 0, z: 0 }, { x: 0, y: 1 }, 2, { fps: 120, collide: false }).position.z;
    expect(Math.abs(at30 - at120)).toBeLessThan(0.15);
  });

  it("caps a long frame so the player never teleports", () => {
    const movement = new MovementController({ x: 0, z: 0 }, Math.PI);
    movement.update({ x: 0, y: 1 }, CAMERA_FORWARD, 5);
    expect(Math.abs(movement.state.position.z)).toBeLessThan(0.5);
  });
});

describe("CollisionSystem", () => {
  it("stops the player flush against a wall and stops the walk animation", () => {
    const state = walk({ x: 0, z: 4 }, { x: 1, y: 0 }, 4);
    expect(state.position.x).toBeCloseTo(9 - PLAYER_RADIUS, 2); // east wall inner face at x = 9
    expect(state.moveAmount).toBeLessThan(0.01);
    expect(state.facing).toBeCloseTo(Math.PI / 2, 1); // still faces the wall
  });

  it("slides along a wall when walking into it diagonally", () => {
    const state = walk({ x: 8, z: 10 }, { x: 0.7, y: 0.7 }, 0.6);
    expect(state.position.x).toBeCloseTo(8.6, 2);
    expect(state.position.z).toBeLessThan(8.5);
  });

  it("holds the player in a corner", () => {
    const { position } = walk({ x: 7.5, z: 12.5 }, { x: 0.7, y: -0.7 }, 3);
    expect(position.x).toBeLessThanOrEqual(9 - PLAYER_RADIUS + 1e-6);
    expect(position.z).toBeLessThanOrEqual(13 - PLAYER_RADIUS + 1e-6);
  });

  it("blocks pillars, crates, solid objects and the closed door", () => {
    expect(walk({ x: -5, z: 10 }, { x: 0, y: 1 }, 2).position.z).toBeCloseTo(7 + 0.6 + PLAYER_RADIUS, 2);
    expect(walk({ x: 4, z: 11 }, { x: 1, y: 0 }, 2).position.x).toBeCloseTo(7 - 0.5 - PLAYER_RADIUS, 2);
    expect(walk({ x: -5, z: 4 }, { x: -1, y: 0 }, 3).position.x).toBeGreaterThan(-8.2 + 0.25); // tablet
    expect(walk({ x: 0, z: 0 }, { x: 0, y: 1 }, 3).position.z).toBeCloseTo(-3 + 0.3 + PLAYER_RADIUS, 2); // door
  });

  it("lets the player through a disabled box (an opened door)", () => {
    const collision = createLevelCollision(templeLevel);
    collision.setEnabled(TEMPLE_IDS.door, false);
    const movement = new MovementController({ x: 0, z: 0 }, Math.PI, collision);
    for (let i = 0; i < 180; i++) movement.update({ x: 0, y: 1 }, CAMERA_FORWARD, 1 / 60);
    expect(movement.state.position.z).toBeLessThan(-5);
  });

  it("pushes the player out of a box it starts inside", () => {
    const position = { x: 5, z: 7 }; // inside a pillar
    createLevelCollision(templeLevel).resolve(position, { x: 0, z: 0 }, PLAYER_RADIUS);
    expect(Math.abs(position.x - 5) > 0.99 || Math.abs(position.z - 7) > 0.99).toBe(true);
  });

  it("circleOverlapsRect", () => {
    const rect = { center: { x: 0, z: 0 }, size: { x: 2, z: 2 } };
    expect(circleOverlapsRect({ x: 1.2, z: 0 }, 0.25, rect)).toBe(true);
    expect(circleOverlapsRect({ x: 1.3, z: 0 }, 0.25, rect)).toBe(false);
  });
});

describe("InteractionSystem (what USE would act on)", () => {
  it("focuses the nearest object in reach and reports only real changes", () => {
    const interaction = new InteractionSystem(templeLevel.interactables);
    expect(interaction.update({ x: 0, z: 10 })).toBe(false);
    expect(interaction.focused).toBeNull();

    expect(interaction.update({ x: -7.3, z: 4 })).toBe(true);
    expect(interaction.focused?.id).toBe(TEMPLE_IDS.tablet);
    expect(interaction.update({ x: -7.2, z: 4.2 })).toBe(false); // still the tablet

    expect(interaction.update({ x: -4, z: 4 })).toBe(true);
    expect(interaction.focused).toBeNull();
  });

  it("never focuses a disabled object", () => {
    const interaction = new InteractionSystem(templeLevel.interactables);
    interaction.setEnabled(TEMPLE_IDS.tablet, false);
    interaction.update({ x: -7.3, z: 4 });
    expect(interaction.focused).toBeNull();
  });

  it("every object can be reached from where collision lets the player stand", () => {
    const tablet = walk({ x: -5, z: 4 }, { x: -1, y: 0 }, 3).position;
    expect(Math.hypot(tablet.x + 8.2, tablet.z - 4)).toBeLessThanOrEqual(1.6);
  });
});
