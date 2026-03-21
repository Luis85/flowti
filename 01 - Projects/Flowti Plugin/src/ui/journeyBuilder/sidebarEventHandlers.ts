/**
 * Event handler methods extracted from JourneyBuilderSidebar.
 *
 * These are standalone functions that receive a "context" object
 * containing the sidebar's state and dependencies to avoid
 * circular references.
 */
import type { JourneyAction, JourneyToolName } from "../../domain/journeyBuilder/types";
import { ACTION_TEMPLATES } from "../../domain/journeyBuilder/types";
import { runPreview } from "../../domain/journeyBuilder/previewRunner";
import type { IEventBus } from "../../infrastructure/events/types";
import type { CanvasSyncController } from "./CanvasSyncController";
import type { JourneyStep, JourneyMetadata } from "./JourneyBuilderSidebar";
import type { CanvasSyncInput } from "../../domain/journeyBuilder/canvasSync";
import { IMAGE_EXTENSIONS, ImagePickerModal } from "./sidebarModals";
import type { JourneyExportPayload } from "../../domain/journeyBuilder/events";
import type { App } from "obsidian";

export interface SidebarContext {
	app: App;
	eventBus: IEventBus;
	metadata: JourneyMetadata;
	steps: JourneyStep[];
	currentStepIndex: number;
	selectedActionIndex: number;
	showToolPicker: boolean;
	showTemplatePicker: boolean;
	updatingFromCanvas: boolean;
	getCanvasPath: () => string;
	journeyFolder: () => string;
	ensureCanvasSync: () => CanvasSyncController;
	buildCanvasSyncInput: () => CanvasSyncInput;
	renderSteps: () => void;
	renderSetup: () => void;
	scheduleCanvasSync: (delay?: number) => void;
	autoSaveDefinition: () => void;
	setCanvasSyncing: (syncing: boolean) => void;
	setBgSyncing: (syncing: boolean) => void;
	buildDefinition: () => JourneyExportPayload["definition"];
	getJsonPanel: () => { update: () => void } | null;
	setSteps: (steps: JourneyStep[]) => void;
	setCurrentStepIndex: (i: number) => void;
	setSelectedActionIndex: (i: number) => void;
	setShowToolPicker: (v: boolean) => void;
	setShowTemplatePicker: (v: boolean) => void;
}

let stepCounter = 0;

export function resetStepCounter(): void {
	stepCounter = 0;
}

export function nextStepId(): string {
	return `step-${++stepCounter}`;
}

export function handleNavPrev(ctx: SidebarContext): void {
	if (ctx.currentStepIndex > 0) {
		ctx.setCurrentStepIndex(ctx.currentStepIndex - 1);
		ctx.ensureCanvasSync().setPendingZoom();
		ctx.renderSteps();
		ctx.scheduleCanvasSync(300);
	}
}

export function handleNavNext(ctx: SidebarContext): void {
	if (ctx.currentStepIndex < ctx.steps.length - 1) {
		ctx.setCurrentStepIndex(ctx.currentStepIndex + 1);
		ctx.ensureCanvasSync().setPendingZoom();
		ctx.renderSteps();
		ctx.scheduleCanvasSync(300);
	}
}

export function handleAddStep(ctx: SidebarContext): void {
	const id = nextStepId();
	const step: JourneyStep = { id, title: "", description: "", swimlane: "", actions: [] };
	ctx.steps.push(step);
	ctx.setCurrentStepIndex(ctx.steps.length - 1);
	ctx.ensureCanvasSync().setPendingZoom();
	void ctx.eventBus.emit("journey-builder.step.added", { stepId: id, title: "" });
	ctx.renderSteps();
	ctx.scheduleCanvasSync(300);
}

export function handleStepFieldChanged(ctx: SidebarContext, stepId: string, field: string, value: string): void {
	const step = ctx.steps.find((s) => s.id === stepId);
	if (step) {
		(step as unknown as Record<string, unknown>)[field] = value;
		void ctx.eventBus.emit("journey-builder.step.updated", {
			stepId,
			field,
			value,
		});
		ctx.getJsonPanel()?.update();
		ctx.scheduleCanvasSync();
	}
}

export function handleBackgroundImageRequested(ctx: SidebarContext, stepId: string): void {
	if (!ctx.app) return;
	const files = ctx.app.vault.getFiles().filter((f) =>
		IMAGE_EXTENSIONS.some((ext) => f.path.toLowerCase().endsWith(ext)),
	);
	if (files.length === 0) {
		void ctx.eventBus.emit("notice.show", { message: "No image files found in vault" });
		return;
	}
	new ImagePickerModal(ctx.app, files.map((f) => f.path), (path) => {
		handleStepFieldChanged(ctx, stepId, "backgroundImage", path);
		ctx.renderSteps();
		ctx.setBgSyncing(true);
	}).open();
}

export function handleStepListChanged(ctx: SidebarContext, stepId: string, field: string, items: string[]): void {
	const step = ctx.steps.find((s) => s.id === stepId);
	if (step) {
		(step as unknown as Record<string, unknown>)[field] = items;
		void ctx.eventBus.emit("journey-builder.step.updated", {
			stepId,
			field,
			value: items,
		});
		ctx.getJsonPanel()?.update();
		ctx.scheduleCanvasSync();
	}
}

export function handleRemoveStep(ctx: SidebarContext, stepId: string): void {
	ctx.setSteps(ctx.steps.filter((s) => s.id !== stepId));
	if (ctx.currentStepIndex >= ctx.steps.length) {
		ctx.setCurrentStepIndex(Math.max(0, ctx.steps.length - 1));
	}
	ctx.setSelectedActionIndex(-1);
	ctx.setShowToolPicker(false);
	ctx.setShowTemplatePicker(false);
	ctx.renderSteps();
	ctx.scheduleCanvasSync();
}

export function handleAddAction(ctx: SidebarContext): void {
	ctx.setShowTemplatePicker(true);
	ctx.setShowToolPicker(false);
	ctx.setSelectedActionIndex(-1);
	ctx.renderSteps();
}

export function handleTemplateSelected(ctx: SidebarContext, templateId: string): void {
	const step = ctx.steps[ctx.currentStepIndex];
	if (!step) return;
	const template = ACTION_TEMPLATES.find((t) => t.id === templateId);
	if (!template) return;
	const actions = template.actions.map((a) => ({ ...a }));
	step.actions.push(...actions);
	ctx.setSelectedActionIndex(step.actions.length - actions.length);
	ctx.setShowTemplatePicker(false);
	for (const a of actions) {
		void ctx.eventBus.emit("journey-builder.action.added", { stepId: step.id, tool: a.tool });
	}
	ctx.renderSteps();
	ctx.scheduleCanvasSync();
}

export function handleCustomFromTemplate(ctx: SidebarContext): void {
	ctx.setShowTemplatePicker(false);
	ctx.setShowToolPicker(true);
	ctx.renderSteps();
}

export function handleToolSelected(ctx: SidebarContext, tool: JourneyToolName): void {
	const step = ctx.steps[ctx.currentStepIndex];
	if (!step) return;
	const action: JourneyAction = { tool };
	step.actions.push(action);
	ctx.setSelectedActionIndex(step.actions.length - 1);
	ctx.setShowToolPicker(false);
	void ctx.eventBus.emit("journey-builder.action.added", { stepId: step.id, tool });
	ctx.renderSteps();
	ctx.scheduleCanvasSync();
}

export function handleRemoveAction(ctx: SidebarContext, index: number): void {
	const step = ctx.steps[ctx.currentStepIndex];
	if (!step) return;
	step.actions.splice(index, 1);
	if (ctx.selectedActionIndex >= step.actions.length) {
		ctx.setSelectedActionIndex(Math.max(-1, step.actions.length - 1));
	}
	ctx.renderSteps();
	ctx.scheduleCanvasSync();
}

export function handleMoveAction(ctx: SidebarContext, fromIndex: number, direction: "up" | "down"): void {
	const step = ctx.steps[ctx.currentStepIndex];
	if (!step) return;
	const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
	if (toIndex < 0 || toIndex >= step.actions.length) return;
	const [moved] = step.actions.splice(fromIndex, 1);
	step.actions.splice(toIndex, 0, moved);
	if (ctx.selectedActionIndex === fromIndex) {
		ctx.setSelectedActionIndex(toIndex);
	}
	ctx.renderSteps();
}

export function handleSelectAction(ctx: SidebarContext, index: number): void {
	ctx.setSelectedActionIndex(index);
	ctx.setShowToolPicker(false);
	ctx.setShowTemplatePicker(false);
	ctx.renderSteps();
}

export function handleActionFieldChanged(ctx: SidebarContext, key: string, value: string | number): void {
	const step = ctx.steps[ctx.currentStepIndex];
	if (!step || ctx.selectedActionIndex < 0) return;
	const action = step.actions[ctx.selectedActionIndex];
	if (!action) return;
	if (key === "description") {
		action.description = String(value);
	} else {
		action[key] = value;
	}
	ctx.getJsonPanel()?.update();
	ctx.scheduleCanvasSync();
}

export function handleExport(ctx: SidebarContext): void {
	const name = ctx.metadata.name;
	const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
	const subfolder = `${ctx.journeyFolder()}/${name}`;
	const filePath = `${subfolder}/${name}.journey`;
	const testFilePath = `tests/e2e/90-journey-${slug}.test.ts`;
	const canvasPath = `${subfolder}/${name}.canvas`;
	const definition = ctx.buildDefinition();
	void ctx.eventBus.emit("journey-builder.exported", {
		path: filePath, testFilePath, canvasPath, definition,
	});
	void ctx.eventBus.emit("notice.success", {
		message: `Exported "${name}" \u2014 JSON, test file, and canvas`,
	});
}

export function handleRunJourney(ctx: SidebarContext): void {
	const name = ctx.metadata.name;
	if (!name || ctx.steps.length === 0) return;
	const subfolder = `${ctx.journeyFolder()}/${name}`;
	void ctx.eventBus.emit("ui.runJourney", {
		journeyName: name,
		jsonPath: `${subfolder}/${name}.journey`,
		canvasPath: ctx.getCanvasPath(),
	});
}

export function handleViewInTestHub(ctx: SidebarContext): void {
	void ctx.eventBus.emit("ui.openTestManagementHub", {});
	if (ctx.metadata.name) {
		void ctx.eventBus.emit("hub.navigate", {
			hubId: "test-management",
			tabId: "journeys",
			entityId: ctx.metadata.name,
		});
	}
}

export async function handlePreviewRun(ctx: SidebarContext): Promise<void> {
	if (ctx.steps.length === 0) return;

	const result = runPreview(ctx.steps);
	void ctx.eventBus.emit("journey-builder.preview.started", {
		stepCount: ctx.steps.length,
	});

	const stepColors: Record<number, string> = {};

	for (let i = 0; i < result.steps.length; i++) {
		const stepResult = result.steps[i];

		// Mark current step as running (cyan)
		stepColors[i] = "5";
		syncCanvasWithColors(ctx, { ...stepColors });

		await previewDelay(300);

		// Mark step with result color: green = pass, red = fail
		stepColors[i] = stepResult.status === "pass" ? "4" : "1";
		syncCanvasWithColors(ctx, { ...stepColors });

		void ctx.eventBus.emit("journey-builder.preview.step-completed", {
			stepIndex: stepResult.stepIndex,
			status: stepResult.status,
			errors: stepResult.errors,
		});
	}

	void ctx.eventBus.emit("journey-builder.preview.completed", {
		totalSteps: result.totalSteps,
		passed: result.passed,
		failed: result.failed,
	});

	const noticeType = result.failed === 0 ? "notice.success" : "notice.error";
	void ctx.eventBus.emit(noticeType as "notice.success", {
		message: `Preview: ${result.passed}/${result.totalSteps} steps passed${
			result.failed > 0 ? `, ${result.failed} failed` : ""
		}`,
	});
}

function syncCanvasWithColors(ctx: SidebarContext, stepColors: Record<number, string>): void {
	const canvasPath = ctx.getCanvasPath();
	if (!canvasPath) return;
	const input = ctx.buildCanvasSyncInput();
	input.stepColors = stepColors;
	void ctx.eventBus.emit("journey-builder.canvas.sync-requested", {
		canvasPath,
		definition: input,
	});
}

function previewDelay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
