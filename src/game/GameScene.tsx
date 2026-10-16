import { Canvas } from "@react-three/fiber/native";
import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";

import type { StageManager } from "@/systems/StageManager";
import { TrapSystem } from "@/systems/TrapSystem";
import type { Interactable, LevelDefinition } from "@/types/game";

import { CAMERA_FOV, CAMERA_OFFSET, CameraController } from "./CameraController";
import { createLevelCollision } from "./CollisionSystem";
import { GameClock, GameClockContext } from "./gameClock";
import { Interactables } from "./Interactables";
import { InteractionSystem } from "./InteractionSystem";
import { MovementController } from "./MovementController";
import { Player } from "./Player";
import { PlayerController } from "./PlayerController";
import type { PlayerInput } from "./PlayerInput";
import { Room } from "./Room";
import { StageController } from "./StageController";
import { TriggerVisuals } from "./TriggerVisuals";
import { syncWorldWithStage } from "./worldSync";

const BACKGROUND_COLOR = "#1b1712";

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
  // Game systems are created once per scene mount and updated by the frame loop.
  const [systems] = useState(() => {
    const collision = createLevelCollision(level);
    return {
      collision,
      interaction: new InteractionSystem(level.interactables),
      movement: new MovementController(level.playerSpawn.position, level.playerSpawn.facing, collision),
      trap: new TrapSystem(),
      // Game time only flows while the stage is being played (not paused or finished).
      clock: new GameClock(() => stage.isRunning),
    };
  });
  const { collision, interaction, movement, trap, clock } = systems;

  // Keep collision/interaction in step with stage progress (key taken, door opened…).
  useEffect(() => {
    const sync = () => syncWorldWithStage(level, stage.getSnapshot(), collision, interaction);
    sync();
    return stage.subscribe(sync);
  }, [level, stage, collision, interaction]);

  const spawn = level.playerSpawn.position;

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
      <color attach="background" args={[BACKGROUND_COLOR]} />
      {/* Fog fades the far end of the temple and hides the edge of the world. */}
      <fog attach="fog" args={[BACKGROUND_COLOR, 18, 40]} />

      {/* Warm sky / dark ground ambient fill, plus one "sun" for shading direction. */}
      <hemisphereLight args={["#fff1d6", "#3a2f22", 1.2]} />
      <directionalLight position={[6, 12, 4]} intensity={2} color="#ffe2b0" />

      <GameClockContext value={clock}>
        <Room level={level} />
        <TriggerVisuals triggers={level.triggers} trap={trap} />
        <Interactables items={level.interactables} interaction={interaction} stage={stage} />

        {/* Order matters: frame callbacks run in mount order (logic → drawing → camera). */}
        <PlayerController
          input={input}
          movement={movement}
          interaction={interaction}
          onFocusChange={onFocusChange}
          onInteract={onInteract}
        />
        <StageController level={level} stage={stage} trap={trap} movement={movement} />
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
