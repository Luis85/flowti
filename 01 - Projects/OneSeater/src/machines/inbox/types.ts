import { IEventBus } from "src/eventsystem";
import { InboxActionEvent } from "src/eventsystem/messages/InboxMachine";
import { TaskKind } from "src/eventsystem/tasks/TaskFinishedEvent";
import { MessageAction } from "src/messages/types";
import { SimulationMessage } from "src/models/SimulationMessage";
import { MessageStore } from "src/simulation/stores/MessageStore";
import { SimulationStore } from "src/simulation/stores/SimulationStore";

export const ACTION_ENERGY_COST: Record<MessageAction, number> = {
	read: 2,
	spam: 1,
	archive: 1,
	delete: 1,
	accept: 5,
	collect: 15,
	decline: 5,
	negotiate: 5,
	respond: 5,
	inspect: 5,
	approve: 5,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Task Definitions (XP, Tags, etc.)
// ─────────────────────────────────────────────────────────────────────────────
export type TaskDefinition = {
	suffix: string;
	taskKind: TaskKind;
	energy: number;
	time: number;
	xp: number;
	tags: string[];
};

export const ACTION_TASK_MAP: Partial<Record<MessageAction, TaskDefinition>> = {
	read: {
		suffix: "read",
		taskKind: "message:read",
		energy: 2,
		time: 0,
		xp: 6,
		tags: ["chores"],
	},
	spam: {
		suffix: "spam",
		taskKind: "message:spam",
		energy: 1,
		time: 0,
		xp: 3,
		tags: ["chores", "triage"],
	},
	archive: {
		suffix: "archived",
		taskKind: "message:archive",
		energy: 1,
		time: 0,
		xp: 2,
		tags: ["chores", "cleanup"],
	},
	collect: {
		suffix: "collect",
		taskKind: "order:payment",
		energy: 15,
		time: 0,
		xp: 35,
		tags: ["work", "finance"],
	},
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Machine Context
// ─────────────────────────────────────────────────────────────────────────────
export type ActionSource = "inbox" | "modal" | "finance" | "system" | "hotkey";
export type RejectionReason =
	| "MESSAGE_NOT_FOUND"
	| "MESSAGE_DELETED"
	| "ACTION_NOT_ALLOWED"
	| "ALREADY_READ"
	| "NOT_PAYMENT_MESSAGE"
	| "PLAYER_SLEEPING"
	| "NOT_ENOUGH_ENERGY"
	| "INBOX_FULL";

export type LastAction = {
	messageId: string;
	action: MessageAction;
	source: ActionSource;
	success: boolean;
	reason?: RejectionReason;
	timestamp: number;
};

export type InboxContext = {
	bus: IEventBus;
	simStore: SimulationStore;
	msgStore: MessageStore;
	lastAction?: LastAction;
	processingCount: number; // für Rate-Limiting / Batch-Operationen
};

export type InboxInput = {
	bus: IEventBus;
	simStore: SimulationStore;
	msgStore: MessageStore;
};

// ─────────────────────────────────────────────────────────────────────────────
// Validation Result
// ─────────────────────────────────────────────────────────────────────────────

export type ValidationResult =
	| { valid: true; message: SimulationMessage }
	| { valid: false; reason: RejectionReason };

// ─────────────────────────────────────────────────────────────────────────────
// Helper to create action events
// ─────────────────────────────────────────────────────────────────────────────

export function createInboxAction(
	messageId: string,
	action: MessageAction,
	source: ActionSource = "inbox"
): InboxActionEvent {
	return { type: "inbox:action", messageId, action, source };
}
