/**
 * Development-only logging for the online connection. Shows in the Metro terminal
 * (and the dev tools console). Compiled out of release builds via `__DEV__`.
 */
const TAG = "[net]";

export const netLog = {
  info(message: string, details?: unknown) {
    if (__DEV__) console.log(TAG, message, ...(details === undefined ? [] : [details]));
  },
  warn(message: string, details?: unknown) {
    if (__DEV__) console.warn(TAG, message, ...(details === undefined ? [] : [details]));
  },
  error(message: string, details?: unknown) {
    if (__DEV__) console.error(TAG, message, ...(details === undefined ? [] : [details]));
  },
};

/** The parts of a thrown value worth logging (SDK errors carry a numeric `code`). */
export function describeRawError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, code: (error as { code?: unknown }).code };
  }
  if (error && typeof error === "object") return { ...(error as Record<string, unknown>) };
  return { value: String(error) };
}
