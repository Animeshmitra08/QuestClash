import { ASSET_REGISTRY, findAsset } from "@/levels/assets";
import { FIRST_LEVEL_ID, LEVEL_CATALOG } from "@/levels/catalog";
import { loadLevel } from "@/levels/levelLoader";
import { templeLevel } from "@/levels/temple";
import type { LevelDefinition } from "@/types/game";

/** A copy of the temple with one change applied, in a one-level catalog. */
function catalogWith(change: (level: LevelDefinition) => void): LevelDefinition[] {
  const level = structuredClone(templeLevel);
  change(level);
  return [level];
}

describe("level catalog", () => {
  it.each(LEVEL_CATALOG.map((level) => [level.id, level] as const))(
    "%s loads with no errors or warnings",
    (id) => {
      const result = loadLevel(id);
      expect(result).toMatchObject({ ok: true, warnings: [] });
    },
  );

  it("has unique ids and starts with the temple", () => {
    const ids = LEVEL_CATALOG.map((level) => level.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(FIRST_LEVEL_ID).toBe("temple-1");
  });

  it("chains levels with nextLevelId and ends with null", () => {
    expect(LEVEL_CATALOG.map((level) => level.nextLevelId)).toEqual(["cloister-2", null]);
  });

  it("every asset a level references exists in the registry, with the right kind", () => {
    for (const level of LEVEL_CATALOG) {
      const key = level.assets?.floorTexture;
      if (key) expect(findAsset(key, "texture")).toBeDefined();
    }
  });

  it("asset sources resolve only when asked for", () => {
    for (const entry of Object.values(ASSET_REGISTRY)) {
      expect(typeof entry.source).toBe("function");
      expect(entry.source()).toBeDefined();
    }
  });
});

describe("loadLevel", () => {
  it("reports an unknown level id", () => {
    expect(loadLevel("nowhere")).toEqual({
      ok: false,
      levelId: "nowhere",
      errors: ['There is no level with id "nowhere".'],
    });
  });

  it("refuses an invalid level and lists every problem", () => {
    const catalog = catalogWith((level) => {
      level.playerSpawnId = "missing-spawn";
      level.puzzles[0].correctOptionIndex = 99;
    });
    const result = loadLevel(templeLevel.id, catalog);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toHaveLength(2);
      expect(result.errors.join("\n")).toMatch(/missing-spawn/);
    }
  });

  it("explains a malformed config instead of crashing", () => {
    const catalog = catalogWith((level) => {
      (level as unknown as Record<string, unknown>).interactables = undefined;
      (level as unknown as Record<string, unknown>).floorSize = { x: "wide" };
    });
    const result = loadLevel(templeLevel.id, catalog);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual([`"interactables" must be a list`, `"floorSize" must have positive x and z`]);
    }
  });

  it("falls back to a plain floor for an unknown asset key, with a warning", () => {
    const catalog = catalogWith((level) => {
      level.assets = { floorTexture: "does-not-exist" };
      level.nextLevelId = null;
    });
    const result = loadLevel(templeLevel.id, catalog);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.level.assets?.floorTexture).toBeUndefined();
      expect(result.warnings).toEqual([`Unknown floor texture "does-not-exist"; using the plain floor colour.`]);
    }
  });

  it("treats a level whose next level is missing as the last level, with a warning", () => {
    const catalog = catalogWith((level) => {
      level.nextLevelId = "level-99";
    });
    const result = loadLevel(templeLevel.id, catalog);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.level.nextLevelId).toBeNull();
      expect(result.warnings[0]).toMatch(/level-99/);
    }
  });

  it("never changes the catalog's own level object", () => {
    const catalog = catalogWith((level) => {
      level.nextLevelId = "level-99";
    });
    loadLevel(templeLevel.id, catalog);
    expect(catalog[0].nextLevelId).toBe("level-99");
  });
});
