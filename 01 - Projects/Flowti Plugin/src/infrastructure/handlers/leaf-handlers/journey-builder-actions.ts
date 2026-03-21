/**
 * Journey Builder action handlers — step, action, and export operations.
 *
 * Extracted from journey-builder-handler.ts to stay under max-lines.
 */

import type { IEventBus } from "../../events/types";
import type { JourneyAction, JourneyToolName } from "../../../domain/journeyBuilder/types";
import { ACTION_TEMPLATES } from "../../../domain/journeyBuilder/types";
import type { JourneyStep } from "../../../ui/journeyBuilder/JourneyBuilderSidebar";
import { runPreview } from "../../../domain/journeyBuilder/previewRunner";
import type { CanvasSyncInput } from "../../../domain/journeyBuilder/canvasSync";

export interface JourneyActionContext {
	eventBus: IEventBus;
	getSteps: () => JourneyStep[];
	setSteps: (steps: JourneyStep[]) => void;
	getCurrentStepIndex: () => number;
	setCurrentStepIndex: (i: number) => void;
	getSelectedActionIndex: () => number;
	setSelectedActionIndex: (i: number) => void;
	setShowToolPicker: (v: boolean) => void;
	setShowTemplatePicker: (v: boolean) => void;
	getMetadata: () => { name: string; description: string; startEvent: string; endEvent: string };
	getJsonPanel: () => { update(): void } | null;
	renderSteps: () => void;
	scheduleCanvasSync: (delay?: number) => void;
	setPendingZoom: () => void;
	nextStepId: () => string;
	journeyFolder: () => string;
	buildDefinition: () => {
		journey: string; description: string; startEvent: string; endEvent: string;
		steps: Array<{ id: string; title: string; description: string; swimlane: string; guideSection: number; actions: JourneyAction[] }>;
	};
	buildCanvasSyncInput: () => CanvasSyncInput;
	getCanvasPath: () => string;
}

export function onAddStep(ctx: JourneyActionContext): void {
	const id = ctx.nextStepId();
	const step: JourneyStep = { id, title: "", description: "", swimlane: "", actions: [] };
	const steps = ctx.getSteps();
	steps.push(step);
	ctx.setSteps(steps);
	ctx.setCurrentStepIndex(steps.length - 1);
	ctx.setPendingZoom();
	void ctx.eventBus.emit("journey-builder.step.added", { stepId: id, title: "" });
	ctx.renderSteps();
	ctx.scheduleCanvasSync(300);
}

export function onStepFieldChanged(ctx: JourneyActionContext, stepId: string, field: string, value: string): void {
	const step = ctx.getSteps().find((st) => st.id === stepId);
	if (step) {
		(step as unknown as Record<string, unknown>)[field] = value;
		void ctx.eventBus.emit("journey-builder.step.updated", { stepId, field, value });
		ctx.getJsonPanel()?.update();
		ctx.scheduleCanvasSync();
	}
}

export function onStepListChanged(ctx: JourneyActionContext, stepId: string, field: string, items: string[]): void {
	const step = ctx.getSteps().find((st) => st.id === stepId);
	if (step) {
		(step as unknown as Record<string, unknown>)[field] = items;
		void ctx.eventBus.emit("journey-builder.step.updated", { stepId, field, value: items });
		ctx.getJsonPanel()?.update();
		ctx.scheduleCanvasSync();
	}
}

export function onRemoveStep(ctx: JourneyActionContext, stepId: string): void {
	ctx.setSteps(ctx.getSteps().filter((st) => st.id !== stepId));
	const steps = ctx.getSteps();
	if (ctx.getCurrentStepIndex() >= steps.length) {
		ctx.setCurrentStepIndex(Math.max(0, steps.length - 1));
	}
	ctx.setSelectedActionIndex(-1);
	ctx.setShowToolPicker(false);
	ctx.setShowTemplatePicker(false);
	ctx.renderSteps();
	ctx.scheduleCanvasSync();
}

export function onAddAction(ctx: JourneyActionContext): void {
	ctx.setShowTemplatePicker(true);
	ctx.setShowToolPicker(false);
	ctx.setSelectedActionIndex(-1);
	ctx.renderSteps();
}

export function onTemplateSelected(ctx: JourneyActionContext, templateId: string): void {
	const step = ctx.getSteps()[ctx.getCurrentStepIndex()];
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

export function onCustomFromTemplate(ctx: JourneyActionContext): void {
	ctx.setShowTemplatePicker(false);
	ctx.setShowToolPicker(true);
	ctx.renderSteps();
}

export function onToolSelected(ctx: JourneyActionContext, tool: JourneyToolName): void {
	const step = ctx.getSteps()[ctx.getCurrentStepIndex()];
	if (!step) return;
	const action: JourneyAction = { tool };
	step.actions.push(action);
	ctx.setSelectedActionIndex(step.actions.length - 1);
	ctx.setShowToolPicker(false);
	void ctx.eventBus.emit("journey-builder.action.added", { stepId: step.id, tool });
	ctx.renderSteps();
	ctx.scheduleCanvasSync();
}

export function onRemoveAction(ctx: JourneyActionContext, index: number): void {
	const step = ctx.getSteps()[ctx.getCurrentStepIndex()];
	if (!step) return;
	step.actions.splice(index, 1);
	if (ctx.getSelectedActionIndex() >= step.actions.length) {
		ctx.setSelectedActionIndex(Math.max(-1, step.actions.length - 1));
	}
	ctx.renderSteps();
	ctx.scheduleCanvasSync();
}

export function onMoveAction(ctx: JourneyActionContext, fromIndex: number, direction: "up" | "down"): void {
	const step = ctx.getSteps()[ctx.getCurrentStepIndex()];
	if (!step) return;
	const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
	if (toIndex < 0 || toIndex >= step.actions.length) return;
	const [moved] = step.actions.splice(fromIndex, 1);
	step.actions.splice(toIndex, 0, moved);
	if (ctx.getSelectedActionIndex() === fromIndex) ctx.setSelectedActionIndex(toIndex);
	ctx.renderSteps();
}

export function onSelectAction(ctx: JourneyActionContext, index: number): void {
	ctx.setSelectedActionIndex(index);
	ctx.setShowToolPicker(false);
	ctx.setShowTemplatePicker(false);
	ctx.renderSteps();
}

export function onActionFieldChanged(ctx: JourneyActionContext, key: string, value: string | number): void {
	const step = ctx.getSteps()[ctx.getCurrentStepIndex()];
	if (!step || ctx.getSelectedActionIndex() < 0) return;
	const action = step.actions[ctx.getSelectedActionIndex()];
	if (!action) return;
	if (key === "description") { action.description = String(value); }
	else { action[key] = value; }
	ctx.getJsonPanel()?.update();
	ctx.scheduleCanvasSync();
}

// ── Export / run / view ──────────────────────────────

export function onExport(ctx: JourneyActionContext): void {
	const metadata = ctx.getMetadata();
	const name = metadata.name;
	const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
	const subfolder = `${ctx.journeyFolder()}/${name}`;
	const filePath = `${subfolder}/${name}.journey`;
	const testFilePath = `tests/e2e/90-journey-${slug}.test.ts`;
	const canvasPath = `${subfolder}/${name}.canvas`;
	void ctx.eventBus.emit("journey-builder.exported", {
		path: filePath, testFilePath, canvasPath, definition: ctx.buildDefinition(),
	});
	void ctx.eventBus.emit("notice.success", {
		message: `Exported "${name}" — JSON, test file, and canvas`,
	});
}

export function onRunJourney(ctx: JourneyActionContext): void {
	const metadata = ctx.getMetadata();
	if (!metadata.name || ctx.getSteps().length === 0) return;
	const subfolder = `${ctx.journeyFolder()}/${metadata.name}`;
	void ctx.eventBus.emit("ui.runJourney", {
		journeyName: metadata.name,
		jsonPath: `${subfolder}/${metadata.name}.journey`,
		canvasPath: ctx.getCanvasPath(),
	});
}

export function onViewInTestHub(ctx: JourneyActionContext): void {
	void ctx.eventBus.emit("ui.openTestManagementHub", {});
	const metadata = ctx.getMetadata();
	if (metadata.name) {
		void ctx.eventBus.emit("hub.navigate", {
			hubId: "test-management", tabId: "journeys", entityId: metadata.name,
		});
	}
}

export async function onPreviewRun(ctx: JourneyActionContext): Promise<void> {
	const steps = ctx.getSteps();
	if (steps.length === 0) return;
	const result = runPreview(steps);
	void ctx.eventBus.emit("journey-builder.preview.started", { stepCount: steps.length });

	const stepColors: Record<number, string> = {};
	for (let i = 0; i < result.steps.length; i++) {
		const stepResult = result.steps[i];
		stepColors[i] = "5";
		syncCanvasWithColors(ctx, { ...stepColors });
		await new Promise<void>((resolve) => setTimeout(resolve, 300));
		stepColors[i] = stepResult.status === "pass" ? "4" : "1";
		syncCanvasWithColors(ctx, { ...stepColors });
		void ctx.eventBus.emit("journey-builder.preview.step-completed", {
			stepIndex: stepResult.stepIndex, status: stepResult.status, errors: stepResult.errors,
		});
	}

	void ctx.eventBus.emit("journey-builder.preview.completed", {
		totalSteps: result.totalSteps, passed: result.passed, failed: result.failed,
	});

	const noticeType = result.failed === 0 ? "notice.success" : "notice.error";
	void ctx.eventBus.emit(noticeType as "notice.success", {
		message: `Preview: ${result.passed}/${result.totalSteps} steps passed${
			result.failed > 0 ? `, ${result.failed} failed` : ""
		}`,
	});
}

function syncCanvasWithColors(ctx: JourneyActionContext, stepColors: Record<number, string>): void {
	const canvasPath = ctx.getCanvasPath();
	if (!canvasPath) return;
	const input = ctx.buildCanvasSyncInput();
	input.stepColors = stepColors;
	void ctx.eventBus.emit("journey-builder.canvas.sync-requested", {
		canvasPath, definition: input,
	});
}
