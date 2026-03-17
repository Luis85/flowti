/**
 * Event types owned by the Event Definition domain.
 */

import type { EventDefinition } from "./types";

export interface EventDefinitionEventMap {
	/** Emitted when event definition state is loaded from storage */
	"eventDefinition.loaded": {
		definitions: EventDefinition[];
	};
	/** Emitted when a new event definition is created */
	"eventDefinition.created": {
		definition: EventDefinition;
	};
	/** Emitted when an event definition is updated */
	"eventDefinition.updated": {
		definition: EventDefinition;
	};
	/** Emitted when an event definition is deleted */
	"eventDefinition.deleted": {
		definitionId: string;
	};
	/** Command: create a new event definition */
	"eventDefinition.create": {
		sourceEventType: string;
		filePattern?: string;
		domainEventName: string;
		payloadMappings: EventDefinition["payloadMappings"];
		emissionPolicy: EventDefinition["emissionPolicy"];
	};
	/** Command: update an existing event definition */
	"eventDefinition.update": {
		definitionId: string;
		filePattern?: string;
		domainEventName?: string;
		payloadMappings?: EventDefinition["payloadMappings"];
		emissionPolicy?: EventDefinition["emissionPolicy"];
		enabled?: boolean;
	};
	/** Command: remove an event definition */
	"eventDefinition.remove": {
		definitionId: string;
	};
	/** Command: request re-emit of current event definition state */
	"eventDefinition.refresh": Record<string, never>;
	/** Emitted when a definition matched an ingested event and a domain event was emitted */
	"eventDefinition.matched": {
		definitionId: string;
		domainEventName: string;
		sourcePath: string;
	};
}
