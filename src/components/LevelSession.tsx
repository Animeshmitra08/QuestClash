import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, AppState, BackHandler, StyleSheet, Text, View } from "react-native";

import { DamageFlash } from "@/components/DamageFlash";
import { GameControls } from "@/components/GameControls";
import { GameHUD } from "@/components/GameHUD";
import { MessageDialog } from "@/components/MessageDialog";
import { NoticeToast } from "@/components/NoticeToast";
import { PauseMenu } from "@/components/PauseMenu";
import { PuzzleDialog } from "@/components/PuzzleDialog";
import { SceneErrorBoundary } from "@/components/SceneErrorBoundary";
import { StageCompleteDialog } from "@/components/StageCompleteDialog";
import { StageFailedDialog } from "@/components/StageFailedDialog";
import { GameScene } from "@/game/GameScene";
import { PlayerInput } from "@/game/PlayerInput";
import { useGameState } from "@/hooks/useGameState";
import { AudioManager } from "@/systems/AudioManager";
import { getObjectiveProgress } from "@/systems/ObjectiveSystem";
import { calculateScore, resolveScoring } from "@/systems/ScoreSystem";
import { StageManager } from "@/systems/StageManager";
import type { Interactable, LevelDefinition } from "@/types/game";
import type { InteractionResult } from "@/types/state";

/** A panel opened by using an object (message or puzzle). */
type OpenDialog = Exclude<InteractionResult, { type: "none" }>;

interface LevelSessionProps {
  /** A level that has already passed the level loader's checks. */
  level: LevelDefinition;
  onRestart: () => void;
  /** Present only if the level has a next level. */
  onNextLevel?: () => void;
  onQuit: () => void;
}

/**
 * One attempt at one level: the 3D scene plus HUD, dialogs and menus.
 * Everything here belongs to this attempt; restarting mounts a fresh session.
 */
export function LevelSession({ level, onRestart, onNextLevel, onQuit }: LevelSessionProps) {
  const [input] = useState(() => new PlayerInput());
  const [stage] = useState(() => new StageManager(level));
  const [audio] = useState(() => new AudioManager());
  const game = useGameState(stage);

  const [sceneReady, setSceneReady] = useState(false);
  const [focused, setFocused] = useState<Interactable | null>(null);
  const [dialog, setDialog] = useState<OpenDialog | null>(null);

  const paused = game.status === "paused";
  const finished = game.status === "completed" || game.status === "failed";
  const inputLocked = dialog !== null || game.status !== "playing";
  const score = calculateScore(game, resolveScoring(level));

  // The joystick and USE button are ignored while any panel is open.
  useEffect(() => {
    input.setLocked(inputLocked);
  }, [input, inputLocked]);

  // Pause automatically when the app goes to the background (call, home button…).
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") stage.pause();
    });
    return () => subscription.remove();
  }, [stage]);

  // Sounds follow game events.
  useEffect(() => audio.attach(stage), [audio, stage]);
  useEffect(() => () => audio.dispose(), [audio]);

  // Android back button: close the open panel, or toggle pause, instead of leaving mid-level.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (finished) return false; // default behaviour: back to the start screen
      if (dialog) setDialog(null);
      else if (paused) stage.resume();
      else stage.pause();
      return true;
    });
    return () => subscription.remove();
  }, [finished, dialog, paused, stage]);

  const handleInteract = (target: Interactable) => {
    const result = stage.interact(target);
    if (result.type !== "none") setDialog(result);
  };

  return (
    <View style={[styles.container, { backgroundColor: level.theme.background }]}>
      <StatusBar hidden />

      <SceneErrorBoundary onRetry={onRestart}>
        <GameScene
          level={level}
          input={input}
          stage={stage}
          onReady={() => setSceneReady(true)}
          onFocusChange={setFocused}
          onInteract={handleInteract}
        />
      </SceneErrorBoundary>

      <DamageFlash hitCount={game.trapHits} />

      {!finished && (
        <>
          <GameControls input={input} actionPrompt={focused?.prompt ?? null} />
          <GameHUD
            objective={getObjectiveProgress(level, game).current?.text ?? "Level complete"}
            elapsedSeconds={game.elapsedSeconds}
            timeLimitSeconds={level.timeLimitSeconds ?? null}
            score={score.total}
            inventory={game.inventory}
            onPause={() => stage.pause()}
          />
        </>
      )}

      <NoticeToast notice={game.notice} />

      {dialog?.type === "message" && (
        <MessageDialog title={dialog.title} message={dialog.message} onClose={() => setDialog(null)} />
      )}

      {dialog?.type === "puzzle" && (
        <PuzzleDialog
          puzzle={dialog.puzzle}
          onAnswer={(optionIndex) => {
            const correct = stage.answerPuzzle(dialog.puzzle.id, optionIndex);
            if (correct) setDialog(null);
            return correct;
          }}
          onClose={() => setDialog(null)}
        />
      )}

      {paused && <PauseMenu onResume={() => stage.resume()} onRestart={onRestart} onQuit={onQuit} />}

      {game.status === "completed" && (
        <StageCompleteDialog
          levelName={level.name}
          elapsedSeconds={game.elapsedSeconds}
          score={score}
          onRestart={onRestart}
          onNextLevel={onNextLevel}
          onExit={onQuit}
        />
      )}

      {game.status === "failed" && (
        <StageFailedDialog levelName={level.name} onRestart={onRestart} onExit={onQuit} />
      )}

      {!sceneReady && (
        <View style={[styles.loading, { backgroundColor: level.theme.background }]} pointerEvents="none">
          <ActivityIndicator size="large" color="#f2c230" />
          <Text style={styles.loadingText}>Entering {level.name}…</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loading: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#c9b99c",
    marginTop: 12,
    fontSize: 16,
  },
});
