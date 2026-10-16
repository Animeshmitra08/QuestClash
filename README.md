# QuestClash

A 2.5D third-person puzzle-adventure prototype for Android and iOS, built with Expo, React Three Fiber, and Three.js.

**Stage 1 – The Forgotten Temple:** find the key, read the clue, solve the sun dial, open the locked door, time your run past the spike trap, and reach the exit. Score depends on time, trap hits and wrong answers. Single-player only.

## Project structure

```
src/
  app/                 Screens (Expo Router): index.tsx = start screen, game.tsx = game screen
  components/          React Native UI: joystick, USE button, HUD, inventory, dialogs, pause menu
  game/                3D scene and per-frame logic
    GameScene.tsx        The <Canvas>; creates the game systems and mounts everything below
    levels/              Level data (walls, objects, trap, exit, puzzle); no code
    MovementController   Joystick → camera-relative movement (pure logic)
    CollisionSystem      Push-out collision against boxes, with wall sliding (pure logic)
    InteractionSystem    Which object USE would act on (pure logic)
    PlayerController, StageController   Per-frame glue between input, logic and the scene
    Player, Room, Interactables, TriggerVisuals, CameraController   Rendering only
    gameClock            useGameFrame: frame time that is 0 while paused
  systems/             Game rules, no React or Three.js: StageManager, PuzzleSystem, TrapSystem, ScoreSystem
  hooks/, types/       React hooks and shared TypeScript types
docs/
  DEVICE_TESTING.md    Full on-device test checklist, and how to make a release build
  ASSETS_AND_CONFIG.md Adding Blender models, textures and audio; configuration; troubleshooting
```

The rule of the codebase: **game rules don't know about rendering.** The 3D scene reports events (USE pressed on an object, player on the trap, exit reached) to `StageManager`, which decides what happens. The HUD and the scene both just display the resulting state.

## Stack (pinned versions)

| Package                          | Version   | Why                                                         |
| -------------------------------- | --------- | ----------------------------------------------------------- |
| `expo`                           | SDK 57    | App runtime and native modules                              |
| `react` / `react-native`         | 19.2.3 / 0.86.3 | Bundled with SDK 57                                   |
| `three`                          | 0.186.1   | 3D engine (pinned exactly; three has no semver guarantees)  |
| `@react-three/fiber`             | 9.8.2     | React renderer for three. Peer range: React `>=19 <19.4`    |
| `expo-gl`                        | ~57.0.2   | Native OpenGL ES surface that R3F renders into              |
| `expo-asset`, `expo-file-system` | SDK 57    | Used by R3F to load GLB models and textures on device       |
| `expo-dev-client`                | ~57.0.20  | Development build (replaces Expo Go)                        |

Import R3F from `@react-three/fiber/native` (not `@react-three/fiber`) in app code.

## Prerequisites

- Node.js 20+ (tested with 22.23.2)
- For local Android builds: Android Studio with Android SDK 36, and JDK 17
- An Android phone with **Developer options** and **USB debugging** enabled

## Install

```bash
npm install
```

## Run on a physical Android device

This project uses a **development build** (your own debug app with the dev menu), not Expo Go. The development build only needs rebuilding when native dependencies or `app.json` change. JavaScript changes reload live.

### Option A: build locally over USB

1. Connect the phone by USB and accept the "Allow USB debugging" prompt.
2. Check that it is detected:
   ```bash
   adb devices
   ```
3. Build, install, and start the dev server (the first build takes 5–15 minutes):
   ```bash
   npx expo run:android --device
   ```
4. Next time, if you only changed JavaScript, just run:
   ```bash
   npx expo start
   ```
   and open the QuestClash app on the phone.

The phone and PC must be on the same Wi-Fi network. If they are not, run `adb reverse tcp:8081 tcp:8081` while the phone is connected by USB.

### Option B: build in the cloud with EAS

No Android Studio is needed. This requires a free Expo account.

```bash
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile development
```

When the build finishes, scan the QR code on your phone to install the APK. Then run `npx expo start` and open the app.

`eas build --local` is not supported on Windows. Use Option A for local builds.

## Checks

```bash
npx tsc --noEmit     # typecheck
npx expo lint        # lint
npx expo-doctor      # dependency / config health
```

## Release build (for testing outside the dev server)

```bash
npx expo run:android --variant release --device                   # local, debug-signed
npx eas-cli@latest build --platform android --profile preview     # cloud, installable APK
```

See [docs/DEVICE_TESTING.md](docs/DEVICE_TESTING.md) for the full checklist.

## Troubleshooting

The most common problems:

- **`TypeError: undefined is not a function` on opening the game:** restart Metro with `npx expo start --clear`. `metro.config.js` must be loaded; it keeps the crashing `three.cjs` out of the bundle.
- **Black or blank 3D view:** turn off remote JS debugging, which breaks `expo-gl`, and check Metro logs for `EXGL:` errors.
- **"No development build installed":** run `npx expo run:android` again, or install the EAS APK.
- **Build fails after adding a package:** run `npx expo install --fix`, then rebuild.
- **App doesn't connect to the dev server:** use the same Wi-Fi network, or `adb reverse tcp:8081 tcp:8081` over USB. Also allow Node through Windows Firewall.

More, including assets and models: [docs/ASSETS_AND_CONFIG.md](docs/ASSETS_AND_CONFIG.md#7-troubleshooting).
