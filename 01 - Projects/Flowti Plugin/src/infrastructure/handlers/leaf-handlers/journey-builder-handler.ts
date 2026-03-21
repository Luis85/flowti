/**
 * Journey Builder leaf handler — sitemap-driven orchestrator.
 *
 * Manages the 3-state machine (welcome → setup → steps) and delegates
 * all rendering to the existing extracted sub-components.
 *
 * Step/action/export logic is in journey-builder-actions.ts.
 */

import type { PluginHandlerRegistry, TabContext } from "../plugin-handler-registry";
import type { IEventBus } from "../../events/types";
import type { EventSuggestItem } from "../../../ui/journeyBuilder/EventSuggestTypes";
import type { JourneyMetadata, JourneyStep, SidebarState } from "../../../ui/journeyBuilder/JourneyBuilderSidebar";
import type { JourneyAction } from "../../../domain/journeyBuilder/types";
import { TOOL_SCHEMAS } from "../../../domain/journeyBuilder/toolSchemas";
import { WelcomeScreen } from "../../../ui/journeyBuilder/WelcomeScreen";
import { SetupForm } from "../../../ui/journeyBuilder/SetupForm";
import { NavBar } from "../../../ui/journeyBuilder/NavBar";
import { StepCard } from "../../../ui/journeyBuilder/StepCard";
import { JSONPanel } from "../../../ui/journeyBuilder/JSONPanel";
import { ActionList } from "../../../ui/journeyBuilder/ActionList";
import { ToolPicker } from "../../../ui/journeyBuilder/ToolPicker";
import { ActionForm } from "../../../ui/journeyBuilder/ActionForm";
import { TemplatePicker } from "../../../ui/journeyBuilder/TemplatePicker";
import { CanvasSyncController } from "../../../ui/journeyBuilder/CanvasSyncController";
import { renderHeader, renderBackButton } from "../../../ui/journeyBuilder/sidebarHelpers";
import { setIcon } from "obsidian";
import type { CanvasSyncInput } from "../../../domain/journeyBuilder/canvasSync";
import {
	onAddStep, onStepFieldChanged, onStepListChanged, onRemoveStep,
	onAddAction, onTemplateSelected, onCustomFromTemplate, onToolSelected,
	onRemoveAction, onMoveAction, onSelectAction, onActionFieldChanged,
	onExport, onRunJourney, onViewInTestHub, onPreviewRun,
	type JourneyActionContext,
} from "./journey-builder-actions";

export interface JourneyBuilderHandlerDeps {
	eventBus: IEventBus;
	app: unknown;
	getEventCatalog?: () => EventSuggestItem[];
	getCommands?: () => { id: string; label: string; domain: string }[];
	getJourneyFolder?: () => string;
}

let stepCounter = 0;

interface JourneyBuilderState {
	state: SidebarState;
	metadata: JourneyMetadata;
	steps: JourneyStep[];
	currentStepIndex: number;
	selectedActionIndex: number;
	showToolPicker: boolean;
	showTemplatePicker: boolean;
	jsonPanel: JSONPanel | null;
	activeSetupForm: SetupForm | null;
	canvasSync: CanvasSyncController | null;
	updatingFromCanvas: boolean;
	unsubscribes: (() => void)[];
}

function createInitialState(): JourneyBuilderState {
	return {
		state: "welcome",
		metadata: { name: "", description: "", startEvent: "", endEvent: "" },
		steps: [], currentStepIndex: 0, selectedActionIndex: -1,
		showToolPicker: false, showTemplatePicker: false,
		jsonPanel: null, activeSetupForm: null, canvasSync: null,
		updatingFromCanvas: false, unsubscribes: [],
	};
}

export function registerJourneyBuilderHandler(
	registry: PluginHandlerRegistry,
	deps: JourneyBuilderHandlerDeps,
): void {
	registry.registerTabHandler("leaf:journey-builder", (container: HTMLElement, _ctx: TabContext) => {
		const s = createInitialState();

		function journeyFolder(): string { return deps.getJourneyFolder?.() ?? "03 - Resources/Journeys"; }
		function getCanvasPath(): string {
			if (!s.metadata.name) return "";
			return `${journeyFolder()}/${s.metadata.name}/${s.metadata.name}.canvas`;
		}

		function ensureCanvasSync(): CanvasSyncController {
			if (!s.canvasSync) {
				s.canvasSync = new CanvasSyncController({
					eventBus: deps.eventBus,
					getCanvasPath: () => getCanvasPath(),
					buildSyncInput: () => buildCanvasSyncInput(),
					getApp: () => deps.app as import("obsidian").App | undefined,
					onStepSelected: (stepIndex) => onStepSelectedOnCanvas(stepIndex),
				});
			}
			return s.canvasSync;
		}

		function buildCanvasSyncInput(): CanvasSyncInput {
			return {
				journey: s.metadata.name, description: s.metadata.description,
				startEvent: s.metadata.startEvent, endEvent: s.metadata.endEvent,
				activeStepIndex: s.currentStepIndex,
				steps: s.steps.map((st) => ({
					id: st.id, title: st.title, description: st.description,
					actions: st.actions, backgroundImage: st.backgroundImage,
				})),
			};
		}

		function buildDefinition(): {
			journey: string; description: string; startEvent: string; endEvent: string;
			steps: Array<{ id: string; title: string; description: string; swimlane: string; guideSection: number; actions: JourneyAction[]; events: string[]; commands: string[]; interactions: string[]; components: string[]; backgroundImage: string }>;
		} {
			return {
				journey: s.metadata.name, description: s.metadata.description,
				startEvent: s.metadata.startEvent, endEvent: s.metadata.endEvent,
				steps: s.steps.map((st, i) => ({
					id: st.id, title: st.title, description: st.description,
					swimlane: st.swimlane, guideSection: i + 1, actions: st.actions,
					events: st.events ?? [], commands: st.commands ?? [],
					interactions: st.interactions ?? [], components: st.components ?? [],
					backgroundImage: st.backgroundImage ?? "",
				})),
			};
		}

		// ── Action context ────────────────────────────────────

		const actCtx: JourneyActionContext = {
			eventBus: deps.eventBus,
			getSteps: () => s.steps,
			setSteps: (steps) => { s.steps = steps; },
			getCurrentStepIndex: () => s.currentStepIndex,
			setCurrentStepIndex: (i) => { s.currentStepIndex = i; },
			getSelectedActionIndex: () => s.selectedActionIndex,
			setSelectedActionIndex: (i) => { s.selectedActionIndex = i; },
			setShowToolPicker: (v) => { s.showToolPicker = v; },
			setShowTemplatePicker: (v) => { s.showTemplatePicker = v; },
			getMetadata: () => s.metadata,
			getJsonPanel: () => s.jsonPanel,
			renderSteps: () => renderSteps(),
			scheduleCanvasSync: (delay) => scheduleCanvasSync(delay),
			setPendingZoom: () => ensureCanvasSync().setPendingZoom(),
			nextStepId: () => `step-${++stepCounter}`,
			journeyFolder, buildDefinition, buildCanvasSyncInput, getCanvasPath,
		};

		// ── Canvas sync ───────────────────────────────────────

		function setCanvasSyncing(syncing: boolean): void {
			const el = container.querySelector<HTMLElement>('[data-test-id="jb-canvas-status"]');
			if (!el) return;
			if (syncing) { el.classList.add("ft-jb-canvas-syncing"); el.setAttribute("aria-busy", "true"); }
			else { el.classList.remove("ft-jb-canvas-syncing"); el.classList.add("ft-jb-canvas-ready"); el.removeAttribute("aria-busy"); setTimeout(() => el.classList.remove("ft-jb-canvas-ready"), 2000); }
		}

		function setBgSyncing(syncing: boolean): void {
			const el = container.querySelector<HTMLElement>('[data-test-id="jb-step-bg"]');
			if (!el) return;
			if (syncing) { el.classList.add("ft-jb-bg-syncing"); el.setAttribute("aria-busy", "true"); }
			else { el.classList.remove("ft-jb-bg-syncing"); el.removeAttribute("aria-busy"); }
		}

		function scheduleCanvasSync(delay?: number): void {
			if (s.updatingFromCanvas) return;
			setCanvasSyncing(true);
			ensureCanvasSync().scheduleSync(delay);
		}

		function autoSaveDefinition(): void {
			if (!s.metadata.name) return;
			const subfolder = `${journeyFolder()}/${s.metadata.name}`;
			const filePath = `${subfolder}/${s.metadata.name}.journey`;
			void deps.eventBus.emit("journey-builder.exported", { path: filePath, definition: buildDefinition() });
		}

		function renderToolbarButton(parent: HTMLElement, testId: string, icon: string, tooltip: string, onClick: () => void): void {
			const btn = parent.createSpan({ cls: "ft-jb-toolbar-btn" });
			btn.dataset.testId = testId;
			btn.setAttribute("role", "button");
			btn.setAttribute("tabindex", "0");
			btn.setAttribute("aria-label", tooltip);
			btn.title = tooltip;
			setIcon(btn, icon);
			btn.addEventListener("click", onClick);
			btn.addEventListener("keydown", (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } });
		}

		// ── Render: Welcome ──────────────────────────────────

		function renderWelcome(): void {
			s.state = "welcome";
			s.metadata = { name: "", description: "", startEvent: "", endEvent: "" };
			s.steps = []; s.currentStepIndex = 0; s.selectedActionIndex = -1;
			s.showToolPicker = false; s.showTemplatePicker = false;
			s.canvasSync?.resetCanvasPath();
			container.innerHTML = "";
			container.addClass("ft-jb-sidebar");
			renderHeader(container);
			const welcomeContainer = container.createDiv();
			new WelcomeScreen(welcomeContainer, {
				hasExistingJourneys: false,
				onCreateNew: () => { void deps.eventBus.emit("journey-builder.create-new", {}); renderSetup(); },
				onOpenExisting: () => { void deps.eventBus.emit("journey-builder.open-existing", {}); },
				onImportFromSystem: () => { void deps.eventBus.emit("journey-builder.import-from-system", {}); },
			}).render();
		}

		// ── Render: Setup ────────────────────────────────────

		function destroySetupForm(): void { s.activeSetupForm?.destroy(); s.activeSetupForm = null; }

		function renderSetup(): void {
			destroySetupForm();
			s.state = "setup";
			container.innerHTML = "";
			container.addClass("ft-jb-sidebar");
			renderHeader(container);
			const backRow = container.createDiv({ cls: "ft-jb-back-row" });
			renderBackButton(backRow, () => renderWelcome());
			renderToolbarButton(backRow, "jb-proceed-btn", "arrow-right", "Continue to steps", () => onContinue());
			const formContainer = container.createDiv();
			s.activeSetupForm = new SetupForm(formContainer, {
				metadata: s.metadata,
				onFieldChanged: (field, value) => { void deps.eventBus.emit("journey-builder.metadata.updated", { field, value }); },
				onContinue: () => onContinue(),
				getEventCatalog: deps.getEventCatalog,
			});
			s.activeSetupForm.render();
		}

		function onContinue(): void { renderSteps(); scheduleCanvasSync(); autoSaveDefinition(); }

		// ── Render: Steps ────────────────────────────────────

		function renderSteps(): void {
			destroySetupForm();
			s.state = "steps";
			container.innerHTML = "";
			container.addClass("ft-jb-sidebar");

			const header = container.createDiv({ cls: "ft-jb-header" });
			const headerLeft = header.createDiv({ cls: "ft-jb-header-left" });
			const iconEl = headerLeft.createSpan({ cls: "ft-jb-header-icon" });
			setIcon(iconEl, "route");
			const titleEl = headerLeft.createSpan({ cls: "ft-jb-header-title", text: "Journey builder" });
			titleEl.dataset.testId = "jb-header-title";

			const toolbar = header.createDiv({ cls: "ft-jb-header-toolbar" });
			toolbar.dataset.testId = "jb-header-toolbar";
			if (s.metadata.name) renderToolbarButton(toolbar, "jb-open-canvas-btn", "layout-dashboard", "Open canvas", () => {
				const canvasPath = getCanvasPath();
				const a = deps.app as { workspace?: { openLinkText: (p: string, s: string) => void } } | undefined;
				void a?.workspace?.openLinkText(canvasPath, "");
			});
			if (s.steps.length > 0) renderToolbarButton(toolbar, "jb-preview-btn", "play", "Preview run", () => void onPreviewRun(actCtx));
			renderToolbarButton(toolbar, "jb-export-btn", "download", "Export", () => onExport(actCtx));
			if (s.steps.length > 0) renderToolbarButton(toolbar, "jb-run-btn", "play-circle", "Run journey", () => onRunJourney(actCtx));
			renderToolbarButton(toolbar, "jb-view-hub-btn", "shield-check", "View in Test Hub", () => onViewInTestHub(actCtx));

			const backRow = container.createDiv({ cls: "ft-jb-back-row" });
			renderBackButton(backRow, () => renderSetup());
			const canvasStatus = backRow.createDiv({ cls: "ft-jb-canvas-status" });
			canvasStatus.dataset.testId = "jb-canvas-status";

			const navContainer = container.createDiv({ cls: "ft-jb-nav-container" });
			new NavBar(navContainer, {
				stepCount: s.steps.length, currentIndex: s.currentStepIndex,
				onPrev: () => onNavPrev(), onNext: () => onNavNext(),
				onAddStep: () => onAddStep(actCtx), onSetup: () => renderSetup(),
			}).render();

			const stepContainer = container.createDiv({ cls: "ft-jb-step-container" });
			if (s.steps.length > 0) {
				const step = s.steps[s.currentStepIndex];
				new StepCard(stepContainer, {
					step, stepNumber: s.currentStepIndex + 1, actionCount: step.actions.length,
					onTitleChanged: (title) => onStepFieldChanged(actCtx, step.id, "title", title),
					onDescriptionChanged: (desc) => onStepFieldChanged(actCtx, step.id, "description", desc),
					onSwimlanChanged: (sw) => onStepFieldChanged(actCtx, step.id, "swimlane", sw),
					onEventsChanged: (items) => onStepListChanged(actCtx, step.id, "events", items),
					onCommandsChanged: (items) => onStepListChanged(actCtx, step.id, "commands", items),
					onInteractionsChanged: (items) => onStepListChanged(actCtx, step.id, "interactions", items),
					onComponentsChanged: (items) => onStepListChanged(actCtx, step.id, "components", items),
					onRemove: () => onRemoveStep(actCtx, step.id),
					onBackgroundImageRequested: () => void 0,
					onBackgroundImageRemoved: () => { onStepFieldChanged(actCtx, step.id, "backgroundImage", ""); renderSteps(); setBgSyncing(true); },
				}).render();

				const actionContainer = container.createDiv({ cls: "ft-jb-action-container" });
				new ActionList(actionContainer, {
					actions: step.actions, selectedIndex: s.selectedActionIndex,
					onAddAction: () => onAddAction(actCtx),
					onRemoveAction: (i) => onRemoveAction(actCtx, i),
					onMoveAction: (i, dir) => onMoveAction(actCtx, i, dir),
					onSelectAction: (i) => onSelectAction(actCtx, i),
				}).render();

				if (s.showTemplatePicker) {
					const tplContainer = container.createDiv({ cls: "ft-jb-picker-container" });
					new TemplatePicker(tplContainer, {
						onTemplateSelected: (id) => onTemplateSelected(actCtx, id),
						onCustom: () => onCustomFromTemplate(actCtx),
					}).render();
				}

				if (s.showToolPicker) {
					const pickerContainer = container.createDiv({ cls: "ft-jb-picker-container" });
					new ToolPicker(pickerContainer, { onToolSelected: (tool) => onToolSelected(actCtx, tool) }).render();
				}

				if (s.selectedActionIndex >= 0 && s.selectedActionIndex < step.actions.length) {
					const action = step.actions[s.selectedActionIndex];
					const schema = TOOL_SCHEMAS[action.tool];
					if (schema) {
						const formContainer = container.createDiv({ cls: "ft-jb-form-container" });
						new ActionForm(formContainer, {
							action, schema,
							onFieldChanged: (key, value) => onActionFieldChanged(actCtx, key, value),
							getEventCatalog: deps.getEventCatalog,
							getCommands: deps.getCommands,
							onReRender: () => renderSteps(),
						}).render();
					}
				}
			} else {
				const empty = stepContainer.createDiv({ cls: "ft-jb-empty-state" });
				empty.dataset.testId = "jb-empty-steps";
				empty.textContent = "No steps yet. Click \u201cadd step\u201d to begin.";
			}

			const jsonContainer = container.createDiv({ cls: "ft-jb-json-container" });
			s.jsonPanel = new JSONPanel(jsonContainer, { getJSON: () => JSON.stringify(buildDefinition(), null, "\t") });
			s.jsonPanel.render();
		}

		// ── Navigation ──────────────────────────────────────

		function onStepSelectedOnCanvas(stepIndex: number): void {
			if (s.state !== "steps") return;
			if (stepIndex === s.currentStepIndex || stepIndex < 0 || stepIndex >= s.steps.length) return;
			s.currentStepIndex = stepIndex;
			ensureCanvasSync().setPendingZoom();
			renderSteps();
			scheduleCanvasSync(300);
		}

		function onNavPrev(): void {
			if (s.currentStepIndex > 0) { s.currentStepIndex--; ensureCanvasSync().setPendingZoom(); renderSteps(); scheduleCanvasSync(300); }
		}

		function onNavNext(): void {
			if (s.currentStepIndex < s.steps.length - 1) { s.currentStepIndex++; ensureCanvasSync().setPendingZoom(); renderSteps(); scheduleCanvasSync(300); }
		}

		// ── Canvas change handler ────────────────────────────

		function onCanvasChanged(payload: { canvasPath: string; startEvent: string; endEvent: string; steps: Array<{ title: string; description: string; backgroundImage?: string }> }): void {
			if (s.state !== "steps" || payload.canvasPath !== getCanvasPath()) return;
			s.updatingFromCanvas = true;
			try {
				s.metadata.startEvent = payload.startEvent;
				s.metadata.endEvent = payload.endEvent;
				s.steps = payload.steps.map((cs, i) => {
					const existing = s.steps[i];
					if (existing) return { ...existing, title: cs.title, description: cs.description, backgroundImage: cs.backgroundImage ?? existing.backgroundImage };
					return { id: `step-${++stepCounter}`, title: cs.title, description: cs.description, swimlane: "", actions: [], backgroundImage: cs.backgroundImage };
				});
				if (s.currentStepIndex >= s.steps.length) s.currentStepIndex = Math.max(0, s.steps.length - 1);
				renderSteps();
				autoSaveDefinition();
			} finally { s.updatingFromCanvas = false; }
		}

		function loadJourneyFromJSON(json: string): void {
			try {
				const data = JSON.parse(json) as Record<string, unknown>;
				const steps = Array.isArray(data.steps) ? data.steps : [];
				s.metadata = {
					name: (data.journey as string) ?? "", description: (data.description as string) ?? "",
					startEvent: (data.startEvent as string) ?? (steps[0]?.events as string[])?.[0] ?? "",
					endEvent: (data.endEvent as string) ?? "",
				};
				s.steps = steps.map((raw: Record<string, unknown>) => ({
					id: (raw.id as string) ?? `step-${++stepCounter}`,
					title: (raw.title as string) ?? "", description: (raw.description as string) ?? "",
					swimlane: (raw.swimlane as string) ?? "",
					actions: (Array.isArray(raw.actions) ? raw.actions : []) as JourneyAction[],
					backgroundImage: (raw.backgroundImage as string) || undefined,
				}));
				s.currentStepIndex = 0; s.selectedActionIndex = -1;
				s.showToolPicker = false; s.showTemplatePicker = false;
				s.canvasSync?.resetCanvasPath();
				renderSteps(); scheduleCanvasSync(); autoSaveDefinition();
			} catch (err) {
				void deps.eventBus.emit("notice.error", { message: `Failed to load journey: ${err instanceof Error ? err.message : String(err)}` });
				renderWelcome();
			}
		}

		// ── Event subscriptions ──────────────────────────────

		s.unsubscribes.push(deps.eventBus.on("journey-builder.canvas.synced", (event) => { ensureCanvasSync().onSynced(event.payload); setBgSyncing(false); setCanvasSyncing(false); }));
		s.unsubscribes.push(deps.eventBus.on("journey-builder.imported", (event) => { loadJourneyFromJSON(event.payload.json); }));
		s.unsubscribes.push(deps.eventBus.on("journey-builder.import-failed", () => { renderWelcome(); }));
		s.unsubscribes.push(deps.eventBus.on("journey-builder.canvas.changed", (event) => { onCanvasChanged(event.payload as Parameters<typeof onCanvasChanged>[0]); }));

		renderWelcome();
	});
}
