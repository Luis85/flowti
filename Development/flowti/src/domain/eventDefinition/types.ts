/**
 * Types for the Event Definition domain.
 *
 * Event Definitions map ingested file events to named domain events
 * with extracted payloads. This is the "files to meaning" transformation.
 */

/**
 * Where a payload field value comes from.
 */
export type PayloadSource = "path" | "metadata" | "derived";

/**
 * A single mapping rule: extract a value from the event and assign it to a field.
 */
export interface PayloadMapping {
	/** Output field name in the emitted domain event */
	field: string;
	/** Where the value comes from */
	source: PayloadSource;
	/** Source-specific expression (regex group name, metadata key, or derivation name) */
	expression: string;
}

/**
 * How often a domain event should be emitted for a matching definition.
 */
export type EmissionPolicy = "once" | "always";

/**
 * A rule that transforms a source event into a named domain event.
 */
export interface EventDefinition {
	/** Unique definition ID */
	id: string;
	/** Source event type to match (e.g. "file.created") */
	sourceEventType: string;
	/** Optional glob pattern to match against file path */
	filePattern?: string;
	/** The domain event name to emit (e.g. "report.daily_received") */
	domainEventName: string;
	/** Rules for extracting payload fields */
	payloadMappings: PayloadMapping[];
	/** Whether to emit once per file or always */
	emissionPolicy: EmissionPolicy;
	/** Whether this definition is active */
	enabled: boolean;
	/** ISO timestamp when created */
	createdAt: string;
}

/**
 * Persisted state for the event definition domain.
 */
export interface EventDefinitionState {
	/** All definitions keyed by ID */
	definitions: Record<string, EventDefinition>;
	/** Keys for "once" policy dedup (oldest first) */
	emittedKeys: string[];
}

/**
 * Maximum number of emitted keys to retain for "once" policy dedup.
 */
export const MAX_EMITTED_KEYS = 10000;
