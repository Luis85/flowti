/**
 * ai-tools.controller.ts — Controller for AI tool management commands.
 *
 * Returns typed data models; rendering is handled by ui/ai-tools-display.ts.
 * Interactive aiToolsMenu stays in domain/ai-tools/ai-tool-commands.ts
 * as it's a menu action, not a non-interactive command.
 */

import type { ControllerAction } from "../infrastructure/request-response.js";
import { adapt, dataResponse } from "../infrastructure/request-response.js";
import type { CommandHandler } from "../infrastructure/types.js";
import { disk } from "../infrastructure/filesystem.js";
import { input } from "../infrastructure/input.js";
import { shell } from "../infrastructure/shell.js";
import { paths } from "../infrastructure/paths.js";
import { VAULT_ROOT, CLI_PROJECT } from "../infrastructure/config.js";
import {
	loadAiTools,
	validateToolDefinition,
	scaffoldAiTool,
	discoverToolFiles,
	AI_TOOLS_DIR,
} from "../domain/ai-tools/ai-tool-loader.js";
import type { LoadedAiTool } from "../domain/ai-tools/ai-tool-types.js";
import { generateAiToolReference } from "../domain/ai-tools/ai-tool-reference.js";
import { substituteParams } from "../domain/ai-tools/ai-tool-commands.js";
import {
	renderToolList,
	renderToolValidation,
	renderToolRunResult,
	renderDryRun,
	renderToolNotFound,
	renderToolInvalid,
	renderMissingParams,
	renderMissingToolFlag,
	renderRunning,
	type ToolListItem,
	type ToolValidationItem,
	type ToolRunResultModel,
	type DryRunModel,
	type ToolNotFoundModel,
	type ToolInvalidModel,
	type MissingParamsModel,
	type MissingToolFlagModel,
} from "../ui/ai-tools-display.js";
import { renderSuccess, renderError, type SuccessModel, type ErrorModel } from "../ui/common-renderers.js";

// ── ai:run helpers ──────────────────────────────────────────────────

function validateToolSelection(
	toolName: string,
	tools: LoadedAiTool[],
): LoadedAiTool | { notFound: ToolNotFoundModel } | { invalid: ToolInvalidModel } {
	const tool = tools.find((t) => t.definition.name === toolName);
	if (!tool) {
		return { notFound: { toolName, available: tools.map((t) => t.definition.name) } };
	}
	if (!tool.valid) {
		return { invalid: { toolName, errors: tool.errors } };
	}
	return tool;
}

function isLoadedTool(result: unknown): result is LoadedAiTool {
	return result !== null && typeof result === "object" && "definition" in (result as Record<string, unknown>);
}

// ── Controller actions ──────────────────────────────────────────────

const actions: Record<string, ControllerAction> = {
	"ai:list": () => {
		const tools = loadAiTools(VAULT_ROOT, disk);
		const model: ToolListItem[] = tools.map((t) => ({
			name: t.definition.name,
			version: t.definition.version ?? null,
			description: t.definition.description,
			run: t.definition.run,
			params: t.definition.params ?? [],
			tags: t.definition.tags ?? [],
			valid: t.valid,
			errors: t.errors,
		}));
		return dataResponse(model, renderToolList);
	},

	"ai:validate": () => {
		const toolsDir = paths.join(VAULT_ROOT, AI_TOOLS_DIR);
		const files = discoverToolFiles(toolsDir, disk);
		const results: ToolValidationItem[] = files.map((file) => {
			const fileName = paths.basename(file);
			try {
				const raw = JSON.parse(disk.readFileSync(file, "utf-8")) as unknown;
				const result = validateToolDefinition(raw);
				return { file: fileName, ...result };
			} catch (err: unknown) {
				return { file: fileName, valid: false, errors: [`Parse error: ${err instanceof Error ? err.message : String(err)}`], warnings: [] };
			}
		});
		return dataResponse(results, renderToolValidation);
	},

	"ai:new": async () => {
		const name = await input.ask("Tool name (lowercase, hyphens/underscores)");
		if (!name) return dataResponse<SuccessModel>({ message: "Cancelled." }, renderSuccess);
		const desc = await input.ask("Description");
		const run = await input.ask("Shell command to run");
		if (!run) return dataResponse<SuccessModel>({ message: "Cancelled." }, renderSuccess);
		const result = scaffoldAiTool(VAULT_ROOT, name, desc || "An AI tool", run, disk);
		if ("error" in result) {
			return dataResponse<ErrorModel>({ error: result.error }, renderError);
		}
		return dataResponse<SuccessModel>({ message: `Created tool at ${result.path}` }, renderSuccess);
	},

	"ai:reference": () => {
		const tools = loadAiTools(VAULT_ROOT, disk);
		const doc = generateAiToolReference(tools);
		const outputPath = paths.join(CLI_PROJECT, "docs", "reference", "AI Tool Reference.md");
		doc.save(outputPath);
		return dataResponse<SuccessModel>({ message: `Reference saved to ${outputPath}` }, renderSuccess);
	},

	"ai:run": (req) => {
		const toolName = req.flags.tool;
		if (!toolName || typeof toolName !== "string") {
			return dataResponse<MissingToolFlagModel>(
				{ usage: "flowti ai:run --tool=<name> [--param1=value1]" },
				renderMissingToolFlag,
			);
		}
		const tools = loadAiTools(VAULT_ROOT, disk);
		const result = validateToolSelection(toolName, tools);
		if (!isLoadedTool(result)) {
			if ("notFound" in result) return dataResponse(result.notFound, renderToolNotFound);
			return dataResponse(result.invalid, renderToolInvalid);
		}
		const params = result.definition.params ?? [];
		const missing = params.filter((p) => p.required && req.flags[p.name] === undefined);
		if (missing.length > 0) {
			const model: MissingParamsModel = { params: missing.map((p) => ({ name: p.name, description: p.description })) };
			return dataResponse(model, renderMissingParams);
		}
		const cmd = substituteParams(result.definition.run, params, req.flags);
		const cwd = result.definition.cwd ? paths.join(VAULT_ROOT, result.definition.cwd) : VAULT_ROOT;
		if (req.flags["dry-run"]) {
			return dataResponse<DryRunModel>({ cmd, cwd }, renderDryRun);
		}
		// Fire-and-forget shell.run — renderRunning is a side-effect before execution
		renderRunning(toolName);
		const { exitCode } = shell.runCaptureStatus(cmd, { cwd });
		return dataResponse<ToolRunResultModel>({ toolName, exitCode }, renderToolRunResult);
	},
};

// ── Adapted commands ────────────────────────────────────────────────

export const commands: Record<string, CommandHandler> = Object.fromEntries(
	Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
);
