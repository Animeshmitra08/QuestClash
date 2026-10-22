/**
 * Fills in JavaScript built-ins the Colyseus client packages expect but React
 * Native's Hermes engine may not provide. Must be imported before @colyseus/sdk
 * (OnlineSession.ts imports it first).
 *
 * - FinalizationRegistry: @colyseus/schema creates one when it loads, as a memory
 *   safety net for server-side "state views". Clients never create state views, so
 *   a registry that never runs its callback changes nothing for the app.
 * - WeakRef: only used by that same server-side feature; a plain strong reference
 *   is a safe stand-in on the client.
 *
 * Each is installed only if missing, so engines that have the real thing keep it.
 */
const scope = globalThis as Record<string, unknown>;

if (typeof scope.FinalizationRegistry === "undefined") {
  // `new FinalizationRegistry(cleanup)` still works: the cleanup callback is simply never called.
  class FinalizationRegistryStandIn<T> {
    register(_target: object, _heldValue: T, _unregisterToken?: object): void {}
    unregister(_unregisterToken: object): boolean {
      return false;
    }
  }
  scope.FinalizationRegistry = FinalizationRegistryStandIn;
}

if (typeof scope.WeakRef === "undefined") {
  class WeakRefStandIn<T extends object> {
    constructor(private readonly target: T) {}
    deref(): T | undefined {
      return this.target;
    }
  }
  scope.WeakRef = WeakRefStandIn;
}

export {};
