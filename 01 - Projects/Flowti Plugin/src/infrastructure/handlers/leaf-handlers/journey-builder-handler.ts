/**
 * Journey Builder leaf handler — sitemap-driven orchestrator.
 *
 * Manages the 3-state machine (welcome → setup → steps) and delegates
 * all rendering to the existing extracted sub-components:
 * WelcomeScreen, SetupForm, NavBar, StepCard, JSONPanel, ActionList,
 * ToolPicker, ActionForm, TemplatePicker, CanvasSyncController.
 *
 * This handler replaces the legacy JourneyBuilderSidebar ItemView
 * as the orchestration layer while reusing every sub-component unchanged.
 */

import type { PluginHandlerRegistry, TabContext } from "../plugin-handler-registry";
import type { IEventBus } from "../../events/types";
import type { EventSuggestItem } from "../../../ui/journeyBuilder/EventSuggestTypes";
import type { JourneyMetadata, JourneyStep, SidebarState } from "../../../ui/journeyBuilder/JourneyBuilderSidebar";
import type { JourneyAction, JourneyToolName } from "../../../domain/journeyBuilder/types";
import { ACTION_TEMPLATES } from "../../../domain/journeyBuilder/types";
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
import { runPreview } from "../../../domain/journeyBuilder/previewRunner";
import type { CanvasSyncInput } from "../../../domain/journeyBuilder/canvasSync";

export interface JourneyBuilderHandlerDeps {
	eventBus: IEventBus;
	app: unknown; // Obsidian App
	getEventCatalog?: () => EventSuggestItem[];
	getCommands?: () => { id: string; label: string; domain: string }[];
	getJourneyFolder?: () => string;
}

let stepCounter = 0;

/**
 * Internal state object for a single journey builder instance.
 * One is created per handler invocation (tab render).
 */
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
		steps: [],
		currentStepIndex: 0,
		selectedActionIndex: -1,
		showToolPicker: false,
		showTemplatePicker: false,
		jsonPanel: null,
		activeSetupForm: null,
		canvasSync: null,
		updatingFromCanvas: false,
		unsubscribes: [],
	};
}

export function registerJourneyBuilderHandler(
	registry: PluginHandlerRegistry,
	deps: JourneyBuilderHandlerDeps,
): void {
	registry.registerTabHandler("leaf:journey-builder", (container: HTMLElement, _ctx: TabContext) => {
		const s = createInitialState();

		// ── Helpers ───────────────────────────────────────────

		function journeyFolder(): string {
			return deps.getJourneyFolder?.() ?? "03 - Resources/Journeys";
		}

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
				journey: s.metadata.name,
				description: s.metadata.description,
				startEvent: s.metadata.startEvent,
				endEvent: s.metadata.endEvent,
				activeStepIndex: s.currentStepIndex,
				steps: s.steps.map((st) => ({
					id: st.id,
					title: st.title,
					description: st.description,
					actions: st.actions,
					backgroundImage: st.backgroundImage,
				})),
			};
		}

		function buildDefinition(): {
			journey: string;
			description: string;
			startEvent: string;
			endEvent: string;
			steps: {
				id: string; title: string; description: string; swimlane: string;
				guideSection: number; actions: JourneyAction[]; events: string[];
				commands: string[]; interactions: string[]; components: string[];
				backgroundImage: string;
			}[];
		} {
			return {
				journey: s.metadata.name,
				description: s.metadata.description,
				startEvent: s.metadata.startEvent,
				endEvent: s.metadata.endEvent,
				steps: s.steps.map((st, i) => ({
					id: st.id,
					title: st.title,
					description: st.description,
					swimlane: st.swimlane,
					guideSection: i + 1,
					actions: st.actions,
					events: st.events ?? [],
					commands: st.commands ?? [],
					interactions: st.interactions ?? [],
					components: st.components ?? [],
					backgroundImage: st.backgroundImage ?? "",
				})),
			};
		}

		// ── Canvas sync scheduling ───────────────────────────

		function setCanvasSyncing(syncing: boolean): void {
			const el = container.querySelector<HTMLElement>('[data-test-id="jb-canvas-status"]');
			if (!el) return;
			if (syncing) {
				el.classList.add("ft-jb-canvas-syncing");
				el.setAttribute("aria-busy", "true");
			} else {
				el.classList.remove("ft-jb-canvas-syncing");
				el.classList.add("ft-jb-canvas-ready");
				el.removeAttribute("aria-busy");
				setTimeout(() => el.classList.remove("ft-jb-canvas-ready"), 2000);
			}
		}

		function setBgSyncing(syncing: boolean): void {
			const el = container.querySelector<HTMLElement>('[data-test-id="jb-step-bg"]');
			if (!el) return;
			if (syncing) {
				el.classList.add("ft-jb-bg-syncing");
				el.setAttribute("aria-busy", "true");
			} else {
				el.classList.remove("ft-jb-bg-syncing");
				el.removeAttribute("aria-busy");
			}
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
			void deps.eventBus.emit("journey-builder.exported", {
				path: filePath,
				definition: buildDefinition(),
			});
		}

		// ── Toolbar button helper ────────────────────────────

		function renderToolbarButton(
			parent: HTMLElement, testId: string, icon: string, tooltip: string, onClick: () => void,
		): void {
			// setIcon imported at module scope
			const btn = parent.createSpan({ cls: "ft-jb-toolbar-btn" });
			btn.dataset.testId = testId;
			btn.setAttribute("role", "button");
			btn.setAttribute("tabindex", "0");
			btn.setAttribute("aria-label", tooltip);
			btn.title = tooltip;
			setIcon(btn, icon);
			btn.addEventListener("click", onClick);
			btn.addEventListener("keydown", (e: KeyboardEvent) => {
				if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); }
			});
		}

		// ── Render: Welcome ──────────────────────────────────

		function renderWelcome(): void {
			s.state = "welcome";
			s.metadata = { name: "", description: "", startEvent: "", endEvent: "" };
			s.steps = [];
			s.currentStepIndex = 0;
			s.selectedActionIndex = -1;
			s.showToolPicker = false;
			s.showTemplatePicker = false;
			s.canvasSync?.resetCanvasPath();
			container.innerHTML = "";
			container.addClass("ft-jb-sidebar");

			renderHeader(container);

			const welcomeContainer = container.createDiv();
			new WelcomeScreen(welcomeContainer, {
				hasExistingJourneys: false, // Handler does not access vault file list directly
				onCreateNew: () => onCreateNew(),
				onOpenExisting: () => onOpenExisting(),
				onImportFromSystem: () => onImportFromSystem(),
			}).render();
		}

		// ── Render: Setup ────────────────────────────────────

		function destroySetupForm(): void {
			s.activeSetupForm?.destroy();
			s.activeSetupForm = null;
		}

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
				onFieldChanged: (field, value) => emitMetadataUpdate(field, value),
				onContinue: () => onContinue(),
				getEventCatalog: deps.getEventCatalog,
			});
			s.activeSetupForm.render();
		}

		// ── Render: Steps ────────────────────────────────────

		function renderSteps(): void {
			destroySetupForm();
			s.state = "steps";
			container.innerHTML = "";
			container.addClass("ft-jb-sidebar");

			// Header with toolbar
			// setIcon imported at module scope
			const header = container.createDiv({ cls: "ft-jb-header" });
			const headerLeft = header.createDiv({ cls: "ft-jb-header-left" });
			const iconEl = headerLeft.createSpan({ cls: "ft-jb-header-icon" });
			setIcon(iconEl, "route");
			const titleEl = headerLeft.createSpan({ cls: "ft-jb-header-title", text: "Journey builder" });
			titleEl.dataset.testId = "jb-header-title";

			const toolbar = header.createDiv({ cls: "ft-jb-header-toolbar" });
			toolbar.dataset.testId = "jb-header-toolbar";
			if (s.metadata.name) {
				renderToolbarButton(toolbar, "jb-open-canvas-btn", "layout-dashboard", "Open canvas", () => onOpenCanvas());
			}
			if (s.steps.length > 0) {
				renderToolbarButton(toolbar, "jb-preview-btn", "play", "Preview run", () => void onPreviewRun());
			}
			renderToolbarButton(toolbar, "jb-export-btn", "download", "Export", () => onExport());
			if (s.steps.length > 0) {
				renderToolbarButton(toolbar, "jb-run-btn", "play-circle", "Run journey", () => onRunJourney());
			}
			renderToolbarButton(toolbar, "jb-view-hub-btn", "shield-check", "View in Test Hub", () => onViewInTestHub());

			// Back row
			const backRow = container.createDiv({ cls: "ft-jb-back-row" });
			renderBackButton(backRow, () => renderSetup());
			const canvasStatus = backRow.createDiv({ cls: "ft-jb-canvas-status" });
			canvasStatus.dataset.testId = "jb-canvas-status";

			// NavBar
			const navContainer = container.createDiv({ cls: "ft-jb-nav-container" });
			new NavBar(navContainer, {
				stepCount: s.steps.length,
				currentIndex: s.currentStepIndex,
				onPrev: () => onNavPrev(),
				onNext: () => onNavNext(),
				onAddStep: () => onAddStep(),
				onSetup: () => renderSetup(),
			}).render();

			// StepCard or empty
			const stepContainer = container.createDiv({ cls: "ft-jb-step-container" });
			if (s.steps.length > 0) {
				const step = s.steps[s.currentStepIndex];
				new StepCard(stepContainer, {
					step,
					stepNumber: s.currentStepIndex + 1,
					actionCount: step.actions.length,
					onTitleChanged: (title) => onStepFieldChanged(step.id, "title", title),
					onDescriptionChanged: (desc) => onStepFieldChanged(step.id, "description", desc),
					onSwimlanChanged: (sw) => onStepFieldChanged(step.id, "swimlane", sw),
					onEventsChanged: (items) => onStepListChanged(step.id, "events", items),
					onCommandsChanged: (items) => onStepListChanged(step.id, "commands", items),
					onInteractionsChanged: (items) => onStepListChanged(step.id, "interactions", items),
					onComponentsChanged: (items) => onStepListChanged(step.id, "components", items),
					onRemove: () => onRemoveStep(step.id),
					onBackgroundImageRequested: () => void 0,
					onBackgroundImageRemoved: () => {
						onStepFieldChanged(step.id, "backgroundImage", "");
						renderSteps();
						setBgSyncing(true);
					},
				}).render();

				// ActionList
				const actionContainer = container.createDiv({ cls: "ft-jb-action-container" });
				new ActionList(actionContainer, {
					actions: step.actions,
					selectedIndex: s.selectedActionIndex,
					onAddAction: () => onAddAction(),
					onRemoveAction: (i) => onRemoveAction(i),
					onMoveAction: (i, dir) => onMoveAction(i, dir),
					onSelectAction: (i) => onSelectAction(i),
				}).render();

				// TemplatePicker
				if (s.showTemplatePicker) {
					const tplContainer = container.createDiv({ cls: "ft-jb-picker-container" });
					new TemplatePicker(tplContainer, {
						onTemplateSelected: (id) => onTemplateSelected(id),
						onCustom: () => onCustomFromTemplate(),
					}).render();
				}

				// ToolPicker
				if (s.showToolPicker) {
					const pickerContainer = container.createDiv({ cls: "ft-jb-picker-container" });
					new ToolPicker(pickerContainer, {
						onToolSelected: (tool) => onToolSelected(tool),
					}).render();
				}

				// ActionForm
				if (s.selectedActionIndex >= 0 && s.selectedActionIndex < step.actions.length) {
					const action = step.actions[s.selectedActionIndex];
					const schema = TOOL_SCHEMAS[action.tool];
					if (schema) {
						const formContainer = container.createDiv({ cls: "ft-jb-form-container" });
						new ActionForm(formContainer, {
							action,
							schema,
							onFieldChanged: (key, value) => onActionFieldChanged(key, value),
							getEventCatalog: deps.getEventCatalog,
							getCommands: deps.getCommands,
							onReRender: () => renderSteps(),
						}).render();
					}
				}
			} else {
				const empty = stepContainer.createDiv({ cls: "ft-jb-empty-state" });
				empty.dataset.testId = "jb-empty-steps";
				empty.textContent = "No steps yet. Click \"Add step\" to begin.";
			}

			// JSONPanel
			const jsonContainer = container.createDiv({ cls: "ft-jb-json-container" });
			s.jsonPanel = new JSONPanel(jsonContainer, {
				getJSON: () => JSON.stringify(buildDefinition(), null, "\t"),
			});
			s.jsonPanel.render();
		}

		// ── Event handlers ───────────────────────────────────

		function onCreateNew(): void {
			void deps.eventBus.emit("journey-builder.create-new", {});
			renderSetup();
		}

		function onOpenExisting(): void {
			void deps.eventBus.emit("journey-builder.open-existing", {});
		}

		function onImportFromSystem(): void {
			// Electron file dialog — delegated via event
			void deps.eventBus.emit("journey-builder.import-from-system", {});
		}

		function onContinue(): void {
			renderSteps();
			scheduleCanvasSync();
			autoSaveDefinition();
		}

		function emitMetadataUpdate(field: string, value: string): void {
			void deps.eventBus.emit("journey-builder.metadata.updated", { field, value });
		}

		function onStepSelectedOnCanvas(stepIndex: number): void {
			if (s.state !== "steps") return;
			if (stepIndex === s.currentStepIndex) return;
			if (stepIndex < 0 || stepIndex >= s.steps.length) return;
			s.currentStepIndex = stepIndex;
			ensureCanvasSync().setPendingZoom();
			renderSteps();
			scheduleCanvasSync(300);
		}

		function onNavPrev(): void {
			if (s.currentStepIndex > 0) {
				s.currentStepIndex--;
				ensureCanvasSync().setPendingZoom();
				renderSteps();
				scheduleCanvasSync(300);
			}
		}

		function onNavNext(): void {
			if (s.currentStepIndex < s.steps.length - 1) {
				s.currentStepIndex++;
				ensureCanvasSync().setPendingZoom();
				renderSteps();
				scheduleCanvasSync(300);
			}
		}

		function onAddStep(): void {
			const id = `step-${++stepCounter}`;
			const step: JourneyStep = { id, title: "", description: "", swimlane: "", actions: [] };
			s.steps.push(step);
			s.currentStepIndex = s.steps.length - 1;
			ensureCanvasSync().setPendingZoom();
			void deps.eventBus.emit("journey-builder.step.added", { stepId: id, title: "" });
			renderSteps();
			scheduleCanvasSync(300);
		}

		function onStepFieldChanged(stepId: string, field: string, value: string): void {
			const step = s.steps.find((st) => st.id === stepId);
			if (step) {
				(step as unknown as Record<string, unknown>)[field] = value;
				void deps.eventBus.emit("journey-builder.step.updated", { stepId, field, value });
				s.jsonPanel?.update();
				scheduleCanvasSync();
			}
		}

		function onStepListChanged(stepId: string, field: string, items: string[]): void {
			const step = s.steps.find((st) => st.id === stepId);
			if (step) {
				(step as unknown as Record<string, unknown>)[field] = items;
				void deps.eventBus.emit("journey-builder.step.updated", { stepId, field, value: items });
				s.jsonPanel?.update();
				scheduleCanvasSync();
			}
		}

		function onRemoveStep(stepId: string): void {
			s.steps = s.steps.filter((st) => st.id !== stepId);
			if (s.currentStepIndex >= s.steps.length) {
				s.currentStepIndex = Math.max(0, s.steps.length - 1);
			}
			s.selectedActionIndex = -1;
			s.showToolPicker = false;
			s.showTemplatePicker = false;
			renderSteps();
			scheduleCanvasSync();
		}

		// ── Action handlers ──────────────────────────────────

		function onAddAction(): void {
			s.showTemplatePicker = true;
			s.showToolPicker = false;
			s.selectedActionIndex = -1;
			renderSteps();
		}

		function onTemplateSelected(templateId: string): void {
			const step = s.steps[s.currentStepIndex];
			if (!step) return;
			const template = ACTION_TEMPLATES.find((t) => t.id === templateId);
			if (!template) return;
			const actions = template.actions.map((a) => ({ ...a }));
			step.actions.push(...actions);
			s.selectedActionIndex = step.actions.length - actions.length;
			s.showTemplatePicker = false;
			for (const a of actions) {
				void deps.eventBus.emit("journey-builder.action.added", { stepId: step.id, tool: a.tool });
			}
			renderSteps();
			scheduleCanvasSync();
		}

		function onCustomFromTemplate(): void {
			s.showTemplatePicker = false;
			s.showToolPicker = true;
			renderSteps();
		}

		function onToolSelected(tool: JourneyToolName): void {
			const step = s.steps[s.currentStepIndex];
			if (!step) return;
			const action: JourneyAction = { tool };
			step.actions.push(action);
			s.selectedActionIndex = step.actions.length - 1;
			s.showToolPicker = false;
			void deps.eventBus.emit("journey-builder.action.added", { stepId: step.id, tool });
			renderSteps();
			scheduleCanvasSync();
		}

		function onRemoveAction(index: number): void {
			const step = s.steps[s.currentStepIndex];
			if (!step) return;
			step.actions.splice(index, 1);
			if (s.selectedActionIndex >= step.actions.length) {
				s.selectedActionIndex = Math.max(-1, step.actions.length - 1);
			}
			renderSteps();
			scheduleCanvasSync();
		}

		function onMoveAction(fromIndex: number, direction: "up" | "down"): void {
			const step = s.steps[s.currentStepIndex];
			if (!step) return;
			const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
			if (toIndex < 0 || toIndex >= step.actions.length) return;
			const [moved] = step.actions.splice(fromIndex, 1);
			step.actions.splice(toIndex, 0, moved);
			if (s.selectedActionIndex === fromIndex) {
				s.selectedActionIndex = toIndex;
			}
			renderSteps();
		}

		function onSelectAction(index: number): void {
			s.selectedActionIndex = index;
			s.showToolPicker = false;
			s.showTemplatePicker = false;
			renderSteps();
		}

		function onActionFieldChanged(key: string, value: string | number): void {
			const step = s.steps[s.currentStepIndex];
			if (!step || s.selectedActionIndex < 0) return;
			const action = step.actions[s.selectedActionIndex];
			if (!action) return;
			if (key === "description") {
				action.description = String(value);
			} else {
				action[key] = value;
			}
			s.jsonPanel?.update();
			scheduleCanvasSync();
		}

		// ── Export / run / view ──────────────────────────────

		function onExport(): void {
			const name = s.metadata.name;
			const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
			const subfolder = `${journeyFolder()}/${name}`;
			const filePath = `${subfolder}/${name}.journey`;
			const testFilePath = `tests/e2e/90-journey-${slug}.test.ts`;
			const canvasPath = `${subfolder}/${name}.canvas`;
			const definition = buildDefinition();
			void deps.eventBus.emit("journey-builder.exported", {
				path: filePath, testFilePath, canvasPath, definition,
			});
			void deps.eventBus.emit("notice.success", {
				message: `Exported "${name}" — JSON, test file, and canvas`,
			});
		}

		function onRunJourney(): void {
			const name = s.metadata.name;
			if (!name || s.steps.length === 0) return;
			const subfolder = `${journeyFolder()}/${name}`;
			void deps.eventBus.emit("ui.runJourney", {
				journeyName: name,
				jsonPath: `${subfolder}/${name}.journey`,
				canvasPath: getCanvasPath(),
			});
		}

		function onViewInTestHub(): void {
			void deps.eventBus.emit("ui.openTestManagementHub", {});
			if (s.metadata.name) {
				void deps.eventBus.emit("hub.navigate", {
					hubId: "test-management",
					tabId: "journeys",
					entityId: s.metadata.name,
				});
			}
		}

		function onOpenCanvas(): void {
			const canvasPath = getCanvasPath();
			const app = deps.app as { workspace?: { openLinkText: (path: string, src: string) => void } } | undefined;
			void app?.workspace?.openLinkText(canvasPath, "");
		}

		// ── Preview run ──────────────────────────────────────

		async function onPreviewRun(): Promise<void> {
			if (s.steps.length === 0) return;
			const result = runPreview(s.steps);
			void deps.eventBus.emit("journey-builder.preview.started", {
				stepCount: s.steps.length,
			});

			const stepColors: Record<number, string> = {};
			for (let i = 0; i < result.steps.length; i++) {
				const stepResult = result.steps[i];
				stepColors[i] = "5";
				syncCanvasWithColors({ ...stepColors });
				await new Promise<void>((resolve) => setTimeout(resolve, 300));
				stepColors[i] = stepResult.status === "pass" ? "4" : "1";
				syncCanvasWithColors({ ...stepColors });
				void deps.eventBus.emit("journey-builder.preview.step-completed", {
					stepIndex: stepResult.stepIndex,
					status: stepResult.status,
					errors: stepResult.errors,
				});
			}

			void deps.eventBus.emit("journey-builder.preview.completed", {
				totalSteps: result.totalSteps,
				passed: result.passed,
				failed: result.failed,
			});

			const noticeType = result.failed === 0 ? "notice.success" : "notice.error";
			void deps.eventBus.emit(noticeType as "notice.success", {
				message: `Preview: ${result.passed}/${result.totalSteps} steps passed${
					result.failed > 0 ? `, ${result.failed} failed` : ""
				}`,
			});
		}

		function syncCanvasWithColors(stepColors: Record<number, string>): void {
			const canvasPath = getCanvasPath();
			if (!canvasPath) return;
			const input = buildCanvasSyncInput();
			input.stepColors = stepColors;
			void deps.eventBus.emit("journey-builder.canvas.sync-requested", {
				canvasPath,
				definition: input,
			});
		}

		// ── Canvas change handler ────────────────────────────

		function onCanvasChanged(payload: { canvasPath: string; startEvent: string; endEvent: string; steps: Array<{ title: string; description: string; backgroundImage?: string }> }): void {
			if (s.state !== "steps") return;
			if (payload.canvasPath !== getCanvasPath()) return;

			s.updatingFromCanvas = true;
			try {
				s.metadata.startEvent = payload.startEvent;
				s.metadata.endEvent = payload.endEvent;

				s.steps = payload.steps.map((cs, i) => {
					const existing = s.steps[i];
					if (existing) {
						return {
							...existing,
							title: cs.title,
							description: cs.description,
							backgroundImage: cs.backgroundImage ?? existing.backgroundImage,
						};
					}
					return {
						id: `step-${++stepCounter}`,
						title: cs.title,
						description: cs.description,
						swimlane: "",
						actions: [],
						backgroundImage: cs.backgroundImage,
					};
				});

				if (s.currentStepIndex >= s.steps.length) {
					s.currentStepIndex = Math.max(0, s.steps.length - 1);
				}

				renderSteps();
				autoSaveDefinition();
			} finally {
				s.updatingFromCanvas = false;
			}
		}

		// ── Load journey from JSON ───────────────────────────

		function loadJourneyFromJSON(json: string): void {
			try {
				const data = JSON.parse(json) as Record<string, unknown>;
				const steps = Array.isArray(data.steps) ? data.steps : [];
				s.metadata = {
					name: (data.journey as string) ?? "",
					description: (data.description as string) ?? "",
					startEvent: (data.startEvent as string)
						?? (steps[0]?.events as string[])?.[0]
						?? "",
					endEvent: (data.endEvent as string) ?? "",
				};
				s.steps = steps.map((raw: Record<string, unknown>) => ({
					id: (raw.id as string) ?? `step-${++stepCounter}`,
					title: (raw.title as string) ?? "",
					description: (raw.description as string) ?? "",
					swimlane: (raw.swimlane as string) ?? "",
					actions: (Array.isArray(raw.actions) ? raw.actions : []) as JourneyAction[],
					backgroundImage: (raw.backgroundImage as string) || undefined,
				}));
				s.currentStepIndex = 0;
				s.selectedActionIndex = -1;
				s.showToolPicker = false;
				s.showTemplatePicker = false;
				s.canvasSync?.resetCanvasPath();
				renderSteps();
				scheduleCanvasSync();
				autoSaveDefinition();
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				void deps.eventBus.emit("notice.error", {
					message: `Failed to load journey: ${message}`,
				});
				renderWelcome();
			}
		}

		// ── Event subscriptions ──────────────────────────────

		s.unsubscribes.push(
			deps.eventBus.on("journey-builder.canvas.synced", (event) => {
				ensureCanvasSync().onSynced(event.payload);
				setBgSyncing(false);
				setCanvasSyncing(false);
			}),
		);

		s.unsubscribes.push(
			deps.eventBus.on("journey-builder.imported", (event) => {
				loadJourneyFromJSON(event.payload.json);
			}),
		);

		s.unsubscribes.push(
			deps.eventBus.on("journey-builder.import-failed", () => {
				renderWelcome();
			}),
		);

		s.unsubscribes.push(
			deps.eventBus.on("journey-builder.canvas.changed", (event) => {
				onCanvasChanged(event.payload as Parameters<typeof onCanvasChanged>[0]);
			}),
		);

		// ── Initial render ───────────────────────────────────

		renderWelcome();
	});
}
