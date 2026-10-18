/**
 * Where the game server is. Set EXPO_PUBLIC_GAME_SERVER_URL in .env.local, e.g.
 *   EXPO_PUBLIC_GAME_SERVER_URL=http://192.168.1.20:2567
 * Use your computer's LAN address for a phone on the same Wi-Fi: "localhost" on a
 * phone is the phone itself. EXPO_PUBLIC_ values are compiled into the app in
 * plain text, which is fine for an address but never for a secret.
 */
export const DEFAULT_SERVER_URL = "http://localhost:2567";

export const GAME_SERVER_URL: string = process.env.EXPO_PUBLIC_GAME_SERVER_URL || DEFAULT_SERVER_URL;
