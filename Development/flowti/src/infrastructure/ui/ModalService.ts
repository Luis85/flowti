/**
 * Centralized modal service for Flowti.
 *
 * Absorbs modal-opening event listeners from main.ts to reduce its
 * LOC and centralize all modal lifecycle management. Domain services
 * are injected via setters (same pattern as {@link UiCommandService}).
 *
 * Handles:
 * - `ui.openQuickCapture` → QuickCaptureModal
 * - `ui.captureIdea` → direct capture + notice
 * - `ui.startTrain` → TrainResumeModal / TrainTypePickerModal chain
 * - `ui.startCanvasSession` → CanvasTemplatePickerModal → InputModal chain
 */

import type { App } from "obsidian";
import type { IEventBus } from "../events/types";
import type { IDisposable } from "../services/types";
import type { NoticeService } from "./NoticeService";
import type { FlowtiSettings } from "../../domain/settings/settings";
import type { CaptureService } from "../../domain/capture/CaptureService";
import type { TrainService } from "../../domain/train/TrainService";
import type { SessionService } from "../../domain/session/SessionService";
import type { CanvasSessionService } from "../../domain/canvas/session/CanvasSessionService";
import type { ThoughtDirection } from "../../domain/train/types";
import { resolveCaptureConfig } from "../../domain/capture/resolveCaptureConfig";
import { QuickCaptureModal } from "../../ui/capture/QuickCaptureModal";
import { TrainResumeModal } from "../../ui/train/TrainResumeModal";
import { TrainTypePickerModal } from "../../ui/train/TrainTypePickerModal";
import { TrainCaptureModal } from "../../ui/train/TrainCaptureModal";
import { CanvasTemplatePickerModal } from "../../ui/canvas/CanvasTemplatePickerModal";
import { InputModal } from "../../ui/modals";
import { SubscriptionManagerModal } from "../../ui/catalog/SubscriptionManagerModal";
import { computeRemainingMs } from "../../domain/session/helpers";
import type { InputModalConfig } from "./UiCommandService";

// ─────────────────────────────────────────────────────────────
// Options
// ─────────────────────────────────────────────────────────────

export interface ModalServiceOptions {
	app: App;
	eventBus: IEventBus;
	noticeService: NoticeService;
	getSettings: () => FlowtiSettings;
}

// ─────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────

export class ModalService implements IDisposable {
	private app: App;
	private eventBus: IEventBus;
	private noticeService: NoticeService;
	private getSettings: () => FlowtiSettings;
	private unsubscribes: (() => void)[] = [];

	// Domain services (injected via setters in onLayoutReady)
	private captureService?: CaptureService;
	private trainService?: TrainService;
	private sessionService?: SessionService;
	private canvasSessionService?: CanvasSessionService;

	constructor(options: ModalServiceOptions) {
		this.app = options.app;
		this.eventBus = options.eventBus;
		this.noticeService = options.noticeService;
		this.getSettings = options.getSettings;
		this.wireEventSubscriptions();
	}

	// ── Service setters (called during onLayoutReady) ───────

	setCaptureService(svc: CaptureService): void {
		this.captureService = svc;
	}

	setTrainService(svc: TrainService): void {
		this.trainService = svc;
	}

	setSessionService(svc: SessionService): void {
		this.sessionService = svc;
	}

	setCanvasSessionService(svc: CanvasSessionService): void {
		this.canvasSessionService = svc;
	}

	// ── Public API (used by UiCommandService) ──────────────

	openInput(config: InputModalConfig): void {
		new InputModal(this.app, config).open();
	}

	openSubscriptionManager(): void {
		new SubscriptionManagerModal(this.app, this.eventBus).open();
		void this.eventBus.emit("modal.opened", {
			modalType: "subscriptionManager",
			timestamp: new Date().toISOString(),
		});
	}

	// ── IDisposable ─────────────────────────────────────────

	dispose(): void {
		for (const unsub of this.unsubscribes) unsub();
		this.unsubscribes = [];
	}

	// ── Private: event wiring ───────────────────────────────

	private wireEventSubscriptions(): void {
		this.unsubscribes.push(
			this.eventBus.on("ui.openQuickCapture", (event) => {
				this.handleOpenQuickCapture(event.payload);
			}),
		);

		this.unsubscribes.push(
			this.eventBus.on("ui.captureIdea", (event) => {
				this.handleCaptureIdea(event.payload);
			}),
		);

		this.unsubscribes.push(
			this.eventBus.on("ui.startTrain", (event) => {
				this.handleStartTrain(event.payload);
			}),
		);

		this.unsubscribes.push(
			this.eventBus.on("ui.startCanvasSession", () => {
				this.handleStartCanvasSession();
			}),
		);
	}

	// ── Handlers ────────────────────────────────────────────

	private handleOpenQuickCapture(payload: { type?: string }): void {
		const type = payload.type;
		const resolved = resolveCaptureConfig(type ?? "idea", this.getSettings());
		new QuickCaptureModal(this.app, {
			showTypeSelector: !type,
			defaultType: type,
			defaultFolder: resolved.folder,
			defaultTemplate: resolved.template || undefined,
			onSubmit: (input) => {
				if (this.captureService) {
					void this.captureService.capture(input).then((result) => {
						this.noticeService.success(`Captured: ${result.title}`);
					});
				}
			},
		}).open();
		void this.eventBus.emit("modal.opened", {
			modalType: "quickCapture",
			timestamp: new Date().toISOString(),
		});
	}

	private handleCaptureIdea(payload: { title: string }): void {
		if (this.captureService) {
			void this.captureService.capture({
				type: "idea",
				title: payload.title,
			}).then((result) => {
				this.noticeService.success(`Captured: ${result.title}`);
			});
		}
	}

	private handleStartTrain(payload: {
		fromThoughtId?: string;
		fromFilePath?: string;
		mergeDown?: boolean;
	}): void {
		if (!this.trainService) return;

		// If paused, resume and open modal from the selected thought
		const activeTrain = this.trainService.getActiveTrain();
		if (activeTrain && activeTrain.status === "paused") {
			const fromThoughtId = payload.fromThoughtId;
			const mdFlag = payload.mergeDown;

			// Smart resume: check if active thought is NOT the head node
			const headNode = this.trainService.getHeadNode(activeTrain.id);
			const activeThoughtId = fromThoughtId ?? activeTrain.thoughts[activeTrain.thoughts.length - 1]?.id;
			const currentThought = activeThoughtId
				? activeTrain.thoughts.find((t) => t.id === activeThoughtId)
				: null;

			if (headNode && currentThought && headNode.id !== currentThought.id && !mdFlag && !fromThoughtId) {
				new TrainResumeModal(this.app, {
					trainTitle: activeTrain.title,
					currentThoughtTitle: currentThought.title,
					headThoughtTitle: headNode.title,
					onChoice: (choice) => {
						switch (choice) {
							case "jump-to-end":
								void this.trainService!.resume(activeTrain.id).then(() => {
									this.openTrainModal(activeTrain.id, activeTrain.title, undefined, headNode.id);
								});
								break;
							case "branch-from-here":
								void this.trainService!.resume(activeTrain.id).then(() => {
									this.openTrainModal(activeTrain.id, activeTrain.title, undefined, currentThought.id);
								});
								break;
							case "stay-here":
								// Don't resume — leave the train paused at current position
								break;
						}
					},
				}).open();
				void this.eventBus.emit("modal.opened", {
					modalType: "trainResume",
					timestamp: new Date().toISOString(),
				});
				return;
			}

			void this.trainService.resume(activeTrain.id).then(() => {
				this.openTrainModal(activeTrain.id, activeTrain.title, undefined, fromThoughtId, mdFlag);
			});
			return;
		}

		// Running train — open capture modal from the active thought
		if (activeTrain && activeTrain.status === "running") {
			this.openTrainModal(activeTrain.id, activeTrain.title, undefined, payload.fromThoughtId, payload.mergeDown);
			return;
		}

		// No train — type picker → title input → start
		const fromFilePath = payload.fromFilePath;
		new TrainTypePickerModal(this.app, {
			onSelect: (typeConfig) => {
				const duration = typeConfig.defaultDuration || (this.getSettings().defaultTrainDuration ?? 0);
				new InputModal(this.app, {
					title: `Start a ${typeConfig.label} Train`,
					inputName: "What are you thinking?",
					inputDesc: "",
					placeholder: "e.g. Exploring a new idea\u2026",
					submitLabel: "Start",
					onSubmit: (title) => {
						void this.trainService!.startTrain(title, duration, typeConfig.id).then(async (train) => {
							if (fromFilePath) {
								const basename = fromFilePath.replace(/^.*[\\/]/, "").replace(/\.md$/, "");
								await this.trainService!.addThought(train.id, basename, { path: fromFilePath });
							}
							this.openTrainModal(train.id, train.title);
						});
					},
				}).open();
			},
		}).open();
		void this.eventBus.emit("modal.opened", {
			modalType: "trainTypePicker",
			timestamp: new Date().toISOString(),
		});
	}

	private handleStartCanvasSession(): void {
		new CanvasTemplatePickerModal(this.app, {
			onSelect: (template) => {
				if (!this.canvasSessionService) return;
				new InputModal(this.app, {
					title: `Canvas session: ${template.name}`,
					inputName: "Session goal",
					inputDesc: "",
					placeholder: "What do you want to achieve?",
					submitLabel: "Start",
					onSubmit: (goal) => {
						void this.canvasSessionService!.startSession({
							templateId: template.id,
							goal,
							durationMinutes: 25,
						}).then((result) => {
							this.noticeService.success(`Canvas session started — ${template.name}`);
							void this.app.workspace.openLinkText(result.canvasPath, "", false);
						}).catch((err: Error) => {
							this.noticeService.error(`Failed to start canvas session: ${err.message}`);
						});
					},
				}).open();
			},
		}).open();
		void this.eventBus.emit("modal.opened", {
			modalType: "canvasTemplatePicker",
			timestamp: new Date().toISOString(),
		});
	}

	// ── Train Capture Modal ─────────────────────────────────

	/**
	 * Opens the Train capture modal in a recursive loop.
	 * Each submit fires addThought in the background and opens the next modal
	 * immediately (optimistic) to keep the capture flow snappy.
	 * Cancel (escape/close) pauses the train. Complete ends it permanently.
	 */
	private openTrainModal(
		trainId: string,
		trainTitle: string,
		overrides?: { previousTitle: string; thoughtCount: number },
		fromThoughtId?: string,
		mergeDown?: boolean,
	): void {
		if (!this.trainService) return;

		// Sync the active thought across all views (main view + timeline sidebar)
		if (fromThoughtId) {
			void this.eventBus.emit("train.thought.activated", { trainId, thoughtId: fromThoughtId });
		}

		let previousThoughtTitle: string | null;
		let thoughtCount: number;

		if (overrides) {
			previousThoughtTitle = overrides.previousTitle;
			thoughtCount = overrides.thoughtCount;
		} else {
			const train = this.trainService.getTrain(trainId);
			if (!train) return;

			// Use the specified thought as context, otherwise fall back to last thought
			const contextThought = fromThoughtId
				? train.thoughts.find((t) => t.id === fromThoughtId) ?? null
				: train.thoughts[train.thoughts.length - 1] ?? null;
			previousThoughtTitle = contextThought?.title ?? null;
			thoughtCount = train.thoughts.length;
		}

		// Resolve timer info from TrainState
		const train = this.trainService.getTrain(trainId);
		const durationMinutes = train?.durationMinutes ?? 0;
		const sessionId = train?.sessionId;

		// Compute current remaining time to avoid timer reset flash when modal reopens
		let initialRemainingMs: number | undefined;
		if (durationMinutes > 0 && sessionId && this.sessionService) {
			const session = this.sessionService.getSessionById(sessionId);
			if (session) {
				initialRemainingMs = computeRemainingMs(session);
			}
		}

		// Auto-detect direction: if the source thought already has a "next" child, default to "branch"
		let defaultDirection: ThoughtDirection = "next";
		if (fromThoughtId && train) {
			const hasNextChild = train.relations.some(
				(r) => r.fromId === fromThoughtId && r.direction === "next",
			);
			if (hasNextChild) {
				defaultDirection = "branch";
			}
		}

		// Timer subscriptions — closures that filter by sessionId
		const subscribeTimerTick = (durationMinutes > 0 && sessionId)
			? (cb: (remainingMs: number) => void) => {
				return this.eventBus.on("session.timer.tick", (event) => {
					if (event.payload.sessionId === sessionId) {
						cb(event.payload.remainingMs);
					}
				});
			}
			: undefined;

		const subscribeTimerCompleted = (durationMinutes > 0 && sessionId)
			? (cb: () => void) => {
				return this.eventBus.on("session.timer.completed", (event) => {
					if (event.payload.sessionId === sessionId) {
						cb();
					}
				});
			}
			: undefined;

		// Navigation callbacks — mirrors the thought's link directions (prev/next/up)
		// Each emits train.thought.activated so main view + timeline sync to the new thought.
		let onBack: (() => void) | undefined;
		let onNext: (() => void) | undefined;
		let onUp: (() => void) | undefined;
		let onDown: (() => void) | undefined;
		if (fromThoughtId && train) {
			// prev: linear parent (any relation pointing TO this thought)
			const parentRelation = train.relations.find((r) => r.toId === fromThoughtId);
			if (parentRelation) {
				const parentId = parentRelation.fromId;
				onBack = () => this.openTrainModal(trainId, trainTitle, undefined, parentId);
			}
			// next: linear child (direction="next" from this thought)
			const nextRelation = train.relations.find(
				(r) => r.fromId === fromThoughtId && r.direction === "next",
			);
			if (nextRelation) {
				const nextId = nextRelation.toId;
				onNext = () => this.openTrainModal(trainId, trainTitle, undefined, nextId);
			}
			// up: first branch child (direction="branch" from this thought)
			const branchRelation = train.relations.find(
				(r) => r.fromId === fromThoughtId && r.direction === "branch",
			);
			if (branchRelation) {
				const branchId = branchRelation.toId;
				onUp = () => this.openTrainModal(trainId, trainTitle, undefined, branchId);
			}
			// down: branch parent (parent with direction="branch" pointing TO this thought)
			const branchParentRelation = train.relations.find(
				(r) => r.toId === fromThoughtId && r.direction === "branch",
			);
			if (branchParentRelation) {
				const branchParentId = branchParentRelation.fromId;
				onDown = () => this.openTrainModal(trainId, trainTitle, undefined, branchParentId);
			}
		}

		// Detect branch for merge-down option (available whenever thought is on a branch)
		const mergeDownInfo = (fromThoughtId && train)
			? this.trainService.findMergeDownTarget(trainId, fromThoughtId)
			: null;
		const isBranchEndpoint = mergeDownInfo !== null;

		// Check if source thought has been merged into another thought
		const isMerged = (fromThoughtId && train)
			? train.relations.some((r) => r.fromId === fromThoughtId && r.direction === "merge")
			: false;

		new TrainCaptureModal(this.app, {
			trainTitle,
			previousThoughtTitle,
			thoughtCount,
			durationMinutes,
			initialRemainingMs,
			defaultDirection,
			subscribeTimerTick,
			subscribeTimerCompleted,
			onBack,
			onNext,
			onUp,
			onDown,
			isBranchEndpoint,
			isMerged,
			defaultMergeDown: mergeDown,
			onRenameThought: fromThoughtId ? (newTitle) => {
				void this.trainService!.renameThought(trainId, fromThoughtId, newTitle);
			} : undefined,
			onMergeDown: isBranchEndpoint ? (title) => {
				if (mergeDownInfo.targetId) {
					// Add thought on branch, then merge it into main chain target
					void this.trainService!.addThought(trainId, title, {
						direction: "next",
						fromThoughtId: fromThoughtId!,
					}).then(async (newThought) => {
						if (newThought) {
							await this.trainService!.mergeBranch(trainId, newThought.id, mergeDownInfo.targetId!);
						}
						// Continue from the main chain target
						this.openTrainModal(trainId, trainTitle, {
							previousTitle: title,
							thoughtCount: thoughtCount + 1,
						}, mergeDownInfo.targetId!);
					});
				} else {
					// No next on main chain — add thought as "next" from origin, then merge branch into it
					void this.trainService!.addThought(trainId, title, { direction: "next", fromThoughtId: mergeDownInfo.originId }).then(async (newThought) => {
						if (newThought) {
							await this.trainService!.mergeBranch(trainId, fromThoughtId!, newThought.id);
						}
						this.openTrainModal(trainId, trainTitle, {
							previousTitle: title,
							thoughtCount: thoughtCount + 1,
						}, newThought?.id);
					});
				}
			} : undefined,
			onSubmit: (title, direction) => {
				// Await addThought so the next modal chains from the correct thought
				void this.trainService!.addThought(trainId, title, { direction, fromThoughtId }).then((newThought) => {
					this.openTrainModal(trainId, trainTitle, {
						previousTitle: title,
						thoughtCount: thoughtCount + 1,
					}, newThought?.id);
				});
			},
			onComplete: () => {
				void this.trainService!.completeTrain(trainId);
			},
			onCancel: () => {
				void this.trainService!.pause(trainId);
			},
		}).open();
	}
}
