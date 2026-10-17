/**
 * Every art asset a level may reference, by key. Levels name assets with these
 * keys (e.g. `assets: { floorTexture: "cloister-floor" }`), never with file paths.
 *
 * Each entry's `source` is a function, so the file is only resolved and loaded
 * when a level that uses it is on screen; the renderer releases it again when
 * the level closes. To add an asset: put the file under assets/, add an entry
 * here, and reference its key from a level.
 */
export type AssetKind = "texture";

export interface AssetEntry {
  kind: AssetKind;
  /** Metro asset id from require(). Called only when the asset is needed. */
  source: () => number;
}

export const ASSET_REGISTRY: Readonly<Record<string, AssetEntry>> = {
  "cloister-floor": {
    kind: "texture",
    source: () => require("@/assets/textures/cloister-floor.png"),
  },
};

/** Look up an asset of the expected kind; undefined if the key is unknown or the wrong kind. */
export function findAsset(key: string, kind: AssetKind): AssetEntry | undefined {
  const entry = ASSET_REGISTRY[key];
  return entry?.kind === kind ? entry : undefined;
}
