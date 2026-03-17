/**
 * CanvasSyncController — manages canvas sync scheduling and zoom lifecycle.
 *
 * Owns debounce timers, canvas path tracking, zoom-to-step behaviour,
 * and canvas→sidebar selection forwarding (pointerup on canvas leaf).
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
		selection?: Set<CanvasNode>;
	};
}

export interface CanvasSyncControllerDeps {
	eventBus: IEventBus;
	getCanvasPath: () => string;
	buildSyncInput: () => CanvasSyncInput;
	getApp: () => App | undefined;
	/** Called when the user selects a step group on the canvas. */
	onStepSelected?: (stepIndex: number) => void;
}

export class CanvasSyncController {
	private canvasSyncTimer: ReturnType<typeof setTimeout> | null = null;
	private zoomTimer: ReturnType<typeof setTimeout> | null = null;
	private selectionTimer: ReturnType<typeof setTimeout> | null = null;
	private canvasOpenedPath: string | null = null;
	private pendingZoomToStep = false;
	private selectionCleanup: (() => void) | null = null;

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
		// Start watching canvas selection after sync
		this.startSelectionWatch(payload.canvasPath);
	}

	/** Flag that the next sync should zoom to the active step. */
	setPendingZoom(): void {
		this.pendingZoomToStep = true;
	}

	/** Reset canvas path (e.g. on journey reset). */
	resetCanvasPath(): void {
		this.canvasOpenedPath = null;
		this.stopSelectionWatch();
	}

	/** Get the currently opened canvas path. */
	getCanvasOpenedPath(): string | null {
		return this.canvasOpenedPath;
	}

	/** Clean up timers and state. */
	destroy(): void {
		if (this.canvasSyncTimer) { clearTimeout(this.canvasSyncTimer); this.canvasSyncTimer = null; }
		if (this.zoomTimer) { clearTimeout(this.zoomTimer); this.zoomTimer = null; }
		if (this.selectionTimer) { clearTimeout(this.selectionTimer); this.selectionTimer = null; }
		this.stopSelectionWatch();
		this.pendingZoomToStep = false;
		this.canvasOpenedPath = null;
	}

	// ── Canvas selection watching ──────────────────────────

	/** Attach a pointerup listener to the canvas leaf to detect step selection. */
	private startSelectionWatch(canvasPath: string): void {
		if (this.selectionCleanup) return; // Already watching
		const leaf = this.findCanvasLeaf(canvasPath);
		// containerEl is on Component (WorkspaceLeaf parent) but not in all type defs
		const el = (leaf as unknown as { containerEl?: HTMLElement })?.containerEl;
		if (!el) return;

		const handler = (): void => {
			// Delay slightly to let Obsidian update its selection state
			if (this.selectionTimer) clearTimeout(this.selectionTimer);
			this.selectionTimer = setTimeout(() => {
				this.selectionTimer = null;
				const canvas = this.findCanvas(canvasPath);
				if (canvas) this.checkCanvasSelection(canvas);
			}, 50);
		};

		el.addEventListener("pointerup", handler);
		this.selectionCleanup = () => {
			el.removeEventListener("pointerup", handler);
		};
	}

	/** Remove the canvas selection listener. */
	private stopSelectionWatch(): void {
		this.selectionCleanup?.();
		this.selectionCleanup = null;
	}

	/** Check canvas selection and forward step index to sidebar. */
	private checkCanvasSelection(canvas: NonNullable<CanvasLeafView["canvas"]>): void {
		if (!this.deps.onStepSelected) return;
		if (!canvas.selection || canvas.selection.size !== 1) return;

		const selected = [...canvas.selection][0];
		const data = typeof selected.getData === "function" ? selected.getData() : null;
		if (!data) return;

		let groupData: Record<string, unknown> | null = null;

		if (data.type === "group") {
			groupData = data;
		} else if (data.type === "text") {
			// Text node inside a group — find the containing group by spatial bounds
			groupData = this.findContainingGroup(canvas, data);
		}

		if (!groupData) return;

		// Collect all group nodes sorted by x position (left-to-right = step order)
		const groups: Array<{ x: number; id: unknown }> = [];
		for (const node of canvas.nodes.values()) {
			const nd = typeof node.getData === "function" ? node.getData() : null;
			if (nd && nd.type === "group") {
				groups.push({ x: nd.x as number, id: nd.id });
			}
		}
		groups.sort((a, b) => a.x - b.x);

		const stepIndex = groups.findIndex((g) => g.id === groupData!.id);
		if (stepIndex >= 0) {
			this.deps.onStepSelected(stepIndex);
		}
	}

	/** Find the group node that spatially contains the given text node. */
	private findContainingGroup(
		canvas: NonNullable<CanvasLeafView["canvas"]>,
		textData: Record<string, unknown>,
	): Record<string, unknown> | null {
		const tx = textData.x as number;
		const ty = textData.y as number;
		for (const node of canvas.nodes.values()) {
			const nd = typeof node.getData === "function" ? node.getData() : null;
			if (nd && nd.type === "group") {
				const gx = nd.x as number;
				const gy = nd.y as number;
				const gw = nd.width as number;
				const gh = nd.height as number;
				if (tx >= gx && tx <= gx + gw && ty >= gy && ty <= gy + gh) {
					return nd;
				}
			}
		}
		return null;
	}

	// ── Canvas lookup ──────────────────────────────────────

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

	private findCanvasLeaf(canvasPath: string): WorkspaceLeaf | null {
		const app = this.deps.getApp();
		const getLeavesOfType = app?.workspace?.getLeavesOfType;
		if (typeof getLeavesOfType !== "function") return null;
		const leaves = (getLeavesOfType.call(app!.workspace, "canvas") ?? []) as WorkspaceLeaf[];
		for (const leaf of leaves) {
			const view = leaf.view as unknown as CanvasLeafView;
			if (view?.file?.path === canvasPath) {
				return leaf;
			}
		}
		return null;
	}

	private findCanvas(canvasPath: string): CanvasLeafView["canvas"] | null {
		const leaf = this.findCanvasLeaf(canvasPath);
		if (!leaf) return null;
		const view = leaf.view as unknown as CanvasLeafView;
		return view?.canvas ?? null;
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
