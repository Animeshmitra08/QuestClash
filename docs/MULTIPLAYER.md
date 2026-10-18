# Multiplayer

Matches support up to five players. Single player runs the match on the device (`LocalMatch`). Online play runs the same `StageManager` on the server (`server/`), and each device sends it commands and its player's position (`OnlineMatch`). The scene and HUD don't know which mode they're in: both go through `MatchSource` (`src/session/MatchSource.ts`).

## Online architecture

| Concern | Where it's decided |
|---|---|
| Item collection, puzzle answers, doors, traps, exits, score, objectives, stage progression | **Server** (`server/src/rooms/QuestRoom.ts`, running `StageManager`) |
| Your own movement | Your device moves your player instantly; it reports its position 15 times a second; the server checks every report (speed, walls) and corrects you if needed (respawn) |
| Other players on your screen | Their server-checked positions, synced as Colyseus state patches and smoothed for drawing |
| Spike animation | Each device redraws traps from the server's match clock. Whether a trap hurts is decided only by the server. |

**Messages:** they're typed in `src/net/protocol.ts`, which the app and server import word for word.

- **Client → server:**
  - `ready`, `selectLevel` (in the lobby)
  - `move`, `command` (during a match)
  - `restart`, `nextLevel` (host only, after a match)
- **Server → client:**
  - `match`: the full `MatchState`, sent whenever it changes
  - `commandResult`: the answer to a `command`
  - `respawn`: move your player here
  - `events`
  - `error`

**Rooms:** each room has a 5-character code (no 0/O/1/I/L). Clients create with `client.create("quest", …)` and join with `client.joinById(code, …)`. A room locks when its match starts; players who drop can still reconnect.

**Disconnects:** a dropped connection keeps the player's seat and their place in the match for 30 seconds. The Colyseus SDK reconnects automatically, as the same player id. While someone is disconnected their body stands still, and traps and exits ignore it. Leaving on purpose, or not returning in time, removes the player, and their items go back where they were found.

**Network errors** the player sees: room not found, room full, match already started, name missing, server unreachable, connection lost or reconnecting, and command timeout. They're defined in `NET_ERRORS`.

## Players

- **Registry** (`systems/PlayerRegistry.ts`):
  - Each player has a stable `PlayerId`, unique for the whole match. A player who left can't rejoin under the same id.
  - There are at most `MAX_PLAYERS = 5`.
  - Each player gets the lowest free slot (0–4), which decides their spawn position and body colour.
- **Status:** `active → eliminated | escaped | left`. Only active players can act or set off traps and exits; positions reported for anyone else are ignored.
- **Spawning:** players stand in a row, 1 unit apart, at the level's start point or a trap's respawn point. Slot 0 stands exactly on the point. A test checks that every slot at every spawn point in every level is clear of walls and traps.

## Shared vs personal state

`MatchState` (`types/state.ts`) keeps the two apart.

| Shared (same for everyone) | Personal (one per player, in `players`) |
|---|---|
| Match status, fail reason, timer | Status (active / eliminated / escaped / left) |
| Which pickups are gone, and who took them | Inventory |
| Puzzle state, total wrong attempts, who solved it | Clues read |
| Door state, and who opened it | Lives left, trap hits, wrong answers |
| Which objectives are done, and who gets the credit | Pop-up message |

## Ownership rules

| Thing | Rule |
|---|---|
| **Keys and other items** | The object in the world is shared: the first player to collect it takes it, and it disappears for everyone. The item is personal: it goes into the collector's inventory, and only that player can use it. A teammate's key doesn't open a door for you. |
| **Clues** | Personal knowledge. Each player has to read a clue themselves. The tablet stays in place for others. An objective like "find the clue" counts for the team once anyone has read it. |
| **Puzzles** | Shared. Opening one shows a panel on the actor's screen only, but solving it counts for the whole team. Wrong answers are counted for the player who gave them. |
| **Doors** | Shared. A door is opened with the opener's own items (and a consumed key leaves their inventory). Once open, it's open for everyone, for good. |
| **Objectives** | Shared team goals, shown to everyone. Each one is credited to the player whose action first completed it. Credit is permanent, but the display is live: if a key goes back into the world, "Find the key" shows again. |
| **Rewards** | **Team score** decides the stars. It counts each shared milestone once (one key = one "item found"; a clue counts once anyone has read it) and adds up everyone's penalties. With one player it equals that player's score. **Personal score** credits the player responsible (collector, solver, opener; every reader of a clue) and their own penalties. The exit points and time bonus go to every player who escaped. |
| **Eliminated or leaving players** | Their items go back to where each was found, so the team can't be locked out. Their credit and score stay. |

## Simultaneous actions

Every action is a typed command (`types/commands.ts`): `interact`, `collectItem`, `submitPuzzleAnswer`, `activateObject`, `completeObjective`. Each one names the responsible player. `StageManager.dispatch` checks it before anything changes:

- the player exists and is active
- the match is running
- the target exists and is the right kind
- the player is within reach (checked on the match side, with a small allowance for lag)

The command is then either applied, or rejected with a typed `RejectReason`. A rejection never changes state.

Commands that arrive together go through `StageManager.resolve`, which applies them in a fixed order (`systems/commandOrder.ts`):

1. earlier `tick` first
2. then lower `sequence`, meaning arrival order at the host
3. then player id, alphabetically, as a last tie-break

The first valid command wins. Later commands that conflict with it are rejected, never half-applied:

| Conflict | Result |
|---|---|
| Two players grab the same key | The first gets it. The second is rejected (`alreadyCollected`) and told who has it. |
| Two players open the same door | It opens once, credited to the first. The second is a harmless no-op (`alreadyOpen`); no key is spent. |
| Answers to the same puzzle | A wrong answer applied before the right one counts as wrong. Any answer after it's solved is rejected (`alreadySolved`) and not counted. |
| Two players read the same clue | Not a conflict. Both learn it. |

Invalid answers (an option that doesn't exist, a negative or fractional index) are rejected as `invalidAnswer` and never counted as wrong.

## Match end

- A player escapes on their own by stepping into an open exit. They then stop counting for traps and can't act.
- The match **completes** when nobody is active and at least one player escaped.
- It **fails** when the time runs out (`timeUp`), or when everyone was eliminated or left without anyone escaping (`allEliminated`).
- Lives come from `MatchRules.livesPerPlayer`. The default is `null` (unlimited): a trap hit only sends you back, as in single player.

## Testing

`src/testing/simulation.ts` runs a match with several players. Each simulated player has their own body and their own view of what's in reach, and acts only through commands to the one shared match. `src/systems/__tests__/multiplayer.test.ts` covers:

- the player registry and spawn safety
- simultaneous key grabs, door openings and puzzle answers, and deterministic ordering
- duplicate collection
- invalid answers and other rejected commands
- who gets credit for each result
- personal pop-ups
- elimination, items returning to the world, and losing when everyone is out
- escaping one by one
- players leaving mid-match
- a full five-player match

## Not built yet

- **Movement authority:** each client moves its own player, and the server only checks the reports (speed and walls). There's no server-side movement simulation, rollback or lag compensation beyond the reach allowance (0.75 units). Other players are smoothed toward their latest position, not interpolated through a buffer.
- **Per-player puzzle locking:** two players can have the same puzzle panel open; their answers are resolved in order.
- **Online pausing:** online matches can't be paused. The menu opens over a running match.
- **Scaling:** one server process, with room codes in memory. Several processes would need Colyseus's Redis presence and driver.
- **Accounts:** none. Names aren't unique, and player ids are Colyseus session ids, valid for one room. There's no persistence or database.
- **LAN play:** not implemented (out of scope for this stage).
- **Item handling:** items can't be handed to a teammate or dropped. They return to the world only on elimination or leaving.
- **Player-to-player collision:** players can walk through each other.
- **Sound:** `AudioManager` plays sounds for every player's events. A networked client would probably filter to nearby or local ones.
