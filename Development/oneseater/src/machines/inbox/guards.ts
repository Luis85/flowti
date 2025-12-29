import { InboxActionEvent } from "src/eventsystem/messages/InboxMachine";
import { MessageAction } from "src/messages/types";
import { SimulationMessage } from "src/models/SimulationMessage";
import { SimulationStore } from "src/simulation/stores/SimulationStore";
import { ACTION_ENERGY_COST, ValidationResult, RejectionReason } from "./types";

/**
 * Find a message by ID (delegates to store)
 */
export function findMessage(
	store: SimulationStore,
	messageId: string
): SimulationMessage | undefined {
	return store.findMessage(messageId);
}

export function isMessageDeleted(msg: SimulationMessage): boolean {
	return !!msg.deleted_at;
}

export function isMessageRead(msg: SimulationMessage): boolean {
	return !!msg.read_at;
}

export function isActionAllowed(
	msg: SimulationMessage,
	action: MessageAction
): boolean {
	return msg.possible_actions?.includes(action) ?? false;
}

export function isPaymentMessage(msg: SimulationMessage): boolean {
	return msg.type === "Payment";
}

export function isPlayerSleeping(store: SimulationStore): boolean {
	return store.player.status === "sleeping";
}

export function getPlayerEnergy(store: SimulationStore): number {
	return store.player.stats.energy ?? 0;
}

export function hasEnoughEnergy(
	store: SimulationStore,
	action: MessageAction
): boolean {
	const energy = getPlayerEnergy(store);
	const required = ACTION_ENERGY_COST[action] ?? 0;
	return energy >= required;
}

/**
 * Check if inbox is full (delegates to store)
 */
export function isInboxFull(store: SimulationStore, maxSize = 50): boolean {
	return store.isInboxFull(maxSize);
}

// ─────────────────────────────────────────────────────────────────────────────
// Composite Validation (für die Machine)
// ─────────────────────────────────────────────────────────────────────────────

export function validateAction(
	store: SimulationStore,
	messageId: string,
	action: MessageAction
): ValidationResult {
	// 1. Message exists?
	const msg = findMessage(store, messageId);
	if (!msg) {
		return { valid: false, reason: "MESSAGE_NOT_FOUND" };
	}

	// 2. Not deleted?
	if (isMessageDeleted(msg)) {
		return { valid: false, reason: "MESSAGE_DELETED" };
	}

	// 3. Action allowed for this message type?
	if (!isActionAllowed(msg, action)) {
		return { valid: false, reason: "ACTION_NOT_ALLOWED" };
	}

	// 4. Action-specific checks
	switch (action) {
		case "read":
			if (isMessageRead(msg)) {
				return { valid: false, reason: "ALREADY_READ" };
			}
			break;

		case "collect":
			{
				const payment = store.payments.find((p) => p.id === msg.id);

				if (!payment) {
					return { valid: false, reason: "ACTION_NOT_ALLOWED" };
				}
				if (!isPaymentMessage(msg)) {
					return { valid: false, reason: "NOT_PAYMENT_MESSAGE" };
				}
			}

			break;
	}

	// 5. Player state checks
	if (isPlayerSleeping(store)) {
		return { valid: false, reason: "PLAYER_SLEEPING" };
	}

	// 6. Energy check
	if (!hasEnoughEnergy(store, action)) {
		return { valid: false, reason: "NOT_ENOUGH_ENERGY" };
	}

	return { valid: true, message: msg };
}

// ─────────────────────────────────────────────────────────────────────────────
// XState Guard Definitions (für setup())
// ─────────────────────────────────────────────────────────────────────────────

export type InboxGuardArgs = {
	context: { store: SimulationStore };
	event: InboxActionEvent;
};

/**
 * XState-kompatible Guards für die InboxMachine
 * Diese werden in setup({ guards: ... }) registriert
 */
export const inboxGuards = {
	/**
	 * Hauptvalidierung: Prüft alle Bedingungen für eine Aktion
	 */
	canExecuteAction: ({ context, event }: InboxGuardArgs): boolean => {
		if (event.type !== "inbox:action") return false;
		const result = validateAction(
			context.store,
			event.messageId,
			event.action
		);
		return result.valid;
	},

	/**
	 * Spezifische Action-Guards (für conditional transitions)
	 */
	isReadAction: ({ event }: { event: InboxActionEvent }): boolean => {
		return event.type === "inbox:action" && event.action === "read";
	},

	isSpamAction: ({ event }: { event: InboxActionEvent }): boolean => {
		return event.type === "inbox:action" && event.action === "spam";
	},

	isArchiveAction: ({ event }: { event: InboxActionEvent }): boolean => {
		return event.type === "inbox:action" && event.action === "archive";
	},

	isDeleteAction: ({ event }: { event: InboxActionEvent }): boolean => {
		return event.type === "inbox:action" && event.action === "delete";
	},

	isAcceptAction: ({ event }: { event: InboxActionEvent }): boolean => {
		return event.type === "inbox:action" && event.action === "accept";
	},

	isCollectAction: ({ event }: { event: InboxActionEvent }): boolean => {
		return event.type === "inbox:action" && event.action === "collect";
	},
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Human-readable rejection messages
// ─────────────────────────────────────────────────────────────────────────────

export const REJECTION_MESSAGES: Record<RejectionReason, string> = {
	MESSAGE_NOT_FOUND: "Message not found.",
	MESSAGE_DELETED: "Message was already deleted.",
	ACTION_NOT_ALLOWED: "This action is not available for this message.",
	ALREADY_READ: "Message was already read.",
	NOT_PAYMENT_MESSAGE: "Only payment messages can be collected.",
	PLAYER_SLEEPING: "Cannot perform actions while sleeping.",
	NOT_ENOUGH_ENERGY: "Not enough energy to perform this action.",
	INBOX_FULL: "Inbox is full. Delete some messages first.",
} as const;
