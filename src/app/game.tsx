import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";

import { LevelErrorScreen } from "@/components/LevelErrorScreen";
import { LevelSession } from "@/components/LevelSession";
import { FIRST_LEVEL_ID } from "@/levels/catalog";
import { loadLevel } from "@/levels/levelLoader";

/**
 * Plays a level: /game?level=<id> (defaults to the first level).
 * Loads and checks the level before anything is created for it, and handles
 * restarting and moving on to the next level.
 */
export default function GameScreen() {
  const params = useLocalSearchParams<{ level?: string }>();
  const [levelId, setLevelId] = useState(params.level ?? FIRST_LEVEL_ID);
  // Bumping the attempt number remounts the session: a clean restart.
  const [attempt, setAttempt] = useState(0);

  const loaded = loadLevel(levelId);
  const quitToMenu = () => router.back();
  const restart = () => setAttempt((n) => n + 1);

  if (!loaded.ok) {
    return <LevelErrorScreen levelId={levelId} errors={loaded.errors} onRetry={restart} onExit={quitToMenu} />;
  }

  const { level, warnings } = loaded;
  if (warnings.length > 0) console.warn(`Level "${level.id}":\n- ${warnings.join("\n- ")}`);

  const nextLevelId = level.nextLevelId;
  const goToNextLevel = nextLevelId
    ? () => {
        setLevelId(nextLevelId);
        setAttempt((n) => n + 1);
      }
    : undefined;

  return (
    <LevelSession
      key={`${level.id}#${attempt}`}
      level={level}
      onRestart={restart}
      onNextLevel={goToNextLevel}
      onQuit={quitToMenu}
    />
  );
}
