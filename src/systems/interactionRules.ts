import type { Interactable, InteractableKind, LevelDefinition } from "@/types/game";
import type { GameEvent, GameState, InteractionResult, Notice } from "@/types/state";

import { blockReason, checkDoor, consumedItemIds, DOOR_TRANSITIONS } from "./DoorSystem";
import { isInspected, isPickupCollected, isPuzzleSolved } from "./gameState";
import { addItem, removeItem } from "./InventorySystem";
import { getPuzzle } from "./PuzzleSystem";
import { nextState } from "./stateMachine";

/** Everything that follows from using an object. Handlers are pure: they never change `state`. */
export interface InteractionOutcome {
  state: GameState;
  result: InteractionResult;
  events: GameEvent[];
  notice?: { text: string; tone: Notice["tone"] };
}

type Handler<K extends InteractableKind> = (
  target: Extract<Interactable, { kind: K }>,
  state: GameState,
  level: LevelDefinition,
) => InteractionOutcome;

const nothing = (state: GameState): InteractionOutcome => ({ state, result: { type: "none" }, events: [] });

/**
 * What using each kind of object does. The mapped type makes TypeScript reject
 * this object until every Interactable kind has a handler, so adding a kind
 * can't be half-done. PlayerController and the scene never change for new kinds.
 */
export const interactionRules: { [K in InteractableKind]: Handler<K> } = {
  inspect(target, state) {
    const firstTime = !isInspected(state, target.id);
    return {
      state: firstTime ? { ...state, inspectedIds: [...state.inspectedIds, target.id] } : state,
      result: { type: "message", title: target.title, message: target.message },
      events: [{ type: "inspected", interactableId: target.id, firstTime }],
    };
  },

  pickup(target, state) {
    if (isPickupCollected(state, target.id)) return nothing(state);

    const inventory = addItem(state.inventory, target.item);
    if (inventory === state.inventory) {
      return { ...nothing(state), notice: { text: "You can't carry any more.", tone: "info" } };
    }
    return {
      state: { ...state, inventory, collectedPickupIds: [...state.collectedPickupIds, target.id] },
      result: { type: "none" },
      events: [{ type: "itemCollected", item: target.item, pickupId: target.id }],
      notice: { text: `You found the ${target.item.name}!`, tone: "success" },
    };
  },

  puzzle(target, state, level) {
    if (isPuzzleSolved(state, target.puzzleId)) {
      return { state, result: { type: "message", ...target.solvedMessage }, events: [] };
    }
    return {
      state,
      result: { type: "puzzle", puzzle: getPuzzle(level.puzzles, target.puzzleId) },
      events: [{ type: "puzzleOpened", puzzleId: target.puzzleId }],
    };
  },

  door(target, state) {
    const check = checkDoor(target, state);
    if (!check.canOpen) {
      if (check.reason === "alreadyOpen") return nothing(state);
      return {
        state,
        result: { type: "message", ...check.requirement.blockedMessage },
        events: [{ type: "doorBlocked", doorId: target.id, reason: blockReason(check.requirement) }],
      };
    }

    // checkDoor already confirmed that "unlock" is valid and every required item is held.
    const opened = nextState(DOOR_TRANSITIONS, state.doors[target.id] ?? "locked", "unlock") ?? "open";
    const usedUp = state.inventory.filter((held) => consumedItemIds(target).includes(held.id));
    return {
      state: {
        ...state,
        doors: { ...state.doors, [target.id]: opened },
        inventory: usedUp.reduce((inventory, item) => removeItem(inventory, item.id), state.inventory),
      },
      result: { type: "none" },
      events: [
        ...usedUp.map((item): GameEvent => ({ type: "itemUsed", item })),
        { type: "doorOpened", doorId: target.id },
      ],
      notice: { text: "The door grinds open…", tone: "success" },
    };
  },
};

/** Run the handler for `target`'s kind. */
export function runInteraction(
  target: Interactable,
  state: GameState,
  level: LevelDefinition,
): InteractionOutcome {
  // TypeScript can't connect `target.kind` to the matching handler's parameter type
  // on its own; the mapped type above guarantees they match.
  const handler = interactionRules[target.kind] as Handler<InteractableKind>;
  return handler(target as never, state, level);
}
