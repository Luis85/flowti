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
	/** Read and parse canvas JSON, throwing on failure with event emission. */
	private async readAndParseCanvas(canvasPath: string): Promise<ReturnType<typeof parseCanvasJson> & object> {
		const json = await this.fileSystem!.readFile(canvasPath);
		if (!json) {
			const error = `Canvas file not found or empty: ${canvasPath}`;
			await this.eventBus?.emit("canvas.import.failed", { canvasPath, error });
			throw new Error(error);
		}
		const canvasData = parseCanvasJson(json);
		if (!canvasData) {
			const error = `Invalid canvas JSON: ${canvasPath}`;
			await this.eventBus?.emit("canvas.import.failed", { canvasPath, error });
			throw new Error(error);
		}
		return canvasData;
	}

	async runImport(configId: string): Promise<CanvasImportResult> {
		const config = this.state.configs.find((c) => c.id === configId);
		if (!config) throw new Error(`Canvas config "${configId}" not found`);
		if (!this.fileSystem) throw new Error("FileSystem not available");

		const fileSystem = this.fileSystem;
		const canvasBasename = config.canvasPath.split("/").pop()?.replace(/\.canvas$/, "") ?? "canvas";
		const subfolder = config.subfolderName || canvasBasename;
		const effectiveTarget = config.targetFolder ? `${config.targetFolder}/${subfolder}` : subfolder;

		// Steps 1-2: Read + parse
		const canvasData = await this.readAndParseCanvas(config.canvasPath);

		// Step 3: Extract legend
		const legendMap = extractLegend(canvasData);
		if (legendMap) await this.eventBus?.emit("canvas.legend.detected", { canvasPath: config.canvasPath, mappings: legendMap });

		// Step 4: Build items
		const colorMap: Record<string, FlowtiCanvasType> = { ...DEFAULT_COLOR_MAP, ...config.colorMap };
		const shapeMap: Record<string, FlowtiCanvasType> = { ...DEFAULT_SHAPE_MAP, ...config.shapeMap };
		const items = buildCanvasItems(canvasData, legendMap, colorMap, shapeMap);

		// Step 5: Resolve parentage
		const groups = items.filter((i) => i.originalType === "group");
		for (const item of items) {
			const pr = resolveParentage(item, groups);
			if (pr) { item.parentId = pr.parentId; item.parent = pr.parent; }
		}

		// Step 6: Build relations
		buildRelations(items, canvasData.edges);

		// Step 7: Filter for import
		const filteredItems = this.filterForImport(items, canvasData, config);

		// Step 8: Import
		const emit = async (type: string, payload: Record<string, unknown>): Promise<void> => { await this.eventBus?.emit(type as never, payload as never); };
		const result = await importCanvas(filteredItems, { ...config, targetFolder: effectiveTarget }, { fileSystem, emit });

		// Steps 9-10: Rebuild canvas + write .base
		await this.postImportSteps(config, canvasData, result, effectiveTarget, subfolder, fileSystem);

		config.lastUsed = new Date().toISOString();
		await this.saveState();
		return result;
	}

	/** Filter canvas items for import, excluding legend and user-specified types. */
	private filterForImport(
		items: ReturnType<typeof buildCanvasItems>,
		canvasData: ReturnType<typeof parseCanvasJson> & object,
		config: CanvasImportConfig,
	): ReturnType<typeof filterItemsForImport> {
		const legendGroup = canvasData.nodes.find(
			(n) => n.type === "group" && !!("label" in n && n.label) && String((n as { label?: string }).label).toLowerCase() === "legend",
		);
		let filtered = filterItemsForImport(items, {
			legendGroup: legendGroup ? { id: legendGroup.id, x: legendGroup.x, y: legendGroup.y, width: legendGroup.width, height: legendGroup.height } : null,
		});
		if (config.excludedTypes?.length) {
			filtered = filtered.filter((item) => !config.excludedTypes.includes(item.type));
		}
		return filtered;
	}

	/** Run post-import steps: rebuild canvas and write .base file. */
	private async postImportSteps(
		config: CanvasImportConfig,
		canvasData: ReturnType<typeof parseCanvasJson> & object,
		result: CanvasImportResult,
		effectiveTarget: string,
		subfolder: string,
		fileSystem: IFileSystemClient,
	): Promise<void> {
		const filePathById = new Map(Object.entries(result.importedPaths));
		if (config.createCanvas !== false && filePathById.size > 0) {
			await writeRebuiltCanvas(rebuildCanvasData(canvasData.nodes, canvasData.edges, filePathById), effectiveTarget, subfolder, fileSystem);
		}
		if (config.createBase !== false) await writeBaseFile(effectiveTarget, fileSystem);
	}

	// ── Internal ─────────────────────────────────────────────

	private async saveState(): Promise<void> {
		await this.storage.save(this.state);
	}
}
