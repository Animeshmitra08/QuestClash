import { netLog } from "./netLog";

/**
 * Where the game server is. Set EXPO_PUBLIC_GAME_SERVER_URL in .env.local, e.g.
 *   EXPO_PUBLIC_GAME_SERVER_URL=http://192.168.1.20:2567
 * Use your computer's LAN address for a phone on the same Wi-Fi: "localhost" on a
 * phone is the phone itself. EXPO_PUBLIC_ values are compiled into the app in
 * plain text, which is fine for an address but never for a secret.
 */
export const DEFAULT_SERVER_URL = "http://localhost:2567";

/** Forgive common .env typos: quotes, whitespace, a trailing `;` or `/`. */
export function cleanServerUrl(raw: string | undefined): string {
  return (raw ?? "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/[;/\s]+$/, "");
}

function resolveServerUrl(): string {
  const raw = process.env.EXPO_PUBLIC_GAME_SERVER_URL;
  const url = cleanServerUrl(raw);
  if (!url) {
    netLog.warn(`EXPO_PUBLIC_GAME_SERVER_URL is not set; using ${DEFAULT_SERVER_URL}`);
    return DEFAULT_SERVER_URL;
  }
  if (url !== raw) netLog.warn(`Cleaned EXPO_PUBLIC_GAME_SERVER_URL from "${raw}" to "${url}". Fix .env.local.`);
  if (!/^(https?|wss?):\/\/[^\s/?#;]+$/i.test(url)) {
    netLog.error(`EXPO_PUBLIC_GAME_SERVER_URL "${url}" doesn't look like http(s)://host[:port]`);
  }
  netLog.info(`Game server: ${url}`);
  return url;
}

export const GAME_SERVER_URL: string = resolveServerUrl();
