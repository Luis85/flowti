import { InboxEvent, InboxActionEvent } from "src/eventsystem/messages/InboxMachine";
import { SimulationStore } from "src/simulation/stores/SimulationStore";
import { createActor } from "xstate";
import { InboxActorRef, inboxMachine, InboxSnapshot } from "./InboxMachine";
import { createInboxAction, LastAction } from "./types";
import { IEventBus } from "src/eventsystem";

export class InboxController {
	private actor: InboxActorRef;

	constructor(private bus: IEventBus, private store: SimulationStore) {
		this.actor = createActor(inboxMachine, {
			input: { bus, store },
		});

		// Subscribe to state changes for debugging/monitoring
		this.actor.subscribe((snapshot) => {
			if (snapshot.context.lastAction) {
				const { action, messageId, success, reason } =
					snapshot.context.lastAction;
				if (!success && reason) {
					console.warn(
						`[Inbox] Action rejected: ${action} on ${messageId} - ${reason}`
					);
				}
			}
		});

		this.actor.start();
	}

	/**
	 * Send an action to the inbox machine
	 */
	send(event: InboxEvent): void {
		this.actor.send(event);
	}

	/**
	 * Convenience method to execute a message action
	 */
	action(
		messageId: string,
		action: InboxActionEvent["action"],
		source: InboxActionEvent["source"] = "inbox"
	): void {
		this.send(createInboxAction(messageId, action, source));
	}

	/**
	 * Get current snapshot
	 */
	getSnapshot(): InboxSnapshot {
		return this.actor.getSnapshot();
	}

	/**
	 * Get last action result
	 */
	getLastAction(): LastAction | undefined {
		return this.getSnapshot().context.lastAction;
	}

	/**
	 * Check if last action was successful
	 */
	wasLastActionSuccessful(): boolean {
		return this.getLastAction()?.success ?? false;
	}

	/**
	 * Get current state name
	 */
	getState(): string {
		return this.getSnapshot().value as string;
	}

	/**
	 * Stop the actor
	 */
	destroy(): void {
		this.actor.stop();
	}
}
