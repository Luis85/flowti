/**
 * scaffold.controller.ts — Controller for scaffold and marketplace commands.
 *
 * Returns typed data models; rendering is handled by ui/scaffold-display.ts.
 */

import type { ControllerAction } from "../infrastructure/request-response.js";
import { adapt, dataResponse } from "../infrastructure/request-response.js";
import type { CommandHandler } from "../infrastructure/types.js";
import { scaffold, scaffoldDryRun, listDefinitions, BUNDLED_DEFINITIONS, getKnownTemplateIds } from "../domain/scaffold/scaffold-service.js";
import { buildMarketplaceListing, resolveDefinitionsDir, importDefinition } from "../domain/scaffold/marketplace.js";
import { exportBundle, saveBundle, loadBundle, importAiToolsFromBundle } from "../domain/scaffold/marketplace-export.js";
import { VAULT_ROOT, PROJECTS_DIR, cliConfig } from "../infrastructure/config.js";
import { afterScaffold } from "../infrastructure/suggestions.js";

import { renderError, type ErrorModel } from "../ui/renderers/common-renderers.js";
import { renderNoProject, type NoProjectModel } from "../ui/renderers/common-renderers.js";
import {
	renderDryRunPreview, renderScaffoldResult, renderDefinitionList,
	renderExportPreview, renderExportSaved, renderBundleImported,
	renderMarketplace, renderImportResult,
	type ScaffoldResultModel, type DefinitionListModel,
	type ExportSavedModel, type BundleImportedModel,
	type MarketplaceModel, type ImportResultModel,
} from "../ui/displays/scaffold-display.js";

// ── Controller actions ──────────────────────────────────────────────

const actions: Record<string, ControllerAction> = {
	"scaffold:new": (req) => {
		const { disk, paths, log } = req.deps;
		const scaffoldDeps = { disk, paths } as const;
		const name = req.flags.name as string | undefined;
		const definitionId = (req.flags.definition as string) ?? "flowti-project";
		const author = req.flags.author as string | undefined;
		const output = req.flags.output as string | undefined;

		if (!name) {
			return dataResponse<ErrorModel>(
				{ error: "Missing required flag: --name", hint: "Usage: scaffold:new --name=\"My Project\" [--definition=flowti-project]" },
				(d) => renderError(d, log),
			);
		}

		const opts = { definitionId, name, author, outputDir: output };

		if (req.flags["dry-run"]) {
			const result = scaffoldDryRun(PROJECTS_DIR, scaffoldDeps, opts, cliConfig.defaultAuthor);
			if ("error" in result) {
				return dataResponse<ErrorModel>({ error: result.error }, (d) => renderError(d, log));
			}
			return dataResponse(result, (d) => renderDryRunPreview(d, log));
		}

		const result = scaffold(PROJECTS_DIR, scaffoldDeps, opts, cliConfig.defaultAuthor);
		if ("error" in result) {
			return dataResponse<ErrorModel>({ error: result.error }, (d) => renderError(d, log));
		}

		const model: ScaffoldResultModel = {
			created: result.created,
			outputPath: result.outputPath,
			suggestions: afterScaffold(opts.name),
		};
		return dataResponse(model, (d) => renderScaffoldResult(d, log));
	},

	"scaffold:list": (req) => {
		const defs = listDefinitions();
		const model: DefinitionListModel = {
			definitions: defs.map((d) => ({ id: d.id, label: d.label, description: d.description })),
		};
		return dataResponse(model, (d) => renderDefinitionList(d, req.deps.log));
	},

	"scaffold:marketplace": (req) => {
		const { disk, paths } = req.deps;
		const knownIds = getKnownTemplateIds();
		const localDir = req.project?.path ? resolveDefinitionsDir({ paths }, req.project.path) : "";
		const entries = buildMarketplaceListing({ disk, paths }, BUNDLED_DEFINITIONS, localDir, knownIds);
		const model: MarketplaceModel = { entries };
		return dataResponse(model, (d) => renderMarketplace(d, req.deps.log));
	},

	"scaffold:import": (req) => {
		const { log } = req.deps;
		const file = req.flags.file as string | undefined;
		if (!file) {
			return dataResponse<ErrorModel>(
				{ error: "Missing required flag: --file", hint: "Usage: scaffold:import --file=<path>" },
				(d) => renderError(d, log),
			);
		}
		if (!req.project) {
			return dataResponse<NoProjectModel>({ command: "scaffold:import" }, (d) => renderNoProject(d, log));
		}
		const { disk, paths } = req.deps;
		const knownIds = getKnownTemplateIds();
		const result = importDefinition({ disk, paths }, file, req.project.path, knownIds);
		const model: ImportResultModel = { result };
		return dataResponse(model, (d) => renderImportResult(d, req.deps.log));
	},

	"marketplace:export": (req) => {
		const { disk, paths, clock } = req.deps;
		const exportDeps = { disk, paths, clock } as const;
		const scaffoldDeps = { disk, paths } as const;
		const output = req.flags.output as string | undefined;
		const bundle = exportBundle(exportDeps, VAULT_ROOT, req.project?.path);
		const total = bundle.aiTools.length + bundle.plugins.length + bundle.scaffolds.length;

		if (output) {
			saveBundle(scaffoldDeps, bundle, output);
			const model: ExportSavedModel = { total, outputPath: output };
			return dataResponse(model, (d) => renderExportSaved(d, req.deps.log));
		}
		return dataResponse(bundle, (d) => renderExportPreview(d, req.deps.log));
	},

	"marketplace:import-bundle": (req) => {
		const { disk, paths, log } = req.deps;
		const scaffoldDeps = { disk, paths } as const;
		const file = req.flags.file as string | undefined;
		if (!file) {
			return dataResponse<ErrorModel>(
				{ error: "Missing --file flag.", hint: "Usage: marketplace:import-bundle --file=<bundle.json>" },
				(d) => renderError(d, log),
			);
		}
		const bundle = loadBundle({ disk } as const, file);
		if (!bundle) {
			return dataResponse<ErrorModel>({ error: `Invalid or unreadable bundle: ${file}` }, (d) => renderError(d, log));
		}
		const imported = importAiToolsFromBundle(scaffoldDeps, bundle, VAULT_ROOT);
		const model: BundleImportedModel = { imported, vault: bundle.vault };
		return dataResponse(model, (d) => renderBundleImported(d, log));
	},
};

// ── Adapted commands ────────────────────────────────────────────────

export const commands: Record<string, CommandHandler> = Object.fromEntries(
	Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
);
