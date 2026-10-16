import { Pressable, StyleSheet, Text, View } from "react-native";

interface MessageDialogProps {
  title: string;
  message: string;
  onClose: () => void;
}

/** Centered panel for reading in-world text (tablets, notes). Blocks touches behind it. */
export function MessageDialog({ title, message, onClose }: MessageDialogProps) {
  return (
    <View style={styles.backdrop}>
      <View style={styles.panel} accessibilityRole="alert">
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={onClose}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Close</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },
  panel: {
    width: "60%",
    maxWidth: 480,
    padding: 24,
    borderRadius: 12,
    backgroundColor: "#2a231a",
    borderWidth: 2,
    borderColor: "#8a7654",
    alignItems: "center",
  },
  title: {
    color: "#f2c230",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 12,
  },
  message: {
    color: "#f2e6d0",
    fontSize: 17,
    lineHeight: 25,
    textAlign: "center",
    fontStyle: "italic",
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#f2c230",
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: "#1b1712",
    fontSize: 16,
    fontWeight: "700",
  },
});
