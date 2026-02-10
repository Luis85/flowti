/**
 * Types for the Event Discovery domain.
 */

/**
 * A user-land event discovered from vault files with `type: "Event"` frontmatter.
 */
export interface DiscoveredEvent {
	/** The event name (from frontmatter `name` or derived from basename) */
	eventName: string;
	/** Vault path of the file that defines this event */
	sourcePath: string;
	/** ISO timestamp of first discovery */
	firstSeenAt: string;
	/** ISO timestamp of most recent trigger */
	lastSeenAt: string;
	/** Number of times this event file was triggered */
	triggerCount: number;
}

/**
 * Persisted state for the discovery domain.
 */
export interface DiscoveryState {
	/** Discovered events keyed by eventName */
	events: Record<string, DiscoveredEvent>;
}
