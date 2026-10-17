import { Canvas } from "@react-three/fiber/native";
import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";

import { createLevelCollision } from "@/systems/CollisionSystem";
import { getSpawnPoint } from "@/systems/gameState";
import { InteractionSystem } from "@/systems/InteractionSystem";
import { MovementController } from "@/systems/MovementController";
import type { StageManager } from "@/systems/StageManager";
import { syncWorldWithState } from "@/systems/worldSync";
import type { Interactable, LevelDefinition } from "@/types/game";

import { CAMERA_FOV, CAMERA_OFFSET, CameraController } from "./CameraController";
import { GameClock, GameClockContext } from "./gameClock";
import { Interactables } from "./Interactables";
import { Player } from "./Player";
import { PlayerController } from "./PlayerController";
import type { PlayerInput } from "./PlayerInput";
import { Room } from "./Room";
import { StageController } from "./StageController";
import { TriggerVisuals } from "./TriggerVisuals";

interface GameSceneProps {
  level: LevelDefinition;
  /** Shared with the on-screen controls, which write to it. */
  input: PlayerInput;
  /** Stage rules and progress, shared with the HUD. */
  stage: StageManager;
  /** Called once the GL context exists and the first frame can be drawn. */
  onReady?: () => void;
  /** The object in reach changed (null = nothing in reach). */
  onFocusChange?: (target: Interactable | null) => void;
  /** USE was pressed on an object. */
  onInteract?: (target: Interactable) => void;
}

/** The 3D world. HUD and menus live outside this component, as React Native views. */
export function GameScene({
  level,
  input,
  stage,
  onReady,
  onFocusChange,
  onInteract,
}: GameSceneProps) {
  // Spatial systems are created once per scene mount and updated by the frame loop.
  // Stage rules (puzzles, doors, traps, timer) live in `stage`.
  const [systems] = useState(() => {
    const collision = createLevelCollision(level);
    const start = getSpawnPoint(level, level.playerSpawnId);
    return {
      collision,
      interaction: new InteractionSystem(level.interactables),
      movement: new MovementController(start.position, start.facing, collision),
      // Game time only flows while the stage is being played (not paused or finished).
      clock: new GameClock(() => stage.isRunning),
    };
  });
  const { collision, interaction, movement, clock } = systems;

  // Keep collision/interaction in step with progress (key taken, door opened…).
  useEffect(() => {
    const sync = () => syncWorldWithState(level, stage.getState(), collision, interaction);
    sync();
    return stage.subscribe(sync);
  }, [level, stage, collision, interaction]);

  const spawn = movement.state.position;
  const { theme } = level;

  return (
    <Canvas
      style={styles.canvas}
      camera={{
        fov: CAMERA_FOV,
        near: 0.1,
        far: 100,
        // Start where the follow camera will be, so the first frame is already correct.
        position: [spawn.x + CAMERA_OFFSET.x, CAMERA_OFFSET.y, spawn.z + CAMERA_OFFSET.z],
      }}
      onCreated={onReady}
    >
      <color attach="background" args={[theme.background]} />
      {/* Fog fades the far end of the level and hides the edge of the world. */}
      <fog attach="fog" args={[theme.background, theme.fog.near, theme.fog.far]} />

      {/* Sky / ground ambient fill, plus one "sun" for shading direction. */}
      <hemisphereLight args={[theme.ambient.sky, theme.ambient.ground, theme.ambient.intensity]} />
      <directionalLight position={[...theme.sun.position]} intensity={theme.sun.intensity} color={theme.sun.color} />

      <GameClockContext value={clock}>
        <Room level={level} />
        <TriggerVisuals triggers={level.triggers} stage={stage} />
        <Interactables items={level.interactables} interaction={interaction} stage={stage} />

        {/* Order matters: frame callbacks run in mount order (logic → drawing → camera). */}
        <PlayerController
          input={input}
          movement={movement}
          interaction={interaction}
          onFocusChange={onFocusChange}
          onInteract={onInteract}
        />
        <StageController stage={stage} movement={movement} />
        <Player state={movement.state} />
        <CameraController target={movement.state.position} />
      </GameClockContext>
    </Canvas>
  );
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
  },
});
