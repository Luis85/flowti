/**
 * Canvas domain service — manages canvas import configurations and orchestrates imports.
 *
 * Provides CRUD for import configs and a multi-step import pipeline:
 *   read → parse → legend → items → parentage → relations → filter → import → rebuild → base
 */

import type { IEventBus } from "../../infrastructure/events/types";
import type { IFileSystemClient } from "../../infrastructure/filesystem/types";
import type { ITypedStorage } from "../../utils/TypedStorage";
import type {
	CanvasImportConfig,
	CanvasImportResult,
	CanvasState,
	FlowtiCanvasType,
} from "./types";
import { DEFAULT_COLOR_MAP, DEFAULT_SHAPE_MAP, MAX_CANVAS_CONFIGS } from "./types";
import {
	parseCanvasJson,
	extractLegend,
	buildCanvasItems,
	resolveParentage,
	buildRelations,
	filterItemsForImport,
} from "./CanvasParser";
import { importCanvas } from "./CanvasImporter";
import { rebuildCanvasData, writeRebuiltCanvas } from "./CanvasRebuilder";
import { writeBaseFile } from "./CanvasBaseGenerator";

// ── Types ────────────────────────────────────────────────────

export interface CanvasServiceOptions {
	storage: ITypedStorage<CanvasState>;
	eventBus?: IEventBus;
	fileSystem?: IFileSystemClient;
}

/** Input for creating/updating a canvas import config. System-managed fields are omitted. */
export type CanvasConfigInput = Omit<
	CanvasImportConfig,
	"id" | "createdAt" | "lastUsed"
>;

// ── Helpers ──────────────────────────────────────────────────

function createDefaultState(): CanvasState {
	return { configs: [] };
}

function generateId(): string {
	return `canvas_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Service ──────────────────────────────────────────────────

export class CanvasService {
	private state: CanvasState = createDefaultState();
	private storage: ITypedStorage<CanvasState>;
	private eventBus?: IEventBus;
	private fileSystem?: IFileSystemClient;

	constructor(options: CanvasServiceOptions) {
		this.storage = options.storage;
		this.eventBus = options.eventBus;
		this.fileSystem = options.fileSystem;
	}

	// ── Lifecycle ────────────────────────────────────────────

	async load(): Promise<void> {
		const saved = await this.storage.load();
		if (saved) {
			this.state = saved;
		}
		await this.eventBus?.emit("canvas.loaded", {
			configCount: this.state.configs.length,
		});
	}

	dispose(): void {
		// No event listeners to clean up (stateless service)
	}

	// ── Queries ──────────────────────────────────────────────

	getConfigs(): CanvasImportConfig[] {
		return [...this.state.configs];
	}

	getConfig(id: string): CanvasImportConfig | undefined {
		return this.state.configs.find((c) => c.id === id);
	}

	// ── Commands — config CRUD ───────────────────────────────

	async saveConfig(input: CanvasConfigInput): Promise<CanvasImportConfig> {
		if (this.state.configs.length >= MAX_CANVAS_CONFIGS) {
			throw new Error(`Maximum of ${MAX_CANVAS_CONFIGS} canvas configurations reached`);
		}

		const config: CanvasImportConfig = {
			...input,
			id: generateId(),
			createdAt: new Date().toISOString(),
			lastUsed: null,
		};

		this.state.configs.push(config);
		await this.saveState();

		await this.eventBus?.emit("canvas.config.saved", {
			configId: config.id,
			name: config.name,
		});

		return config;
	}

	async updateConfig(id: string, input: Partial<CanvasConfigInput>): Promise<CanvasImportConfig | undefined> {
		const config = this.state.configs.find((c) => c.id === id);
		if (!config) return undefined;

		Object.assign(config, input);
		await this.saveState();

		await this.eventBus?.emit("canvas.config.saved", {
			configId: config.id,
			name: config.name,
		});

		return config;
	}

	async removeConfig(id: string): Promise<boolean> {
		const index = this.state.configs.findIndex((c) => c.id === id);
		if (index === -1) return false;

		this.state.configs.splice(index, 1);
		await this.saveState();
		return true;
	}

	// ── Commands — import orchestration ──────────────────────

	/**
	 * Run a full canvas import pipeline for a given config.
	 *
	 * Steps:
	 *  1. Read canvas JSON from vault
	 *  2. Parse canvas data
	 *  3. Extract legend (if present)
	 *  4. Build canvas items from raw nodes
	 *  5. Resolve parentage (spatial containment)
	 *  6. Build relations from edges
	 *  7. Filter items for import
	 *  8. Import items as vault notes
	 *  9. Rebuild canvas with file-node references
	 * 10. Write .base index file
	 */
	async runImport(configId: string): Promise<CanvasImportResult> {
		const config = this.state.configs.find((c) => c.id === configId);
		if (!config) {
			throw new Error(`Canvas config "${configId}" not found`);
		}
		if (!this.fileSystem) {
			throw new Error("FileSystem not available");
		}

		const fileSystem = this.fileSystem;
		const eventBus = this.eventBus;

		// Derive subfolder name: use explicit subfolderName if set, else canvas file basename
		const canvasBasename = config.canvasPath.split("/").pop()?.replace(/\.canvas$/, "") ?? "canvas";
		const subfolder = config.subfolderName || canvasBasename;
		const effectiveTarget = config.targetFolder
			? `${config.targetFolder}/${subfolder}`
			: subfolder;

		// 1. Read canvas JSON
		const json = await fileSystem.readFile(config.canvasPath);
		if (!json) {
			const error = `Canvas file not found or empty: ${config.canvasPath}`;
			await eventBus?.emit("canvas.import.failed", {
				canvasPath: config.canvasPath,
				error,
			});
			throw new Error(error);
		}

		// 2. Parse
		const canvasData = parseCanvasJson(json);
		if (!canvasData) {
			const error = `Invalid canvas JSON: ${config.canvasPath}`;
			await eventBus?.emit("canvas.import.failed", {
				canvasPath: config.canvasPath,
				error,
			});
			throw new Error(error);
		}

		// 3. Extract legend
		const legendMap = extractLegend(canvasData);
		if (legendMap) {
			await eventBus?.emit("canvas.legend.detected", {
				canvasPath: config.canvasPath,
				mappings: legendMap,
			});
		}

		// 4. Build items
		const colorMap: Record<string, FlowtiCanvasType> = { ...DEFAULT_COLOR_MAP, ...config.colorMap };
		const shapeMap: Record<string, FlowtiCanvasType> = { ...DEFAULT_SHAPE_MAP, ...config.shapeMap };
		const items = buildCanvasItems(canvasData, legendMap, colorMap, shapeMap);

		// 5. Resolve parentage
		const groups = items.filter((i) => i.originalType === "group");
		for (const item of items) {
			const result = resolveParentage(item, groups);
			if (result) {
				item.parentId = result.parentId;
				item.parent = result.parent;
			}
		}

		// 6. Build relations
		buildRelations(items, canvasData.edges);

		// 7. Filter for import
		const legendGroup = canvasData.nodes.find(
			(n) => n.type === "group" && !!("label" in n && n.label) &&
				String((n as { label?: string }).label).toLowerCase() === "legend",
		);
		let filteredItems = filterItemsForImport(items, {
			legendGroup: legendGroup ? {
				id: legendGroup.id,
				x: legendGroup.x,
				y: legendGroup.y,
				width: legendGroup.width,
				height: legendGroup.height,
			} : null,
		});

		// 7b. Exclude user-specified types
		if (config.excludedTypes?.length) {
			filteredItems = filteredItems.filter(
				(item) => !config.excludedTypes.includes(item.type),
			);
		}

		// 8. Import as vault notes (using canvas-named subfolder)
		const emit = async (type: string, payload: Record<string, unknown>): Promise<void> => {
			await eventBus?.emit(type as never, payload as never);
		};
		const importConfig = { ...config, targetFolder: effectiveTarget };
		const result = await importCanvas(filteredItems, importConfig, { fileSystem, emit });

		// 9. Rebuild canvas with file-node references (gated on createCanvas)
		const filePathById = new Map(Object.entries(result.importedPaths));
		if (config.createCanvas !== false && filePathById.size > 0) {
			const rebuilt = rebuildCanvasData(canvasData.nodes, canvasData.edges, filePathById);
			await writeRebuiltCanvas(rebuilt, effectiveTarget, subfolder, fileSystem);
		}

		// 10. Write .base index file (gated on createBase)
		if (config.createBase !== false) {
			await writeBaseFile(effectiveTarget, fileSystem);
		}

		// Update config lastUsed
		config.lastUsed = new Date().toISOString();
		await this.saveState();

		return result;
	}

	// ── Internal ─────────────────────────────────────────────

	private async saveState(): Promise<void> {
		await this.storage.save(this.state);
	}
}
