/**
 * publish.controller.ts — Controller for publish commands.
 *
 * Returns typed data models; rendering is handled by ui/publish-display.ts.
 */

import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler, ProjectContext } from "../infrastructure/types.js";
import type { LogFn } from "../infrastructure/command-engine.js";
import type { CliDeps } from "../infrastructure/deps.js";
import { collectHealth } from "../domain/health/health.js";
import { scoreHealth } from "../domain/health/health-scoring.js";
import { evaluateQualityGates, type GateResult } from "../domain/health/quality-gate.js";
import { renderDryRun, renderGateResult, renderGateBlocked, type DryRunModel, type GateBlockedModel } from "../ui/displays/publish-display.js";
import { renderShellCommand, type ShellCommandModel } from "../ui/renderers/common-renderers.js";
import { renderNoProject, type NoProjectModel } from "../ui/renderers/common-renderers.js";

// ── Helpers ─────────────────────────────────────────────────────────

function resolvePublishCommands(p: ProjectContext | undefined): { buildCmd: string; testCmd: string; cwd: string | undefined } {
	return {
		buildCmd: p?.config.publish?.build ?? "npm run build",
		testCmd: p?.config.publish?.test ?? "npm test",
		cwd: p?.path,
	};
}

function resolvePublishConfig(p: ProjectContext | undefined): DryRunModel {
	const pub = p?.config.publish;
	const cmds = resolvePublishCommands(p);
	return {
		buildCmd: cmds.buildCmd,
		testCmd: cmds.testCmd,
		outDir: pub?.outDir ?? "(not configured)",
		artifacts: pub?.artifacts ?? [],
		endpoints: pub?.endpoints ?? [],
	};
}

function checkGates(deps: Pick<CliDeps, "disk" | "paths" | "shell">, p: ProjectContext): GateResult | null {
	const gateConfig = p.config.health?.qualityGates;
	if (!gateConfig || gateConfig.enabled === false) return null;
	const snapshot = collectHealth(deps, p);
	const score = scoreHealth(snapshot);
	return evaluateQualityGates(snapshot, score, gateConfig);
}

// ── Model types ─────────────────────────────────────────────────────

type PublishAllModel = ShellCommandModel;
type PublishCheckModel = GateResult | NoProjectModel;
type PublishDryRunOrRun = DryRunModel | ShellCommandModel | { gate: GateResult; blocked: GateBlockedModel };

function isGateBlocked(m: unknown): m is { gate: GateResult; blocked: GateBlockedModel } {
	return typeof m === "object" && m !== null && "gate" in m && "blocked" in m;
}

function isDryRun(m: unknown): m is DryRunModel {
	return typeof m === "object" && m !== null && "buildCmd" in m && "testCmd" in m && "outDir" in m;
}

function isNoProject(m: unknown): m is NoProjectModel {
	return typeof m === "object" && m !== null && "command" in m && !("passed" in m);
}

// ── Commands ────────────────────────────────────────────────────────

export const commands: Record<string, CommandHandler> = {
	publish: adaptDescriptor<Record<string, unknown>, PublishDryRunOrRun>({
		flags: {
			"dry-run": { type: "boolean", default: false },
			"skip-gates": { type: "boolean", default: false },
		},
		handler: (ctx) => {
			if (ctx.flags["dry-run"]) {
				return resolvePublishConfig(ctx.project);
			}
			const { disk, paths, shell } = ctx.deps;
			if (ctx.project && !ctx.flags["skip-gates"]) {
				const result = checkGates({ disk, paths, shell }, ctx.project);
				if (result && !result.passed) {
					const blocked: GateBlockedModel = {
						message: "Publish blocked by quality gates.",
						hint: "Use --skip-gates to bypass, or fix the issues above.",
					};
					return { gate: result, blocked };
				}
			}
			const { buildCmd, cwd } = resolvePublishCommands(ctx.project);
			const exitCode = shell.run(buildCmd, { cwd, label: "Publishing..." });
			return { command: buildCmd, exitCode, label: "publish" };
		},
		renderer: (data: PublishDryRunOrRun, log: LogFn) => {
			if (isGateBlocked(data)) {
				renderGateResult(data.gate, log);
				renderGateBlocked(data.blocked, log);
				return;
			}
			if (isDryRun(data)) {
				renderDryRun(data, log);
				return;
			}
			renderShellCommand(data as ShellCommandModel, log);
		},
		exitCode: (model) => {
			if (isGateBlocked(model)) return 1;
			if ("exitCode" in model && typeof model.exitCode === "number" && model.exitCode !== 0) return model.exitCode;
			return undefined;
		},
	}),

	"publish:all": adaptDescriptor<Record<string, unknown>, PublishAllModel | { gate: GateResult; blocked: GateBlockedModel }>({
		flags: {
			"skip-gates": { type: "boolean", default: false },
		},
		handler: (ctx) => {
			const { disk, paths, shell } = ctx.deps;
			if (ctx.project && !ctx.flags["skip-gates"]) {
				const result = checkGates({ disk, paths, shell }, ctx.project);
				if (result && !result.passed) {
					const blocked: GateBlockedModel = {
						message: "Publish blocked by quality gates.",
						hint: "Use --skip-gates to bypass, or fix the issues above.",
					};
					return { gate: result, blocked };
				}
			}
			const { buildCmd, testCmd, cwd } = resolvePublishCommands(ctx.project);
			const b = shell.run(buildCmd, { cwd, label: "Step 1/2: Building..." });
			if (b !== 0) {
				return { command: buildCmd, exitCode: b, label: "publish:all" };
			}
			const t = shell.run(testCmd, { cwd, label: "Step 2/2: Testing..." });
			if (t !== 0) {
				return { command: testCmd, exitCode: t, label: "publish:all" };
			}
			return { command: `${buildCmd} && ${testCmd}`, exitCode: 0, label: "publish:all" };
		},
		renderer: (data, log: LogFn) => {
			if (isGateBlocked(data)) {
				renderGateResult(data.gate, log);
				renderGateBlocked(data.blocked, log);
				return;
			}
			renderShellCommand(data as ShellCommandModel, log);
		},
		exitCode: (model) => {
			if (isGateBlocked(model)) return 1;
			const shell = model as ShellCommandModel;
			if (shell.exitCode !== 0) return shell.exitCode;
			return undefined;
		},
	}),

	"publish:check": adaptDescriptor<Record<string, unknown>, PublishCheckModel>({
		requires: "project",
		handler: (ctx) => {
			const { disk, paths, shell } = ctx.deps;
			const snapshot = collectHealth({ disk, paths, shell }, ctx.project!);
			const score = scoreHealth(snapshot);
			const gateConfig = ctx.project!.config.health?.qualityGates;
			return evaluateQualityGates(snapshot, score, gateConfig);
		},
		renderer: (data: PublishCheckModel, log: LogFn) => {
			if (isNoProject(data)) {
				renderNoProject(data, log);
				return;
			}
			renderGateResult(data as GateResult, log);
		},
		exitCode: (model) => {
			if ("passed" in model && !model.passed) return 1;
			return undefined;
		},
	}),
};
