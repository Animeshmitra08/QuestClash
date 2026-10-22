# Assets, configuration and troubleshooting

How to configure Expo for 3D, add models, textures and audio, manage configuration, and diagnose common problems. Everything here applies to Expo SDK 57. Check the versioned Expo docs (`https://docs.expo.dev/versions/v57.0.0/`) before relying on anything that might have changed.

## 1. How Expo is configured for 3D

| What | Where | Why |
|---|---|---|
| `expo-gl` | `package.json` | The native OpenGL ES surface that Three.js draws into. |
| `expo-asset`, `expo-file-system` | `package.json`, plus the `expo-asset` plugin in `app.json` | React Three Fiber uses them to load model and texture files on the device. |
| `expo-dev-client` | `package.json` | Makes `npx expo start` open your own development build instead of Expo Go. |
| Single Three.js copy | `metro.config.js` | Without it, two copies of Three.js get bundled. One of them (`three.cjs`) crashes on React Native. |
| `.glb` / `.gltf` / `.bin` asset types | `metro.config.js` | Lets `require("./model.glb")` bundle models. |
| `"orientation": "landscape"` | `app.json` | The game is played with two thumbs. |

Rules of thumb:
- **JavaScript-only change** (game code, a new pure-JS package, assets): reload the app.
- **`metro.config.js` change:** restart `npx expo start`.
- **Native change** (a new package with native code, or an `app.json` plugin, permission or orientation change): rebuild the app with `npx expo run:android`, or a new EAS development build.
- Always add packages with `npx expo install <package>`, so you get versions that match the SDK.
- Never edit `android/` or `ios/` by hand. They're generated from `app.json`.

## 2. Organizing assets

Create these folders when you add the first file of each kind:

```
assets/
  models/      .glb files (characters, props, environment pieces)
  textures/    .jpg / .png (floors, walls)
  audio/
    sfx/       short .mp3 / .wav effects (pickup, door, trap)
    music/     longer .mp3 loops
```

Size guidelines (everything ships inside the app download):

| Asset | Target |
|---|---|
| Character `.glb` | ≤ 3 MB, ≤ 15k triangles, one material if possible |
| Prop `.glb` | ≤ 500 KB, ≤ 2k triangles |
| Textures | ≤ 1024 × 1024 px, power-of-two sizes (512, 1024), JPG unless you need transparency |
| Sound effects | ≤ 100 KB each, mono |
| Music | ≤ 2 MB per track, 96–128 kbps |

- **Use plain `.glb` files.** Avoid Draco or meshopt compression and KTX2 textures. Their decoders need WebAssembly or browser features that `expo-gl` doesn't provide.
- **Shrink files before adding them.** Use [glTF-Transform](https://gltf-transform.dev/) (for example `npx @gltf-transform/cli resize in.glb out.glb --width 1024 --height 1024`), or [gltf.report](https://gltf.report/) in a browser.
- **Licensing:** only add models, textures and sounds you made or that have a clear license (CC0 is easiest). Note the source and license in `assets/CREDITS.md`.
- **If assets grow beyond about 50 MB,** consider downloading them after install instead of bundling them. That's a later step.

## 3. Adding a Blender character model

### Export from Blender

1. Rig the character with its **feet at the origin**, **facing −Y in Blender**. That becomes +z in Three.js, the direction the placeholder faces.
2. Make animations named exactly `Idle` and `Walk` as separate actions (use the NLA editor or Action editor).
3. **File → Export → glTF 2.0**. Use **Format: glTF Binary (.glb)**, turn on **Apply Modifiers** and **Animation**, and leave Draco compression **off**.
4. Save it as `assets/models/hero.glb`.

### Load it in the game

The code below would replace the primitive meshes in `src/game/Player.tsx`, keeping the outer group that follows the player's position and facing. It uses only `three` and R3F, both already installed.

```tsx
import { useLoader } from "@react-three/fiber/native";
import { useEffect, useRef } from "react";
import { type AnimationAction, AnimationMixer } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import type { PlayerState } from "@/types/game";

import { useGameFrame } from "./gameClock";

// Metro turns require() of an asset into an asset id (a number). R3F native resolves
// that id to a file, but its types expect a URL string, so tell TypeScript it's one.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const HERO_MODEL = require("@/assets/models/hero.glb") as string;

interface HeroAnimation {
  mixer: AnimationMixer;
  idle: AnimationAction;
  walk: AnimationAction;
}

/** Rigged character. Must be rendered inside <Suspense>, because loading is asynchronous. */
export function HeroModel({ state }: { state: PlayerState }) {
  const gltf = useLoader(GLTFLoader, HERO_MODEL);
  // A ref, not useMemo: the frame loop changes the actions every frame, and the React
  // Compiler doesn't allow changing values that came out of a hook.
  const animation = useRef<HeroAnimation | null>(null);

  useEffect(() => {
    const mixer = new AnimationMixer(gltf.scene);
    const action = (name: string) => {
      const clip = gltf.animations.find((a) => a.name === name);
      if (!clip) throw new Error(`hero.glb has no "${name}" animation`);
      return mixer.clipAction(clip);
    };
    const idle = action("Idle");
    const walk = action("Walk");
    idle.play();
    walk.play();
    animation.current = { mixer, idle, walk };
    return () => {
      mixer.stopAllAction();
      animation.current = null;
    };
  }, [gltf]);

  useGameFrame((_, dt) => {
    const anim = animation.current;
    if (!anim) return;
    // Blend between idle and walk by speed, so there's no hard switch.
    anim.walk.weight = state.moveAmount;
    anim.idle.weight = 1 - state.moveAmount;
    anim.mixer.update(dt); // dt is 0 while paused, so animations freeze too
  });

  return <primitive object={gltf.scene} />;
}
```

To use it in `Player.tsx`, render `<Suspense fallback={<PlaceholderBody />}><HeroModel state={state} /></Suspense>`. Keep the current primitive body as the fallback, so the player is visible while the model loads. A broken model file is caught by `SceneErrorBoundary`.

Then:
- Match `PLAYER_RADIUS` in `MovementController.ts` to the model's body width.
- If the model is the wrong size, scale it with `<primitive object={gltf.scene} scale={0.01} />`. Blender files sometimes come out in centimetres.
- To show the same model more than once (enemies, other players), clone it with `SkeletonUtils.clone` from `three/examples/jsm/utils/SkeletonUtils.js`.

**Not yet tested on a device:** loading a real `.glb`. R3F's native build includes the file and texture loading this needs, and `metro.config.js` now bundles `.glb` files. Test with a small model first.

## 4. Textures

```tsx
import { useLoader } from "@react-three/fiber/native";
import { useMemo } from "react";
import { RepeatWrapping, SRGBColorSpace, TextureLoader } from "three";

const SANDSTONE = require("@/assets/textures/sandstone.jpg") as string; // asset id, see above

export function SandstoneMaterial() {
  const source = useLoader(TextureLoader, SANDSTONE);
  // Set up a copy: loaded textures are cached and shared, and hook results mustn't be changed.
  const floor = useMemo(() => {
    const texture = source.clone();
    texture.colorSpace = SRGBColorSpace; // colour textures look washed out without this
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.repeat.set(8, 10); // tile across the floor instead of stretching
    texture.needsUpdate = true;
    return texture;
  }, [source]);
  return <meshStandardMaterial map={floor} />;
}
```

Like models, textures load asynchronously, so render that mesh inside `<Suspense>`. The `EXGL: pixelStorei` log line is expected when textures load.

Both examples pass this project's typecheck and lint, but haven't been run on a device.

## 5. Audio

SDK 57 uses **`expo-audio`**. `expo-av` has no SDK 57 release, so don't follow older tutorials that use it.

The game already has the wiring for sound:
- `StageManager` emits typed events.
- `AudioManager` (`src/systems/AudioManager.ts`) maps them to sound ids through `EVENT_SOUNDS`, and plays them through a `SoundBackend`.
- The default backend is silent, so nothing is needed until you have sound files.

Adding real sound means writing a backend; no gameplay code changes.

1. Install `expo-audio`. It contains native code, so **rebuild your development build** afterwards (`npx expo run:android`). Expo Go already includes it, but your own build doesn't until you rebuild.
   ```bash
   npx expo install expo-audio
   ```
2. Put the files in `assets/audio/sfx/`, one per `SoundId`.
3. Create `src/systems/expoAudioBackend.ts`:
   ```ts
   import { createAudioPlayer } from "expo-audio";

   import type { SoundBackend, SoundId } from "./AudioManager";

   const FILES: Record<SoundId, number> = {
     pickup: require("@/assets/audio/sfx/pickup.mp3"),
     doorOpen: require("@/assets/audio/sfx/door-open.mp3"),
     // …one entry per SoundId; TypeScript lists any you've missed
   };

   export function createExpoAudioBackend(): SoundBackend {
     // One player per sound, created once and reused.
     const players = Object.fromEntries(
       Object.entries(FILES).map(([id, file]) => [id, createAudioPlayer(file)]),
     ) as Record<SoundId, ReturnType<typeof createAudioPlayer>>;

     return {
       play(sound) {
         const player = players[sound];
         player.seekTo(0); // rewind, so repeated plays restart the sound
         player.play();
       },
       dispose() {
         // createAudioPlayer players must be released by hand, or they leak.
         Object.values(players).forEach((player) => player.release());
       },
     };
   }
   ```
4. In `src/app/game.tsx`, change `new AudioManager()` to `new AudioManager(createExpoAudioBackend())`.

This backend is a sketch: it isn't compiled or tested, because `expo-audio` isn't installed.

For looping background music, use a separate player with `player.loop = true`, outside the event mapping.

## 6. Environment-specific configuration

This prototype needs **no environment variables and no secrets**. When it does:

- Expo reads `.env` files. Only variables prefixed `EXPO_PUBLIC_` reach the app, and **they're compiled into the app in plain text**, so never put secrets in them.
- Use `.env.local` for values that differ per developer. It's already in `.gitignore`.
- For values that differ per build (for example a staging and a production server later), use `app.config.ts` reading `process.env`, and set the variables per profile under `env` in `eas.json`.
- Real secrets (API keys with write access, signing keys) never go in the app. Keep them on a server, or in EAS secrets for build-time-only use.

## 7. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `TypeError: undefined is not a function` when opening the game; "Route ./game.tsx is missing the required default export" | `three.cjs` got bundled. It calls Node's `process.emitWarning`. | Check that `metro.config.js` has the `three` redirect, then restart with `npx expo start --clear`. |
| `WARNING: Multiple instances of Three.js being imported` | Two copies of Three.js are bundled. | Same fix as above. |
| Blank or black 3D view, no error | Remote JS debugging is on (breaks `expo-gl`), or the GL context failed. | Turn off remote debugging, reload, and check Metro logs for `EXGL:` errors. |
| A button is visible but has no background (text on dark) | A function `style` on a child of `<Link asChild>`; Link's Slot drops it. | Use `Pressable` with `router.push(...)` instead. |
| "No development build installed" / app opens Expo Go | `expo-dev-client` build missing or outdated. | `npx expo run:android`, or install the latest EAS development build. |
| A package "requires native code", or crashes calling a native module | A native package was added since the last build. | Rebuild the development build. |
| `metro.config.js` change has no effect | Metro only reads it at startup. | Restart `npx expo start --clear`. |
| Build fails after adding a package | Version not matched to the SDK. | `npx expo install --fix`, then `npx expo-doctor`. |
| Phone can't reach the dev server | Different Wi-Fi network, or the firewall blocks Node. | Same network, allow Node through Windows Firewall, or USB plus `adb reverse tcp:8081 tcp:8081`. |
| `require("./model.glb")` fails to resolve | Metro doesn't treat `.glb` as an asset. | Check `assetExts` in `metro.config.js`, then restart Metro. |
| Model appears huge, tiny or lying down | Blender unit or axis mismatch. | Scale or rotate the `<primitive>`, or fix it in Blender and apply transforms before export. |
| Low frame rate | Too many draw calls, heavy models, real-time shadows. | Use the Perf Monitor. Merge or instance repeated meshes (as the spikes do), lower triangle and texture sizes, keep shadows off. |
