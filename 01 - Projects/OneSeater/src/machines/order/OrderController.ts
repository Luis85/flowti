import { SimulationStore } from "src/simulation/stores/SimulationStore";
import { ActorRefFrom, SnapshotFrom, createActor } from "xstate";
import { orderMachine } from "./OrderMachine";
import { OrderMachineEvent, LastOrderAction, ActionSource } from "./types";
import { IEventBus } from "src/eventsystem";
import { SimulationMessage } from "src/models/SimulationMessage";

export type OrderMachineType = typeof orderMachine;
export type OrderActorRef = ActorRefFrom<OrderMachineType>;
export type OrderSnapshot = SnapshotFrom<OrderMachineType>;

export interface OrderControllerOptions {
	debug?: boolean;
}

export class OrderController {
	private actor: OrderActorRef;

	constructor(
		private bus: IEventBus,
		private store: SimulationStore,
		options: OrderControllerOptions = {}
	) {
		this.actor = createActor(orderMachine, {
			input: { bus, store },
		});

		// Subscribe to state changes for monitoring
		this.actor.subscribe((snapshot) => {
			if (snapshot.context.lastAction) {
				const { action, orderId, success, reason } =
					snapshot.context.lastAction;
				if (!success && reason) {
					console.warn(
						`[Order] Action rejected: ${action} on ${orderId} - ${reason}`
					);
				}
			}
		});

		this.actor.start();
	}

	/**
	 * Send an event to the order machine
	 */
	send(event: OrderMachineEvent): void {
		this.actor.send(event);
	}

	/**
	 * Create a new order from a CustomerPurchaseOrder message
	 */
	create(
		message: SimulationMessage,
		source: ActionSource = "system"
	): void {
		this.send({ type: "order:create", message, source });
	}

	/**
	 * Process an order (new → active)
	 */
	process(
		orderId: string,
		source: ActionSource = "player"
	): void {
		this.send({ type: "order:process", orderId, source });
	}

	/**
	 * Ship an order (active → shipped)
	 */
	ship(
		orderId: string,
		source: ActionSource = "player"
	): void {
		this.send({ type: "order:ship", orderId, source });
	}

	/**
	 * Close an order (shipped/paid → closed)
	 */
	close(
		orderId: string,
		source: ActionSource = "system"
	): void {
		this.send({ type: "order:close", orderId, source });
	}

	/**
	 * Mark order as paid (shipped → paid)
	 */
	pay(
		orderId: string,
		source: ActionSource = "system"
	): void {
		this.send({ type: "order:pay", orderId, source });
	}

	/**
	 * Mark order payment as failed (shipped → failed)
	 */
	fail(
		orderId: string,
		reason?: string,
		source: ActionSource = "system"
	): void {
		this.send({ type: "order:fail", orderId, reason, source });
	}

	/**
	 * Cancel an order
	 */
	cancel(
		orderId: string,
		reason?: string,
		source: ActionSource = "player"
	): void {
		this.send({ type: "order:cancel", orderId, reason, source });
	}

	/**
	 * Delete an order
	 */
	delete(
		orderId: string,
		source: ActionSource = "system"
	): void {
		this.send({ type: "order:delete", orderId, source });
	}

	/**
	 * Get current snapshot
	 */
	getSnapshot(): OrderSnapshot {
		return this.actor.getSnapshot();
	}

	/**
	 * Get last action result
	 */
	getLastAction(): LastOrderAction | undefined {
		return this.getSnapshot().context.lastAction;
	}

	/**
	 * Check if last action was successful
	 */
	wasLastActionSuccessful(): boolean {
		return this.getLastAction()?.success ?? false;
	}

	/**
	 * Get processing count
	 */
	getProcessingCount(): number {
		return this.getSnapshot().context.processingCount;
	}

	/**
	 * Stop the actor
	 */
	destroy(): void {
		this.actor.stop();
	}
}
