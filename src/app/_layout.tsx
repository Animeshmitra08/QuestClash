import { Stack } from "expo-router";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function RootLayout() {
  return (
    // Required once at the root for react-native-gesture-handler (joystick, action button).
    <GestureHandlerRootView style={styles.root}>
      {/* Full-screen game: no navigation header on any screen. */}
      <Stack screenOptions={{ headerShown: false }} />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
