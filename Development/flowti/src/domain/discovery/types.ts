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
	/** Optional user-assigned category (e.g. "Orders", "Payments") */
	category?: string;
}

/**
 * Optional metadata carried by `discovery.create` to auto-create an EventDoc file.
 * When present, the DiscoveryService creates the doc using `generateEventDocContent()`.
 */
export interface EventDocMeta {
	/** Short description of the event */
	description: string;
	/** Domain that owns this event */
	domain: string;
	/** Service(s) that emit/handle this event */
	services: string;
	/** Data flow direction */
	direction: string;
	/** Contract stability */
	stability: string;
	/** Intended audience */
	visibility: string;
	/** Wikilink lines appended after the Related Events section */
	relatedEvents?: string[];
	/** Extra markdown lines appended after the standard template */
	extraSections?: string[];
}

/**
 * Persisted state for the discovery domain.
 */
export interface DiscoveryState {
	/** Discovered events keyed by eventName */
	events: Record<string, DiscoveredEvent>;
}
