/**
 * Step editor rendering logic extracted from JourneyBuilderSidebar.
 *
 * Renders the step card, action list, pickers, and action form
 * for the currently active step.
 */
import { setIcon } from "obsidian";
import { TOOL_SCHEMAS } from "../../domain/journeyBuilder/toolSchemas";
import type { EventSuggestItem } from "./EventSuggestTypes";
import { NavBar } from "./NavBar";
import { StepCard } from "./StepCard";
import { JSONPanel } from "./JSONPanel";
import { ActionList } from "./ActionList";
import { ToolPicker } from "./ToolPicker";
import { ActionForm } from "./ActionForm";
import { TemplatePicker } from "./TemplatePicker";
import { renderBackButton, renderToolbarButton } from "./sidebarHelpers";
import type { JourneyStep, JourneyMetadata } from "./JourneyBuilderSidebar";
import {
	handleNavPrev, handleNavNext, handleAddStep,
	handleStepFieldChanged, handleBackgroundImageRequested,
	handleStepListChanged, handleRemoveStep,
	handleAddAction, handleTemplateSelected, handleCustomFromTemplate,
	handleToolSelected, handleRemoveAction, handleMoveAction,
	handleSelectAction, handleActionFieldChanged,
	handleExport, handleRunJourney, handleViewInTestHub,
	handlePreviewRun,
	type SidebarContext,
} from "./sidebarEventHandlers";

export interface StepRendererDeps {
	metadata: JourneyMetadata;
	steps: JourneyStep[];
	currentStepIndex: number;
	selectedActionIndex: number;
	showToolPicker: boolean;
	showTemplatePicker: boolean;
	getEventCatalog: (() => EventSuggestItem[]) | undefined;
	getCommands: (() => { id: string; label: string; domain: string }[]) | undefined;
	getCanvasPath: () => string;
	ctx: () => SidebarContext;
	renderSetup: () => void;
	renderSteps: () => void;
	setBgSyncing: (v: boolean) => void;
	buildDefinition: () => Record<string, unknown>;
	openCanvasPath: () => void;
}

/** Renders the step editor header with toolbar buttons. */
export function renderStepsHeader(el: HTMLElement, deps: StepRendererDeps): void {
	const header = el.createDiv({ cls: "ft-jb-header" });
	const headerLeft = header.createDiv({ cls: "ft-jb-header-left" });
	const iconEl = headerLeft.createSpan({ cls: "ft-jb-header-icon" });
	setIcon(iconEl, "route");
	const titleEl = headerLeft.createSpan({ cls: "ft-jb-header-title", text: "Journey builder" });
	titleEl.dataset.testId = "jb-header-title";
	const toolbar = header.createDiv({ cls: "ft-jb-header-toolbar" });
	toolbar.dataset.testId = "jb-header-toolbar";
	if (deps.metadata.name) renderToolbarButton(toolbar, "jb-open-canvas-btn", "layout-dashboard", "Open canvas", () => deps.openCanvasPath());
	if (deps.steps.length > 0) renderToolbarButton(toolbar, "jb-preview-btn", "play", "Preview run", () => void handlePreviewRun(deps.ctx()));
	renderToolbarButton(toolbar, "jb-export-btn", "download", "Export", () => handleExport(deps.ctx()));
	if (deps.steps.length > 0) renderToolbarButton(toolbar, "jb-run-btn", "play-circle", "Run journey", () => handleRunJourney(deps.ctx()));
	renderToolbarButton(toolbar, "jb-view-hub-btn", "shield-check", "View in Test Hub", () => handleViewInTestHub(deps.ctx()));
	const backRow = el.createDiv({ cls: "ft-jb-back-row" });
	renderBackButton(backRow, () => deps.renderSetup());
	const canvasStatus = backRow.createDiv({ cls: "ft-jb-canvas-status" });
	canvasStatus.dataset.testId = "jb-canvas-status";
}

/** Renders the step navigation bar. */
export function renderStepsNavigation(el: HTMLElement, deps: StepRendererDeps): void {
	const navContainer = el.createDiv({ cls: "ft-jb-nav-container" });
	new NavBar(navContainer, {
		stepCount: deps.steps.length,
		currentIndex: deps.currentStepIndex,
		onPrev: () => handleNavPrev(deps.ctx()),
		onNext: () => handleNavNext(deps.ctx()),
		onAddStep: () => handleAddStep(deps.ctx()),
		onSetup: () => deps.renderSetup(),
	}).render();
}

/** Renders the active step card and its action editors. */
export function renderStepsContent(el: HTMLElement, deps: StepRendererDeps): void {
	const stepContainer = el.createDiv({ cls: "ft-jb-step-container" });
	if (deps.steps.length === 0) {
		const empty = stepContainer.createDiv({ cls: "ft-jb-empty-state" });
		empty.dataset.testId = "jb-empty-steps";
		empty.textContent = "No steps yet. Click \"Add step\" to begin."; // eslint-disable-line obsidianmd/ui/sentence-case -- button name
		return;
	}
	const step = deps.steps[deps.currentStepIndex];
	const c = deps.ctx();
	new StepCard(stepContainer, {
		step, stepNumber: deps.currentStepIndex + 1, actionCount: step.actions.length,
		onTitleChanged: (title) => handleStepFieldChanged(c, step.id, "title", title),
		onDescriptionChanged: (desc) => handleStepFieldChanged(c, step.id, "description", desc),
		onSwimlanChanged: (sw) => handleStepFieldChanged(c, step.id, "swimlane", sw),
		onEventsChanged: (items) => handleStepListChanged(c, step.id, "events", items),
		onCommandsChanged: (items) => handleStepListChanged(c, step.id, "commands", items),
		onInteractionsChanged: (items) => handleStepListChanged(c, step.id, "interactions", items),
		onComponentsChanged: (items) => handleStepListChanged(c, step.id, "components", items),
		onRemove: () => handleRemoveStep(c, step.id),
		onBackgroundImageRequested: () => handleBackgroundImageRequested(c, step.id),
		onBackgroundImageRemoved: () => { handleStepFieldChanged(c, step.id, "backgroundImage", ""); deps.renderSteps(); deps.setBgSyncing(true); },
	}).render();
	renderStepActions(el, step, deps);
}

/** Renders the action list, pickers, and action form for a step. */
function renderStepActions(el: HTMLElement, step: JourneyStep, deps: StepRendererDeps): void {
	const c = deps.ctx();
	const actionContainer = el.createDiv({ cls: "ft-jb-action-container" });
	new ActionList(actionContainer, {
		actions: step.actions, selectedIndex: deps.selectedActionIndex,
		onAddAction: () => handleAddAction(c),
		onRemoveAction: (i) => handleRemoveAction(c, i),
		onMoveAction: (i, dir) => handleMoveAction(c, i, dir),
		onSelectAction: (i) => handleSelectAction(c, i),
	}).render();
	if (deps.showTemplatePicker) {
		const tplContainer = el.createDiv({ cls: "ft-jb-picker-container" });
		new TemplatePicker(tplContainer, {
			onTemplateSelected: (id) => handleTemplateSelected(c, id),
			onCustom: () => handleCustomFromTemplate(c),
		}).render();
	}
	if (deps.showToolPicker) {
		const pickerContainer = el.createDiv({ cls: "ft-jb-picker-container" });
		new ToolPicker(pickerContainer, { onToolSelected: (tool) => handleToolSelected(c, tool) }).render();
	}
	if (deps.selectedActionIndex >= 0 && deps.selectedActionIndex < step.actions.length) {
		const action = step.actions[deps.selectedActionIndex];
		const schema = TOOL_SCHEMAS[action.tool];
		if (schema) {
			const formContainer = el.createDiv({ cls: "ft-jb-form-container" });
			new ActionForm(formContainer, {
				action, schema,
				onFieldChanged: (key, value) => handleActionFieldChanged(c, key, value),
				getEventCatalog: deps.getEventCatalog,
				getCommands: deps.getCommands,
				onReRender: () => deps.renderSteps(),
			}).render();
		}
	}
}

/** Renders the JSON panel at the bottom. */
export function renderJsonPanel(el: HTMLElement, deps: StepRendererDeps): JSONPanel {
	const jsonContainer = el.createDiv({ cls: "ft-jb-json-container" });
	const panel = new JSONPanel(jsonContainer, { getJSON: () => JSON.stringify(deps.buildDefinition(), null, "\t") });
	panel.render();
	return panel;
}
