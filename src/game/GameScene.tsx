import { Canvas } from "@react-three/fiber/native";
import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";

import type { MatchSource } from "@/session/MatchSource";
import { createLevelCollision } from "@/systems/CollisionSystem";
import { InteractionSystem } from "@/systems/InteractionSystem";
import { MovementController } from "@/systems/MovementController";
import { syncWorldWithState } from "@/systems/worldSync";
import type { Interactable } from "@/types/game";

import { CAMERA_FOV, CAMERA_OFFSET, CameraController } from "./CameraController";
import { GameClock, GameClockContext } from "./gameClock";
import { Interactables } from "./Interactables";
import { Player, playerColor } from "./Player";
import { PlayerController } from "./PlayerController";
import type { PlayerInput } from "./PlayerInput";
import { RemotePlayers } from "./RemotePlayers";
import { Room } from "./Room";
import { StageController } from "./StageController";
import { TriggerVisuals } from "./TriggerVisuals";

interface GameSceneProps {
  /** The match: run on this device (single player) or on the server (online). */
  source: MatchSource;
  /** Shared with the on-screen controls, which write to it. */
  input: PlayerInput;
  /** Called once the GL context exists and the first frame can be drawn. */
  onReady?: () => void;
  /** The object in reach changed (null = nothing in reach). */
  onFocusChange?: (target: Interactable | null) => void;
  /** USE was pressed on an object. */
  onInteract?: (target: Interactable) => void;
}

/** The 3D world. HUD and menus live outside this component, as React Native views. */
export function GameScene({ source, input, onReady, onFocusChange, onInteract }: GameSceneProps) {
  const { level, localPlayerId } = source;
  // Spatial systems are created once per scene mount and updated by the frame loop.
  // Match rules (puzzles, doors, traps, timer) live behind `source`.
  const [systems] = useState(() => {
    const collision = createLevelCollision(level);
    const start = source.spawnPoint();
    return {
      collision,
      interaction: new InteractionSystem(level.interactables),
      movement: new MovementController(start.position, start.facing, collision),
      // Game time only flows while the match is being played (not paused or finished).
      clock: new GameClock(() => source.isRunning),
    };
  });
  const { collision, interaction, movement, clock } = systems;

  // Keep collision/interaction in step with progress (key taken, door opened…).
  useEffect(() => {
    const sync = () => syncWorldWithState(level, source.getState(), collision, interaction);
    sync();
    return source.subscribe(sync);
  }, [level, source, collision, interaction]);

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
        <TriggerVisuals triggers={level.triggers} source={source} />
        <Interactables items={level.interactables} interaction={interaction} source={source} />

        {/* Order matters: frame callbacks run in mount order (logic → drawing → camera). */}
        <PlayerController
          input={input}
          movement={movement}
          interaction={interaction}
          onFocusChange={onFocusChange}
          onInteract={onInteract}
        />
        <StageController source={source} movement={movement} />
        <Player state={movement.state} color={playerColor(source.getState().players[localPlayerId]?.slot ?? 0)} />
        <RemotePlayers source={source} />
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
