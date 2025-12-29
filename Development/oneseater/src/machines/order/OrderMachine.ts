import { setup, assign } from "xstate";
import {
	executeCreate,
	createLastActionResult,
	executeProcess,
	executeShip,
	executeClose,
	executePay,
	executeFail,
	executeCancel,
	executeDelete,
} from "./actions";
import {
	validateCreate,
	validateProcess,
	validateShip,
	validateClose,
	validatePay,
	validateFail,
	validateCancel,
	validateDelete,
} from "./guards";
import {
	OrderContext,
	OrderMachineEvent,
	OrderInput,
	LastOrderAction,
} from "./types";

export const orderMachine = setup({
	types: {
		context: {} as OrderContext,
		events: {} as OrderMachineEvent,
		input: {} as OrderInput,
	},

	guards: {
		canCreate: ({ context, event }) => {
			if (event.type !== "order:create") return false;
			return validateCreate(context.store, event.message).valid;
		},

		canProcess: ({ context, event }) => {
			if (event.type !== "order:process") return false;
			return validateProcess(context.store, event.orderId).valid;
		},

		canShip: ({ context, event }) => {
			if (event.type !== "order:ship") return false;
			return validateShip(context.store, event.orderId).valid;
		},

		canClose: ({ context, event }) => {
			if (event.type !== "order:close") return false;
			return validateClose(context.store, event.orderId).valid;
		},

		canPay: ({ context, event }) => {
			if (event.type !== "order:pay") return false;
			return validatePay(context.store, event.orderId).valid;
		},

		canFail: ({ context, event }) => {
			if (event.type !== "order:fail") return false;
			return validateFail(context.store, event.orderId).valid;
		},

		canCancel: ({ context, event }) => {
			if (event.type !== "order:cancel") return false;
			return validateCancel(context.store, event.orderId).valid;
		},

		canDelete: ({ context, event }) => {
			if (event.type !== "order:delete") return false;
			return validateDelete(context.store, event.orderId).valid;
		},
	},

	actions: {
		executeCreate: assign({
			lastAction: ({ context, event }): LastOrderAction | undefined => {
				if (event.type !== "order:create") return context.lastAction;

				const result = executeCreate(
					context.bus,
					context.store,
					event.message,
					context.publishedTransitions,
					event.source
				);

				return createLastActionResult(
					result.success ? result.order.id : "unknown",
					"create",
					result
				);
			},
			processingCount: ({ context }) => context.processingCount + 1,
		}),

		executeProcess: assign({
			lastAction: ({ context, event }): LastOrderAction | undefined => {
				if (event.type !== "order:process") return context.lastAction;

				const result = executeProcess(
					context.bus,
					context.store,
					event.orderId,
					context.publishedTransitions,
					event.source
				);

				return createLastActionResult(event.orderId, "process", result);
			},
			processingCount: ({ context }) => context.processingCount + 1,
		}),

		executeShip: assign({
			lastAction: ({ context, event }): LastOrderAction | undefined => {
				if (event.type !== "order:ship") return context.lastAction;

				const result = executeShip(
					context.bus,
					context.store,
					event.orderId,
					context.publishedTransitions,
					event.source
				);

				return createLastActionResult(event.orderId, "ship", result);
			},
			processingCount: ({ context }) => context.processingCount + 1,
		}),

		executeClose: assign({
			lastAction: ({ context, event }): LastOrderAction | undefined => {
				if (event.type !== "order:close") return context.lastAction;

				const result = executeClose(
					context.bus,
					context.store,
					event.orderId,
					context.publishedTransitions,
					event.source
				);

				return createLastActionResult(event.orderId, "close", result);
			},
			processingCount: ({ context }) => context.processingCount + 1,
		}),

		executePay: assign({
			lastAction: ({ context, event }): LastOrderAction | undefined => {
				if (event.type !== "order:pay") return context.lastAction;

				const result = executePay(
					context.bus,
					context.store,
					event.orderId,
					context.publishedTransitions,
					event.source
				);

				return createLastActionResult(event.orderId, "pay", result);
			},
			processingCount: ({ context }) => context.processingCount + 1,
		}),

		executeFail: assign({
			lastAction: ({ context, event }): LastOrderAction | undefined => {
				if (event.type !== "order:fail") return context.lastAction;

				const result = executeFail(
					context.bus,
					context.store,
					event.orderId,
					context.publishedTransitions,
					event.source,
					event.reason
				);

				return createLastActionResult(event.orderId, "fail", result);
			},
			processingCount: ({ context }) => context.processingCount + 1,
		}),

		executeCancel: assign({
			lastAction: ({ context, event }): LastOrderAction | undefined => {
				if (event.type !== "order:cancel") return context.lastAction;

				const result = executeCancel(
					context.bus,
					context.store,
					event.orderId,
					context.publishedTransitions,
					event.source,
					event.reason
				);

				return createLastActionResult(event.orderId, "cancel", result);
			},
			processingCount: ({ context }) => context.processingCount + 1,
		}),

		executeDelete: assign({
			lastAction: ({ context, event }): LastOrderAction | undefined => {
				if (event.type !== "order:delete") return context.lastAction;

				const result = executeDelete(
					context.bus,
					context.store,
					event.orderId,
					context.publishedTransitions,
					event.source
				);

				return createLastActionResult(event.orderId, "delete", result);
			},
			processingCount: ({ context }) => context.processingCount + 1,
		}),

		rejectAction: assign({
			lastAction: ({ context, event }): LastOrderAction | undefined => {
				let orderId = "unknown";
				let action = "unknown";

				if ("orderId" in event) orderId = event.orderId;
				if (event.type === "order:create") action = "create";
				else if (event.type === "order:process") action = "process";
				else if (event.type === "order:ship") action = "ship";
				else if (event.type === "order:close") action = "close";
				else if (event.type === "order:cancel") action = "cancel";
				else if (event.type === "order:delete") action = "delete";

				return {
					orderId,
					action: action as LastOrderAction["action"],
					success: false,
					reason: "INVALID_TRANSITION",
					timestamp: Date.now(),
				};
			},
		}),

		logAction: ({ context, event }) => {
			if (context.lastAction) {
				const { orderId, action, success, reason } = context.lastAction;
				const status = success ? "✓" : "✗";
				console.log(
					`[Order] ${status} ${action} → ${orderId}${
						reason ? ` (${reason})` : ""
					}`
				);
			}
		},
	},
}).createMachine({
	id: "orderManagement",

	context: ({ input }) => ({
		bus: input.bus,
		store: input.store,
		publishedTransitions: new Set<string>(),
		lastAction: undefined,
		processingCount: 0,
	}),

	initial: "idle",

	states: {
		idle: {
			on: {
				"order:create": [
					{
						guard: "canCreate",
						actions: ["executeCreate", "logAction"],
						target: "idle",
					},
					{
						actions: ["rejectAction", "logAction"],
						target: "idle",
					},
				],

				"order:process": [
					{
						guard: "canProcess",
						actions: ["executeProcess", "logAction"],
						target: "idle",
					},
					{
						actions: ["rejectAction", "logAction"],
						target: "idle",
					},
				],

				"order:ship": [
					{
						guard: "canShip",
						actions: ["executeShip", "logAction"],
						target: "idle",
					},
					{
						actions: ["rejectAction", "logAction"],
						target: "idle",
					},
				],

				"order:close": [
					{
						guard: "canClose",
						actions: ["executeClose", "logAction"],
						target: "idle",
					},
					{
						actions: ["rejectAction", "logAction"],
						target: "idle",
					},
				],

				"order:pay": [
					{
						guard: "canPay",
						actions: ["executePay", "logAction"],
						target: "idle",
					},
					{
						actions: ["rejectAction", "logAction"],
						target: "idle",
					},
				],

				"order:fail": [
					{
						guard: "canFail",
						actions: ["executeFail", "logAction"],
						target: "idle",
					},
					{
						actions: ["rejectAction", "logAction"],
						target: "idle",
					},
				],

				"order:cancel": [
					{
						guard: "canCancel",
						actions: ["executeCancel", "logAction"],
						target: "idle",
					},
					{
						actions: ["rejectAction", "logAction"],
						target: "idle",
					},
				],

				"order:delete": [
					{
						guard: "canDelete",
						actions: ["executeDelete", "logAction"],
						target: "idle",
					},
					{
						actions: ["rejectAction", "logAction"],
						target: "idle",
					},
				],

				"order:sync": {
					// Sync event - no-op, just for triggering re-evaluation
					target: "idle",
				},
			},
		},
	},
});
