/**
 * TrainCanvasSyncService — Wires train events to canvas regeneration.
 *
 * Listens to train graph mutations and debounces canvas sync at 500ms.
 * Uses TrainCanvasWriter for generation + FileSystemClient for I/O.
 * Respects `trainCanvasEnabled` setting.
 */

import type { IEventBus } from "../../infrastructure/events/types";
import type { IFileSystemClient } from "../../infrastructure/filesystem/types";
import type { TrainState } from "./types";
import { writeTrainCanvas } from "./TrainCanvasWriter";
import { getCanvasPath } from "./helpers";

export const CANVAS_SYNC_DELAY_MS = 500;

export interface TrainCanvasSyncOptions {
	eventBus: IEventBus;
	fileSystem: IFileSystemClient;
	getSettings: () => { trainFolder: string; trainCanvasEnabled: boolean };
	getTrain: (trainId: string) => TrainState | undefined;
}

export class TrainCanvasSyncService {
	private readonly eventBus: IEventBus;
	private readonly fileSystem: IFileSystemClient;
	private readonly getSettings: () => { trainFolder: string; trainCanvasEnabled: boolean };
	private readonly getTrain: (trainId: string) => TrainState | undefined;
	private readonly syncTimers = new Map<string, ReturnType<typeof setTimeout>>();
	private readonly unsubscribers: Array<() => void> = [];

	/** Tracks which trains have had their canvas created (for created vs synced events). */
	private readonly canvasCreated = new Set<string>();

	constructor(options: TrainCanvasSyncOptions) {
		this.eventBus = options.eventBus;
		this.fileSystem = options.fileSystem;
		this.getSettings = options.getSettings;
		this.getTrain = options.getTrain;
	}

	setup(): void {
		this.unsubscribers.push(
			this.eventBus.on("train.thought.added", (event) => {
				this.scheduleSync(event.payload.trainId);
			}),
			this.eventBus.on("train.branch.merged", (event) => {
				this.scheduleSync(event.payload.trainId);
			}),
			this.eventBus.on("train.branch.merge.undone", (event) => {
				this.scheduleSync(event.payload.trainId);
			}),
			this.eventBus.on("train.completed", (event) => {
				this.scheduleSync(event.payload.trainId);
			}),
			this.eventBus.on("train.paused", (event) => {
				this.scheduleSync(event.payload.trainId);
			}),
			this.eventBus.on("train.resumed", (event) => {
				this.scheduleSync(event.payload.trainId);
			}),
			this.eventBus.on("train.renamed", (event) => {
				this.scheduleSync(event.payload.trainId);
			}),
		);
	}

	destroy(): void {
		for (const unsub of this.unsubscribers) unsub();
		this.unsubscribers.length = 0;
		for (const timer of this.syncTimers.values()) clearTimeout(timer);
		this.syncTimers.clear();
	}

	private scheduleSync(trainId: string): void {
		if (!this.getSettings().trainCanvasEnabled) return;

		const existing = this.syncTimers.get(trainId);
		if (existing) clearTimeout(existing);

		this.syncTimers.set(
			trainId,
			setTimeout(() => {
				this.syncTimers.delete(trainId);
				void this.executeSync(trainId);
			}, CANVAS_SYNC_DELAY_MS),
		);
	}

	private async executeSync(trainId: string): Promise<void> {
		const train = this.getTrain(trainId);
		if (!train || train.thoughts.length === 0) return;

		const { trainFolder } = this.getSettings();
		const canvasPath = getCanvasPath(train.title, trainFolder);

		// Read pre-sync managed file node count for reconciliation detection
		const preSyncCount = await this.countManagedFileNodes(canvasPath);

		const { action } = await writeTrainCanvas(train, canvasPath, this.fileSystem);

		const isFirstCreate = !this.canvasCreated.has(trainId);
		if (action === "created" && isFirstCreate) {
			this.canvasCreated.add(trainId);
			void this.eventBus.emit("train.canvas.created", { trainId, canvasPath });
		}

		// Reconciliation: if pre-sync count differed from train thought count, it was corrected
		if (preSyncCount !== null && preSyncCount !== train.thoughts.length) {
			void this.eventBus.emit("train.canvas.reconciled", {
				trainId,
				expected: train.thoughts.length,
				found: preSyncCount,
				corrected: true,
			});
		}

		void this.eventBus.emit("train.canvas.synced", {
			trainId,
			canvasPath,
			nodeCount: train.thoughts.length,
		});
	}

	/** Count managed file nodes (ft-t-* prefix) in existing canvas. Returns null if no canvas exists. */
	private async countManagedFileNodes(canvasPath: string): Promise<number | null> {
		try {
			if (!await this.fileSystem.fileExists(canvasPath)) return null;
			const content = await this.fileSystem.readFile(canvasPath);
			const canvas = JSON.parse(content) as { nodes?: Array<{ id: string; type?: string }> };
			if (!canvas.nodes) return 0;
			return canvas.nodes.filter((n) => n.id.startsWith("ft-t-") && n.type === "file").length;
		} catch (error) {
			console.warn("[Flowti] Failed to count managed nodes in canvas:", canvasPath, error);
			return null;
		}
	}
}
