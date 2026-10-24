import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeInLeft, FadeInRight, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Confetti } from "@/components/ui/Confetti";
import { GameButton } from "@/components/ui/GameButton";
import { Eyebrow, Panel } from "@/components/ui/Panel";
import { COLORS, GOLD_GRADIENT, RADIUS } from "@/components/ui/theme";
import { playerColor } from "@/game/playerColors";
import type { LobbyPlayer } from "@/net/OnlineSession";
import { type LeaderboardEntry, rankPlayers } from "@/systems/leaderboard";
import { calculateScore, formatTime, resolveScoring } from "@/systems/ScoreSystem";
import type { LevelDefinition } from "@/types/game";
import type { FailReason, MatchState, PlayerId, PlayerStatus } from "@/types/state";

interface OnlineResultsProps {
  level: LevelDefinition;
  state: MatchState;
  localPlayerId: PlayerId;
  /** Everyone in the room now, including players who joined after the match ended. */
  roomPlayers: readonly LobbyPlayer[];
  roomCode: string | null;
  reconnecting: boolean;
  /** Host only. */
  onNextLevel?: () => void;
  onRestart?: () => void;
  onBackToLobby?: () => void;
  onExit: () => void;
  exitLabel: string;
  /** Shown under the buttons (e.g. "Waiting for the host…"). */
  note?: string;
}

const MAX_STARS = 3;

const FAIL_TITLES: Record<FailReason, string> = {
  timeUp: "Out of time",
  allEliminated: "Everyone is out",
};

const STATUS_CHIPS: Record<PlayerStatus, { label: string; color: string }> = {
  escaped: { label: "Escaped", color: COLORS.success },
  active: { label: "Didn't escape", color: COLORS.textMuted },
  eliminated: { label: "Out", color: COLORS.danger },
  left: { label: "Left", color: COLORS.textDim },
};

const MEDALS: Record<number, string> = {
  1: GOLD_GRADIENT,
  2: "linear-gradient(135deg, #f1f4f8 0%, #a9b3c1 100%)",
  3: "linear-gradient(135deg, #f0b27a 0%, #a8602c 100%)",
};
const MEDAL_FALLBACK: Record<number, string> = { 1: COLORS.gold, 2: "#c9d0da", 3: "#c98547" };

/**
 * End of an online match: the team result and what's next on the left, and a
 * leaderboard of personal scores on the right. Players who joined the room after
 * the match ended are listed too, so everyone can see who's in for the next one.
 */
export function OnlineResults({
  level,
  state,
  localPlayerId,
  roomPlayers,
  roomCode,
  reconnecting,
  onNextLevel,
  onRestart,
  onBackToLobby,
  onExit,
  exitLabel,
  note,
}: OnlineResultsProps) {
  const insets = useSafeAreaInsets();
  const rules = resolveScoring(level);
  const team = calculateScore(state, rules);
  const won = state.status === "completed";
  const board = rankPlayers(state, rules);
  const me = board.find((entry) => entry.id === localPlayerId);
  const hostId = roomPlayers.find((player) => player.isHost)?.id;
  const latecomers = roomPlayers.filter((player) => !state.players[player.id]);

  return (
    <Animated.View entering={FadeIn.duration(350)} style={styles.backdrop}>
      {won && <Confetti />}
      <View
        style={[
          styles.content,
          { paddingLeft: insets.left + 28, paddingRight: insets.right + 20, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 },
        ]}
      >
        <ScrollView style={styles.summary} contentContainerStyle={styles.summaryContent} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInLeft.duration(450)}>
            <Eyebrow color={won ? COLORS.success : COLORS.danger}>{won ? "VICTORY" : "DEFEAT"}</Eyebrow>
          </Animated.View>
          <Animated.Text entering={ZoomIn.delay(80).springify().damping(12)} style={styles.title} accessibilityRole="header">
            {won ? "Level complete!" : FAIL_TITLES[state.failReason ?? "timeUp"]}
          </Animated.Text>
          <Text style={styles.subtitle}>
            {level.name} · {formatTime(state.elapsedSeconds)}
          </Text>

          {won && (
            <View style={styles.stars} accessible accessibilityLabel={`${team.stars} of ${MAX_STARS} stars`}>
              {Array.from({ length: MAX_STARS }, (_, index) => (
                <Animated.Text
                  key={index}
                  entering={ZoomIn.delay(300 + index * 160).springify().damping(9)}
                  style={[styles.star, index < team.stars ? styles.starOn : styles.starOff]}
                >
                  ★
                </Animated.Text>
              ))}
            </View>
          )}

          <Animated.View entering={FadeInDown.delay(250).duration(450)} style={styles.scoreRow}>
            <View style={styles.scoreCard}>
              <Text style={styles.scoreLabel}>TEAM SCORE</Text>
              <Text style={styles.scoreValue}>{team.total}</Text>
            </View>
            {me && (
              <View style={styles.scoreCard}>
                <Text style={styles.scoreLabel}>YOUR PLACE</Text>
                <Text style={styles.scoreValue}>
                  #{me.rank}
                  <Text style={styles.scoreOf}> of {board.length}</Text>
                </Text>
              </View>
            )}
          </Animated.View>

          {roomCode && (
            <Text style={styles.roomNote}>
              Room <Text style={styles.roomCode}>{roomCode}</Text> is open: players who left can rejoin.
            </Text>
          )}
          {reconnecting && <Text style={styles.reconnecting}>Connection lost. Reconnecting…</Text>}

          <Animated.View entering={FadeInDown.delay(400).duration(450)} style={styles.actions}>
            {onNextLevel && <GameButton label="Next level" icon="▶" shimmer onPress={onNextLevel} disabled={reconnecting} />}
            {onRestart && (
              <GameButton
                label={won ? "Play again" : "Try again"}
                icon="↻"
                variant={onNextLevel ? "secondary" : "primary"}
                shimmer={!onNextLevel}
                onPress={onRestart}
                disabled={reconnecting}
              />
            )}
            {onBackToLobby && <GameButton label="Back to lobby" icon="⌂" variant="secondary" onPress={onBackToLobby} disabled={reconnecting} />}
            <GameButton label={exitLabel} variant="ghost" onPress={onExit} />
          </Animated.View>
          {note && <Text style={styles.note}>{note}</Text>}
        </ScrollView>

        <Panel style={styles.board} delay={150}>
          <View style={styles.boardHeader}>
            <Text style={styles.boardTitle}>Leaderboard</Text>
            <Text style={styles.boardCount}>{board.length} players</Text>
          </View>
          <ScrollView style={styles.boardList} contentContainerStyle={styles.boardListContent} showsVerticalScrollIndicator={false}>
            {board.map((entry, index) => (
              <LeaderboardRow
                key={entry.id}
                entry={entry}
                index={index}
                isYou={entry.id === localPlayerId}
                isHost={entry.id === hostId}
                isMvp={entry.rank === 1 && entry.score.total > 0 && board.length > 1}
              />
            ))}
            {latecomers.length > 0 && (
              <Animated.View entering={FadeIn.delay(600)} style={styles.latecomers}>
                <Text style={styles.latecomersLabel}>Joined for the next match</Text>
                <View style={styles.latecomerChips}>
                  {latecomers.map((player) => (
                    <View key={player.id} style={styles.latecomerChip}>
                      <View style={[styles.latecomerDot, { backgroundColor: playerColor(player.slot) }]} />
                      <Text style={styles.latecomerName} numberOfLines={1}>
                        {player.name}
                        {player.id === localPlayerId ? " (you)" : ""}
                      </Text>
                    </View>
                  ))}
                </View>
              </Animated.View>
            )}
          </ScrollView>
        </Panel>
      </View>
    </Animated.View>
  );
}

function LeaderboardRow({
  entry,
  index,
  isYou,
  isHost,
  isMvp,
}: {
  entry: LeaderboardEntry;
  index: number;
  isYou: boolean;
  isHost: boolean;
  isMvp: boolean;
}) {
  const { stats } = entry;
  const chip = STATUS_CHIPS[entry.status];
  const medal = MEDALS[entry.rank];
  const statItems = [
    ["🗝", stats.itemsFound, "items"],
    ["🧩", stats.puzzlesSolved, "puzzles"],
    ["🚪", stats.doorsOpened, "doors"],
    ["📜", stats.cluesRead, "clues"],
    ["⚠", stats.trapHits, "trap hits"],
  ] as const;
  const shown = statItems.filter(([, value]) => value > 0);

  return (
    <Animated.View
      entering={FadeInRight.delay(250 + index * 90).duration(420)}
      style={[styles.row, isYou && styles.rowYou, entry.rank === 1 && styles.rowFirst]}
      accessible
      accessibilityLabel={`Rank ${entry.rank}, ${entry.name}${isYou ? " (you)" : ""}, ${entry.score.total} points, ${chip.label}`}
    >
      <View style={[styles.rank, medal ? { backgroundColor: MEDAL_FALLBACK[entry.rank], experimental_backgroundImage: medal } : styles.rankPlain]}>
        <Text style={[styles.rankText, !medal && styles.rankTextPlain]}>{entry.rank}</Text>
      </View>
      <View style={[styles.avatar, { backgroundColor: playerColor(entry.slot) }, entry.status === "left" && styles.faded]}>
        <Text style={styles.avatarText}>{entry.name.trim().charAt(0).toUpperCase() || "?"}</Text>
      </View>
      <View style={styles.rowInfo}>
        <View style={styles.nameLine}>
          <Text style={styles.name} numberOfLines={1}>
            {entry.name}
          </Text>
          {isMvp && <Text style={[styles.tag, styles.tagMvp]}>♛ MVP</Text>}
          {isHost && <Text style={[styles.tag, styles.tagHost]}>HOST</Text>}
          {isYou && <Text style={[styles.tag, styles.tagYou]}>YOU</Text>}
        </View>
        <Text style={styles.stats} numberOfLines={1}>
          {shown.length > 0 ? shown.map(([icon, value]) => `${icon} ${value}`).join("   ") : "No points scored"}
        </Text>
      </View>
      <View style={styles.rowEnd}>
        <Text style={styles.points}>{entry.score.total}</Text>
        <Text style={[styles.status, { color: chip.color }]}>{chip.label}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(10, 7, 22, 0.82)",
    experimental_backgroundImage:
      "radial-gradient(circle at 30% 20%, rgba(246, 196, 69, 0.14) 0%, rgba(10, 7, 22, 0) 55%), linear-gradient(180deg, rgba(10, 7, 22, 0.7) 0%, rgba(10, 7, 22, 0.92) 100%)",
  },
  content: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
  },
  summary: {
    flex: 1,
    alignSelf: "stretch",
  },
  summaryContent: {
    flexGrow: 1,
    justifyContent: "center",
    gap: 8,
    paddingVertical: 6,
  },
  title: {
    color: COLORS.text,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -0.5,
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 10,
  },
  subtitle: {
    color: COLORS.textMuted,
    fontSize: 14,
    marginTop: -4,
  },
  stars: {
    flexDirection: "row",
    gap: 6,
  },
  star: {
    fontSize: 34,
  },
  starOn: {
    color: COLORS.gold,
    textShadowColor: "rgba(246, 170, 60, 0.8)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  starOff: {
    color: "rgba(255, 255, 255, 0.15)",
  },
  scoreRow: {
    flexDirection: "row",
    gap: 10,
  },
  scoreCard: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: RADIUS.md,
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
  },
  scoreLabel: {
    color: COLORS.textDim,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  scoreValue: {
    color: COLORS.gold,
    fontSize: 24,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  scoreOf: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  roomNote: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  roomCode: {
    color: COLORS.text,
    fontWeight: "900",
    letterSpacing: 2,
  },
  reconnecting: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: "700",
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  note: {
    color: COLORS.textDim,
    fontSize: 12,
    fontStyle: "italic",
  },
  board: {
    flex: 1.15,
    maxWidth: 440,
    maxHeight: "100%",
    flexShrink: 1,
  },
  boardHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  boardTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
  },
  boardCount: {
    color: COLORS.textDim,
    fontSize: 12,
    fontWeight: "700",
  },
  boardList: {
    flexGrow: 0,
    flexShrink: 1,
  },
  boardListContent: {
    gap: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    padding: 8,
    borderRadius: RADIUS.md,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "transparent",
  },
  rowYou: {
    borderColor: "rgba(159, 196, 255, 0.45)",
  },
  rowFirst: {
    backgroundColor: "rgba(246, 196, 69, 0.12)",
    borderColor: "rgba(246, 196, 69, 0.5)",
  },
  rank: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  rankPlain: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  rankText: {
    color: COLORS.ink,
    fontSize: 13,
    fontWeight: "900",
  },
  rankTextPlain: {
    color: COLORS.textMuted,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  faded: {
    opacity: 0.4,
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  nameLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  name: {
    flexShrink: 1,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
  },
  tag: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
  },
  tagMvp: {
    color: COLORS.gold,
  },
  tagHost: {
    color: "#d59bff",
  },
  tagYou: {
    color: "#9fc4ff",
  },
  stats: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  rowEnd: {
    alignItems: "flex-end",
  },
  points: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  status: {
    fontSize: 10,
    fontWeight: "800",
  },
  latecomers: {
    gap: 6,
    marginTop: 4,
    padding: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  latecomersLabel: {
    color: COLORS.textDim,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  latecomerChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  latecomerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: RADIUS.pill,
    backgroundColor: "rgba(255, 255, 255, 0.07)",
  },
  latecomerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  latecomerName: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "700",
    maxWidth: 110,
  },
});
