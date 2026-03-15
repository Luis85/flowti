/**
 * ai-tools.controller.ts — Controller for AI tool management commands.
 *
 * Returns typed data models; rendering is handled by ui/ai-tools-display.ts.
 * Interactive aiToolsMenu stays in domain/ai-tools/ai-tool-commands.ts
 * as it's a menu action, not a non-interactive command.
 */

import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler } from "../infrastructure/types.js";
import type { LogFn } from "../infrastructure/command-engine.js";
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
} from "../ui/displays/ai-tools-display.js";
import { renderSuccess, renderError, type SuccessModel, type ErrorModel } from "../ui/renderers/common-renderers.js";

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

// ── Model types ──────────────────────────────────────────────────────

type AiNewModel = SuccessModel | ErrorModel;
type AiRunModel = ToolRunResultModel | DryRunModel | ToolNotFoundModel | ToolInvalidModel | MissingParamsModel | MissingToolFlagModel;

function isErrorModel(m: unknown): m is ErrorModel {
	return typeof m === "object" && m !== null && "error" in m;
}

function renderAiNew(data: AiNewModel, log: LogFn): void {
	if (isErrorModel(data)) { renderError(data, log); return; }
	renderSuccess(data as SuccessModel, log);
}

function renderAiRun(data: AiRunModel, log: LogFn): void {
	if ("usage" in data) { renderMissingToolFlag(data as MissingToolFlagModel, log); return; }
	if ("available" in data) { renderToolNotFound(data as ToolNotFoundModel, log); return; }
	if ("errors" in data && "toolName" in data) { renderToolInvalid(data as ToolInvalidModel, log); return; }
	if ("params" in data) { renderMissingParams(data as MissingParamsModel, log); return; }
	if ("cmd" in data) { renderDryRun(data as DryRunModel, log); return; }
	renderToolRunResult(data as ToolRunResultModel, log);
}

// ── Commands ────────────────────────────────────────────────────────

export const commands: Record<string, CommandHandler> = {
	"ai:list": adaptDescriptor<Record<string, unknown>, ToolListItem[]>({
		handler: (ctx) => {
			const { disk } = ctx.deps;
			const tools = loadAiTools(ctx.deps, VAULT_ROOT, disk);
			return tools.map((t) => ({
				name: t.definition.name,
				version: t.definition.version ?? null,
				description: t.definition.description,
				run: t.definition.run,
				params: t.definition.params ?? [],
				tags: t.definition.tags ?? [],
				valid: t.valid,
				errors: t.errors,
			}));
		},
		renderer: renderToolList,
	}),

	"ai:validate": adaptDescriptor<Record<string, unknown>, ToolValidationItem[]>({
		handler: (ctx) => {
			const { disk, paths } = ctx.deps;
			const toolsDir = paths.join(VAULT_ROOT, AI_TOOLS_DIR);
			const files = discoverToolFiles(ctx.deps, toolsDir, disk);
			return files.map((file) => {
				const fileName = paths.basename(file);
				try {
					const raw = JSON.parse(disk.readFileSync(file, "utf-8")) as unknown;
					const result = validateToolDefinition(raw);
					return { file: fileName, ...result };
				} catch (err: unknown) {
					return { file: fileName, valid: false, errors: [`Parse error: ${err instanceof Error ? err.message : String(err)}`], warnings: [] };
				}
			});
		},
		renderer: renderToolValidation,
	}),

	"ai:new": adaptDescriptor<Record<string, unknown>, AiNewModel>({
		handler: async (ctx) => {
			const { disk, input } = ctx.deps;
			const name = await input.ask("Tool name (lowercase, hyphens/underscores)");
			if (!name) return { message: "Cancelled." } as SuccessModel;
			const desc = await input.ask("Description");
			const run = await input.ask("Shell command to run");
			if (!run) return { message: "Cancelled." } as SuccessModel;
			const result = scaffoldAiTool(ctx.deps, VAULT_ROOT, name, desc || "An AI tool", run, disk);
			if ("error" in result) {
				return { error: result.error } as ErrorModel;
			}
			return { message: `Created tool at ${result.path}` } as SuccessModel;
		},
		renderer: renderAiNew,
	}),

	"ai:reference": adaptDescriptor<Record<string, unknown>, SuccessModel>({
		handler: (ctx) => {
			const { paths } = ctx.deps;
			const tools = loadAiTools(ctx.deps, VAULT_ROOT, ctx.deps.disk);
			const doc = generateAiToolReference(ctx.deps, tools);
			const outputPath = paths.join(CLI_PROJECT, "docs", "reference", "AI Tool Reference.md");
			doc.save(outputPath, ctx.deps.disk);
			return { message: `Reference saved to ${outputPath}` };
		},
		renderer: renderSuccess,
	}),

	"ai:run": adaptDescriptor<Record<string, unknown>, AiRunModel>({
		flags: {
			tool: { type: "string", required: true, hint: "Usage: flowti ai:run --tool=<name> [--param1=value1]" },
			"dry-run": { type: "boolean", default: false },
		},
		handler: (ctx) => {
			const { disk, paths, shell } = ctx.deps;
			const toolName = ctx.flags.tool as string;
			const tools = loadAiTools(ctx.deps, VAULT_ROOT, disk);
			const result = validateToolSelection(toolName, tools);
			if (!isLoadedTool(result)) {
				if ("notFound" in result) return result.notFound;
				return result.invalid;
			}
			const params = result.definition.params ?? [];
			// Need access to raw flags for param substitution — use ctx.flags which has been parsed
			const rawFlags = ctx.flags as Record<string, unknown>;
			const missing = params.filter((p) => p.required && rawFlags[p.name] === undefined);
			if (missing.length > 0) {
				return { params: missing.map((p) => ({ name: p.name, description: p.description })) } as MissingParamsModel;
			}
			const cmd = substituteParams(result.definition.run, params, rawFlags as Record<string, string | boolean>);
			const cwd = result.definition.cwd ? paths.join(VAULT_ROOT, result.definition.cwd) : VAULT_ROOT;
			if (ctx.flags["dry-run"]) {
				return { cmd, cwd } as DryRunModel;
			}
			// Fire-and-forget shell.run — renderRunning is a side-effect before execution
			renderRunning(toolName, ctx.deps.log);
			const { exitCode } = shell.runCaptureStatus(cmd, { cwd });
			return { toolName, exitCode } as ToolRunResultModel;
		},
		renderer: renderAiRun,
	}),
};
