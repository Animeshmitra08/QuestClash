import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeIn, FadeInLeft, FadeInRight, LinearTransition, useReducedMotion, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LevelSession } from "@/components/LevelSession";
import { OnlineResults } from "@/components/OnlineResults";
import { GameButton } from "@/components/ui/GameButton";
import { ErrorBanner, Eyebrow, InfoNote, Panel } from "@/components/ui/Panel";
import { SceneryBackground } from "@/components/ui/SceneryBackground";
import { COLORS, RADIUS } from "@/components/ui/theme";
import { usePressScale } from "@/components/ui/usePressScale";
import { playerColor } from "@/game/Player";
import { LEVEL_CATALOG } from "@/levels/catalog";
import { GAME_SERVER_URL } from "@/net/config";
import { type LobbyPlayer, OnlineSession, type SessionView } from "@/net/OnlineSession";
import { MAX_NAME_LENGTH, MAX_ROOM_PLAYERS, NET_ERRORS, ROOM_CODE_LENGTH } from "@/net/protocol";

/** After this long "connecting", explain that a sleeping server can take a while to wake. */
const SLOW_CONNECT_MS = 5000;

const PULSE = { from: { opacity: 0.35, transform: [{ scale: 0.8 }] }, to: { opacity: 1, transform: [{ scale: 1.15 }] } };
const BLINK = { "0%": { opacity: 1 }, "50%": { opacity: 0 }, "100%": { opacity: 1 } };
const BOUNCE = { "0%": { opacity: 0.25 }, "30%": { opacity: 1 }, "60%": { opacity: 0.25 }, "100%": { opacity: 0.25 } };

/**
 * Online play: create or join a room by code, wait in the lobby until everyone is
 * ready, then play on the server. One OnlineSession lives as long as this screen.
 */
export default function OnlineScreen() {
  const [session] = useState(() => new OnlineSession(GAME_SERVER_URL));
  const view = useSyncExternalStore(session.subscribe, session.getView);

  // Leaving the screen leaves the room.
  useEffect(() => () => void session.leave(), [session]);

  const leaveRoom = () => void session.leave();

  if (view.match) {
    const { match } = view;
    const nextLevelId = match.level.nextLevelId;
    const exitLabel = view.isHost ? "Close room" : "Leave room";
    return (
      <LevelSession
        key={match.matchNumber}
        source={match}
        onRestart={view.isHost ? () => session.restart() : undefined}
        onQuit={leaveRoom}
        exitLabel={exitLabel}
        connectionNotice={view.status === "reconnecting" ? "Connection lost. Reconnecting…" : null}
        renderResults={(state) => (
          <OnlineResults
            level={match.level}
            state={state}
            localPlayerId={match.localPlayerId}
            roomPlayers={view.players}
            roomCode={view.code}
            reconnecting={view.status === "reconnecting"}
            onNextLevel={view.isHost && nextLevelId && state.status === "completed" ? () => session.nextLevel() : undefined}
            onRestart={view.isHost ? () => session.restart() : undefined}
            onBackToLobby={view.isHost ? () => session.backToLobby() : undefined}
            onExit={leaveRoom}
            exitLabel={exitLabel}
            note={
              view.isHost
                ? "Closing the room sends everyone home."
                : "Waiting for the host to choose what's next… You can leave and rejoin with the code."
            }
          />
        )}
      />
    );
  }

  const inRoom = view.status === "connected" || view.status === "reconnecting";

  return (
    <View style={styles.screen}>
      <StatusBar hidden />
      <SceneryBackground variant="night" />
      {inRoom ? <Lobby session={session} view={view} onLeave={leaveRoom} /> : <JoinForm session={session} view={view} />}
    </View>
  );
}

// --- Join / create ----------------------------------------------------------------------

function JoinForm({ session, view }: { session: OnlineSession; view: SessionView }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState<"create" | "join" | null>(null);
  const busy = view.status === "connecting";
  const slow = useSlowFlag(busy);
  const canCreate = name.trim().length > 0 && !busy;
  const canJoin = canCreate && code.trim().length === ROOM_CODE_LENGTH;

  const run = (action: "create" | "join") => {
    setPending(action);
    void (action === "create" ? session.create(name) : session.join(code, name)).finally(() => setPending(null));
  };

  return (
    <ScreenColumns
      left={
        <>
          <Animated.View entering={FadeInLeft.duration(500)} style={styles.headerRow}>
            <BackButton onPress={() => router.back()} />
            <Eyebrow color={COLORS.success}>PLAY ONLINE</Eyebrow>
          </Animated.View>
          <Animated.Text entering={FadeInLeft.delay(100).duration(600)} style={styles.title} accessibilityRole="header">
            Gather your party
          </Animated.Text>
          <Animated.Text entering={FadeInLeft.delay(180).duration(600)} style={styles.subtitle}>
            Team up with up to {MAX_ROOM_PLAYERS} players in real time.
          </Animated.Text>

          <Animated.View entering={FadeInLeft.delay(260).duration(600)} style={styles.field}>
            <View style={styles.fieldHeader}>
              <Text style={styles.label}>Your name</Text>
              <Text style={styles.counter}>
                {name.length}/{MAX_NAME_LENGTH}
              </Text>
            </View>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              maxLength={MAX_NAME_LENGTH}
              placeholder="Adventurer"
              placeholderTextColor={COLORS.textDim}
              autoCorrect={false}
              returnKeyType="done"
              accessibilityLabel="Your name"
            />
          </Animated.View>

          <Animated.View entering={FadeIn.delay(400)}>
            <ServerChip state={busy ? "busy" : view.error === NET_ERRORS.serverUnreachable ? "error" : "idle"} />
          </Animated.View>

          {view.error && <ErrorBanner message={view.error} />}
          {busy && slow && <InfoNote message="Waking the server up… the first connection can take up to a minute." />}
        </>
      }
      right={
        <Panel style={styles.sidePanel} delay={200}>
          <Text style={styles.sectionTitle}>Host a room</Text>
          <Text style={styles.sectionText}>Create a room, then share its code with your friends.</Text>
          <GameButton
            label="Create room"
            icon="✦"
            shimmer
            onPress={() => run("create")}
            disabled={!canCreate}
            loading={busy && pending === "create"}
          />

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <Text style={styles.sectionTitle}>Join a friend</Text>
          <CodeInput value={code} onChange={setCode} />
          <GameButton
            label="Join room"
            icon="➜"
            variant="secondary"
            onPress={() => run("join")}
            disabled={!canJoin}
            loading={busy && pending === "join"}
          />
          {!name.trim() && <Text style={styles.hint}>Enter your name to continue.</Text>}
        </Panel>
      }
    />
  );
}

/** True once `active` has stayed true for SLOW_CONNECT_MS. */
function useSlowFlag(active: boolean) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setSlow(true), SLOW_CONNECT_MS);
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [active]);
  return active && slow;
}

/** Five letter boxes over a hidden text field: tap anywhere to type the code. */
function CodeInput({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const animate = !useReducedMotion();
  const activeIndex = Math.min(value.length, ROOM_CODE_LENGTH - 1);

  return (
    <Pressable style={styles.codeRow} onPress={() => input.current?.focus()} accessible={false}>
      {Array.from({ length: ROOM_CODE_LENGTH }, (_, index) => {
        const char = value[index];
        const active = focused && index === activeIndex;
        return (
          <View key={index} style={[styles.codeBox, char && styles.codeBoxFilled, active && styles.codeBoxActive]}>
            {char ? (
              <Animated.Text key={char} entering={ZoomIn.duration(160)} style={styles.codeChar}>
                {char}
              </Animated.Text>
            ) : (
              active && (
                <Animated.View
                  style={[
                    styles.caret,
                    animate && { animationName: BLINK, animationDuration: 1000, animationIterationCount: "infinite" },
                  ]}
                />
              )
            )}
          </View>
        );
      })}
      <TextInput
        ref={input}
        style={styles.hiddenInput}
        value={value}
        onChangeText={(text) => onChange(text.replace(/[^a-z0-9]/gi, "").toUpperCase())}
        maxLength={ROOM_CODE_LENGTH}
        autoCapitalize="characters"
        autoCorrect={false}
        caretHidden
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel="Room code"
        accessibilityHint={`${ROOM_CODE_LENGTH} letters or numbers`}
      />
    </Pressable>
  );
}

const SERVER_CHIP_LABELS = {
  idle: "Game server",
  busy: "Connecting to the game server…",
  error: "Game server unreachable",
} as const;

function ServerChip({ state }: { state: keyof typeof SERVER_CHIP_LABELS }) {
  const animate = !useReducedMotion();
  const color = state === "error" ? COLORS.danger : state === "busy" ? COLORS.gold : COLORS.success;
  return (
    <View style={styles.chip}>
      <Animated.View
        style={[
          styles.dot,
          { backgroundColor: color, boxShadow: `0 0 8px ${color}` },
          animate &&
            state === "busy" && {
              animationName: PULSE,
              animationDuration: 600,
              animationIterationCount: "infinite",
              animationDirection: "alternate",
            },
        ]}
      />
      <Text style={styles.chipText} numberOfLines={1}>
        {SERVER_CHIP_LABELS[state]}
      </Text>
    </View>
  );
}

// --- Lobby --------------------------------------------------------------------------------

function Lobby({ session, view, onLeave }: { session: OnlineSession; view: SessionView; onLeave: () => void }) {
  const me = view.players.find((player) => player.isYou);
  const level = LEVEL_CATALOG.find((candidate) => candidate.id === view.levelId);
  const code = view.code ?? "";
  const readyCount = view.players.filter((player) => player.ready && player.connected).length;
  const connectedCount = view.players.filter((player) => player.connected).length;
  const readyShare = connectedCount === 0 ? 0 : readyCount / connectedCount;
  const reconnecting = view.status === "reconnecting";
  const afterMatch = view.phase === "finished";

  const shareCode = () => {
    void Share.share({ message: `Join my QuestClash room! Code: ${code}` }).catch(() => {});
  };

  return (
    <ScreenColumns
      left={
        <>
          <Animated.View entering={FadeInLeft.duration(500)} style={styles.headerRow}>
            <Eyebrow color={COLORS.success}>ROOM CODE</Eyebrow>
            <StatusPill reconnecting={reconnecting} />
          </Animated.View>

          <View style={styles.codeTiles} accessible accessibilityLabel={`Room code ${[...code].join(" ")}`}>
            {[...code].map((char, index) => (
              <Animated.View key={`${index}-${char}`} entering={ZoomIn.delay(120 + index * 70).springify().damping(12)} style={styles.codeTile}>
                <Text style={styles.codeTileChar}>{char}</Text>
              </Animated.View>
            ))}
          </View>

          <Animated.View entering={FadeIn.delay(500)} style={styles.shareRow}>
            <GameButton label="Share code" icon="↗" variant="secondary" onPress={shareCode} />
            <Text style={[styles.sectionText, styles.shareText]}>Friends enter this code under “Join a friend”.</Text>
          </Animated.View>

          <Text style={[styles.label, styles.spaced]}>Level</Text>
          {view.isHost ? (
            <View style={styles.levelChoices}>
              {LEVEL_CATALOG.map((candidate, index) => (
                <LevelChoice
                  key={candidate.id}
                  name={candidate.name}
                  number={index + 1}
                  selected={candidate.id === view.levelId}
                  onPress={() => session.selectLevel(candidate.id)}
                />
              ))}
            </View>
          ) : (
            <View style={styles.levelReadOnly}>
              <Text style={styles.levelReadOnlyName}>{level?.name ?? view.levelId}</Text>
              <Text style={styles.sectionText}>The host chooses the level.</Text>
            </View>
          )}

          {view.error && <ErrorBanner message={view.error} />}
        </>
      }
      right={
        <Panel style={styles.sidePanel} delay={150}>
          <View style={styles.partyHeader}>
            <Text style={styles.sectionTitle}>Party</Text>
            <Text style={styles.partyCount}>
              {view.players.length}/{MAX_ROOM_PLAYERS}
            </Text>
          </View>

          <View style={styles.readyMeter}>
            <View style={styles.readyTrack}>
              <Animated.View
                style={[
                  styles.readyFill,
                  {
                    width: `${Math.round(readyShare * 100)}%`,
                    transitionProperty: "width",
                    transitionDuration: 450,
                    transitionTimingFunction: "ease-out",
                  },
                ]}
              />
            </View>
            <Text style={styles.readyLabel}>
              {readyCount} of {connectedCount} ready
            </Text>
          </View>

          <ScrollView style={styles.playerList} contentContainerStyle={styles.playerListContent} showsVerticalScrollIndicator={false}>
            {view.players.map((player, index) => (
              <PlayerRow key={player.id} player={player} index={index} />
            ))}
            {view.players.length < MAX_ROOM_PLAYERS && <WaitingRow />}
          </ScrollView>

          {afterMatch ? (
            // Rejoined while the others are still on the end-of-match screen.
            <Text style={styles.hint}>A match just ended. Waiting for the host to start the next one…</Text>
          ) : (
            <>
              <Text style={styles.hint}>The match starts when everyone is ready.</Text>
              {me?.ready ? (
                <GameButton label="Ready! Tap to cancel" icon="✓" variant="success" onPress={() => session.setReady(false)} />
              ) : (
                <GameButton label="I'm ready" icon="⚑" shimmer onPress={() => session.setReady(true)} disabled={reconnecting} />
              )}
            </>
          )}
          <GameButton label={view.isHost ? "Close room" : "Leave room"} variant="ghost" onPress={onLeave} />
          {view.isHost && <Text style={styles.hint}>Closing the room sends everyone home.</Text>}
        </Panel>
      }
    />
  );
}

function StatusPill({ reconnecting }: { reconnecting: boolean }) {
  const animate = !useReducedMotion();
  const color = reconnecting ? COLORS.gold : COLORS.success;
  return (
    <View style={[styles.statusPill, { borderColor: color }]} accessibilityLiveRegion="polite">
      <Animated.View
        style={[
          styles.dot,
          { backgroundColor: color, boxShadow: `0 0 8px ${color}` },
          animate && {
            animationName: PULSE,
            animationDuration: reconnecting ? 500 : 1400,
            animationIterationCount: "infinite",
            animationDirection: "alternate",
          },
        ]}
      />
      <Text style={[styles.statusText, { color }]}>{reconnecting ? "Reconnecting…" : "Connected"}</Text>
    </View>
  );
}

function LevelChoice({ name, number, selected, onPress }: { name: string; number: number; selected: boolean; onPress: () => void }) {
  const press = usePressScale(0.96);
  return (
    <Animated.View style={press.style}>
      <Pressable
        style={[styles.levelChoice, selected && styles.levelChoiceSelected]}
        onPress={onPress}
        {...press.handlers}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={`Level ${number}, ${name}`}
      >
        <Text style={[styles.levelChoiceNumber, selected && styles.levelChoiceTextSelected]}>{number}</Text>
        <Text style={[styles.levelChoiceText, selected && styles.levelChoiceTextSelected]}>{name}</Text>
        {selected && <Text style={styles.levelChoiceCheck}>✓</Text>}
      </Pressable>
    </Animated.View>
  );
}

function PlayerRow({ player, index }: { player: LobbyPlayer; index: number }) {
  const color = playerColor(player.slot);
  const status = !player.connected ? "away" : player.ready ? "ready" : "waiting";
  return (
    <Animated.View
      entering={FadeInRight.delay(index * 60).duration(400)}
      layout={LinearTransition.springify().damping(18)}
      style={[styles.playerRow, player.isYou && styles.playerRowYou]}
    >
      <View
        style={[
          styles.avatar,
          { backgroundColor: color },
          player.ready && player.connected && { boxShadow: `0 0 0 2px ${COLORS.ink}, 0 0 0 4px ${COLORS.success}` },
          !player.connected && styles.avatarAway,
        ]}
      >
        <Text style={styles.avatarText}>{player.name.trim().charAt(0).toUpperCase() || "?"}</Text>
      </View>
      <View style={styles.playerInfo}>
        <Text style={styles.playerName} numberOfLines={1}>
          {player.name}
        </Text>
        <View style={styles.tags}>
          {player.isHost && <Text style={[styles.tag, styles.tagHost]}>♛ HOST</Text>}
          {player.isYou && <Text style={[styles.tag, styles.tagYou]}>YOU</Text>}
          {player.connected && <PingBadge ms={player.ping} />}
        </View>
      </View>
      <Animated.View key={status} entering={ZoomIn.duration(220)} style={[styles.statusBadge, STATUS_BADGES[status].box]}>
        <Text style={[styles.statusBadgeText, STATUS_BADGES[status].text]}>{STATUS_BADGES[status].label}</Text>
      </Animated.View>
    </Animated.View>
  );
}

/** Signal bars and the round trip in ms: green under 100, gold under 200, red above. */
function PingBadge({ ms }: { ms: number | null }) {
  const quality = ms === null ? 0 : ms < 100 ? 3 : ms < 200 ? 2 : 1;
  const color = [COLORS.textDim, COLORS.danger, COLORS.gold, COLORS.success][quality];
  return (
    <View style={styles.ping} accessible accessibilityLabel={ms === null ? "Ping not measured yet" : `Ping ${ms} milliseconds`}>
      <View style={styles.pingBars}>
        {[1, 2, 3].map((bar) => (
          <View
            key={bar}
            style={[styles.pingBar, { height: 3 + bar * 2, backgroundColor: bar <= quality ? color : "rgba(255, 255, 255, 0.18)" }]}
          />
        ))}
      </View>
      <Text style={[styles.pingText, { color }]}>{ms === null ? "– ms" : `${ms} ms`}</Text>
    </View>
  );
}

function WaitingRow() {
  const animate = !useReducedMotion();
  return (
    <Animated.View entering={FadeIn.delay(300)} layout={LinearTransition} style={styles.waitingRow}>
      <View style={styles.waitingAvatar}>
        <Text style={styles.waitingPlus}>+</Text>
      </View>
      <Text style={styles.waitingText}>Waiting for players</Text>
      <View style={styles.dots}>
        {[0, 1, 2].map((dot) => (
          <Animated.View
            key={dot}
            style={[
              styles.waitingDot,
              animate && {
                animationName: BOUNCE,
                animationDuration: 1200,
                animationDelay: dot * 180,
                animationIterationCount: "infinite",
              },
            ]}
          />
        ))}
      </View>
    </Animated.View>
  );
}

// --- Shared layout --------------------------------------------------------------------------

function ScreenColumns({ left, right }: { left: ReactNode; right: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.columns,
        { paddingLeft: insets.left + 32, paddingRight: insets.right + 24, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 },
      ]}
    >
      <ScrollView
        style={styles.leftColumn}
        contentContainerStyle={styles.leftContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {left}
      </ScrollView>
      <View style={styles.rightColumn}>{right}</View>
    </View>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  const press = usePressScale(0.9);
  return (
    <Animated.View style={press.style}>
      <Pressable style={styles.backButton} onPress={onPress} {...press.handlers} accessibilityRole="button" accessibilityLabel="Back">
        <Text style={styles.backGlyph}>‹</Text>
      </Pressable>
    </Animated.View>
  );
}

const STATUS_BADGES = {
  ready: {
    label: "Ready",
    box: { backgroundColor: "rgba(79, 227, 168, 0.16)", borderColor: "rgba(79, 227, 168, 0.6)" },
    text: { color: COLORS.success },
  },
  waiting: {
    label: "Not ready",
    box: { backgroundColor: "rgba(255, 255, 255, 0.06)", borderColor: "rgba(255, 255, 255, 0.16)" },
    text: { color: COLORS.textMuted },
  },
  away: {
    label: "Reconnecting",
    box: { backgroundColor: "rgba(255, 125, 110, 0.14)", borderColor: "rgba(255, 125, 110, 0.5)" },
    text: { color: COLORS.danger },
  },
} as const;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.ink,
  },
  columns: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 28,
  },
  leftColumn: {
    flex: 1,
    alignSelf: "stretch",
  },
  leftContent: {
    flexGrow: 1,
    justifyContent: "center",
    gap: 10,
    paddingVertical: 8,
  },
  rightColumn: {
    flex: 1,
    maxWidth: 380,
    maxHeight: "100%",
    justifyContent: "center",
  },
  sidePanel: {
    flexShrink: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
  },
  backGlyph: {
    color: COLORS.text,
    fontSize: 24,
    lineHeight: 26,
    fontWeight: "600",
    marginTop: -2,
    marginLeft: -2,
  },
  title: {
    color: COLORS.text,
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: -0.5,
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 10,
  },
  subtitle: {
    color: COLORS.textMuted,
    fontSize: 15,
    marginTop: -4,
  },
  field: {
    gap: 6,
    marginTop: 4,
  },
  fieldHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  label: {
    color: COLORS.gold,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  counter: {
    color: COLORS.textDim,
    fontSize: 12,
  },
  spaced: {
    marginTop: 6,
  },
  input: {
    backgroundColor: COLORS.field,
    borderWidth: 1,
    borderColor: COLORS.fieldBorder,
    borderRadius: RADIUS.md,
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "600",
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    maxWidth: "100%",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: RADIUS.pill,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipText: {
    flexShrink: 1,
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
  },
  sectionText: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: -6,
  },
  hint: {
    color: COLORS.textDim,
    fontSize: 12,
    textAlign: "center",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.panelBorder,
  },
  dividerText: {
    color: COLORS.textDim,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
  },
  codeRow: {
    flexDirection: "row",
    gap: 8,
  },
  codeBox: {
    flex: 1,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.field,
    borderWidth: 1.5,
    borderColor: COLORS.fieldBorder,
  },
  codeBoxFilled: {
    borderColor: "rgba(246, 196, 69, 0.55)",
    backgroundColor: "rgba(246, 196, 69, 0.08)",
  },
  codeBoxActive: {
    borderColor: COLORS.gold,
    boxShadow: "0 0 12px rgba(246, 196, 69, 0.45)",
  },
  codeChar: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
  },
  caret: {
    width: 2,
    height: 22,
    borderRadius: 1,
    backgroundColor: COLORS.gold,
  },
  hiddenInput: {
    ...StyleSheet.absoluteFill,
    opacity: 0,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "800",
  },
  codeTiles: {
    flexDirection: "row",
    gap: 8,
  },
  codeTile: {
    width: 52,
    height: 62,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.md,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(246, 196, 69, 0.55)",
    boxShadow: "0 6px 16px rgba(0, 0, 0, 0.35), 0 0 14px rgba(246, 196, 69, 0.2)",
  },
  codeTileChar: {
    color: COLORS.text,
    fontSize: 32,
    fontWeight: "900",
  },
  shareRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  shareText: {
    flex: 1,
    marginTop: 0,
  },
  levelChoices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  levelChoice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: RADIUS.pill,
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    borderWidth: 1,
    borderColor: COLORS.fieldBorder,
  },
  levelChoiceSelected: {
    backgroundColor: "rgba(246, 196, 69, 0.18)",
    borderColor: COLORS.gold,
  },
  levelChoiceNumber: {
    color: COLORS.textDim,
    fontWeight: "900",
  },
  levelChoiceText: {
    color: COLORS.text,
    fontWeight: "700",
  },
  levelChoiceTextSelected: {
    color: COLORS.gold,
  },
  levelChoiceCheck: {
    color: COLORS.gold,
    fontWeight: "900",
  },
  levelReadOnly: {
    gap: 8,
    padding: 12,
    borderRadius: RADIUS.md,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  levelReadOnlyName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "800",
  },
  partyHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  partyCount: {
    color: COLORS.gold,
    fontSize: 15,
    fontWeight: "900",
  },
  readyMeter: {
    gap: 4,
  },
  readyTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  readyFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: COLORS.success,
    experimental_backgroundImage: "linear-gradient(90deg, #24b886 0%, #6ff0bd 100%)",
  },
  readyLabel: {
    color: COLORS.textDim,
    fontSize: 11,
    fontWeight: "700",
  },
  playerList: {
    flexGrow: 0,
    flexShrink: 1,
  },
  playerListContent: {
    gap: 6,
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 8,
    borderRadius: RADIUS.md,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "transparent",
  },
  playerRowYou: {
    borderColor: "rgba(246, 196, 69, 0.35)",
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarAway: {
    opacity: 0.4,
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  playerInfo: {
    flex: 1,
    gap: 2,
  },
  playerName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700",
  },
  tags: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  ping: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  pingBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 1.5,
  },
  pingBar: {
    width: 2.5,
    borderRadius: 1,
  },
  pingText: {
    fontSize: 10,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  tag: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
  },
  tagHost: {
    color: COLORS.gold,
  },
  tagYou: {
    color: "#9fc4ff",
  },
  statusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  waitingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  waitingAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  waitingPlus: {
    color: COLORS.textDim,
    fontSize: 18,
    fontWeight: "700",
  },
  waitingText: {
    flex: 1,
    color: COLORS.textDim,
    fontSize: 13,
    fontWeight: "600",
  },
  dots: {
    flexDirection: "row",
    gap: 4,
    paddingRight: 6,
  },
  waitingDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.textMuted,
  },
});
