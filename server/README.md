# QuestClash server

The authoritative multiplayer server for QuestClash, built on [Colyseus](https://docs.colyseus.io/) 0.18. It is its own Node.js project: it has its own `package.json` and `node_modules`, and runs and deploys independently of the Expo app.

It runs the **same gameplay rules as the app**. The rules (`StageManager`, puzzles, doors, traps, scoring, objectives), the levels and the client–server protocol are imported from the app's `../src` through the `@/` alias. They're bundled into the server build, so each rule exists only once.

## What it does

- **Rooms:** rooms of up to 5 players, each with a short code (for example `K7QPM`) that friends join with.
- **Lobby:** players mark themselves ready, and the host picks the level. The match starts when every connected player is ready, and the room then locks to new players.
- **Authority:** the server decides items, puzzle answers, doors, traps, exits, score, objectives and stage progression (the host chooses replay or next level).
- **Movement:** each client moves its own player and reports its position 15 times a second. The server checks every report against walking speed and the walls before using it, so a modified client can't teleport or walk through a closed door. Positions are synced to everyone with Colyseus state patches.
- **Disconnects:** a dropped connection keeps its seat for 30 seconds, and the SDK reconnects automatically as the same player. A deliberate leave, or not returning in time, removes the player and puts their items back in the world.

## Requirements

- Node.js 22 or newer (Colyseus 0.18 requires it).

## Run it

```bash
cd server
npm install
npm run dev            # development: restarts when you edit files
```

Production:

```bash
npm run build          # bundles src/ and the shared ../src code into dist/index.js
npm start              # node dist/index.js
```

To deploy, copy `dist/`, `package.json` and `package-lock.json`, then run `npm ci --omit=dev && npm start`.

### Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `2567` | Port to listen on (HTTP and WebSocket). |
| `HOST` | `0.0.0.0` | Interface to bind. `0.0.0.0` lets phones on your Wi-Fi connect. |

Set them in your shell, for example `PORT=3000 npm start` (bash) or `$env:PORT=3000; npm start` (PowerShell). There are no secrets, and no database is used.

## Test it

```bash
npm run typecheck      # also typechecks the shared ../src code it uses
npm test               # end-to-end: real server + real clients built from the app's network code
npm run build && npm run smoke   # built server as its own process + two separate client processes
```

## Files

```
src/index.ts                  entry point (PORT / HOST)
src/app.ts                    server definition (shared by index.ts and the tests)
src/rooms/QuestRoom.ts        the room: lobby, codes, ready, matches, commands, reconnection
src/rooms/QuestRoomState.ts   synced state (players' bodies, lobby); checked against the app's protocol at compile time
src/rooms/messageValidation.ts  checks every client message before it is used
src/rooms/roomCodes.ts        unique short room codes
src/match/MovementGuard.ts    checks reported positions (speed, walls)
test/multiplayer.test.ts      end-to-end tests
scripts/client-bot.ts         a scripted player, for testing with separate processes
scripts/two-client-smoke.mjs  runs the built server + two bots and checks what they saw
```

The protocol (messages, error codes, room options) is in `../src/net/protocol.ts`, shared word for word with the app.

## Scaling note

One server process handles many rooms. Room codes are tracked with Colyseus's in-memory presence, so running several processes behind a load balancer would need Colyseus's Redis presence and driver. That isn't needed for the initial version.
