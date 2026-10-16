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
- [ ] Top bar shows the inventory (3 empty slots), the objective "Find the key to the temple door", the timer counting up from 0:00, the score ★ 0, and a pause button.
- [ ] The joystick moves the player in the direction you push. Pushing it part-way walks slower.
- [ ] You can hold the joystick and press USE at the same time.
- [ ] The player slides along walls and can't pass through walls, pillars, crates, the tablet or the sun dial.

### Puzzle sequence
- [ ] **Key** (behind the crates, bottom-right): the "Pick up" prompt appears. Picking it up removes the key, shows "You found the Bronze Key!", adds it to a slot, gives +100 points, and changes the objective to "Find a clue to the sun dial".
- [ ] **Door before the puzzle:** the "Sealed Door" message appears and the door stays shut.
- [ ] **Tablet** (left wall): "Read" shows the clue. +50 points. The objective changes to "Set the sun dial to break the seal".
- [ ] **Sun dial** (right of the door): a wrong answer shows a hint and costs −25. **Three** solves it: "The seal of the suns breaks!", +200, and the dial glows.
- [ ] **Door:** it sinks into the floor, the key leaves the inventory, +100 points, and the objective becomes "Cross the spikes and reach the exit".
- [ ] **Trap:** the spikes rattle, rise and retract on a cycle. Getting hit flashes the screen red, shows a message, costs −50, and returns you just inside the door.
- [ ] **Exit:** the glowing green archway shows **Stage Complete!** with your time, the score breakdown and the total.

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
