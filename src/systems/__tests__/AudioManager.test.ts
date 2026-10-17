import { TEMPLE_IDS, templeLevel } from "@/levels/temple";
import { AudioManager, type SoundBackend, type SoundId } from "@/systems/AudioManager";
import { StageManager } from "@/systems/StageManager";
import type { Interactable } from "@/types/game";

function recordingBackend() {
  const played: SoundId[] = [];
  const backend: SoundBackend = { play: (sound) => played.push(sound), dispose: jest.fn() };
  return { played, backend };
}
const byId = (id: string) => templeLevel.interactables.find((item) => item.id === id) as Interactable;

describe("AudioManager", () => {
  it("plays a sound for game events, and nothing for silent ones", () => {
    const { played, backend } = recordingBackend();
    const stage = new StageManager(templeLevel);
    new AudioManager(backend).attach(stage);

    stage.interact(byId(TEMPLE_IDS.door)); // locked
    stage.interact(byId(TEMPLE_IDS.key));
    stage.interact(byId(TEMPLE_IDS.tablet)); // "inspected" has no sound
    stage.answerPuzzle(TEMPLE_IDS.sunPuzzle, 0);
    stage.pause();

    expect(played).toEqual(["doorLocked", "pickup", "puzzleWrong", "pause"]);
  });

  it("respects mute and stops after detaching", () => {
    const { played, backend } = recordingBackend();
    const stage = new StageManager(templeLevel);
    const audio = new AudioManager(backend);
    const detach = audio.attach(stage);

    audio.setMuted(true);
    stage.interact(byId(TEMPLE_IDS.key));
    audio.setMuted(false);
    detach();
    stage.pause();

    expect(played).toEqual([]);
  });

  it("works with no backend at all (silent by default)", () => {
    const stage = new StageManager(templeLevel);
    new AudioManager().attach(stage);
    expect(() => stage.interact(byId(TEMPLE_IDS.key))).not.toThrow();
  });

  it("releases the backend on dispose", () => {
    const { backend } = recordingBackend();
    new AudioManager(backend).dispose();
    expect(backend.dispose).toHaveBeenCalled();
  });
});
