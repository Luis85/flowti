/**
 * Sitemap-driven handler for the Session Workspace.
 *
 * Orchestrates the session workspace using the `flowti-session-workspace`
 * Lit component and its sub-components. The handler is responsible for:
 * - Creating and mounting the Lit component
 * - Mapping session domain data to component properties
 * - Wiring CustomEvents from Lit components to EventBus
 * - Subscribing to EventBus events and updating component properties
 *
 * Event subscriptions: SessionWorkspaceSubscriptions.ts
 * Helper functions:    SessionWorkspaceHelpers.ts
 */

import type { App, WorkspaceLeaf } from "obsidian";
import type { IEventBus } from "../../events/types";
import type { SessionService } from "../../../domain/session/SessionService";
import type { TrainService } from "../../../domain/train/TrainService";
import type { Session, SessionTypeConfig, SessionOutputTemplate, ClosureTemplate, EnergyLevel, ClosureResponse } from "../../../domain/session/types";
import { SESSION_TYPE_CONFIGS, MAX_CONTEXT_BINDINGS, BINDING_TYPES } from "../../../domain/session/types";
import { resolveClosureTemplate, resolveTypeConfig } from "../../../domain/session/helpers";
import { computeRemainingMs, computeActivityIntelligence } from "../../../domain/session/helpers";
import { detectCognitiveOverload, isExcluded } from "../../../domain/session/helpers";
import { SESSION_TYPE_LABELS, SESSION_STATUS_LABELS } from "../../../ui/userHub/types";
import { BUILT_IN_TRAIN_TYPES } from "../../../domain/train/types";
import type { FlowtiSessionWorkspace } from "../../../components/session/flowti-session-workspace";
import {
	captureWorkspaceState, restoreWorkspaceState,
	openOutputPicker, openSaveTemplateModal, openInTab, openInSidebar,
	openInAdjacentLeaf, revealInFileExplorer,
} from "../../../ui/session/SessionWorkspaceHelpers";
import type { WorkspaceHelperContext } from "../../../ui/session/SessionWorkspaceHelpers";
import type { PluginHandlerRegistry, TabContext } from "../plugin-handler-registry";

// Side-effect import to register all session Lit components
import "../../../components/session/flowti-session-workspace.js";

// ── Deps ──────────────────────────────────────────────────────

export interface SessionWorkspaceHandlerDeps {
	sessionService: SessionService;
	eventBus: IEventBus;
	app: App;
	trainService?: TrainService;
	customSessionTypes?: Record<string, SessionTypeConfig>;
	customOutputTemplates?: readonly SessionOutputTemplate[];
}

// ── Registration ──────────────────────────────────────────────

export function registerSessionWorkspaceHandler(
	registry: PluginHandlerRegistry,
	deps: SessionWorkspaceHandlerDeps,
): void {
	registry.registerTabHandler("leaf:session-workspace", (container: HTMLElement, ctx: TabContext) => {
		createSessionWorkspace(container, deps, ctx.leaf as WorkspaceLeaf);
	});
}

// ── Orchestrator ──────────────────────────────────────────────

function createSessionWorkspace(
	container: HTMLElement,
	deps: SessionWorkspaceHandlerDeps,
	leaf: WorkspaceLeaf,
): () => void {
	const { sessionService, eventBus, app } = deps;
	const customSessionTypes = deps.customSessionTypes ?? {};
	const customOutputTemplates = deps.customOutputTemplates ?? [];

	// ── State ─────────────────────────────────────────────
	let session: Session | null = null;
	let renderTimer: ReturnType<typeof setTimeout> | null = null;
	let adjacentLeaf: WorkspaceLeaf | null = null;
	let unsubscribes: (() => void)[] = [];

	// ── Create Lit component ─────────────────────────────
	const workspace = document.createElement("flowti-session-workspace") as FlowtiSessionWorkspace;
	container.addClass("ft-session-workspace");
	container.appendChild(workspace);

	// ── Helpers ───────────────────────────────────────────

	function refreshSession(): Session {
		return (session
			? sessionService.getSessionById(session.id)
			: sessionService.getActiveSession()) ?? session!;
	}

	function buildHelperContext(): WorkspaceHelperContext {
		return {
			app,
			eventBus,
			leaf,
			getSession: () => session,
			getAdjacentLeaf: () => adjacentLeaf,
			setAdjacentLeaf: (l) => { adjacentLeaf = l; },
			customOutputTemplates,
			sessionService,
		};
	}

	// ── Closure template resolution ──────────────────────

	function getTypeClosureTemplates(): Record<string, ClosureTemplate> | undefined {
		const result: Record<string, ClosureTemplate> = {};
		let hasAny = false;

		for (const [type, config] of Object.entries(SESSION_TYPE_CONFIGS)) {
			if (config.closureTemplate) {
				result[type] = config.closureTemplate;
				hasAny = true;
			}
		}

		for (const [type, config] of Object.entries(customSessionTypes)) {
			if (config.closureTemplate) {
				result[type] = config.closureTemplate;
				hasAny = true;
			}
		}

		return hasAny ? result : undefined;
	}

	function buildTrainClosureData(): { title: string; trainType?: string; thoughtCount: number; branchCount: number; mergeCount: number; elapsed: string; keyThoughts: string[] } | null {
		if (!deps.trainService || !session) return null;
		const train = deps.trainService.getAllTrains().find((t) => t.sessionId === session!.id);
		if (!train) return null;

		const typeConfig = BUILT_IN_TRAIN_TYPES.find((t) => t.id === train.trainType);
		const branchCount = train.relations.filter((r) => r.direction === "branch").length;
		const mergeCount = train.relations.filter((r) => r.direction === "merge").length;

		// Compute elapsed
		let elapsed = "\u2014";
		if (train.createdAt) {
			const start = new Date(train.createdAt).getTime();
			const end = train.completedAt
				? new Date(train.completedAt).getTime()
				: (train.pausedAt ? new Date(train.pausedAt).getTime() : Date.now());
			const diffMs = Math.max(0, end - start);
			elapsed = `${Math.floor(diffMs / 60_000)} min`;
		}

		// Collect key thoughts (max 5)
		const thoughts = train.thoughts;
		const titles: string[] = [];
		const seen = new Set<string>();
		if (thoughts.length > 0) {
			let head = thoughts[0];
			for (;;) {
				const next = train.relations.find((r) => r.fromId === head.id && r.direction === "next");
				if (!next) break;
				const nextNode = thoughts.find((t) => t.id === next.toId);
				if (!nextNode) break;
				head = nextNode;
			}
			titles.push(head.title);
			seen.add(head.id);
		}
		for (const rel of train.relations) {
			if (titles.length >= 5) break;
			if (rel.direction === "branch") {
				const node = thoughts.find((t) => t.id === rel.toId);
				if (node && !seen.has(node.id)) { titles.push(node.title); seen.add(node.id); }
			}
		}
		for (const rel of train.relations) {
			if (titles.length >= 5) break;
			if (rel.direction === "merge") {
				const node = thoughts.find((t) => t.id === rel.toId);
				if (node && !seen.has(node.id)) { titles.push(node.title); seen.add(node.id); }
			}
		}

		return {
			title: train.title,
			trainType: typeConfig?.label,
			thoughtCount: thoughts.length,
			branchCount,
			mergeCount,
			elapsed,
			keyThoughts: titles.slice(0, 5),
		};
	}

	// ── Filtered activity ────────────────────────────────

	function getFilteredActivity(s: Session): readonly { path: string; action: string; timestamp: string }[] {
		if (s.status === "completed" || s.status === "archived") {
			return s.activity;
		}
		const globalFilter = sessionService.globalActivityFilter;
		if (globalFilter.length === 0 && s.activityFilter.length === 0) {
			return s.activity;
		}
		return s.activity.filter(
			(entry) => !isExcluded(entry.path, globalFilter, s.activityFilter),
		);
	}

	// ── Sync session state to Lit properties ─────────────

	function syncToComponent(): void {
		if (!session) {
			workspace.sessionId = "";
			return;
		}

		const s = session;
		const isEditable = s.status !== "completed" && s.status !== "archived";
		const isActive = s.status === "active" || s.status === "running" || s.status === "paused";
		const showOutputs = s.status === "completed" || s.status === "archived";

		workspace.sessionId = s.id;
		workspace.sessionStatus = s.status;
		workspace.sessionTitle = s.title;
		workspace.sessionType = s.type;
		workspace.sessionTypeLabel = SESSION_TYPE_LABELS[s.type] ?? s.type;
		workspace.statusLabel = SESSION_STATUS_LABELS[s.status] ?? s.status;
		workspace.durationMinutes = s.durationMinutes;
		workspace.remainingMs = computeRemainingMs(s);
		workspace.energyLevel = s.energy ?? 0;
		workspace.energyEditable = isActive;
		workspace.goals = [...s.goals];
		workspace.tasks = [...s.executionTasks];
		workspace.notesText = s.notes;
		workspace.activities = [...getFilteredActivity(s)];
		workspace.activityFilter = [...s.activityFilter];
		workspace.contextBindings = [...s.contextBindings];
		workspace.maxContextBindings = MAX_CONTEXT_BINDINGS;
		workspace.decisions = [...s.decisions];
		workspace.reflections = [...s.reflections];
		workspace.outputArtifacts = [...s.outputArtifacts];
		workspace.isEditable = isEditable;
		workspace.showOutputs = showOutputs;
		workspace.isInSidebar = leaf.getRoot() === app.workspace.rightSplit;
		workspace.canStart = s.status === "prepared" && !sessionService.getActiveSession();
		workspace.focusFile = s.focusFile ?? "";
		workspace.notesFile = s.notesFile ?? "";
		workspace.canvasFile = s.canvasFile ?? "";

		// Guiding questions (only for active sessions)
		if (isActive) {
			const config = resolveTypeConfig(s.type, customSessionTypes);
			workspace.guidingQuestions = [...config.guidingQuestions];
		} else {
			workspace.guidingQuestions = [];
		}

		// Intelligence stats
		const intel = computeActivityIntelligence(s);
		workspace.intelligence = {
			filesModified: intel.filesModified,
			artifactsProduced: intel.artifactsProduced,
			tasksCompleted: intel.tasksCompleted,
			eventsEmitted: intel.eventsEmitted,
			activeTimeMs: intel.activeTimeMs,
			pauseTimeMs: intel.pauseTimeMs,
		};

		// Cognitive overload
		if (s.status === "running" || s.status === "paused") {
			const result = detectCognitiveOverload(s);
			workspace.overloaded = result.overloaded;
			workspace.overloadReasons = [...result.reasons];
		} else {
			workspace.overloaded = false;
			workspace.overloadReasons = [];
		}

		// Closure data (for reviewing status)
		if (s.status === "reviewing") {
			const template = resolveClosureTemplate(s, undefined, getTypeClosureTemplates());
			workspace.closureQuestions = [...template.questions];
			workspace.trainClosure = buildTrainClosureData();
		}
	}

	// ── Render scheduling ────────────────────────────────

	function scheduleSync(): void {
		if (renderTimer !== null) clearTimeout(renderTimer);
		renderTimer = setTimeout(() => {
			renderTimer = null;
			syncToComponent();
		}, 16);
	}

	// ── Wire CustomEvents from Lit components to EventBus ─

	function wireComponentEvents(): void {
		// Action buttons
		workspace.addEventListener("action-pause", ((e: CustomEvent) => {
			void eventBus.emit("session.pause", { sessionId: e.detail.sessionId });
		}) as EventListener);

		workspace.addEventListener("action-resume", ((e: CustomEvent) => {
			void eventBus.emit("session.resume", { sessionId: e.detail.sessionId });
		}) as EventListener);

		workspace.addEventListener("action-complete", ((e: CustomEvent) => {
			void eventBus.emit("session.complete", { sessionId: e.detail.sessionId });
		}) as EventListener);

		workspace.addEventListener("action-start", ((e: CustomEvent) => {
			if (sessionService.getActiveSession()) {
				void eventBus.emit("notice.error", { message: "Another session is already active. Complete or pause it first." });
				return;
			}
			void eventBus.emit("session.start", { sessionId: e.detail.sessionId });
		}) as EventListener);

		workspace.addEventListener("action-save-template", () => {
			if (session) openSaveTemplateModal(buildHelperContext(), session);
		});

		workspace.addEventListener("action-sidebar", () => {
			openInSidebar(buildHelperContext());
		});

		workspace.addEventListener("action-tab", () => {
			openInTab(buildHelperContext());
		});

		// File links
		workspace.addEventListener("file-open", ((e: CustomEvent) => {
			openInAdjacentLeaf(buildHelperContext(), e.detail.path);
		}) as EventListener);

		workspace.addEventListener("canvas-create", () => {
			// No-op in current implementation (button exists but no handler wired in old code)
		});

		// Timer
		workspace.addEventListener("duration-change", ((e: CustomEvent) => {
			if (session) {
				void eventBus.emit("session.duration.update", {
					sessionId: session.id,
					durationMinutes: e.detail.durationMinutes,
				});
			}
		}) as EventListener);

		// Energy
		workspace.addEventListener("energy-change", ((e: CustomEvent) => {
			if (session) {
				void eventBus.emit("session.energy.set", {
					sessionId: session.id,
					level: e.detail.level as EnergyLevel,
				});
			}
		}) as EventListener);

		// Goals
		workspace.addEventListener("goal-toggle", ((e: CustomEvent) => {
			if (session) void eventBus.emit("session.goal.toggle", { sessionId: session.id, goalId: e.detail.goalId });
		}) as EventListener);

		workspace.addEventListener("goal-add", ((e: CustomEvent) => {
			if (session) void eventBus.emit("session.goal.add", { sessionId: session.id, text: e.detail.text });
		}) as EventListener);

		workspace.addEventListener("goal-remove", ((e: CustomEvent) => {
			if (session) void eventBus.emit("session.goal.remove", { sessionId: session.id, goalId: e.detail.goalId });
		}) as EventListener);

		workspace.addEventListener("goal-reorder", ((e: CustomEvent) => {
			if (session) void eventBus.emit("session.goal.reorder", { sessionId: session.id, goalIds: e.detail.goalIds });
		}) as EventListener);

		// Tasks
		workspace.addEventListener("task-toggle", ((e: CustomEvent) => {
			if (session) void eventBus.emit("session.task.toggle", { sessionId: session.id, taskId: e.detail.taskId });
		}) as EventListener);

		workspace.addEventListener("task-add", ((e: CustomEvent) => {
			if (session) void eventBus.emit("session.task.add", { sessionId: session.id, label: e.detail.label });
		}) as EventListener);

		workspace.addEventListener("task-remove", ((e: CustomEvent) => {
			if (session) void eventBus.emit("session.task.remove", { sessionId: session.id, taskId: e.detail.taskId });
		}) as EventListener);

		workspace.addEventListener("task-reorder", ((e: CustomEvent) => {
			if (session) void eventBus.emit("session.task.reorder", { sessionId: session.id, taskIds: e.detail.taskIds });
		}) as EventListener);

		// Notes
		workspace.addEventListener("notes-change", ((e: CustomEvent) => {
			if (session) void eventBus.emit("session.notes.update", { sessionId: session.id, notes: e.detail.notes });
		}) as EventListener);

		// Activity filter
		workspace.addEventListener("filter-add", ((e: CustomEvent) => {
			if (session) {
				const updated = [...session.activityFilter, e.detail.folder];
				sessionService.updateActivityFilter(session.id, updated);
			}
		}) as EventListener);

		workspace.addEventListener("filter-remove", ((e: CustomEvent) => {
			if (session) {
				const updated = session.activityFilter.filter((f) => f !== e.detail.folder);
				sessionService.updateActivityFilter(session.id, updated);
			}
		}) as EventListener);

		workspace.addEventListener("activity-open", ((e: CustomEvent) => {
			openInAdjacentLeaf(buildHelperContext(), e.detail.path);
		}) as EventListener);

		// Context
		workspace.addEventListener("context-cycle-type", ((e: CustomEvent) => {
			if (!session) return;
			const binding = session.contextBindings.find((b) => b.id === e.detail.bindingId);
			if (!binding) return;
			const currentIdx = BINDING_TYPES.indexOf(binding.type);
			const nextType = BINDING_TYPES[(currentIdx + 1) % BINDING_TYPES.length];
			void eventBus.emit("session.context.changeType", {
				sessionId: session.id,
				bindingId: binding.id,
				type: nextType,
			});
		}) as EventListener);

		workspace.addEventListener("context-open", ((e: CustomEvent) => {
			const ctx = buildHelperContext();
			if (e.detail.type === "folder") {
				revealInFileExplorer(ctx, e.detail.path);
			} else {
				openInAdjacentLeaf(ctx, e.detail.path);
			}
		}) as EventListener);

		workspace.addEventListener("context-remove", ((e: CustomEvent) => {
			if (session) {
				void eventBus.emit("session.context.unbind", {
					sessionId: session.id,
					bindingId: e.detail.bindingId,
				});
			}
		}) as EventListener);

		workspace.addEventListener("context-add", () => {
			if (!session) return;
			// Open the context binding picker (uses Obsidian FuzzySuggestModal)
			const items = app.vault.getAllLoadedFiles();
			const choices: Array<{ path: string; type: "file" | "folder" }> = [];
			for (const item of items) {
				if ("children" in item && item.path) {
					choices.push({ path: item.path + "/", type: "folder" });
				} else if ("extension" in item) {
					choices.push({ path: item.path, type: "file" });
				}
			}
			choices.sort((a, b) => a.path.localeCompare(b.path));

			// Dynamic import to avoid top-level dependency on the modal
			const { FuzzySuggestModal } = require("obsidian") as typeof import("obsidian");
			class PickerModal extends FuzzySuggestModal<{ path: string; type: "file" | "folder" }> {
				getItems() { return choices; }
				getItemText(item: { path: string }) { return item.path; }
				onChooseItem(item: { path: string; type: "file" | "folder" }) {
					void eventBus.emit("session.context.bind", {
						sessionId: session!.id,
						path: item.path,
						type: item.type,
					});
					const name = item.path.replace(/\/$/, "").split("/").pop() ?? item.path;
					void eventBus.emit("notice.success", { message: `Added "${name}" as ${item.type} context` });
				}
			}
			const modal = new PickerModal(app);
			modal.setPlaceholder("Search for a file or folder to bind...");
			modal.open();
		});

		// Decisions
		workspace.addEventListener("decision-record", ((e: CustomEvent) => {
			if (session) void eventBus.emit("session.decision.record", { sessionId: session.id, title: e.detail.title });
		}) as EventListener);

		workspace.addEventListener("decision-remove", ((e: CustomEvent) => {
			if (session) void eventBus.emit("session.decision.remove", { sessionId: session.id, decisionId: e.detail.decisionId });
		}) as EventListener);

		// Reflections
		workspace.addEventListener("reflection-add", ((e: CustomEvent) => {
			if (session) void eventBus.emit("session.reflection.add", { sessionId: session.id, type: e.detail.type, content: e.detail.content });
		}) as EventListener);

		workspace.addEventListener("reflection-remove", ((e: CustomEvent) => {
			if (session) void eventBus.emit("session.reflection.remove", { sessionId: session.id, entryId: e.detail.entryId });
		}) as EventListener);

		// Outputs
		workspace.addEventListener("output-open", ((e: CustomEvent) => {
			openInAdjacentLeaf(buildHelperContext(), e.detail.path);
		}) as EventListener);

		workspace.addEventListener("output-generate", () => {
			openOutputPicker(buildHelperContext());
		});

		// Closure
		workspace.addEventListener("closure-submit", ((e: CustomEvent) => {
			if (!session) return;
			const answers = e.detail.answers as Record<string, string>;
			const response: ClosureResponse = {
				outcomeAchieved: (answers["outcome"] as ClosureResponse["outcomeAchieved"]) ?? "partial",
				whatWorked: answers["what-worked"] ?? "",
				whatDidnt: answers["what-didnt"] ?? "",
				nextAction: answers["next-action"] ?? "",
				answers,
			};
			void sessionService.completeClosure(session.id, response);
		}) as EventListener);

		workspace.addEventListener("closure-skip", () => {
			if (session) void sessionService.skipClosure(session.id);
		});
	}

	// ── EventBus subscriptions ───────────────────────────

	function setupEventSubscriptions(): (() => void)[] {
		const unsubs: (() => void)[] = [];

		// Timer tick — direct property update (high frequency)
		unsubs.push(
			eventBus.on("session.timer.tick", (event) => {
				if (session && event.payload.sessionId === session.id) {
					workspace.remainingMs = event.payload.remainingMs;
				}
			}),
		);

		// Timer completed — immediate full sync
		unsubs.push(
			eventBus.on("session.timer.completed", () => {
				session = refreshSession();
				syncToComponent();
			}),
		);

		// Duration updated
		unsubs.push(
			eventBus.on("session.duration.updated", (event) => {
				if (event.payload.sessionId === session?.id) {
					session = refreshSession();
					scheduleSync();
				}
			}),
		);

		// Session lifecycle changes
		const lifecycleEvents = [
			"session.started", "session.paused", "session.resumed", "session.completed",
		] as const;
		for (const eventType of lifecycleEvents) {
			unsubs.push(
				eventBus.on(eventType, (event) => {
					if (event.payload.session.id === session?.id) {
						session = event.payload.session;
						scheduleSync();
					} else {
						// Other session changed — refresh canStart
						scheduleSync();
					}
				}),
			);
		}

		// Closure started/completed
		unsubs.push(
			eventBus.on("session.closure.started", (event) => {
				if (event.payload.sessionId === session?.id) {
					session = refreshSession();
					syncToComponent();
				}
			}),
		);
		unsubs.push(
			eventBus.on("session.closure.completed", (event) => {
				if (event.payload.sessionId === session?.id) {
					session = refreshSession();
					syncToComponent();
				}
			}),
		);

		// Notes file / canvas file set
		unsubs.push(
			eventBus.on("session.notesFile.updated", (event) => {
				if (event.payload.sessionId === session?.id) {
					session = refreshSession();
					scheduleSync();
				}
			}),
		);
		unsubs.push(
			eventBus.on("session.canvasFile.updated", (event) => {
				if (event.payload.sessionId === session?.id) {
					session = refreshSession();
					scheduleSync();
				}
			}),
		);

		// Context binding changes
		const contextEvents = ["session.context.bound", "session.context.unbound", "session.context.typeChanged"] as const;
		for (const eventType of contextEvents) {
			unsubs.push(
				eventBus.on(eventType, (event) => {
					if (event.payload.sessionId === session?.id) {
						session = refreshSession();
						scheduleSync();
					}
				}),
			);
		}

		// Activity filter updated
		unsubs.push(
			eventBus.on("session.activity.filter.updated", (event) => {
				if (event.payload.sessionId === session?.id) {
					session = refreshSession();
					scheduleSync();
				}
			}),
		);

		// Path reconciliation
		unsubs.push(
			eventBus.on("session.paths.updated", (event) => {
				if (session && event.payload.sessionIds.includes(session.id)) {
					session = refreshSession();
					scheduleSync();
				}
			}),
		);

		// Session deleted
		unsubs.push(
			eventBus.on("session.deleted", (event) => {
				if (event.payload.sessionId === session?.id) {
					session = null;
					syncToComponent();
				}
			}),
		);

		// Energy changed
		unsubs.push(
			eventBus.on("session.energy.changed", (event) => {
				if (event.payload.sessionId === session?.id) {
					session = refreshSession();
					workspace.energyLevel = session.energy ?? 0;
				}
			}),
		);

		// Goal changes
		const goalEvents = ["session.goal.added", "session.goal.toggled", "session.goal.removed", "session.goal.reordered"] as const;
		for (const eventType of goalEvents) {
			unsubs.push(
				eventBus.on(eventType, (event) => {
					if (event.payload.sessionId === session?.id) {
						session = refreshSession();
						workspace.goals = [...session.goals];
					}
				}),
			);
		}

		// Task changes
		const taskEvents = ["session.task.added", "session.task.completed", "session.task.removed", "session.task.reordered"] as const;
		for (const eventType of taskEvents) {
			unsubs.push(
				eventBus.on(eventType, (event) => {
					if (event.payload.sessionId === session?.id) {
						session = refreshSession();
						workspace.tasks = [...session.executionTasks];
						// Also refresh intelligence stats
						const intel = computeActivityIntelligence(session);
						workspace.intelligence = {
							filesModified: intel.filesModified,
							artifactsProduced: intel.artifactsProduced,
							tasksCompleted: intel.tasksCompleted,
							eventsEmitted: intel.eventsEmitted,
							activeTimeMs: intel.activeTimeMs,
							pauseTimeMs: intel.pauseTimeMs,
						};
					}
				}),
			);
		}

		// Decision changes
		const decisionEvents = ["session.decision.recorded", "session.decision.removed"] as const;
		for (const eventType of decisionEvents) {
			unsubs.push(
				eventBus.on(eventType, (event) => {
					if (event.payload.sessionId === session?.id) {
						session = refreshSession();
						workspace.decisions = [...session.decisions];
					}
				}),
			);
		}

		// Reflection changes
		const reflectionEvents = ["session.reflection.added", "session.reflection.removed"] as const;
		for (const eventType of reflectionEvents) {
			unsubs.push(
				eventBus.on(eventType, (event) => {
					if (event.payload.sessionId === session?.id) {
						session = refreshSession();
						workspace.reflections = [...session.reflections];
					}
				}),
			);
		}

		// Notes updated
		unsubs.push(
			eventBus.on("session.notes.updated", (event) => {
				if (event.payload.sessionId === session?.id) {
					session = refreshSession();
					workspace.notesText = session.notes;
				}
			}),
		);

		// Artifact added
		unsubs.push(
			eventBus.on("session.artifact.added", (event) => {
				if (event.payload.sessionId === session?.id) {
					session = refreshSession();
					workspace.activities = [...getFilteredActivity(session)];
				}
			}),
		);

		// Activity tracked
		unsubs.push(
			eventBus.on("session.activity.tracked", (event) => {
				if (event.payload.sessionId === session?.id) {
					session = refreshSession();
					workspace.activities = [...getFilteredActivity(session)];
					const intel = computeActivityIntelligence(session);
					workspace.intelligence = {
						filesModified: intel.filesModified,
						artifactsProduced: intel.artifactsProduced,
						tasksCompleted: intel.tasksCompleted,
						eventsEmitted: intel.eventsEmitted,
						activeTimeMs: intel.activeTimeMs,
						pauseTimeMs: intel.pauseTimeMs,
					};
				}
			}),
		);

		// Output artifact generated
		unsubs.push(
			eventBus.on("session.output.generated", (event) => {
				if (event.payload.sessionId === session?.id) {
					session = refreshSession();
					workspace.outputArtifacts = [...session.outputArtifacts];
				}
			}),
		);

		// Cognitive overload detected
		unsubs.push(
			eventBus.on("session.overload.detected", (event) => {
				if (event.payload.sessionId === session?.id) {
					if (session) {
						const result = detectCognitiveOverload(session);
						workspace.overloaded = result.overloaded;
						workspace.overloadReasons = [...result.reasons];
					}
				}
			}),
		);

		// Reverse sync from notes file
		unsubs.push(
			eventBus.on("session.notes.reverseSynced", (event) => {
				if (event.payload.sessionId === session?.id) {
					session = refreshSession();
					workspace.goals = [...session.goals];
					workspace.tasks = [...session.executionTasks];
					workspace.notesText = session.notes;
				}
			}),
		);

		// Workspace state capture/restore
		unsubs.push(
			eventBus.on("session.state.save", (event) => {
				if (event.payload.sessionId === session?.id) {
					void captureWorkspaceState(buildHelperContext(), event.payload.sessionId);
				}
			}),
		);

		unsubs.push(
			eventBus.on("session.state.restore", (event) => {
				if (event.payload.sessionId === session?.id) {
					void restoreWorkspaceState(buildHelperContext(), event.payload.sessionId, event.payload.state);
				}
			}),
		);

		return unsubs;
	}

	// ── Initialize ───────────────────────────────────────

	const targetId = sessionService.workspaceSessionId;
	session = targetId
		? sessionService.getSessionById(targetId)
		: sessionService.getActiveSession();

	if (session) {
		sessionService.workspaceSessionId = session.id;
	}

	syncToComponent();
	wireComponentEvents();
	unsubscribes = setupEventSubscriptions();

	// ── Cleanup function ─────────────────────────────────

	return function destroy(): void {
		if (renderTimer !== null) { clearTimeout(renderTimer); renderTimer = null; }
		if (session && sessionService.workspaceSessionId === session.id) {
			sessionService.workspaceSessionId = null;
		}
		for (const unsub of unsubscribes) unsub();
		unsubscribes = [];
		workspace.remove();
	};
}
