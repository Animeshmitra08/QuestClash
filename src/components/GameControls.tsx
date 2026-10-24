import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { PlayerInput } from "@/game/PlayerInput";

import { ActionButton } from "./ActionButton";
import { VirtualJoystick } from "./VirtualJoystick";

const EDGE_MARGIN = 16;

interface GameControlsProps {
  input: PlayerInput;
  /** What USE would do right now, e.g. "Read". Null when nothing is in reach. */
  actionPrompt: string | null;
}

/**
 * On-screen touch controls, laid over the 3D view: joystick bottom-left for
 * the left thumb, action button bottom-right for the right thumb.
 * Stays clear of notches and rounded corners using the safe-area insets.
 */
export function GameControls({ input, actionPrompt }: GameControlsProps) {
  const insets = useSafeAreaInsets();
  const actionRight = insets.right + EDGE_MARGIN * 3;
  const actionBottom = insets.bottom + EDGE_MARGIN * 3;

  return (
    // box-none: this full-screen layer doesn't swallow touches itself, only its children do.
    <View style={styles.overlay} pointerEvents="box-none">
      <VirtualJoystick
        style={[styles.joystick, { left: insets.left + EDGE_MARGIN, bottom: insets.bottom + EDGE_MARGIN }]}
        onMove={(x, y) => input.setMove(x, y)}
        onRelease={() => input.clearMove()}
      />

      <ActionButton
        // Names what it will do ("READ", "PICK UP"…) while something is in reach.
        label={(actionPrompt ?? "Use").toUpperCase()}
        accessibilityLabel={actionPrompt ?? "Interact"}
        style={[
          styles.action,
          { right: actionRight, bottom: actionBottom },
          !actionPrompt && styles.actionIdle,
        ]}
        onPress={() => input.requestInteract()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
  },
  joystick: {
    position: "absolute",
  },
  action: {
    position: "absolute",
  },
  actionIdle: {
    // Still pressable, just visibly "nothing to use here".
    backgroundColor: "#a08a52",
  },
});
