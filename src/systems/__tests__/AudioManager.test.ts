import { TEMPLE_IDS, templeLevel } from "@/levels/temple";
import { AudioManager, type SoundBackend, type SoundId } from "@/systems/AudioManager";
import { StageManager } from "@/systems/StageManager";
import { createMatchSimulation, SOLO } from "@/testing/simulation";

function recordingBackend() {
  const played: SoundId[] = [];
  const backend: SoundBackend = { play: (sound) => played.push(sound), dispose: jest.fn() };
  return { played, backend };
}
const id = SOLO.id;

describe("AudioManager", () => {
  it("plays a sound for game events, and nothing for silent ones", () => {
    const { played, backend } = recordingBackend();
    const sim = createMatchSimulation(templeLevel);
    new AudioManager(backend).attach(sim.stage);

    sim.place(id, 0, -2.2);
    sim.dispatch({ type: "interact", playerId: id, targetId: TEMPLE_IDS.door }); // locked
    sim.place(id, 8.2, 12.3);
    sim.dispatch({ type: "interact", playerId: id, targetId: TEMPLE_IDS.key });
    sim.place(id, -7.4, 4);
    sim.dispatch({ type: "interact", playerId: id, targetId: TEMPLE_IDS.tablet }); // "inspected" is silent
    sim.place(id, 2.3, -1.2);
    sim.dispatch({ type: "submitPuzzleAnswer", playerId: id, puzzleId: TEMPLE_IDS.sunPuzzle, optionIndex: 0 });
    sim.stage.pause();

    expect(played).toEqual(["doorLocked", "pickup", "puzzleWrong", "pause"]);
  });

  it("respects mute and stops after detaching", () => {
    const { played, backend } = recordingBackend();
    const sim = createMatchSimulation(templeLevel);
    const audio = new AudioManager(backend);
    const detach = audio.attach(sim.stage);

    audio.setMuted(true);
    sim.place(id, 8.2, 12.3);
    sim.dispatch({ type: "interact", playerId: id, targetId: TEMPLE_IDS.key });
    audio.setMuted(false);
    detach();
    sim.stage.pause();

    expect(played).toEqual([]);
  });

  it("works with no backend at all (silent by default)", () => {
    const stage = new StageManager(templeLevel);
    new AudioManager().attach(stage);
    expect(() => stage.addPlayer(SOLO)).not.toThrow();
  });

  it("releases the backend on dispose", () => {
    const { backend } = recordingBackend();
    new AudioManager(backend).dispose();
    expect(backend.dispose).toHaveBeenCalled();
  });
});
