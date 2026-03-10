/**
 * publish.controller.ts — Controller for publish commands.
 *
 * Returns typed data models; rendering is handled by ui/publish-display.ts.
 */

import type { ControllerAction } from "../infrastructure/request-response.js";
import { adapt, dataResponse } from "../infrastructure/request-response.js";
import type { CommandHandler, ProjectContext } from "../infrastructure/types.js";
import { shell } from "../infrastructure/shell.js";
import { proc } from "../infrastructure/proc.js";
import { collectHealth } from "../domain/health/health.js";
import { scoreHealth } from "../domain/health/health-scoring.js";
import { evaluateQualityGates, type GateResult } from "../domain/health/quality-gate.js";
import { renderDryRun, renderGateResult, renderGateBlocked, type DryRunModel, type GateBlockedModel } from "../ui/publish-display.js";
import { renderNoProject, type NoProjectModel } from "../ui/common-renderers.js";

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

function checkGates(p: ProjectContext): GateResult | null {
	const gateConfig = p.config.health?.qualityGates;
	if (!gateConfig || gateConfig.enabled === false) return null;
	const snapshot = collectHealth(p);
	const score = scoreHealth(snapshot);
	return evaluateQualityGates(snapshot, score, gateConfig);
}

function noProjectResponse(command: string) {
	return dataResponse<NoProjectModel>({ command }, renderNoProject);
}

function gateBlockedResponse(gateResult: GateResult) {
	const blocked: GateBlockedModel = {
		message: "Publish blocked by quality gates.",
		hint: "Use --skip-gates to bypass, or fix the issues above.",
	};
	return {
		data: { gate: gateResult, blocked },
		render: (d: { gate: GateResult; blocked: GateBlockedModel }) => {
			renderGateResult(d.gate);
			renderGateBlocked(d.blocked);
		},
		exitCode: 1,
	};
}

// ── Controller actions ──────────────────────────────────────────────

const actions: Record<string, ControllerAction> = {
	publish: (req) => {
		if (req.flags["dry-run"]) {
			const model = resolvePublishConfig(req.project);
			return dataResponse(model, renderDryRun);
		}
		if (req.project && !req.flags["skip-gates"]) {
			const result = checkGates(req.project);
			if (result && !result.passed) {
				return gateBlockedResponse(result);
			}
		}
		const { buildCmd, cwd } = resolvePublishCommands(req.project);
		shell.run(buildCmd, { cwd, label: "Publishing..." });
	},

	"publish:all": (req) => {
		if (req.project && !req.flags["skip-gates"]) {
			const result = checkGates(req.project);
			if (result && !result.passed) {
				return gateBlockedResponse(result);
			}
		}
		const { buildCmd, testCmd, cwd } = resolvePublishCommands(req.project);
		const b = shell.run(buildCmd, { cwd, label: "Step 1/2: Building..." });
		if (b !== 0) proc.exit(b);
		const t = shell.run(testCmd, { cwd, label: "Step 2/2: Testing..." });
		if (t !== 0) proc.exit(t);
	},

	"publish:check": (req) => {
		if (!req.project) return noProjectResponse("publish:check");
		const snapshot = collectHealth(req.project);
		const score = scoreHealth(snapshot);
		const gateConfig = req.project.config.health?.qualityGates;
		const result = evaluateQualityGates(snapshot, score, gateConfig);

		return {
			data: result,
			render: renderGateResult,
			exitCode: result.passed ? undefined : 1,
		};
	},
};

// ── Adapted commands ────────────────────────────────────────────────

export const commands: Record<string, CommandHandler> = Object.fromEntries(
	Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
);
