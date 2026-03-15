/**
 * publish.controller.ts — Controller for publish commands.
 *
 * Returns typed data models; rendering is handled by ui/publish-display.ts.
 */

import type { ControllerAction } from "../infrastructure/request-response.js";
import { adapt, dataResponse } from "../infrastructure/request-response.js";
import type { CommandHandler, ProjectContext } from "../infrastructure/types.js";
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

function noProjectResponse(log: CliDeps["log"], command: string) {
	return dataResponse<NoProjectModel>({ command }, (d) => renderNoProject(d, log));
}

function gateBlockedResponse(gateResult: GateResult, log: (msg?: string) => void) {
	const blocked: GateBlockedModel = {
		message: "Publish blocked by quality gates.",
		hint: "Use --skip-gates to bypass, or fix the issues above.",
	};
	return {
		data: { gate: gateResult, blocked },
		render: (d: { gate: GateResult; blocked: GateBlockedModel }) => {
			renderGateResult(d.gate, log);
			renderGateBlocked(d.blocked, log);
		},
		exitCode: 1,
	};
}

// ── Controller actions ──────────────────────────────────────────────

const actions: Record<string, ControllerAction> = {
	publish: (req) => {
		if (req.flags["dry-run"]) {
			const model = resolvePublishConfig(req.project);
			return dataResponse(model, (d) => renderDryRun(d, req.deps.log));
		}
		const { disk, paths, shell } = req.deps;
		if (req.project && !req.flags["skip-gates"]) {
			const result = checkGates({ disk, paths, shell }, req.project);
			if (result && !result.passed) {
				return gateBlockedResponse(result, req.deps.log);
			}
		}
		const { buildCmd, cwd } = resolvePublishCommands(req.project);
		const exitCode = shell.run(buildCmd, { cwd, label: "Publishing..." });
		const model: ShellCommandModel = { command: buildCmd, exitCode, label: "publish" };
		return dataResponse(model, (d) => renderShellCommand(d, req.deps.log));
	},

	"publish:all": (req) => {
		const { disk, paths, shell, log } = req.deps;
		if (req.project && !req.flags["skip-gates"]) {
			const result = checkGates({ disk, paths, shell }, req.project);
			if (result && !result.passed) {
				return gateBlockedResponse(result, req.deps.log);
			}
		}
		const { buildCmd, testCmd, cwd } = resolvePublishCommands(req.project);
		const b = shell.run(buildCmd, { cwd, label: "Step 1/2: Building..." });
		if (b !== 0) {
			const model: ShellCommandModel = { command: buildCmd, exitCode: b, label: "publish:all" };
			return { data: model, render: (d: ShellCommandModel) => renderShellCommand(d, log), exitCode: b };
		}
		const t = shell.run(testCmd, { cwd, label: "Step 2/2: Testing..." });
		if (t !== 0) {
			const model: ShellCommandModel = { command: testCmd, exitCode: t, label: "publish:all" };
			return { data: model, render: (d: ShellCommandModel) => renderShellCommand(d, log), exitCode: t };
		}
		const model: ShellCommandModel = { command: `${buildCmd} && ${testCmd}`, exitCode: 0, label: "publish:all" };
		return dataResponse(model, (d) => renderShellCommand(d, log));
	},

	"publish:check": (req) => {
		if (!req.project) return noProjectResponse(req.deps.log, "publish:check");
		const { disk, paths, shell } = req.deps;
		const snapshot = collectHealth({ disk, paths, shell }, req.project);
		const score = scoreHealth(snapshot);
		const gateConfig = req.project.config.health?.qualityGates;
		const result = evaluateQualityGates(snapshot, score, gateConfig);

		const { log } = req.deps;
		return {
			data: result,
			render: (d: GateResult) => renderGateResult(d, log),
			exitCode: result.passed ? undefined : 1,
		};
	},
};

// ── Adapted commands ────────────────────────────────────────────────

export const commands: Record<string, CommandHandler> = Object.fromEntries(
	Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
);
