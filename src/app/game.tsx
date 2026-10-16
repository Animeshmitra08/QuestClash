import { router } from "expo-router";
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
import { GameScene } from "@/game/GameScene";
import { templeLevel } from "@/game/levels/templeLevel";
import { PlayerInput } from "@/game/PlayerInput";
import { useStageSnapshot } from "@/hooks/useStageSnapshot";
import { calculateScore } from "@/systems/ScoreSystem";
import { currentObjective, StageManager } from "@/systems/StageManager";
import type { Interactable, PuzzleDefinition } from "@/types/game";

type OpenDialog =
  | { type: "message"; title: string; message: string }
  | { type: "puzzle"; puzzle: PuzzleDefinition };

let nextRunId = 1;

/** Everything that belongs to one attempt at the stage. Restarting makes a new one. */
function createRun() {
  return {
    id: nextRunId++,
    input: new PlayerInput(),
    stage: new StageManager(templeLevel),
  };
}

export default function GameScreen() {
  const [run, setRun] = useState(createRun);
  const { input, stage } = run;
  const snapshot = useStageSnapshot(stage);

  const [sceneReady, setSceneReady] = useState(false);
  const [focused, setFocused] = useState<Interactable | null>(null);
  const [dialog, setDialog] = useState<OpenDialog | null>(null);

  const paused = snapshot.status === "paused";
  const completed = snapshot.status === "completed";
  const inputLocked = dialog !== null || snapshot.status !== "playing";
  const score = calculateScore(snapshot);

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

  // Android back button: close the open panel, or toggle pause, instead of leaving mid-stage.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (completed) return false; // default behaviour: back to the start screen
      if (dialog) setDialog(null);
      else if (paused) stage.resume();
      else stage.pause();
      return true;
    });
    return () => subscription.remove();
  }, [completed, dialog, paused, stage]);

  const handleInteract = (target: Interactable) => {
    const result = stage.interact(target);
    if (result.type !== "none") setDialog(result);
  };

  const restart = () => {
    setSceneReady(false);
    setFocused(null);
    setDialog(null);
    setRun(createRun());
  };

  const quitToMenu = () => router.back();

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* A new run id remounts the scene, giving it fresh game systems. */}
      <SceneErrorBoundary key={run.id} onRetry={restart}>
        <GameScene
          level={templeLevel}
          input={input}
          stage={stage}
          onReady={() => setSceneReady(true)}
          onFocusChange={setFocused}
          onInteract={handleInteract}
        />
      </SceneErrorBoundary>

      <DamageFlash hitCount={snapshot.trapHits} />

      {!completed && (
        <>
          <GameControls input={input} actionPrompt={focused?.prompt ?? null} />
          <GameHUD
            objective={currentObjective(templeLevel, snapshot)}
            elapsedSeconds={snapshot.elapsedSeconds}
            score={score.total}
            inventory={snapshot.inventory}
            onPause={() => stage.pause()}
          />
        </>
      )}

      <NoticeToast notice={snapshot.notice} />

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

      {paused && <PauseMenu onResume={() => stage.resume()} onRestart={restart} onQuit={quitToMenu} />}

      {completed && (
        <StageCompleteDialog
          elapsedSeconds={snapshot.elapsedSeconds}
          score={score}
          onRestart={restart}
          onExit={quitToMenu}
        />
      )}

      {!sceneReady && (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator size="large" color="#f2c230" />
          <Text style={styles.loadingText}>Entering the temple…</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1b1712",
  },
  loading: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1b1712",
  },
  loadingText: {
    color: "#c9b99c",
    marginTop: 12,
    fontSize: 16,
  },
});
