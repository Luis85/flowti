import type { DiscoveredEvent } from "./types";

/**
 * Event types owned by the Discovery domain.
 */
export interface DiscoveryEventMap {
	/** Emitted when discovery state is loaded from storage */
	"discovery.loaded": { discoveredEvents: DiscoveredEvent[] };
	/** Emitted when a user-land event is discovered or updated */
	"discovery.updated": { event: DiscoveredEvent; isNew: boolean };
	/** Command: create a new custom event manually */
	"discovery.create": { eventName: string; category?: string };
	/** Command: request removal of a discovered event by name */
	"discovery.remove": { eventName: string };
	/** Emitted after a discovered event has been removed */
	"discovery.removed": { eventName: string };
}
