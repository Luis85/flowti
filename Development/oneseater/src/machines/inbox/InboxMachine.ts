import { validateAction } from "./guards";
import { executeAction } from "./actions";
import { setup, assign, ActorRefFrom, SnapshotFrom } from "xstate";
import { InboxContext, InboxInput, LastAction } from "./types";
import { InboxEvent } from "src/eventsystem/messages/InboxMachine";
import { InboxResetedEvent } from "src/eventsystem/messages/InboxResetedEvent";

export type InboxMachineType = typeof inboxMachine;
export type InboxActorRef = ActorRefFrom<InboxMachineType>;
export type InboxSnapshot = SnapshotFrom<InboxMachineType>;

export const inboxMachine = setup({
	types: {
		context: {} as InboxContext,
		events: {} as InboxEvent,
		input: {} as InboxInput,
	},

	guards: {
		/**
		 * Main validation guard - checks all preconditions
		 */
		canExecute: ({ context, event }) => {
			if (event.type !== "inbox:action") return false;
			const result = validateAction(
				context.store,
				event.messageId,
				event.action
			);
			return result.valid;
		},

		canReset: ({ context, event }) => {
			if (event.type !== "inbox:reset") return false;
			return true;
		},

		/**
		 * Action type guards for conditional branching
		 */
		isRead: ({ event }) =>
			event.type === "inbox:action" && event.action === "read",
		isSpam: ({ event }) =>
			event.type === "inbox:action" && event.action === "spam",
		// this is our done event, if we archive a mail we are done with it, finito basta, we now also want compensation
		// gets projected as "done" button, should be refactored into proper done state I guess
		isArchive: ({ event }) =>
			event.type === "inbox:action" && event.action === "archive",
		isDelete: ({ event }) =>
			event.type === "inbox:action" && event.action === "delete",
		isAccept: ({ event }) =>
			event.type === "inbox:action" && event.action === "accept",
		isCollect: ({ event }) =>
			event.type === "inbox:action" && event.action === "collect",
	},

	actions: {
		/**
		 * Execute action and update context with result
		 */
		executeAction: assign({
			lastAction: ({ context, event }): LastAction | undefined => {
				if (event.type !== "inbox:action") return context.lastAction;

				const result = executeAction(
					context.bus,
					context.store,
					event.messageId,
					event.action,
					event.source
				);

				return {
					messageId: event.messageId,
					action: event.action,
					source: event.source,
					success: result.success,
					reason: result.success ? undefined : result.reason,
					timestamp: Date.now(),
				};
			},
			processingCount: ({ context }) => context.processingCount + 1,
		}),

		/**
		 * Handle rejected action - still track but mark as failed
		 */
		rejectAction: assign({
			lastAction: ({ context, event }): LastAction | undefined => {
				if (event.type !== "inbox:action") return context.lastAction;

				const validation = validateAction(
					context.store,
					event.messageId,
					event.action
				);

				return {
					messageId: event.messageId,
					action: event.action,
					source: event.source,
					success: false,
					reason: validation.valid ? undefined : validation.reason,
					timestamp: Date.now(),
				};
			},
		}),

		/**
		 * clear the inbox
		 */
		executeReset: assign({
			lastAction: ({ context, event }): LastAction | undefined => {
				if (event.type !== "inbox:reset") return context.lastAction;
				context.store.messages = []
				context.bus.publish(new InboxResetedEvent())
			},
		}),

		/**
		 * Clear last action tracking
		 */
		clearLastAction: assign({
			lastAction: undefined,
		}),

		/**
		 * Debug logging
		 */
		log: ({ event }) => {
			if (event.type === "inbox:action") {
				console.log(`[Inbox] ${event.action} → ${event.messageId}`);
			}
		},
	},
}).createMachine({
	id: "inbox",

	context: ({ input }) => ({
		bus: input.bus,
		store: input.store,
		lastAction: undefined,
		processingCount: 0,
	}),

	initial: "idle",

	states: {
		// ─────────────────────────────────────────────────────────────────────────
		// IDLE: Ready to process actions
		// ─────────────────────────────────────────────────────────────────────────
		idle: {
			on: {
				"inbox:action": [
					{
						// Valid action → execute and return to idle
						guard: "canExecute",
						actions: ["executeAction"],
						target: "idle",
					},
					{
						// Invalid action → reject and return to idle
						actions: ["rejectAction"],
						target: "idle",
					},
				],

				"inbox:sync": {
					// UI sync request - no-op, just for state refresh
					target: "idle",
				},

				"inbox:reset": [
					{
						// Valid action → execute and return to idle
						guard: "canReset",
						actions: ["executeReset"],
						target: "idle",
					},
					{
						// Invalid action → reject and return to idle
						actions: ["rejectAction"],
						target: "idle",
					},
				],

				"inbox:message:new": {
					// New message notification - could trigger UI updates
					target: "idle",
				},
			},
		},

		// ─────────────────────────────────────────────────────────────────────────
		// PROCESSING: For future batch operations with loading state
		// ─────────────────────────────────────────────────────────────────────────
		processing: {
			// Reserved for batch operations
			always: { target: "idle" },
		},

		// ─────────────────────────────────────────────────────────────────────────
		// LOCKED: When player can't interact (sleeping, cutscene, etc.)
		// ─────────────────────────────────────────────────────────────────────────
		locked: {
			on: {
				"inbox:action": {
					// All actions rejected in locked state
					actions: ["rejectAction"],
					target: "locked",
				},
			},
		},
	},
});
