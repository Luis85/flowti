import type { IEventBus } from "../../infrastructure/events/types";
import type { IFileSystemClient } from "../../infrastructure/filesystem/types";
import { loadStateFromStorage, saveStateToStorage } from "../../utils/persistence";
import type { IStorageProvider } from "../../utils/types";
import type { DiscoveredEvent, DiscoveryState, EventDocMeta } from "./types";
import { generateEventDocContent, getEventDocPath } from "../docs";
import type { EventCatalogEntry, EventStability, EventVisibility } from "../../infrastructure/events/catalog";

/**
 * Configuration options for the DiscoveryService.
 */
export interface DiscoveryServiceOptions {
	storage: IStorageProvider;
	eventBus?: IEventBus;
	/** Optional file system client for creating EventDoc files */
	fileSystem?: IFileSystemClient;
	/** Optional docs root path (e.g. "03 - Resources/Documentation/Reference") */
	docsRootPath?: string;
}

/**
 * Creates a fresh default discovery state.
 */
function createDefaultState(): DiscoveryState {
	return { events: {} };
}

/**
 * Service for discovering user-land events from vault files.
 *
 * Listens to `event.file.triggered` events (fired when files with
 * `type: "Event"` frontmatter are created/modified/deleted/renamed),
 * persists discovered event names, and emits discovery events so the
 * Event Catalog can display them alongside system events.
 *
 * When `discovery.create` includes `docMeta`, the service also creates
 * an EventDoc file using the centralized `generateEventDocContent()` template.
 */
export class DiscoveryService {
	private state: DiscoveryState = createDefaultState();
	private storage: IStorageProvider;
	private eventBus?: IEventBus;
	private fileSystem?: IFileSystemClient;
	private docsRootPath?: string;
	private unsubscribes: (() => void)[] = [];

	constructor(options: DiscoveryServiceOptions) {
		this.storage = options.storage;
		this.eventBus = options.eventBus;
		this.fileSystem = options.fileSystem;
		this.docsRootPath = options.docsRootPath;

		if (this.eventBus) {
			this.unsubscribes.push(
				this.eventBus.on("event.file.triggered", (event) =>
					this.handleEventFileTriggered(
						event.payload.eventName,
						event.payload.path
					)
				)
			);
			this.unsubscribes.push(
				this.eventBus.on("discovery.create", (event) =>
					this.handleCreate(
						event.payload.eventName,
						event.payload.category,
						event.payload.docMeta
					)
				)
			);
			this.unsubscribes.push(
				this.eventBus.on("discovery.remove", (event) =>
					this.handleRemove(event.payload.eventName)
				)
			);
		}
	}

	/**
	 * Sets the docs root path (called when settings change).
	 */
	setDocsRootPath(path: string): void {
		this.docsRootPath = path;
	}

	/**
	 * Loads discovery state from storage.
	 * Emits "discovery.loaded" with the current discovered events.
	 */
	async load(): Promise<void> {
		const saved = await loadStateFromStorage<DiscoveryState>(this.storage, "discovery");
		if (saved) {
			this.state = saved;
		}
		await this.eventBus?.emit("discovery.loaded", {
			discoveredEvents: this.getDiscoveredEvents(),
		});
	}

	/**
	 * Returns all discovered events.
	 */
	getDiscoveredEvents(): DiscoveredEvent[] {
		return Object.values(this.state.events);
	}

	/**
	 * Handles an incoming event file trigger by upserting the discovered event.
	 */
	private async handleEventFileTriggered(
		eventName: string,
		path: string
	): Promise<void> {
		const now = new Date().toISOString();
		const existing = this.state.events[eventName];
		const isNew = !existing;

		const updated: DiscoveredEvent = existing
			? {
					...existing,
					sourcePath: path,
					lastSeenAt: now,
					triggerCount: existing.triggerCount + 1,
				}
			: {
					eventName,
					sourcePath: path,
					firstSeenAt: now,
					lastSeenAt: now,
					triggerCount: 1,
				};

		this.state.events[eventName] = updated;
		await this.saveState();
		await this.eventBus?.emit("discovery.updated", {
			event: updated,
			isNew,
		});

		// Fire the custom event itself so wildcard listeners (Activity Log) can see it
		await this.eventBus?.emitCustom(eventName, { sourcePath: path });
	}

	/**
	 * Creates a new custom event manually (before it has ever fired).
	 * When docMeta is provided, also creates an EventDoc file.
	 */
	private async handleCreate(
		eventName: string,
		category?: string,
		docMeta?: EventDocMeta
	): Promise<void> {
		if (!this.state.events[eventName]) {
			const now = new Date().toISOString();
			const created: DiscoveredEvent = {
				eventName,
				sourcePath: "",
				firstSeenAt: now,
				lastSeenAt: now,
				triggerCount: 0,
				...(category ? { category } : {}),
			};

			this.state.events[eventName] = created;
			await this.saveState();
			await this.eventBus?.emit("discovery.updated", {
				event: created,
				isNew: true,
			});
		}

		// Create EventDoc file if metadata provided and fileSystem available
		if (docMeta && this.fileSystem && this.docsRootPath) {
			await this.createEventDoc(eventName, category ?? "Uncategorized", docMeta);
		}
	}

	/**
	 * Creates an EventDoc file using the centralized template.
	 * Skips creation if file already exists.
	 */
	private async createEventDoc(
		eventName: string,
		category: string,
		meta: EventDocMeta
	): Promise<void> {
		const docPath = getEventDocPath(this.docsRootPath!, eventName);

		// Skip if file already exists
		try {
			await this.fileSystem!.readFile(docPath);
			return;
		} catch {
			// File doesn't exist — create it
		}

		const entry: EventCatalogEntry = {
			type: eventName,
			category,
			description: meta.description,
			direction: meta.direction,
			domain: meta.domain,
			services: meta.services,
			stability: meta.stability as EventStability,
			visibility: meta.visibility as EventVisibility,
			tags: [],
		};

		let content = generateEventDocContent(entry);

		// Append extra sections (e.g. wikilinks to related events, TypeDoc link)
		if (meta.relatedEvents && meta.relatedEvents.length > 0) {
			// Replace the placeholder "Related Events" section
			const relatedMarker = "## Related Events\n\n> List preceding";
			const relatedReplacement = [
				"## Related Events",
				"",
				...meta.relatedEvents,
			].join("\n");
			content = content.replace(relatedMarker, relatedReplacement + "\n\n> List preceding");
		}

		if (meta.extraSections && meta.extraSections.length > 0) {
			content = content.trimEnd() + "\n\n" + meta.extraSections.join("\n") + "\n";
		}

		try {
			await this.fileSystem!.createFile(docPath, content, { createFolders: true });
		} catch (err) {
			console.error(`[Flowti] Failed to create event doc: ${docPath}`, err);
		}
	}

	/**
	 * Removes a discovered event by name.
	 */
	private async handleRemove(eventName: string): Promise<void> {
		if (!this.state.events[eventName]) return;

		delete this.state.events[eventName];
		await this.saveState();
		await this.eventBus?.emit("discovery.removed", { eventName });
	}

	/**
	 * Persists the discovery state to storage.
	 */
	private async saveState(): Promise<void> {
		await saveStateToStorage(this.storage, "discovery", this.state);
	}

	/**
	 * Unsubscribes from event bus listeners.
	 */
	dispose(): void {
		for (const unsub of this.unsubscribes) unsub();
		this.unsubscribes = [];
	}
}
