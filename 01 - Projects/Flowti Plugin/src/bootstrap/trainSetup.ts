/**
 * Train domain wiring — service instantiation, canvas sync,
 * and all train-related event subscriptions.
 *
 * Extracted from main.ts to reduce its LOC (TD-05).
 */

import type { App } from "obsidian";
import type { IEventBus } from "../infrastructure/events/types";
import type { TrainService } from "../domain/train/TrainService";
import { TrainCanvasSyncService } from "../domain/train/TrainCanvasSyncService";
import { getCanvasPath } from "../domain/train/helpers";
import { FileSystemClient } from "../infrastructure/filesystem/FileSystemClient";
import type { CaptureService } from "../domain/capture/CaptureService";
import type { SessionService } from "../domain/session/SessionService";
import type { CanvasService } from "../domain/canvas/CanvasService";
import { CanvasSessionService } from "../domain/canvas/session/CanvasSessionService";
import type { IServiceContainer } from "../infrastructure/services/types";
import type { ISettingsService } from "../domain/settings/types";
import type { NoticeService } from "../infrastructure/ui/NoticeService";
import type { ModalService } from "../infrastructure/ui/ModalService";
import { SESSION_NOTES_FOLDER } from "../domain/session/types";
import { VIEW_TYPE_TRAIN_MAIN } from "../ui/train/TrainMainView";
import { VIEW_TYPE_TRAIN_TIMELINE } from "../ui/train/TrainTimelineSidebar";
import { VIEW_TYPE_SESSION_WORKSPACE } from "../ui/session/SessionWorkspaceView";

export interface TrainSetupDeps {
	app: App;
	eventBus: IEventBus;
	services: IServiceContainer;
	settingsService: ISettingsService;
	sessionService: SessionService;
	noticeService: NoticeService;
	modalService: ModalService;
}

export interface TrainSetupResult {
	trainService: TrainService;
	captureService: CaptureService;
	canvasService: CanvasService;
	canvasSessionService: CanvasSessionService;
	trainCanvasSync: TrainCanvasSyncService;
	unsubscribes: (() => void)[];
}

export class TrainSetup {
	constructor(private deps: TrainSetupDeps) {}

	async setup(
		timedServiceLoad: (name: string, loadFn: () => Promise<void>) => Promise<void>,
	): Promise<TrainSetupResult> {
		const { app, eventBus, services, settingsService, sessionService, noticeService, modalService } = this.deps;
		const unsubscribes: (() => void)[] = [];

		// Capture Service — quick note capture via ribbons and command palette
		const captureService = await services.get<CaptureService>("captureService");
		captureService.getSettings = () => ({
			captureFolder: settingsService.getSettings().captureFolder,
		});

		// Train + Canvas services — resolve in parallel; loads run in parallel (independent I/O).
		const [trainService, canvasService] = await Promise.all([
			services.get<TrainService>("trainService"),
			services.get<CanvasService>("canvasService"),
		]);
		trainService.getSettings = () => ({
			trainFolder: settingsService.getSettings().trainFolder,
			trainMaxThoughts: settingsService.getSettings().trainMaxThoughts,
		});

		// Train Canvas Sync — auto-generate canvas from train graph
		const trainCanvasFileSystem = new FileSystemClient({ eventBus });
		const trainCanvasSync = new TrainCanvasSyncService({
			eventBus,
			fileSystem: trainCanvasFileSystem,
			getSettings: () => ({
				trainCanvasEnabled: settingsService.getSettings().trainCanvasEnabled,
			}),
			getTrain: (id) => trainService.getTrain(id),
		});
		trainCanvasSync.setup();

		await Promise.all([
			timedServiceLoad("trainService", () => trainService.load()),
			timedServiceLoad("canvasService", () => canvasService.load()),
		]);

		// Canvas Session Service — guided canvas session orchestration
		const canvasSessionFs = new FileSystemClient({ eventBus });
		const canvasSessionService = new CanvasSessionService({
			eventBus,
			fileSystem: canvasSessionFs,
			sessionFolder: SESSION_NOTES_FOLDER,
		});

		// Wire domain services into ModalService
		modalService.setCaptureService(captureService);
		modalService.setTrainService(trainService);
		modalService.setSessionService(sessionService);
		modalService.setCanvasSessionService(canvasSessionService);

		// ── Train event subscriptions ────────────────────────────

		unsubscribes.push(
			eventBus.on("train.started", (event) => {
				this.revealOrCreateTrainView(event.payload.train.id);
				this.revealOrCreateTrainTimeline(event.payload.train.id);
			}),
		);

		// Auto-open canvas when created (if trainCanvasAutoOpen is enabled)
		// Delay 500ms to allow metadataCache to settle before Advanced Canvas parses the file.
		unsubscribes.push(
			eventBus.on("train.canvas.created", (event) => {
				if (settingsService.getSettings().trainCanvasAutoOpen) {
					setTimeout(() => {
						void app.workspace.openLinkText(event.payload.canvasPath, "", false);
					}, 500);
				}
			}),
		);

		// Resume train → reveal Train Main View (modal opened separately via ui.startTrain)
		unsubscribes.push(
			eventBus.on("train.resumed", (event) => {
				const train = trainService.getTrain(event.payload.trainId);
				if (train) {
					this.revealOrCreateTrainView(train.id);
				}
			}),
		);

		// Open/reveal Train Main View on command (accepts optional trainId)
		unsubscribes.push(
			eventBus.on("ui.openTrainView", (event) => {
				const trainId = event.payload.trainId ?? trainService.getActiveTrain()?.id ?? null;
				this.revealOrCreateTrainView(trainId);
			}),
		);

		// Toggle Train Timeline Sidebar — 3-state: open, reveal, or collapse
		unsubscribes.push(
			eventBus.on("ui.toggleTrainTimeline", (event) => {
				const rightSplit = (app.workspace as unknown as {
					rightSplit?: { collapsed?: boolean; expand?: () => void; collapse?: () => void };
				}).rightSplit;
				const existingLeaves = app.workspace.getLeavesOfType(VIEW_TYPE_TRAIN_TIMELINE);

				// Force close — always collapse (used after closure ritual)
				if (event.payload.forceClose) {
					rightSplit?.collapse?.();
					return;
				}

				// Case 1: Sidebar is collapsed → expand and show timeline
				if (rightSplit?.collapsed) {
					rightSplit.expand?.();
					if (existingLeaves.length > 0) {
						void app.workspace.revealLeaf(existingLeaves[0]);
					} else {
						this.revealOrCreateTrainTimeline(event.payload.trainId);
					}
					return;
				}

				// Sidebar is open
				if (existingLeaves.length > 0) {
					// Timeline leaf exists — check if it's visible
					const timelineLeaf = existingLeaves[0];
					const isVisible = timelineLeaf.view?.containerEl?.isShown?.() !== false;
					if (isVisible) {
						// Case 2: Timeline is visible → collapse sidebar
						rightSplit?.collapse?.();
					} else {
						// Case 3: Different tab is active → reveal timeline
						void app.workspace.revealLeaf(timelineLeaf);
					}
				} else {
					// No timeline leaf exists → create it
					this.revealOrCreateTrainTimeline(event.payload.trainId);
				}
			}),
		);

		// Resume paused train (command palette)
		unsubscribes.push(
			eventBus.on("ui.resumeTrain", () => {
				const paused = trainService.getAllTrains().find((t) => t.status === "paused");
				if (!paused) {
					noticeService.show("No paused train to resume");
					return;
				}
				void trainService.resume(paused.id);
			}),
		);

		// Complete current train (command palette)
		unsubscribes.push(
			eventBus.on("ui.completeTrain", () => {
				const active = trainService.getActiveTrain();
				if (!active) {
					noticeService.show("No active train to complete");
					return;
				}
				void trainService.completeTrain(active.id);
			}),
		);

		// Rename train folder when train is renamed
		unsubscribes.push(
			eventBus.on("train.renamed", (event) => {
				const { oldFolder, newFolder } = event.payload;
				if (oldFolder && newFolder && oldFolder !== newFolder) {
					const folder = app.vault.getAbstractFileByPath(oldFolder);
					if (folder) {
						void app.vault.rename(folder, newFolder);
					}
				}
			}),
		);

		// Rename vault note when a thought is renamed
		unsubscribes.push(
			eventBus.on("train.thought.renamed", (event) => {
				const { oldPath, newPath } = event.payload;
				if (oldPath !== newPath) {
					const file = app.vault.getAbstractFileByPath(oldPath);
					if (file) {
						void app.vault.rename(file, newPath);
					}
				}
			}),
		);

		// Open canvas for active train (command palette)
		unsubscribes.push(
			eventBus.on("ui.openTrainCanvas", () => {
				const active = trainService.getActiveTrain();
				if (!active) {
					noticeService.show("No active train");
					return;
				}
				const settings = settingsService.getSettings();
				if (!settings.trainCanvasEnabled || !active.folderPath) {
					noticeService.show("Train canvas is not enabled");
					return;
				}
				const canvasPath = getCanvasPath(active.title, active.folderPath);
				void app.workspace.openLinkText(canvasPath, "", false);
			}),
		);

		// Open train timeline sidebar for active train (command palette)
		unsubscribes.push(
			eventBus.on("ui.openTrainTimeline", () => {
				const active = trainService.getActiveTrain();
				if (!active) {
					noticeService.show("No active train");
					return;
				}
				this.revealOrCreateTrainTimeline(active.id);
			}),
		);

		// Auto-open Session Workspace for train closure ritual
		// Train sessions suppress workspace on start, but need it for closure
		unsubscribes.push(
			eventBus.on("session.closure.started", (event) => {
				const session = sessionService.getSessionById(event.payload.sessionId);
				if (!session || session.type !== "train-of-thought") return;

				const existingLeaves = app.workspace.getLeavesOfType(VIEW_TYPE_SESSION_WORKSPACE);
				if (existingLeaves.length > 0) {
					// Already open — just reveal it (it will re-render the closure overlay)
					void app.workspace.revealLeaf(existingLeaves[0]);
					return;
				}

				void app.workspace.getLeaf("tab").setViewState({
					type: VIEW_TYPE_SESSION_WORKSPACE,
					active: true,
				});
			}),
		);

		return {
			trainService,
			captureService,
			canvasService,
			canvasSessionService,
			trainCanvasSync,
			unsubscribes,
		};
	}

	// ── View helpers ─────────────────────────────────────────

	/**
	 * Opens the Train Main View for a specific train, or reveals an existing one.
	 * If no train ID is given (e.g. no active train), opens the view in empty state.
	 */
	revealOrCreateTrainView(trainId: string | null): void {
		const { app } = this.deps;
		const existingLeaves = app.workspace.getLeavesOfType(VIEW_TYPE_TRAIN_MAIN);
		if (existingLeaves.length > 0) {
			// Already open — refresh with the given train and reveal
			for (const leaf of existingLeaves) {
				void leaf.setViewState({
					type: VIEW_TYPE_TRAIN_MAIN,
					state: { trainId },
				});
			}
			void app.workspace.revealLeaf(existingLeaves[0]);
			return;
		}
		void app.workspace.getLeaf("tab").setViewState({
			type: VIEW_TYPE_TRAIN_MAIN,
			active: true,
			state: { trainId },
		});
	}

	/**
	 * Opens the Train Timeline Sidebar in the right split, or reveals an existing one.
	 */
	revealOrCreateTrainTimeline(trainId: string | null): void {
		const { app } = this.deps;
		const existingLeaves = app.workspace.getLeavesOfType(VIEW_TYPE_TRAIN_TIMELINE);
		if (existingLeaves.length > 0) {
			for (const leaf of existingLeaves) {
				void leaf.setViewState({
					type: VIEW_TYPE_TRAIN_TIMELINE,
					state: { trainId },
				});
			}
			void app.workspace.revealLeaf(existingLeaves[0]);
			return;
		}
		void app.workspace.getRightLeaf(false)?.setViewState({
			type: VIEW_TYPE_TRAIN_TIMELINE,
			active: true,
			state: { trainId },
		});
	}
}
