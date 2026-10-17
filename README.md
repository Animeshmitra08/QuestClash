# QuestClash

A 2.5D third-person puzzle-adventure prototype for Android and iOS, built with Expo, React Three Fiber, and Three.js.

Two single-player levels, both built from configuration on the same systems:
- **Forgotten Temple:** find the key, read the clue, solve the sun dial, open the locked door, time your run past the spike trap, and reach the exit.
- **Moonlit Cloister:** a key-only gate, two out-of-step spike traps, an exit sealed until the moon altar is answered, and a two-minute time limit.

Score depends on progress, time, trap hits and wrong answers; each level awards up to three stars.

## Project structure

```
src/
  app/                   Screens (Expo Router): index.tsx = start screen + level list, game.tsx = /game?level=<id>
  components/            React Native UI: LevelSession (one attempt at a level), HUD, joystick, dialogs, menus
  levels/                Level configuration. Data only, no gameplay or rendering code (see docs/LEVELS.md)
    temple.ts, cloister.ts The two levels
    catalog.ts             Every level, in play order
    levelLoader.ts         Finds a level and validates it before it starts
    assets.ts              Asset registry: keys → files, loaded only when a level needs them
    builders.ts            Layout helpers (walls, pillars, crates)
  game/                  The 3D scene (React Three Fiber). Rendering and per-frame glue only
    GameScene.tsx          The <Canvas>; creates the spatial systems and mounts everything below
    PlayerController       Each frame: input → movement, focus, USE presses
    StageController        Each frame: stage rules at the player's position; applies respawns
    CameraController       Fixed-angle follow camera
    Player, Room, Interactables, TriggerVisuals   Models in the level's theme; read state, never change it
    AssetBoundary          Shows a plain fallback if an asset fails to load
    gameClock              useGameFrame: frame time that is 0 while paused
  systems/               Gameplay rules. Plain TypeScript, no React or Three.js, all unit-tested
    StageManager           Runs a level: owns GameState, level state machine, traps, events
    interactionRules       What using each kind of object does (one handler per kind)
    InventorySystem, PuzzleSystem, DoorSystem, TrapSystem, ObjectiveSystem, ScoreSystem
    MovementController, CollisionSystem, InteractionSystem   Movement, collision, what's in reach
    AudioManager           Game events → sounds, through a swappable backend (silent by default)
    stateMachine           Transition tables for level, puzzle and door states
    levelValidation        Unique ids and valid references, checked when a level starts
    gameState, worldSync   Initial state and read helpers; keeps collision in step with progress
    __tests__/             Jest tests for all of the above
  types/                 game.ts = level data types, state.ts = runtime state and events
  hooks/                 useGameState: re-render when progress changes
  testing/               Test helper that runs the real systems frame by frame, no rendering
docs/
  LEVELS.md              How to create a level: the config format, ids, validation, assets
  DEVICE_TESTING.md      Full on-device test checklist, and how to make a release build
  ASSETS_AND_CONFIG.md   Adding Blender models, textures and audio; configuration; troubleshooting
```

The rule of the codebase: **game rules don't know about rendering.** The scene reports what happened (USE pressed on an object, a frame of play at some position) to `StageManager`. `StageManager` applies the rules and publishes:
- an immutable `GameState`, which the HUD reads
- typed `GameEvent`s, which `AudioManager` listens to.

Things that change every frame (player position, spike height) live in mutable objects that the renderer reads directly, never in React state.

### Extending the game

| To add… | Change |
|---|---|
| A new level | Write a `LevelDefinition` in `src/levels/`, add it to `catalog.ts`, link it with `nextLevelId`. No game code changes. See [docs/LEVELS.md](docs/LEVELS.md) |
| A new object in a level | Add an entry to that level's `interactables`, with a new unique id |
| A new *kind* of object | 1. Add its type to the `Interactable` union in `types/game.ts`. 2. Add a handler to `systems/interactionRules.ts`; TypeScript refuses to compile until you do. 3. Add a model to `game/Interactables.tsx`. `PlayerController` and `GameScene` don't change. |
| Another trap | Add a `trap` trigger with its own timing, `startOffset` and respawn point |
| An objective | Add to `objectives`, using a completion condition (`pickupCollected`, `puzzleSolved`, `any`, …) |
| A sound | Map the event in `EVENT_SOUNDS` (`systems/AudioManager.ts`), then plug in a real backend (see docs) |
| Level art | Put the file under `assets/`, register a key in `src/levels/assets.ts`, reference the key from the level |

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
npm test             # gameplay unit tests (Jest, no device or rendering needed)
npx tsc --noEmit     # typecheck
npx expo lint        # lint
npx expo-doctor      # dependency / config health
```

The tests in `src/systems/__tests__/` cover every gameplay rule, plus a scripted full playthrough of the temple: key → door → clue → puzzle → door → trap → exit. Add a test next to any rule you change.

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
