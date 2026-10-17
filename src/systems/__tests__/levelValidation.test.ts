import { TEMPLE_IDS, templeLevel } from "@/levels/temple";
import { validateLevel } from "@/systems/levelValidation";
import { StageManager } from "@/systems/StageManager";
import type { Interactable, LevelDefinition } from "@/types/game";

/** A copy of the temple with one change applied. */
function variant(change: (level: LevelDefinition) => void): LevelDefinition {
  const level = structuredClone(templeLevel);
  change(level);
  return level;
}
const find = (level: LevelDefinition, id: string) => level.interactables.find((i) => i.id === id) as Interactable;

describe("validateLevel", () => {
  it("accepts the shipped temple level", () => {
    expect(validateLevel(templeLevel)).toEqual([]);
  });

  it("rejects duplicate ids across blocks, objects and triggers", () => {
    const level = variant((l) => {
      l.blocks[0].id = TEMPLE_IDS.door; // a wall sharing the door's id would vanish when the door opens
    });
    expect(validateLevel(level)).toContain(`world objects: duplicate id "${TEMPLE_IDS.door}"`);
  });

  it("rejects references to things that don't exist", () => {
    const level = variant((l) => {
      const door = find(l, TEMPLE_IDS.door);
      if (door.kind === "door") {
        door.requirements = [
          { kind: "item", itemId: "silver-key", consume: true, blockedMessage: { title: "", message: "" } },
          { kind: "puzzle", puzzleId: "moon-dial", blockedMessage: { title: "", message: "" } },
        ];
      }
      const dial = find(l, TEMPLE_IDS.sunDial);
      if (dial.kind === "puzzle") dial.puzzleId = "moon-dial";
      l.objectives[0].completeWhen = { kind: "pickupCollected", pickupId: "nowhere" };
    });
    const problems = validateLevel(level);
    expect(problems).toHaveLength(4);
    expect(problems.join("\n")).toMatch(/silver-key/);
    expect(problems.join("\n")).toMatch(/nowhere/);
  });

  it("rejects a bad puzzle answer index, a broken trap timing and a missing exit", () => {
    const level = variant((l) => {
      l.puzzles[0].correctOptionIndex = 9;
      const trap = l.triggers.find((t) => t.kind === "trap");
      if (trap?.kind === "trap") trap.timing = { ...trap.timing, armed: 0 };
      l.triggers = l.triggers.filter((t) => t.kind !== "exit");
    });
    expect(validateLevel(level)).toHaveLength(3);
  });

  it("checks spawn points, exit conditions, time limits and star thresholds", () => {
    const level = variant((l) => {
      l.spawnPoints.push({ ...l.spawnPoints[0] }); // duplicate spawn id
      const trap = l.triggers.find((t) => t.kind === "trap");
      if (trap?.kind === "trap") trap.respawnPointId = "nowhere";
      const exit = l.triggers.find((t) => t.kind === "exit");
      if (exit?.kind === "exit") exit.requires = { kind: "doorOpened", doorId: "back-door" };
      l.timeLimitSeconds = 0;
      l.scoring = { starThresholds: [900, 500, 1000] };
    });
    const problems = validateLevel(level).join("\n");
    expect(problems).toMatch(/spawn points: duplicate id "start"/);
    expect(problems).toMatch(/respawn point "nowhere"/);
    expect(problems).toMatch(/exit "exit": door "back-door" does not exist/);
    expect(problems).toMatch(/timeLimitSeconds must be positive/);
    expect(problems).toMatch(/starThresholds must be in increasing order/);
  });

  it("StageManager refuses to run an invalid level", () => {
    const level = variant((l) => {
      l.puzzles[0].correctOptionIndex = -1;
    });
    expect(() => new StageManager(level)).toThrow(/is invalid/);
  });
});
