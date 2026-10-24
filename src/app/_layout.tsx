import { Stack } from "expo-router";
import { NavigationBar } from "expo-navigation-bar";
import * as SplashScreen from "expo-splash-screen";
import { useCallback, useState } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { BrandSplash } from "@/components/BrandSplash";

// Keep the native splash (app.json) up until BrandSplash has drawn the same picture over
// the app; it then hides it, so there's no flash in between. Called here, at load time,
// because inside a component it could run after the splash has already gone.
void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 250, fade: true });

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);
  const finishSplash = useCallback(() => setShowSplash(false), []);

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
      {/* Over the first screen, which loads underneath it and is ready when it fades away. */}
      {showSplash && <BrandSplash onDone={finishSplash} />}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
