# Device testing (Stage G)

How to check the complete single-player stage on a physical Android phone, in a development build and in a release build.

The game logic (movement, collision, interactions, puzzle, door, trap, timer, score, pause) has been tested in Node. Rendering, touch controls, layout and performance can only be checked on a real device, which is what this checklist is for.

## 1. Development build

1. Start the dev server and reload the app:
   ```bash
   npx expo start --clear
   ```
   Restart the server (Ctrl+C, then run it again) whenever `metro.config.js` changes.
2. Open **Perf Monitor** from the dev menu (shake the phone) to see the frame rate while you play.

## 2. Full run-through

Tick each item off. If anything differs, note what you saw.

### Start screen
- [ ] Opens in landscape, with the title and **Start Game** on the left and **How to play** on the right.
- [ ] Nothing is clipped by the notch or rounded corners.
- [ ] **Start Game** opens the game. A loading spinner appears, then the temple.

### HUD and controls
- [ ] Top bar shows the inventory (3 empty slots), the objective "Search the woods for the temple key", the timer counting up from 0:00, the score ★ 0, and a pause button.
- [ ] The joystick moves the player in the direction you push. Pushing it part-way walks slower.
- [ ] You can hold the joystick and press USE at the same time.
- [ ] The player slides along walls and can't pass through trees, rocks, bushes, logs, stumps, the forest edge, walls, pillars, the tablet or the sun dial.

### Forest
- [ ] The temple starts in a sunny open wood: grass with patches of earth, round trees, pines, grey rocks, bushes, fallen logs and stumps, and a dense tree line all round the edge.
- [ ] Walking behind a tree (with the tree between you and the camera) makes it see-through until you step out from behind it. You're never hidden.
- [ ] The frame rate stays smooth while walking across the whole map, including along the tree lines.
- [ ] Neighbouring trees look a little different (size, shape, shade), and the forest looks the same every time you play.

### Puzzle sequence
- [ ] **Key** (among boulders in the south-east of the woods, right of the start): the USE button changes to "PICK UP" (and back to "USE" when you walk away). Picking it up removes the key, shows "You found the Bronze Key!", adds it to a slot, gives +100 points, and changes the objective to "Find a clue to the sun dial".
- [ ] **Door before the puzzle** (stone gate in the thicket, straight north of the start): the "Sealed Door" message appears and the door stays shut.
- [ ] **Tablet** (between ruined pillars in the west of the woods): "Read" shows the clue. +50 points. The objective changes to "Set the sun dial by the gate to break the seal".
- [ ] **Sun dial** (just south-east of the gate): a wrong answer shows a hint and costs −25. **Three** solves it: "The seal of the suns breaks!", +200, and the dial glows.
- [ ] **Door:** it sinks into the floor, the key leaves the inventory, +100 points, and the objective becomes "Cross the spikes and reach the exit".
- [ ] **Trap:** the spikes rattle, rise and retract on a cycle. Getting hit flashes the screen red, shows a message, costs −50, and returns you just inside the door.
- [ ] **Exit:** the glowing green archway shows **Stage Complete!** with your time, the score breakdown and the total.

### Levels and transitions
- [ ] The start screen lists both levels. Tapping one starts that level.
- [ ] After the temple, **Level Complete!** shows stars and a **Next level** button, which opens the Moonlit Cloister.
- [ ] Cloister: a dark, blue moonlit pine forest with mossy patches on the ground, and a walled cloister north of the gate.
- [ ] Cloister: the timer counts **down** from 3:30 and turns red in the last 15 s.
- [ ] Cloister: the silver key opens the gate. Stepping into the dim exit before answering the altar shows "The moon gate is sealed…" once.
- [ ] Cloister: after the altar is answered, the exit glows green and works. The completion screen has no **Next level** button (it's the last level).
- [ ] Cloister: let the timer run out. **Out of time** appears, and **Try again** restarts at 3:30.

### Online (two phones, server running; see README → Online multiplayer)
- [ ] **Play online** shows the server address you set in `EXPO_PUBLIC_GAME_SERVER_URL`.
- [ ] Phone A: **Create a room** shows a 5-letter code and the lobby, with A marked ★ (host).
- [ ] Phone B: enter the code and tap **Join room**. Both lobbies list both players, each with their own colour.
- [ ] A wrong code shows "No room with that code"; a stopped server shows "Can't reach the game server".
- [ ] The host can change the level; the other player can't.
- [ ] Both tap **I'm ready**, and the match starts on both phones in the chosen level.
- [ ] Each phone shows the other player moving smoothly, in their colour.
- [ ] One player picks up the key. It disappears for both, and the other sees "… found the Bronze Key."
- [ ] Both stand at the key and press USE together. Only one gets it.
- [ ] The puzzle, door and trap work as in single player, and each phone sees the other's results.
- [ ] Turn on airplane mode on one phone for ~5 s, then turn it off. That phone shows "Reconnecting…" and then carries on, and the other phone's lobby list showed it as reconnecting.
- [ ] **Leave match** on one phone: the other phone carries on alone.
- [ ] Both reach the exit, then **Level Complete!** appears. Only the host sees **Next level** / **Play again**, and the other sees "Waiting for the host…".

### Pause and app lifecycle
- [ ] The pause button freezes everything: player, spikes, timer and pop-up messages.
- [ ] **Resume** continues exactly where you left off. **Restart stage** starts from the beginning with 0:00 and ★ 0.
- [ ] **Quit to menu** returns to the start screen, and **Start Game** starts a fresh run.
- [ ] Press the home button during play and come back: the game is paused.
- [ ] Android back button: closes an open dialog, otherwise pauses or resumes. After **Stage Complete** it returns to the start screen.

### Try to break it
- [ ] Spam USE next to the key, the door and the dial: nothing triggers twice.
- [ ] Hold the joystick while a dialog opens: the player doesn't walk off.
- [ ] Pause in the middle of the spikes, wait, then resume.
- [ ] Background the app while the puzzle dialog is open, come back, and finish it.
- [ ] **Play again** from the completion screen several times in a row.

### Performance
- [ ] Perf Monitor shows a steady frame rate (ideally 60 fps, and at least 30 fps on low-end phones).
- [ ] The phone doesn't get noticeably hot after 5 minutes of play.

Note that development builds run slower than release builds, so judge final performance in the release build below.

## 3. Release build

A release build is what players would install: no dev server, optimized JavaScript. Pick one way to make it.

**Option A: local build** (uses your Android SDK; the APK is signed with the debug key, which is fine for testing):
```bash
npx expo run:android --variant release --device
```

**Option B: EAS cloud build** (needs a free Expo account; produces an installable APK):
```bash
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile preview
```
Scan the QR code when the build finishes to install it.

Before either option, it's a good moment to apply Expo's latest patch updates. This changes native code, so do it right before rebuilding:
```bash
npx expo install --fix
```

In the release build:
- [ ] Repeat the full run-through above once.
- [ ] Compare the frame rate with the development build. It should be the same or better.

## 4. What to report

For each problem, note:
- The phone model and Android version.
- What you did, what you expected, and what happened.
- Any red error screen or Metro log output. Copy the whole **Call Stack**, not just the first line.
- A screenshot for any layout problem.

## Known, harmless log lines

| Log | Why it appears |
|---|---|
| `THREE.Clock: This module has been deprecated` | Comes from inside React Three Fiber, not our code. |
| `EXGL: gl.pixelStorei() doesn't support this parameter yet!` | expo-gl ignores an image-upload setting Three.js sends. It doesn't affect rendering. |
