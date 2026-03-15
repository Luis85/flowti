/**
 * make.controller.ts — Controller for in-project scaffolding commands.
 *
 * Converts pure domain results to typed models with renderers.
 */

import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler } from "../infrastructure/types.js";
import type { LogFn } from "../infrastructure/command-engine.js";
import { makeComponent, COMPONENT_DEFINITION_IDS, type MakeComponentOutcome } from "../domain/make/component/component-commands.js";
import { editComponent, type EditComponentOutcome } from "../domain/make/component/component-edit.js";
import { scaffoldDefinition, type ScaffoldDefinitionOutcome } from "../domain/make/component/definition-scaffold.js";
import { suggestRelationships, type RelationshipSuggestion } from "../domain/make/component/component-suggest.js";
import { listProjectComponents } from "../domain/make/component/component-list.js";
import { renderError, renderSuccess } from "../ui/renderers/common-renderers.js";
import { renderComponentAdding } from "../ui/renderers/make-renderers.js";
import { showSuggestions } from "../infrastructure/suggestions.js";

// ── Renderers ────────────────────────────────────────────────────────

function renderMakeResult(data: MakeComponentOutcome, log: LogFn): void {
	if (!data.success) {
		renderError({ error: data.error, hint: data.hint }, log);
		return;
	}
	renderComponentAdding(data.definitionLabel, data.name, log);
	renderSuccess({ message: `Created ${data.filesCreated} files.` }, log);
	showSuggestions(data.suggestions);
}

function renderEditResult(data: EditComponentOutcome, log: LogFn): void {
	if (!data.success) {
		renderError({ error: data.error, hint: data.hint }, log);
		return;
	}
	renderSuccess({ message: `Updated ${data.kebab}: ${data.propList}` }, log);
}

function renderScaffoldResult(data: ScaffoldDefinitionOutcome, log: LogFn): void {
	if (!data.success) {
		renderError({ error: data.error, hint: data.hint }, log);
		return;
	}
	renderSuccess({ message: `Created definition: ${data.outputPath}` }, log);
}

function renderSuggestions(data: { suggestions: RelationshipSuggestion[] }, log: LogFn): void {
	if (data.suggestions.length === 0) {
		renderSuccess({ message: "No new relationship suggestions found." }, log);
		return;
	}
	renderSuccess({ message: `Found ${data.suggestions.length} relationship suggestion(s):` }, log);
	for (const s of data.suggestions) {
		renderSuccess({ message: `  ${s.source} → ${s.target} (${s.type}, ${s.confidence}) — ${s.evidence}` }, log);
	}
}

// ── Commands ─────────────────────────────────────────────────────────

function makeComponentCommand(definitionId: string): CommandHandler {
	return adaptDescriptor<Record<string, unknown>, MakeComponentOutcome>({
		flags: {
			name: { type: "string", default: "" },
		},
		handler: (ctx) => {
			if (!ctx.project) {
				return { success: false, error: "No project selected." } as MakeComponentOutcome;
			}
			const name = (ctx.flags.name as string) || undefined;
			return makeComponent(definitionId, name, ctx.flags as Record<string, string | boolean>, ctx.project.path, ctx.deps);
		},
		renderer: renderMakeResult,
		exitCode: (model) => model.success ? undefined : 1,
	});
}

export const commands: Record<string, CommandHandler> = {
	"edit:component": adaptDescriptor<Record<string, unknown>, EditComponentOutcome>({
		flags: {
			name: { type: "string", default: "" },
		},
		handler: (ctx) => {
			if (!ctx.project) {
				return { success: false, error: "No project selected." } as EditComponentOutcome;
			}
			const name = (ctx.flags.name as string) || undefined;
			return editComponent(name, ctx.flags as Record<string, string | boolean>, ctx.project.path, ctx.deps);
		},
		renderer: renderEditResult,
		exitCode: (model) => model.success ? undefined : 1,
	}),

	"make:definition": adaptDescriptor<Record<string, unknown>, ScaffoldDefinitionOutcome>({
		flags: {
			name: { type: "string", default: "" },
		},
		handler: (ctx) => {
			if (!ctx.project) {
				return { success: false, error: "No project selected." } as ScaffoldDefinitionOutcome;
			}
			const name = (ctx.flags.name as string) || undefined;
			return scaffoldDefinition(name, ctx.flags as Record<string, string | boolean>, ctx.project.path, ctx.deps);
		},
		renderer: renderScaffoldResult,
		exitCode: (model) => model.success ? undefined : 1,
	}),

	"suggest:relationships": adaptDescriptor<Record<string, unknown>, { suggestions: RelationshipSuggestion[] }>({
		handler: (ctx) => {
			if (!ctx.project) {
				return { suggestions: [] };
			}
			const components = listProjectComponents(ctx.project.path, ctx.deps);
			const suggestions = suggestRelationships(components, ctx.project.path, ctx.deps);
			return { suggestions };
		},
		renderer: renderSuggestions,
	}),
};

// ── Dynamic make:* commands ──────────────────────────────────────────

for (const id of COMPONENT_DEFINITION_IDS) {
	const shortName = id === "c4-component" ? "c4-component" : id.replace("c4-", "");
	const commandKey = `make:${shortName}`;
	commands[commandKey] = makeComponentCommand(id);
}
