/**
 * Service for managing event definitions that transform file events
 * into named domain events with extracted payloads.
 *
 * Listens to `ingestion.job.completed` (enriched with payload) and
 * checks all enabled definitions. When a definition matches, extracts
 * a payload and emits a domain event via `eventBus.emitCustom()`.
 */

import type { IEventBus } from "../../infrastructure/events/types";
import { isSkippedEvent } from "../../infrastructure/events/catalog";
import type { IStorageProvider } from "../../utils/types";
import { safeLoadState, safeSaveState } from "../../utils/persistence";
import { generateUUID, extractSettingsBoolean, extractStringField } from "../../utils/helpers";
import { matchGlob } from "../../utils/glob";
import { extractPayload } from "./payloadExtractor";
import type {
	EventDefinition,
	EventDefinitionState,
} from "./types";
import { MAX_EMITTED_KEYS } from "./types";

/**
 * Configuration options for the EventDefinitionService.
 */
export interface EventDefinitionServiceOptions {
	storage: IStorageProvider;
	eventBus?: IEventBus;
}

/**
 * Creates a fresh default state (no definitions).
 */
function createDefaultState(): EventDefinitionState {
	return { definitions: {}, emittedKeys: [] };
}

/**
 * Generates a unique definition ID.
 */
function generateId(): string {
	return `def_${generateUUID()}`;
}

/** Extra prefixes to skip beyond the shared INTERNAL_EVENT_PREFIXES. */
const EXTRA_SKIP_PREFIXES = ["eventDefinition.", "ingestion."] as const;

export class EventDefinitionService {
	private state: EventDefinitionState = createDefaultState();
	private emittedKeys: Set<string> = new Set();
	private storage: IStorageProvider;
	private eventBus?: IEventBus;
	private unsubscribes: (() => void)[] = [];

	// Master toggle (responds to settings.changed / settings.loaded)
	private enabled = true;

	constructor(options: EventDefinitionServiceOptions) {
		this.storage = options.storage;
		this.eventBus = options.eventBus;

		if (this.eventBus) {
			// Listen for settings changes to update the enabled flag
			this.unsubscribes.push(
				this.eventBus.on("settings.changed", (event) => {
					const flag = extractSettingsBoolean(event.payload, "eventSystemEnabled");
					if (flag !== undefined) this.enabled = flag;
				})
			);
			this.unsubscribes.push(
				this.eventBus.on("settings.loaded", (event) => {
					const flag = extractSettingsBoolean(event.payload, "eventSystemEnabled");
					if (flag !== undefined) this.enabled = flag;
				})
			);

			// Command: create a definition
			this.unsubscribes.push(
				this.eventBus.on("eventDefinition.create", (event) =>
					this.handleCreate(event.payload)
				)
			);

			// Command: update a definition
			this.unsubscribes.push(
				this.eventBus.on("eventDefinition.update", (event) =>
					this.handleUpdate(event.payload)
				)
			);

			// Command: remove a definition
			this.unsubscribes.push(
				this.eventBus.on("eventDefinition.remove", (event) =>
					this.handleRemove(event.payload.definitionId)
				)
			);

			// Command: refresh — re-emit current state
			this.unsubscribes.push(
				this.eventBus.on("eventDefinition.refresh", () => {
					void this.eventBus?.emit("eventDefinition.loaded", {
						definitions: this.getDefinitions(),
					});
				})
			);

			// Listen to ingestion.job.completed to match definitions
			this.unsubscribes.push(
				this.eventBus.on("ingestion.job.completed", (event) => {
					if (!this.enabled) return;
					const eventType = extractStringField(event.payload, "eventType");
					const innerPayload = (event.payload as Record<string, unknown>).payload;
					if (eventType && innerPayload && typeof innerPayload === "object") {
						this.matchDefinitions(eventType, innerPayload as Record<string, unknown>);
					}
				})
			);
		}
	}

	/**
	 * Loads event definition state from storage.
	 */
	async load(): Promise<void> {
		const saved = await safeLoadState<EventDefinitionState>(this.storage, "eventDefinition");
		if (saved) {
			this.state = saved;
			this.emittedKeys = new Set(saved.emittedKeys ?? []);
		}
		await this.eventBus?.emit("eventDefinition.loaded", {
			definitions: this.getDefinitions(),
		});
	}

	/**
	 * Returns all definitions as an array.
	 */
	getDefinitions(): EventDefinition[] {
		return Object.values(this.state.definitions);
	}

	/**
	 * Returns a definition by ID, or undefined.
	 */
	getDefinition(id: string): EventDefinition | undefined {
		return this.state.definitions[id];
	}

	/**
	 * Creates a new event definition.
	 */
	private async handleCreate(payload: {
		sourceEventType: string;
		filePattern?: string;
		domainEventName: string;
		payloadMappings: EventDefinition["payloadMappings"];
		emissionPolicy: EventDefinition["emissionPolicy"];
	}): Promise<void> {
		const def: EventDefinition = {
			id: generateId(),
			sourceEventType: payload.sourceEventType,
			filePattern: payload.filePattern,
			domainEventName: payload.domainEventName,
			payloadMappings: payload.payloadMappings,
			emissionPolicy: payload.emissionPolicy,
			enabled: true,
			createdAt: new Date().toISOString(),
		};
		this.state.definitions[def.id] = def;
		await this.saveState();
		await this.eventBus?.emit("eventDefinition.created", { definition: def });
	}

	/**
	 * Updates an existing event definition.
	 */
	private async handleUpdate(payload: {
		definitionId: string;
		filePattern?: string;
		domainEventName?: string;
		payloadMappings?: EventDefinition["payloadMappings"];
		emissionPolicy?: EventDefinition["emissionPolicy"];
		enabled?: boolean;
	}): Promise<void> {
		const existing = this.state.definitions[payload.definitionId];
		if (!existing) return;

		if (payload.filePattern !== undefined) existing.filePattern = payload.filePattern;
		if (payload.domainEventName !== undefined) existing.domainEventName = payload.domainEventName;
		if (payload.payloadMappings !== undefined) existing.payloadMappings = payload.payloadMappings;
		if (payload.emissionPolicy !== undefined) existing.emissionPolicy = payload.emissionPolicy;
		if (payload.enabled !== undefined) existing.enabled = payload.enabled;

		await this.saveState();
		await this.eventBus?.emit("eventDefinition.updated", { definition: existing });
	}

	/**
	 * Removes an event definition.
	 */
	private async handleRemove(definitionId: string): Promise<void> {
		if (!this.state.definitions[definitionId]) return;
		delete this.state.definitions[definitionId];
		await this.saveState();
		await this.eventBus?.emit("eventDefinition.deleted", { definitionId });
	}

	/**
	 * Checks all enabled definitions against an ingested event.
	 */
	private matchDefinitions(
		eventType: string,
		eventPayload: Record<string, unknown>
	): void {
		// Skip internal events
		if (isSkippedEvent(eventType, EXTRA_SKIP_PREFIXES)) return;

		for (const def of Object.values(this.state.definitions)) {
			if (!def.enabled) continue;
			if (def.sourceEventType !== eventType) continue;

			// Check file pattern if specified
			if (def.filePattern) {
				const path = extractStringField(eventPayload, "path");
				if (!path) continue;
				if (!matchGlob(def.filePattern, path)) continue;
			}

			// Check "once" emission policy
			if (def.emissionPolicy === "once") {
				const path = extractStringField(eventPayload, "path");
				const emitKey = `${def.id}::${path ?? ""}`;
				if (this.emittedKeys.has(emitKey)) continue;
				this.addToEmittedKeys(emitKey);
			}

			// Extract payload and emit domain event
			const extracted = extractPayload(def.payloadMappings, eventPayload);
			void this.eventBus?.emitCustom(def.domainEventName, extracted);
			void this.eventBus?.emit("eventDefinition.matched", {
				definitionId: def.id,
				domainEventName: def.domainEventName,
				sourcePath: extractStringField(eventPayload, "path") ?? "",
			});

			// Persist emitted keys for "once" policy
			if (def.emissionPolicy === "once") {
				void this.saveState();
			}
		}
	}

	/**
	 * Adds a key to the emitted keys set, evicting oldest if over limit.
	 */
	private addToEmittedKeys(key: string): void {
		this.emittedKeys.add(key);
		if (this.emittedKeys.size > MAX_EMITTED_KEYS) {
			const excess = this.emittedKeys.size - MAX_EMITTED_KEYS;
			let count = 0;
			for (const k of this.emittedKeys) {
				if (count >= excess) break;
				this.emittedKeys.delete(k);
				count++;
			}
		}
	}

	/**
	 * Persists state to storage.
	 */
	private async saveState(): Promise<void> {
		await safeSaveState(this.storage, "eventDefinition", {
			definitions: this.state.definitions,
			emittedKeys: [...this.emittedKeys],
		});
	}

	/**
	 * Unsubscribes from event bus listeners.
	 */
	dispose(): void {
		for (const unsub of this.unsubscribes) {
			unsub();
		}
		this.unsubscribes = [];
	}
}
