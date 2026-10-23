import { StatusBar } from "expo-status-bar";
import { type ReactNode, useEffect, useState, useSyncExternalStore } from "react";
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
import type { MatchSource } from "@/session/MatchSource";
import { AudioManager } from "@/systems/AudioManager";
import { getObjectiveProgress } from "@/systems/ObjectiveSystem";
import { calculateScore, resolveScoring } from "@/systems/ScoreSystem";
import type { Interactable } from "@/types/game";
import type { InteractionResult, MatchState } from "@/types/state";

/** A panel opened by using an object (message or puzzle). */
type OpenDialog = Exclude<InteractionResult, { type: "none" }>;

interface LevelSessionProps {
  /** The match to play: local (single player) or online. Created by the screen; one per attempt. */
  source: MatchSource;
  /** Omitted online for everyone but the host. */
  onRestart?: () => void;
  /** Present only if the level has a next level (and, online, for the host). */
  onNextLevel?: () => void;
  onQuit: () => void;
  /** Label for leaving (menus and end screens). Defaults to "Leave room" online, "Main menu" offline. */
  exitLabel?: string;
  /** Online: a connection problem to show over the game ("Reconnecting…"), or null. */
  connectionNotice?: string | null;
  /** Online, not the host: shown on the end-of-level screens. */
  waitingNote?: string;
  /** Replaces the end-of-level dialogs once the match is over (online: results and leaderboard). */
  renderResults?: (state: MatchState) => ReactNode;
}

/**
 * One attempt at one level: the 3D scene plus HUD, dialogs and menus. Works the
 * same for single player and online: everything goes through the MatchSource.
 */
export function LevelSession({
  source,
  onRestart,
  onNextLevel,
  onQuit,
  exitLabel = source.online ? "Leave room" : "Main menu",
  connectionNotice,
  waitingNote,
  renderResults,
}: LevelSessionProps) {
  const { level } = source;
  const [input] = useState(() => new PlayerInput());
  const [audio] = useState(() => new AudioManager());
  const game = useSyncExternalStore(source.subscribe, source.getState);
  // The local player's personal state: inventory, pop-ups, hits.
  const me = game.players[source.localPlayerId];

  const [sceneReady, setSceneReady] = useState(false);
  const [focused, setFocused] = useState<Interactable | null>(null);
  const [dialog, setDialog] = useState<OpenDialog | null>(null);
  // Online there's no pause: the menu opens over the running match.
  const [menuOpen, setMenuOpen] = useState(false);

  const paused = game.status === "paused";
  const showMenu = source.canPause ? paused : menuOpen;
  const finished = game.status === "completed" || game.status === "failed";
  const meActive = me?.status === "active";
  const inputLocked = dialog !== null || showMenu || game.status !== "playing" || !meActive;
  const score = calculateScore(game, resolveScoring(level));

  const openMenu = () => (source.canPause ? source.pause() : setMenuOpen(true));
  const closeMenu = () => (source.canPause ? source.resume() : setMenuOpen(false));

  // The joystick and USE button are ignored while any panel is open.
  useEffect(() => {
    input.setLocked(inputLocked);
  }, [input, inputLocked]);

  // Single player pauses when the app goes to the background (call, home button…).
  useEffect(() => {
    if (!source.canPause) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") source.pause();
    });
    return () => subscription.remove();
  }, [source]);

  // Sounds follow game events.
  useEffect(() => audio.attach(source), [audio, source]);
  useEffect(() => () => audio.dispose(), [audio]);

  // Android back button: close the open panel, or toggle the menu, instead of leaving mid-level.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (finished) return false; // default behaviour: back to the previous screen
      if (dialog) setDialog(null);
      else if (showMenu) closeMenu();
      else openMenu();
      return true;
    });
    return () => subscription.remove();
  });

  const handleInteract = async (target: Interactable) => {
    const outcome = await source.dispatch({ type: "interact", targetId: target.id });
    if (outcome.accepted && outcome.result.type !== "none") setDialog(outcome.result);
  };

  const answerPuzzle = async (puzzleId: string, optionIndex: number) => {
    const outcome = await source.dispatch({ type: "submitPuzzleAnswer", puzzleId, optionIndex });
    const correct = outcome.accepted && outcome.correct === true;
    // Close on success, or if someone else solved it in the meantime.
    if (correct || (!outcome.accepted && outcome.reason === "alreadySolved")) setDialog(null);
    return correct;
  };

  return (
    <View style={[styles.container, { backgroundColor: level.theme.background }]}>
      <StatusBar hidden />

      <SceneErrorBoundary onRetry={onRestart ?? onQuit}>
        <GameScene
          source={source}
          input={input}
          onReady={() => setSceneReady(true)}
          onFocusChange={setFocused}
          onInteract={handleInteract}
        />
      </SceneErrorBoundary>

      <DamageFlash hitCount={me?.trapHits ?? 0} />

      {!finished && (
        <>
          {meActive && <GameControls input={input} actionPrompt={focused?.prompt ?? null} />}
          <GameHUD
            objective={getObjectiveProgress(level, game).current?.text ?? "Level complete"}
            elapsedSeconds={game.elapsedSeconds}
            timeLimitSeconds={level.timeLimitSeconds ?? null}
            score={score.total}
            inventory={me?.inventory ?? []}
            onPause={openMenu}
          />
        </>
      )}

      {/* Online: you escaped or are out, but others are still playing. */}
      {!finished && me && !meActive && (
        <View style={styles.banner} pointerEvents="none">
          <Text style={styles.bannerText}>
            {me.status === "escaped" ? "You escaped! Waiting for the others…" : "You're out. Watching the others…"}
          </Text>
        </View>
      )}

      {connectionNotice && (
        <View style={[styles.banner, styles.connectionBanner]} pointerEvents="none">
          <Text style={styles.bannerText}>{connectionNotice}</Text>
        </View>
      )}

      <NoticeToast notice={me?.notice ?? null} />

      {dialog?.type === "message" && (
        <MessageDialog title={dialog.title} message={dialog.message} onClose={() => setDialog(null)} />
      )}

      {dialog?.type === "puzzle" && (
        <PuzzleDialog
          puzzle={dialog.puzzle}
          onAnswer={(optionIndex) => answerPuzzle(dialog.puzzle.id, optionIndex)}
          onClose={() => setDialog(null)}
        />
      )}

      {showMenu && !finished && (
        <PauseMenu
          online={source.online}
          onResume={closeMenu}
          onRestart={source.canPause ? onRestart : undefined}
          onQuit={onQuit}
          quitLabel={source.online ? exitLabel : undefined}
        />
      )}

      {finished && renderResults?.(game)}

      {game.status === "completed" && !renderResults && (
        <StageCompleteDialog
          levelName={level.name}
          elapsedSeconds={game.elapsedSeconds}
          score={score}
          onRestart={onRestart}
          onNextLevel={onNextLevel}
          onExit={onQuit}
          waitingNote={waitingNote}
          exitLabel={exitLabel}
        />
      )}

      {game.status === "failed" && !renderResults && (
        <StageFailedDialog
          levelName={level.name}
          reason={game.failReason ?? "timeUp"}
          onRestart={onRestart}
          onExit={onQuit}
          waitingNote={waitingNote}
          exitLabel={exitLabel}
        />
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
  banner: {
    position: "absolute",
    bottom: 24,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "rgba(27, 23, 18, 0.85)",
    borderWidth: 1,
    borderColor: "#8a7654",
  },
  connectionBanner: {
    top: 140,
    bottom: undefined,
    borderColor: "#d9534f",
  },
  bannerText: {
    color: "#f2e6d0",
    fontSize: 14,
    fontWeight: "600",
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
