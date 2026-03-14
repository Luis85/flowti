/**
 * make.controller.ts — Controller for in-project scaffolding commands.
 *
 * Converts pure domain results to CliResponse with renderers.
 */

import type { CommandHandler } from "../infrastructure/types.js";
import type { ControllerAction } from "../infrastructure/request-response.js";
import { adapt, dataResponse } from "../infrastructure/request-response.js";
import { makeComponent, COMPONENT_DEFINITION_IDS, type MakeComponentOutcome } from "../domain/make/component/component-commands.js";
import { editComponent, type EditComponentOutcome } from "../domain/make/component/component-edit.js";
import { scaffoldDefinition, type ScaffoldDefinitionOutcome } from "../domain/make/component/definition-scaffold.js";
import { suggestRelationships, type RelationshipSuggestion } from "../domain/make/component/component-suggest.js";
import { listProjectComponents } from "../domain/make/component/component-list.js";
import { renderError, renderSuccess } from "../ui/renderers/common-renderers.js";
import { renderComponentAdding } from "../ui/renderers/make-renderers.js";
import { showSuggestions } from "../infrastructure/suggestions.js";

type Log = (msg?: string) => void;

// ── Renderers ────────────────────────────────────────────────────────

function renderMakeResult(log: Log, data: MakeComponentOutcome): void {
	if (!data.success) {
		renderError(log, { error: data.error, hint: data.hint });
		return;
	}
	renderComponentAdding(log, data.definitionLabel, data.name);
	renderSuccess(log, { message: `Created ${data.filesCreated} files.` });
	showSuggestions(data.suggestions);
}

function renderEditResult(log: Log, data: EditComponentOutcome): void {
	if (!data.success) {
		renderError(log, { error: data.error, hint: data.hint });
		return;
	}
	renderSuccess(log, { message: `Updated ${data.kebab}: ${data.propList}` });
}

function renderScaffoldResult(log: Log, data: ScaffoldDefinitionOutcome): void {
	if (!data.success) {
		renderError(log, { error: data.error, hint: data.hint });
		return;
	}
	renderSuccess(log, { message: `Created definition: ${data.outputPath}` });
}

function renderSuggestions(log: Log, data: { suggestions: RelationshipSuggestion[] }): void {
	if (data.suggestions.length === 0) {
		renderSuccess(log, { message: "No new relationship suggestions found." });
		return;
	}
	renderSuccess(log, { message: `Found ${data.suggestions.length} relationship suggestion(s):` });
	for (const s of data.suggestions) {
		renderSuccess(log, { message: `  ${s.source} → ${s.target} (${s.type}, ${s.confidence}) — ${s.evidence}` });
	}
}

// ── Controller actions ──────────────────────────────────────────────

function makeComponentAction(definitionId: string): ControllerAction {
	return (req) => {
		const { log } = req.deps;
		const render = (d: MakeComponentOutcome) => renderMakeResult(log, d);
		if (!req.project) {
			return { data: { success: false, error: "No project selected." } as MakeComponentOutcome, render, exitCode: 1 };
		}
		const name = typeof req.flags.name === "string" ? req.flags.name : undefined;
		const result = makeComponent(definitionId, name, req.flags, req.project.path, req.deps);
		if (!result.success) {
			return { data: result, render, exitCode: 1 };
		}
		return dataResponse(result, render);
	};
}

const editComponentAction: ControllerAction = (req) => {
	const { log } = req.deps;
	const render = (d: EditComponentOutcome) => renderEditResult(log, d);
	if (!req.project) {
		return { data: { success: false, error: "No project selected." } as EditComponentOutcome, render, exitCode: 1 };
	}
	const name = typeof req.flags.name === "string" ? req.flags.name : undefined;
	const result = editComponent(name, req.flags, req.project.path, req.deps);
	if (!result.success) {
		return { data: result, render, exitCode: 1 };
	}
	return dataResponse(result, render);
};

const makeDefinitionAction: ControllerAction = (req) => {
	const { log } = req.deps;
	const render = (d: ScaffoldDefinitionOutcome) => renderScaffoldResult(log, d);
	if (!req.project) {
		return { data: { success: false, error: "No project selected." } as ScaffoldDefinitionOutcome, render, exitCode: 1 };
	}
	const name = typeof req.flags.name === "string" ? req.flags.name : undefined;
	const result = scaffoldDefinition(name, req.flags, req.project.path, req.deps);
	if (!result.success) {
		return { data: result, render, exitCode: 1 };
	}
	return dataResponse(result, render);
};

const suggestRelationshipsAction: ControllerAction = (req) => {
	const { log } = req.deps;
	const render = (d: { suggestions: RelationshipSuggestion[] }) => renderSuggestions(log, d);
	if (!req.project) {
		return { data: { suggestions: [] as RelationshipSuggestion[] }, render, exitCode: 1 };
	}
	const components = listProjectComponents(req.project.path, req.deps);
	const suggestions = suggestRelationships(components, req.project.path, req.deps);
	return dataResponse({ suggestions }, render);
};

// ── Exported commands ────────────────────────────────────────────────

const actions: Record<string, ControllerAction> = {
	"edit:component": editComponentAction,
	"make:definition": makeDefinitionAction,
	"suggest:relationships": suggestRelationshipsAction,
};

for (const id of COMPONENT_DEFINITION_IDS) {
	const shortName = id === "c4-component" ? "c4-component" : id.replace("c4-", "");
	const commandKey = `make:${shortName}`;
	actions[commandKey] = makeComponentAction(id);
}

export const commands: Record<string, CommandHandler> = Object.fromEntries(
	Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
);
