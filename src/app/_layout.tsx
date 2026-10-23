import { Stack } from "expo-router";
import { NavigationBar } from "expo-navigation-bar";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function RootLayout() {
  return (
    // Required once at the root for react-native-gesture-handler (joystick, action button).
    <GestureHandlerRootView style={styles.root}>
      {/*
        Android: hide the system navigation bar (3-button or gesture bar) for a full-screen
        game. Swiping in from the screen edge shows it for a moment, over the game, then it
        hides itself again. app.json's expo-navigation-bar plugin hides it from launch, before
        this runs. No effect on iOS.
      */}
      <NavigationBar hidden />
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
