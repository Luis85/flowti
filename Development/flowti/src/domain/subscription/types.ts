/**
 * Types for the Subscription domain.
 */

/**
 * Filter criteria for a subscription.
 * All specified fields must match (AND logic).
 */
export interface SubscriptionFilter {
	/** Glob pattern matched against the file path */
	pathPattern?: string;
	/** File extension to match (e.g. "csv", "md") */
	extension?: string;
	/** Glob pattern matched against the filename (basename) */
	namePattern?: string;
}

/**
 * A single event subscription with optional filters.
 */
export interface Subscription {
	/** Unique subscription ID */
	id: string;
	/** The event type to subscribe to */
	eventType: string;
	/** Optional human-readable label */
	label?: string;
	/** Filter criteria (all must match) */
	filters: SubscriptionFilter;
	/** Whether this subscription is active */
	enabled: boolean;
	/** ISO timestamp of creation */
	createdAt: string;
}

/**
 * Persisted state for event subscriptions.
 */
export interface SubscriptionState {
	/** All subscriptions keyed by ID */
	subscriptions: Record<string, Subscription>;
}
