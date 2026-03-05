/**
 * CanvasSyncController — manages canvas sync scheduling and zoom lifecycle.
 *
 * Owns debounce timers, canvas path tracking, and zoom-to-step behaviour.
 * Extracted from JourneyBuilderSidebar to isolate timer/canvas concerns.
 */
import type { App, WorkspaceLeaf } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types";
import type { CanvasSyncInput } from "../../domain/journeyBuilder/canvasSync";

/** Narrow type for Obsidian's internal canvas node (not publicly typed). */
interface CanvasNode {
	getData: () => Record<string, unknown>;
}

/** Narrow type for Obsidian's internal canvas view (not publicly typed). */
interface CanvasLeafView {
	file?: { path: string };
	canvas?: {
		zoomToFit: () => void;
		zoomToSelection: () => void;
		selectOnly: (node: CanvasNode) => void;
		deselectAll: () => void;
		nodes: Map<string, CanvasNode>;
	};
}

export interface CanvasSyncControllerDeps {
	eventBus: IEventBus;
	getCanvasPath: () => string;
	buildSyncInput: () => CanvasSyncInput;
	getApp: () => App | undefined;
}

export class CanvasSyncController {
	private canvasSyncTimer: ReturnType<typeof setTimeout> | null = null;
	private zoomTimer: ReturnType<typeof setTimeout> | null = null;
	private canvasOpenedPath: string | null = null;
	private pendingZoomToStep = false;

	constructor(private readonly deps: CanvasSyncControllerDeps) {}

	/** Schedule a debounced canvas sync. */
	scheduleSync(delay = 1500): void {
		const canvasPath = this.deps.getCanvasPath();
		if (!canvasPath) return;
		if (this.canvasSyncTimer) clearTimeout(this.canvasSyncTimer);
		this.canvasSyncTimer = setTimeout(() => {
			this.canvasSyncTimer = null;
			void this.deps.eventBus.emit("journey-builder.canvas.sync-requested", {
				canvasPath,
				definition: this.deps.buildSyncInput(),
			});
		}, delay);
	}

	/** Handle canvas.synced event — opens canvas and triggers zoom when needed. */
	onSynced(payload: { canvasPath: string }): void {
		const isFirstOpen = this.canvasOpenedPath !== payload.canvasPath;
		if (isFirstOpen) {
			this.canvasOpenedPath = payload.canvasPath;
			void this.deps.getApp()?.workspace?.openLinkText(payload.canvasPath, "");
		}
		if (isFirstOpen || this.pendingZoomToStep) {
			this.pendingZoomToStep = false;
			this.scheduleZoom(payload.canvasPath, isFirstOpen);
		}
	}

	/** Flag that the next sync should zoom to the active step. */
	setPendingZoom(): void {
		this.pendingZoomToStep = true;
	}

	/** Reset canvas path (e.g. on journey reset). */
	resetCanvasPath(): void {
		this.canvasOpenedPath = null;
	}

	/** Get the currently opened canvas path. */
	getCanvasOpenedPath(): string | null {
		return this.canvasOpenedPath;
	}

	/** Clean up timers and state. */
	destroy(): void {
		if (this.canvasSyncTimer) { clearTimeout(this.canvasSyncTimer); this.canvasSyncTimer = null; }
		if (this.zoomTimer) { clearTimeout(this.zoomTimer); this.zoomTimer = null; }
		this.pendingZoomToStep = false;
		this.canvasOpenedPath = null;
	}

	private scheduleZoom(canvasPath: string, zoomToFit: boolean): void {
		if (this.zoomTimer) clearTimeout(this.zoomTimer);
		this.zoomTimer = setTimeout(() => {
			this.zoomTimer = null;
			const canvas = this.findCanvas(canvasPath);
			if (!canvas) return;
			if (zoomToFit) canvas.zoomToFit();
			this.zoomToActiveStep(canvas);
		}, 400);
	}

	private findCanvas(canvasPath: string): CanvasLeafView["canvas"] | null {
		const app = this.deps.getApp();
		const getLeavesOfType = app?.workspace?.getLeavesOfType;
		if (typeof getLeavesOfType !== "function") return null;
		const leaves = (getLeavesOfType.call(app!.workspace, "canvas") ?? []) as WorkspaceLeaf[];
		for (const leaf of leaves) {
			const view = leaf.view as unknown as CanvasLeafView;
			if (view?.file?.path === canvasPath && view?.canvas) {
				return view.canvas;
			}
		}
		return null;
	}

	private zoomToActiveStep(canvas: NonNullable<CanvasLeafView["canvas"]>): void {
		if (!canvas.nodes || typeof canvas.zoomToSelection !== "function") return;
		for (const node of canvas.nodes.values()) {
			const data = typeof node.getData === "function" ? node.getData() : null;
			if (data && data.color === "5" && data.type === "group") {
				canvas.selectOnly(node);
				canvas.zoomToSelection();
				return;
			}
		}
	}
}
