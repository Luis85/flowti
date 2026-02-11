/**
 * Event types owned by the Subscription domain.
 */

import type { Subscription } from "./types";

export interface SubscriptionEventMap {
	/** Emitted when subscription state is loaded from storage */
	"subscription.loaded": { subscriptions: Subscription[] };
	/** Emitted when a subscription is created */
	"subscription.created": { subscription: Subscription };
	/** Emitted when a subscription is updated */
	"subscription.updated": { subscription: Subscription };
	/** Emitted when a subscription is deleted */
	"subscription.deleted": { subscriptionId: string };
	/** Command: create a new subscription */
	"subscription.create": {
		eventType: string;
		label?: string;
		filters: Subscription["filters"];
	};
	/** Command: update an existing subscription */
	"subscription.update": {
		subscriptionId: string;
		label?: string;
		filters?: Subscription["filters"];
		enabled?: boolean;
	};
	/** Command: remove a subscription */
	"subscription.remove": { subscriptionId: string };
	/** Command: request re-emit of current subscription state */
	"subscription.refresh": Record<string, never>;
	/** Emitted when an incoming event matches one or more subscriptions */
	"subscription.matched": {
		eventType: string;
		subscriptionId: string;
		subscriptionLabel?: string;
		timestamp: string;
	};
}
