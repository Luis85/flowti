import { MessageAction } from "src/messages/types";

export type TaskKind =
	| "message:read"
	| "message:archive"
	| "message:spam"
	| "message:delete"
	| "message:accept"
	| "message:collect"
	| "player:sleep"
	| "order:creation"
	| "order:processing"
	| "order:shipping"
	| "order:closing"
	| "order:payment"
	| "generic";

export type TaskSource = "inbox" | "board" | "system" | "customer" | "other";

export class TaskFinishedEvent {
	type: "task:finished";

	finishedAtIso: string;
	action?: MessageAction;
	messageId?: string;
	constructor(
		public taskId: string, // unique: e.g. `msg:${messageId}:read`
		public kind: TaskKind,
		public source: TaskSource,

		// costs & rewards (inputs)
		public energyCost: number, // e.g. 1..5
		public timeCostMinutes: number, // e.g. 1..15
		public xpGain: number, // e.g. 1..25

		// reference payload (optional)
		public refs?: Record<string, string>, // e.g. { messageId: "..."}
		public tags: string[] = [] // e.g. ["ops", "comms"]
	) {}
}
