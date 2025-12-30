import { MessageActionRejectedEvent } from "src/eventsystem/messages/MessageActionRejectedEvent";
import { MessageDeletedEvent } from "src/eventsystem/messages/MessageDeletedEvent";
import { MessageMarkedAsSpamEvent } from "src/eventsystem/messages/MessageMarkedAsSpamEvent";
import { MessageReadEvent } from "src/eventsystem/messages/MessageReadEvent";
import { OrderAcceptedEvent } from "src/eventsystem/orders/OrderAcceptedEvent";
import { PaymentCollectedEvent } from "src/eventsystem/orders/PaymentCollectedEvent";
import { TaskFinishedEvent, TaskKind } from "src/eventsystem/tasks/TaskFinishedEvent";
import { MessageAction } from "src/messages/types";
import { SimulationMessage } from "src/models/SimulationMessage";
import { validateAction, REJECTION_MESSAGES } from "./guards";
import { RejectionReason, ActionSource, ACTION_TASK_MAP, LastAction } from "./types";
import { IEventBus } from "src/eventsystem";
import { MessageStore } from "src/simulation/stores/MessageStore";
import { SimulationStore } from "src/simulation/stores/SimulationStore";

export type ExecuteResult =
	| { success: true; action: MessageAction }
	| { success: false; reason: RejectionReason };

/**
 * Executes an action: validates, mutates store, publishes events
 */
export function executeAction(
	bus: IEventBus,
	simStore: SimulationStore,
	msgStore: MessageStore,
	messageId: string,
	action: MessageAction,
	source: ActionSource
): ExecuteResult {
	// 1. Validate first
	const validation = validateAction(simStore,msgStore, messageId, action);

	if (!validation.valid) {
		publishRejection(bus, messageId, action, validation.reason);
		return { success: false, reason: validation.reason };
	}

	const message = validation.message;

	// 2. Mutate store + 3. Publish events
	switch (action) {
		case "read":
			msgStore.markMessageAsRead(messageId);
			publishRead(bus, messageId);
			break;

		case "spam":
			msgStore.markMessageAsSpam(messageId);
			publishSpam(bus, messageId);
			break;

		case "archive":
			msgStore.softDeleteMessage(messageId);
			publishDelete(bus, messageId);
			break;

		case "delete":
			msgStore.softDeleteMessage(messageId);
			publishDelete(bus, messageId);
			break;

		case "accept":
			msgStore.softDeleteMessage(messageId);
			publishAccept(bus, messageId, message);
			publishDelete(bus, messageId);
			break;

		case "collect":
			msgStore.softDeleteMessage(messageId);
			publishCollect(bus, messageId, message);
			publishDelete(bus, messageId);
			break;
	}

	// 4. Publish task completion for XP/energy
	publishTask(bus, messageId, action, source);

	return { success: true, action };
}

/**
 * Publishes MessageReadEvent to EventBus
 */
export function publishRead(bus: IEventBus, messageId: string): void {
	bus.publish(new MessageReadEvent(messageId));
}

/**
 * Publishes MessageDeletedEvent with hardRemove flag
 */
export function publishDelete(
	bus: IEventBus,
	messageId: string,
	hardRemove = false
): void {
	bus.publish(new MessageDeletedEvent(messageId, hardRemove));
}

/**
 * Publishes MessageMarkedAsSpamEvent
 */
export function publishSpam(bus: IEventBus, messageId: string): void {
	bus.publish(new MessageMarkedAsSpamEvent(messageId));
}

/**
 * Publishes OrderAcceptedEvent with message payload
 */
export function publishAccept(
	bus: IEventBus,
	messageId: string,
	message: SimulationMessage
): void {
	bus.publish(new OrderAcceptedEvent(messageId, { ...message }));
}

/**
 * Publishes PaymentCollectedEvent with message payload
 */
export function publishCollect(
	bus: IEventBus,
	messageId: string,
	message: SimulationMessage
): void {
	bus.publish(new PaymentCollectedEvent(messageId, { ...message }));
}

/**
 * Publishes MessageActionRejectedEvent
 */
export function publishRejection(
	bus: IEventBus,
	messageId: string,
	action: MessageAction,
	reason: RejectionReason
): void {
	const humanReason = REJECTION_MESSAGES[reason] ?? "Unknown error.";
	bus.publish(new MessageActionRejectedEvent(messageId, action, humanReason));
}

/**
 * Publishes TaskFinishedEvent for XP/Energy tracking
 */
export function publishTask(
	bus: IEventBus,
	messageId: string,
	action: MessageAction,
	source: ActionSource
): void {
	const taskDef = ACTION_TASK_MAP[action];
	if (!taskDef) return;

	bus.publish(
		new TaskFinishedEvent(
			`msg:${messageId}:${taskDef.suffix}`,
			taskDef.taskKind as TaskKind,
			"inbox",
			taskDef.energy,
			taskDef.time,
			taskDef.xp,
			{ messageId, source },
			taskDef.tags
		)
	);
}


// ─────────────────────────────────────────────────────────────────────────────
// Action Helpers (für externe Nutzung / Composition)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a LastAction result object from an execution result
 * Used by InboxMachine internally
 */
export function createLastActionResult(
	messageId: string,
	action: MessageAction,
	source: ActionSource,
	result: ExecuteResult
): LastAction {
	return {
		messageId,
		action,
		source,
		success: result.success,
		reason: result.success ? undefined : result.reason,
		timestamp: Date.now(),
	};
}

/**
 * Log helper for debugging
 */
export function logInboxAction(
	action: MessageAction,
	messageId: string,
	source: ActionSource,
	success: boolean
): void {
	const status = success ? "✓" : "✗";
	console.log(`[Inbox] ${status} ${action} → ${messageId} (${source})`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Batch Operations
// ─────────────────────────────────────────────────────────────────────────────

export type BatchResult = {
	total: number;
	successful: number;
	failed: number;
	results: Array<{ messageId: string; result: ExecuteResult }>;
};

/**
 * Execute same action on multiple messages
 */
export function executeBatchAction(
	bus: IEventBus,
	simStore: SimulationStore,
	msgStore: MessageStore,
	messageIds: string[],
	action: MessageAction,
	source: ActionSource = "system"
): BatchResult {
	const results = messageIds.map((messageId) => ({
		messageId,
		result: executeAction(bus, simStore, msgStore, messageId, action, source),
	}));

	return {
		total: results.length,
		successful: results.filter((r) => r.result.success).length,
		failed: results.filter((r) => !r.result.success).length,
		results,
	};
}

/**
 * Archive all read messages
 */
export function archiveAllRead(
	bus: IEventBus,
	simStore: SimulationStore,
	msgStore: MessageStore,
): BatchResult {
	// Use store method to get read messages
	const readMessages = msgStore.getActiveMessages().filter((m) => m.read_at);
	const readMessageIds = readMessages.map((m) => m.id);

	return executeBatchAction(bus, simStore, msgStore, readMessageIds, "archive", "system");
}
