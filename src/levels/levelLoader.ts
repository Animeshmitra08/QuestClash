import { validateLevel } from "@/systems/levelValidation";
import type { LevelDefinition } from "@/types/game";

import { findAsset } from "./assets";
import { LEVEL_CATALOG } from "./catalog";

export type LevelLoadResult =
  | {
      ok: true;
      /** The level, ready to play. Unusable optional parts (bad asset keys) are removed. */
      level: LevelDefinition;
      /** Problems that were worked around; worth fixing, but the level still plays. */
      warnings: string[];
    }
  | { ok: false; levelId: string; errors: string[] };

/**
 * Loads a level by id and checks it before anything is created for it.
 *
 * - Errors (unknown id, broken references, malformed config) stop the level
 *   from starting; the screen shows them instead of crashing.
 * - Warnings (unknown asset keys, a missing next level) are worked around: the
 *   level falls back to plain colours, or is treated as the last level.
 */
export function loadLevel(
  levelId: string,
  catalog: readonly LevelDefinition[] = LEVEL_CATALOG,
): LevelLoadResult {
  const found = catalog.find((level) => level?.id === levelId);
  if (!found) return { ok: false, levelId, errors: [`There is no level with id "${levelId}".`] };

  let errors: string[];
  try {
    errors = validateLevel(found);
  } catch (error) {
    // A config shaped too differently for validation to even read.
    errors = [`The level config is malformed: ${error instanceof Error ? error.message : String(error)}`];
  }
  if (errors.length > 0) return { ok: false, levelId, errors };

  const warnings: string[] = [];
  let level = found;

  const floorTexture = level.assets?.floorTexture;
  if (floorTexture !== undefined && !findAsset(floorTexture, "texture")) {
    warnings.push(`Unknown floor texture "${floorTexture}"; using the plain floor colour.`);
    level = { ...level, assets: { ...level.assets, floorTexture: undefined } };
  }

  if (level.nextLevelId !== null && !catalog.some((other) => other?.id === level.nextLevelId)) {
    warnings.push(`Next level "${level.nextLevelId}" does not exist; treating this as the last level.`);
    level = { ...level, nextLevelId: null };
  }

  return { ok: true, level, warnings };
}
