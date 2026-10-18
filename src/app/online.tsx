import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LevelSession } from "@/components/LevelSession";
import { playerColor } from "@/game/Player";
import { LEVEL_CATALOG } from "@/levels/catalog";
import { GAME_SERVER_URL } from "@/net/config";
import { OnlineSession, type SessionView } from "@/net/OnlineSession";
import { MAX_NAME_LENGTH, MAX_ROOM_PLAYERS, ROOM_CODE_LENGTH } from "@/net/protocol";

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
    return (
      <LevelSession
        key={match.matchNumber}
        source={match}
        onRestart={view.isHost ? () => session.restart() : undefined}
        onNextLevel={view.isHost && nextLevelId ? () => session.nextLevel() : undefined}
        onQuit={leaveRoom}
        connectionNotice={view.status === "reconnecting" ? "Connection lost. Reconnecting…" : null}
        waitingNote={view.isHost ? undefined : "Waiting for the host to choose what's next…"}
      />
    );
  }

  if (view.status === "connected" || view.status === "reconnecting") {
    return <Lobby session={session} view={view} onLeave={leaveRoom} />;
  }

  return <JoinForm session={session} view={view} />;
}

function JoinForm({ session, view }: { session: OnlineSession; view: SessionView }) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const busy = view.status === "connecting";
  const canCreate = name.trim().length > 0 && !busy;
  const canJoin = canCreate && code.trim().length === ROOM_CODE_LENGTH;

  return (
    <View style={[styles.screen, { paddingLeft: insets.left + 32, paddingRight: insets.right + 32 }]}>
      <StatusBar hidden />
      <View style={styles.column}>
        <Text style={styles.eyebrow}>PLAY ONLINE</Text>
        <Text style={styles.title}>Up to {MAX_ROOM_PLAYERS} players</Text>
        <Text style={styles.muted}>Server: {GAME_SERVER_URL}</Text>

        <Text style={styles.label}>Your name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          maxLength={MAX_NAME_LENGTH}
          placeholder="Name"
          placeholderTextColor="#7d6f5c"
          autoCorrect={false}
        />

        {view.error && <Text style={styles.error}>{view.error}</Text>}
        {busy && <ActivityIndicator color="#f2c230" style={styles.spinner} />}
      </View>

      <View style={styles.column}>
        <Button label="Create a room" onPress={() => void session.create(name)} disabled={!canCreate} />

        <Text style={[styles.label, styles.spaced]}>Or join with a code</Text>
        <TextInput
          style={[styles.input, styles.codeInput]}
          value={code}
          onChangeText={(text) => setCode(text.toUpperCase())}
          maxLength={ROOM_CODE_LENGTH}
          placeholder="ABCDE"
          placeholderTextColor="#7d6f5c"
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <Button label="Join room" onPress={() => void session.join(code, name)} disabled={!canJoin} />
        <Button label="Back" secondary onPress={() => router.back()} />
      </View>
    </View>
  );
}

function Lobby({ session, view, onLeave }: { session: OnlineSession; view: SessionView; onLeave: () => void }) {
  const insets = useSafeAreaInsets();
  const me = view.players.find((player) => player.isYou);
  const level = LEVEL_CATALOG.find((candidate) => candidate.id === view.levelId);

  return (
    <View style={[styles.screen, { paddingLeft: insets.left + 32, paddingRight: insets.right + 32 }]}>
      <StatusBar hidden />
      <View style={styles.column}>
        <Text style={styles.eyebrow}>ROOM CODE</Text>
        <Text style={styles.code} accessibilityLabel={`Room code ${[...(view.code ?? "")].join(" ")}`}>
          {view.code}
        </Text>
        <Text style={styles.muted}>Share this code with your friends.</Text>

        <Text style={[styles.label, styles.spaced]}>Level</Text>
        {view.isHost ? (
          <View style={styles.levelChoices}>
            {LEVEL_CATALOG.map((candidate) => (
              <Pressable
                key={candidate.id}
                style={[styles.levelChoice, candidate.id === view.levelId && styles.levelChoiceSelected]}
                onPress={() => session.selectLevel(candidate.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: candidate.id === view.levelId }}
              >
                <Text style={styles.levelChoiceText}>{candidate.name}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={styles.value}>{level?.name ?? view.levelId} (the host chooses)</Text>
        )}

        {view.status === "reconnecting" && <Text style={styles.error}>Connection lost. Reconnecting…</Text>}
        {view.error && <Text style={styles.error}>{view.error}</Text>}
      </View>

      <View style={styles.column}>
        <Text style={styles.label}>
          Players ({view.players.length}/{MAX_ROOM_PLAYERS})
        </Text>
        <ScrollView style={styles.playerList} contentContainerStyle={styles.playerListContent}>
          {view.players.map((player) => (
            <View key={player.id} style={styles.playerRow}>
              <View style={[styles.swatch, { backgroundColor: playerColor(player.slot) }]} />
              <Text style={styles.playerName} numberOfLines={1}>
                {player.name}
                {player.isYou ? " (you)" : ""}
                {player.isHost ? " ★" : ""}
              </Text>
              <Text style={[styles.status, player.ready && styles.ready, !player.connected && styles.offline]}>
                {!player.connected ? "Reconnecting" : player.ready ? "Ready" : "Not ready"}
              </Text>
            </View>
          ))}
        </ScrollView>
        <Text style={styles.muted}>The match starts when everyone is ready.</Text>
        <Button label={me?.ready ? "Not ready" : "I'm ready"} onPress={() => session.setReady(!me?.ready)} />
        <Button label="Leave room" secondary onPress={onLeave} />
      </View>
    </View>
  );
}

function Button({
  label,
  onPress,
  disabled = false,
  secondary = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        secondary && styles.buttonSecondary,
        (pressed || disabled) && styles.buttonDim,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 32,
    backgroundColor: "#1b1712",
  },
  column: {
    flex: 1,
    gap: 8,
  },
  eyebrow: {
    color: "#f2c230",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
  },
  title: {
    color: "#f2e6d0",
    fontSize: 28,
    fontWeight: "900",
  },
  code: {
    color: "#f2e6d0",
    fontSize: 48,
    fontWeight: "900",
    letterSpacing: 8,
    fontVariant: ["tabular-nums"],
  },
  muted: {
    color: "#c9b99c",
    fontSize: 13,
  },
  label: {
    color: "#f2c230",
    fontSize: 14,
    fontWeight: "700",
  },
  spaced: {
    marginTop: 10,
  },
  value: {
    color: "#f2e6d0",
    fontSize: 15,
  },
  input: {
    backgroundColor: "#2a231a",
    borderWidth: 1,
    borderColor: "#8a7654",
    borderRadius: 8,
    color: "#f2e6d0",
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  codeInput: {
    fontSize: 22,
    letterSpacing: 6,
    fontWeight: "800",
  },
  error: {
    color: "#ff8a7a",
    fontSize: 14,
    fontWeight: "600",
  },
  spinner: {
    alignSelf: "flex-start",
  },
  levelChoices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  levelChoice: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#8a7654",
  },
  levelChoiceSelected: {
    backgroundColor: "#f2c230",
    borderColor: "#f2c230",
  },
  levelChoiceText: {
    color: "#f2e6d0",
    fontWeight: "700",
  },
  playerList: {
    maxHeight: 180,
    flexGrow: 0,
  },
  playerListContent: {
    gap: 6,
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(242, 230, 208, 0.06)",
  },
  swatch: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  playerName: {
    flex: 1,
    color: "#f2e6d0",
    fontSize: 15,
    fontWeight: "600",
  },
  status: {
    color: "#c9b99c",
    fontSize: 13,
  },
  ready: {
    color: "#3fe0b0",
    fontWeight: "700",
  },
  offline: {
    color: "#ff8a7a",
  },
  button: {
    backgroundColor: "#f2c230",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonSecondary: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "#f2c230",
  },
  buttonDim: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#1b1712",
    fontSize: 16,
    fontWeight: "800",
  },
  buttonTextSecondary: {
    color: "#f2c230",
  },
});
