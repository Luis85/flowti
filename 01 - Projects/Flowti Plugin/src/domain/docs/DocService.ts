/**
 * Centralized documentation file creation service.
 *
 * Listens for `doc.create` events, resolves paths, generates content
 * (or uses provided content), creates files, and emits completion events.
 *
 * Callers never need to interact with the file system directly for
 * doc creation — they emit `doc.create` and react to `doc.created`.
 */

import type { IEventBus } from "../../infrastructure/events/types";
import type { IFileSystemClient } from "../../infrastructure/filesystem/types";
import type { EntityPaths, FlowtiSettings } from "../settings/settings";
import { resolveEntityPath } from "./pathResolver";
import type { DocCreateRequest } from "./types";
import * as pathResolver from "./pathResolver";
import * as contentGenerator from "./contentGenerator";

export interface DocServiceOptions {
	eventBus: IEventBus;
	fileSystem: IFileSystemClient;
}

export class DocService {
	private eventBus: IEventBus;
	private fileSystem: IFileSystemClient;
	private docsRootPath = "";
	private entityPaths: EntityPaths | null = null;
	private unsubscribes: (() => void)[] = [];

	constructor(options: DocServiceOptions) {
		this.eventBus = options.eventBus;
		this.fileSystem = options.fileSystem;

		this.unsubscribes.push(
			this.eventBus.on("doc.create", (event) =>
				this.handleCreate(event.payload),
			),
		);

		this.unsubscribes.push(
			this.eventBus.on("doc.delete", (event) =>
				this.handleDelete(event.payload.path, event.payload.source),
			),
		);

		this.unsubscribes.push(
			this.eventBus.on("settings.loaded", (event) => {
				this.syncSettings(event.payload.settings);
			}),
		);

		this.unsubscribes.push(
			this.eventBus.on("settings.changed", (event) => {
				this.syncSettings(event.payload.settings);
			}),
		);
	}

	/**
	 * Loads initial state. DocService derives its state from settings events
	 * (settings.loaded / settings.changed), so this is a no-op — provided
	 * for lifecycle consistency with other domain services.
	 */
	async load(): Promise<void> {
		// State is populated by settings.loaded listener — no storage to load
	}

	// ── Settings sync ───────────────────────────────────────

	private syncSettings(settings: FlowtiSettings): void {
		this.docsRootPath = settings.docsRootPath ?? "";
		this.entityPaths = settings.entityPaths ?? null;
	}

	// ── Public accessors (for tests / callers) ──────────────

	getDocsRootPath(): string {
		return this.docsRootPath;
	}

	// ── Handlers ────────────────────────────────────────────

	private async handleCreate(request: DocCreateRequest): Promise<void> {
		try {
			const path = request.path ?? this.resolvePath(request);
			if (!path) {
				await this.eventBus.emit("doc.failed", {
					docType: request.docType,
					name: request.name,
					error: "Could not resolve file path",
					source: request.source,
				});
				return;
			}

			const content = request.content ?? this.generateContent(request);
			if (!content) {
				await this.eventBus.emit("doc.failed", {
					docType: request.docType,
					name: request.name,
					error: `No content generator for doc type: ${request.docType}`,
					source: request.source,
				});
				return;
			}

			const exists = await this.fileExists(path);

			if (exists && !request.upsert) {
				await this.eventBus.emit("doc.exists", {
					path,
					docType: request.docType,
					name: request.name,
					source: request.source,
				});
				return;
			}

			if (exists) {
				await this.fileSystem.updateFile(path, content);
				await this.eventBus.emit("doc.created", {
					path,
					created: false,
					updated: true,
					docType: request.docType,
					name: request.name,
					source: request.source,
				});
			} else {
				await this.fileSystem.createFile(path, content, { createFolders: true });
				await this.eventBus.emit("doc.created", {
					path,
					created: true,
					docType: request.docType,
					name: request.name,
					source: request.source,
				});
			}
		} catch (error) {
			console.error(`[Flowti] DocService failed to create ${request.docType}:`, error);
			await this.eventBus.emit("doc.failed", {
				docType: request.docType,
				name: request.name,
				error: error instanceof Error ? error.message : String(error),
				source: request.source,
			});
		}
	}

	private async handleDelete(path: string, source?: string): Promise<void> {
		try {
			await this.fileSystem.deleteFile(path);
			await this.eventBus.emit("doc.deleted", { path, source });
		} catch (error) {
			console.error(`[Flowti] DocService failed to delete: ${path}`, error);
		}
	}

	// ── Path resolution ─────────────────────────────────────

	private resolvePath(request: DocCreateRequest): string | null {
		if (!request.entityType || !this.entityPaths) return null;

		const config = this.entityPaths[request.entityType];
		if (!config) return null;

		const folder = resolveEntityPath(this.docsRootPath, config);

		switch (request.docType) {
			case "EventDoc":
				return pathResolver.getEventDocPathResolved(folder, request.name);
			case "DomainDoc":
				return pathResolver.getDomainDocPathResolved(folder, request.name);
			case "ArchitectureDoc":
				return pathResolver.getArchitectureDocPathResolved(folder, request.name);
			case "ServiceDoc":
				return pathResolver.getServiceDocPathResolved(folder, request.name);
			case "ServiceBlueprintDoc":
				return pathResolver.getServiceBlueprintPathResolved(folder, request.name);
			case "CategoryDoc":
				return pathResolver.getCategoryDocPathResolved(folder, request.name);
			case "FlowDoc":
				return pathResolver.getFlowDocPathResolved(folder, request.name);
			case "SystemDoc":
				return pathResolver.getSystemDocPathResolved(folder, request.name);
			case "ActorDoc":
				return pathResolver.getActorDocPathResolved(folder, request.name);
			case "ProductDoc":
				return pathResolver.getProductDocPathResolved(folder, request.name);
			default:
				return null;
		}
	}

	// ── Content generation ──────────────────────────────────

	private generateContent(request: DocCreateRequest): string | null {
		if (request.content) return request.content;

		switch (request.docType) {
			case "FlowDoc":
				return contentGenerator.generateFlowDocContent(request.name);
			case "SystemDoc":
				return contentGenerator.generateSystemDocContent(request.name);
			case "ActorDoc":
				return contentGenerator.generateActorDocContent(request.name);
			case "ProductDoc":
				return contentGenerator.generateProductDocContent(request.name);
			case "ProjectBrief":
				return contentGenerator.generateProjectBriefContent(request.name);
			default:
				// Domain, Service, Config docs etc. require context — caller must provide content
				return null;
		}
	}

	// ── Utilities ────────────────────────────────────────────

	private async fileExists(path: string): Promise<boolean> {
		try {
			await this.fileSystem.readFile(path);
			return true;
		} catch {
			return false;
		}
	}

	// ── Lifecycle ────────────────────────────────────────────

	dispose(): void {
		for (const unsub of this.unsubscribes) unsub();
		this.unsubscribes = [];
	}
}
