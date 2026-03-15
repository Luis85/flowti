/**
 * scaffold.controller.ts — Controller for scaffold and marketplace commands.
 *
 * Returns typed data models; rendering is handled by ui/scaffold-display.ts.
 */

import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler } from "../infrastructure/types.js";
import type { LogFn } from "../infrastructure/command-engine.js";
import { scaffold, scaffoldDryRun, listDefinitions, BUNDLED_DEFINITIONS, getKnownTemplateIds, type DryRunResult } from "../domain/scaffold/scaffold-service.js";
import { buildMarketplaceListing, resolveDefinitionsDir, importDefinition } from "../domain/scaffold/marketplace.js";
import { exportBundle, saveBundle, loadBundle, importAiToolsFromBundle } from "../domain/scaffold/marketplace-export.js";
import { VAULT_ROOT, PROJECTS_DIR, cliConfig } from "../infrastructure/config.js";
import { afterScaffold } from "../infrastructure/suggestions.js";

import { renderError, renderNoProject, type ErrorModel, type NoProjectModel } from "../ui/renderers/common-renderers.js";
import {
	renderDryRunPreview, renderScaffoldResult, renderDefinitionList,
	renderExportPreview, renderExportSaved, renderBundleImported,
	renderMarketplace, renderImportResult,
	type ScaffoldResultModel, type DefinitionListModel,
	type ExportSavedModel, type BundleImportedModel,
	type MarketplaceModel, type ImportResultModel,
} from "../ui/displays/scaffold-display.js";

// ── Model types ─────────────────────────────────────────────────────

type ScaffoldNewModel = ScaffoldResultModel | ErrorModel | DryRunResult;
type ScaffoldImportModel = ImportResultModel | ErrorModel | NoProjectModel;
type ExportModel = ExportSavedModel | ReturnType<typeof exportBundle>;
type BundleImportModel = BundleImportedModel | ErrorModel;

function isErrorModel(m: unknown): m is ErrorModel {
	return typeof m === "object" && m !== null && "error" in m;
}

function isNoProject(m: unknown): m is NoProjectModel {
	return typeof m === "object" && m !== null && "command" in m;
}

// ── Commands ────────────────────────────────────────────────────────

export const commands: Record<string, CommandHandler> = {
	"scaffold:new": adaptDescriptor<Record<string, unknown>, ScaffoldNewModel>({
		flags: {
			name: { type: "string", required: true, hint: 'Usage: scaffold:new --name="My Project" [--definition=flowti-project]' },
			definition: { type: "string", default: "flowti-project" },
			author: { type: "string", default: "" },
			output: { type: "string", default: "" },
			"dry-run": { type: "boolean", default: false },
		},
		handler: (ctx) => {
			const { disk, paths } = ctx.deps;
			const scaffoldDeps = { disk, paths } as const;
			const name = ctx.flags.name as string;
			const definitionId = (ctx.flags.definition as string) || "flowti-project";
			const author = (ctx.flags.author as string) || undefined;
			const output = (ctx.flags.output as string) || undefined;
			const opts = { definitionId, name, author, outputDir: output };

			if (ctx.flags["dry-run"]) {
				const result = scaffoldDryRun(PROJECTS_DIR, scaffoldDeps, opts, cliConfig.defaultAuthor);
				if ("error" in result) {
					return { error: result.error } as ErrorModel;
				}
				return result;
			}

			const result = scaffold(PROJECTS_DIR, scaffoldDeps, opts, cliConfig.defaultAuthor);
			if ("error" in result) {
				return { error: result.error } as ErrorModel;
			}

			return {
				created: result.created,
				outputPath: result.outputPath,
				suggestions: afterScaffold(opts.name),
			} as ScaffoldResultModel;
		},
		renderer: (data: ScaffoldNewModel, log: LogFn) => {
			if (isErrorModel(data)) { renderError(data, log); return; }
			if ("created" in data && "outputPath" in data && "suggestions" in data) {
				renderScaffoldResult(data as ScaffoldResultModel, log);
				return;
			}
			renderDryRunPreview(data as DryRunResult, log);
		},
	}),

	"scaffold:list": adaptDescriptor<Record<string, unknown>, DefinitionListModel>({
		handler: () => {
			const defs = listDefinitions();
			return {
				definitions: defs.map((d) => ({ id: d.id, label: d.label, description: d.description })),
			};
		},
		renderer: renderDefinitionList,
	}),

	"scaffold:marketplace": adaptDescriptor<Record<string, unknown>, MarketplaceModel>({
		handler: (ctx) => {
			const { disk, paths } = ctx.deps;
			const knownIds = getKnownTemplateIds();
			const localDir = ctx.project?.path ? resolveDefinitionsDir({ paths }, ctx.project.path) : "";
			const entries = buildMarketplaceListing({ disk, paths }, BUNDLED_DEFINITIONS, localDir, knownIds);
			return { entries };
		},
		renderer: renderMarketplace,
	}),

	"scaffold:import": adaptDescriptor<Record<string, unknown>, ScaffoldImportModel>({
		requires: "project",
		flags: {
			file: { type: "string", required: true, hint: "Usage: scaffold:import --file=<path>" },
		},
		handler: (ctx) => {
			const { disk, paths } = ctx.deps;
			const file = ctx.flags.file as string;
			const knownIds = getKnownTemplateIds();
			const result = importDefinition({ disk, paths }, file, ctx.project!.path, knownIds);
			return { result };
		},
		renderer: (data: ScaffoldImportModel, log: LogFn) => {
			if (isNoProject(data)) { renderNoProject(data as NoProjectModel, log); return; }
			if (isErrorModel(data)) { renderError(data, log); return; }
			renderImportResult(data as ImportResultModel, log);
		},
	}),

	"marketplace:export": adaptDescriptor<Record<string, unknown>, ExportModel>({
		flags: {
			output: { type: "string", default: "" },
		},
		handler: (ctx) => {
			const { disk, paths, clock } = ctx.deps;
			const exportDeps = { disk, paths, clock } as const;
			const scaffoldDeps = { disk, paths } as const;
			const output = (ctx.flags.output as string) || undefined;
			const bundle = exportBundle(exportDeps, VAULT_ROOT, ctx.project?.path);

			if (output) {
				saveBundle(scaffoldDeps, bundle, output);
				const total = bundle.aiTools.length + bundle.plugins.length + bundle.scaffolds.length;
				return { total, outputPath: output } as ExportSavedModel;
			}
			return bundle;
		},
		renderer: (data: ExportModel, log: LogFn) => {
			if ("outputPath" in data) {
				renderExportSaved(data as ExportSavedModel, log);
				return;
			}
			renderExportPreview(data as ReturnType<typeof exportBundle>, log);
		},
	}),

	"marketplace:import-bundle": adaptDescriptor<Record<string, unknown>, BundleImportModel>({
		flags: {
			file: { type: "string", required: true, hint: "Usage: marketplace:import-bundle --file=<bundle.json>" },
		},
		handler: (ctx) => {
			const { disk, paths } = ctx.deps;
			const scaffoldDeps = { disk, paths } as const;
			const file = ctx.flags.file as string;
			const bundle = loadBundle({ disk } as const, file);
			if (!bundle) {
				return { error: `Invalid or unreadable bundle: ${file}` } as ErrorModel;
			}
			const imported = importAiToolsFromBundle(scaffoldDeps, bundle, VAULT_ROOT);
			return { imported, vault: bundle.vault };
		},
		renderer: (data: BundleImportModel, log: LogFn) => {
			if (isErrorModel(data)) { renderError(data, log); return; }
			renderBundleImported(data as BundleImportedModel, log);
		},
	}),
};
