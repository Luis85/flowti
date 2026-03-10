/**
 * publish.ts — Non-interactive publish commands.
 *
 * Commands resolve scripts from the project's flowti.config.json publish section.
 * The interactive Publish menu lives in project-publish.ts.
 *
 * Quality gates integration: when `health.qualityGates.enabled` is true in config,
 * `publish` and `publish:all` check gates before executing. Use `publish:check`
 * to preview gate status without publishing.
 */

import { shell } from "../../infrastructure/shell.js";
import { proc } from "../../infrastructure/proc.js";
import { log } from "../../infrastructure/logger.js";
import { RESET, DIM, CYAN, GREEN, RED, YELLOW, BOLD } from "../../infrastructure/ui.js";
import { resolveFormat, printOutput } from "../../infrastructure/output.js";
import type { ProjectContext } from "../../infrastructure/types.js";
import { collectHealth } from "../health/health.js";
import { scoreHealth } from "../health/health-scoring.js";
import { evaluateQualityGates, type GateResult } from "../health/quality-gate.js";

// ── Helpers ─────────────────────────────────────────────────────────

function resolvePublishCommands(p: ProjectContext | undefined): { buildCmd: string; testCmd: string; cwd: string | undefined } {
	return {
		buildCmd: p?.config.publish?.build ?? "npm run build",
		testCmd: p?.config.publish?.test ?? "npm test",
		cwd: p?.path,
	};
}

function resolvePublishConfig(p: ProjectContext | undefined) {
	const pub = p?.config.publish;
	return {
		...resolvePublishCommands(p),
		endpoints: pub?.endpoints ?? [],
		outDir: pub?.outDir ?? "(not configured)",
		artifacts: pub?.artifacts ?? [],
	};
}

function displayDryRun(p: ProjectContext | undefined): void {
	const cfg = resolvePublishConfig(p);

	log(`\n  ${CYAN}Dry run — publish preview${RESET}\n`);
	log(`  ${DIM}Build command:${RESET}  ${cfg.buildCmd}`);
	log(`  ${DIM}Test command:${RESET}   ${cfg.testCmd}`);
	log(`  ${DIM}Output dir:${RESET}     ${cfg.outDir}`);

	if (cfg.artifacts.length > 0) {
		log(`  ${DIM}Artifacts:${RESET}      ${cfg.artifacts.join(", ")}`);
	}

	if (cfg.endpoints.length > 0) {
		log(`\n  ${DIM}Endpoints:${RESET}`);
		for (const ep of cfg.endpoints) {
			log(`    ${DIM}•${RESET} ${ep.name} → ${ep.path}`);
		}
	} else {
		log(`\n  ${DIM}No endpoints configured.${RESET}`);
	}
	log();
}

// ── Quality gate display ─────────────────────────────────────────────

function displayGateResult(result: GateResult): void {
	const status = result.passed
		? `${GREEN}${BOLD}PASSED${RESET}`
		: `${RED}${BOLD}FAILED${RESET}`;
	log(`\n  ${BOLD}Quality Gates:${RESET} ${status}\n`);

	if (result.scoreCheck) {
		const icon = result.scoreCheck.passed ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
		log(`  ${icon} Score ≥ ${result.scoreCheck.required}  ${DIM}(actual: ${result.scoreCheck.actual})${RESET}`);
	}

	for (const r of result.rules) {
		const icon = r.passed ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
		const actual = r.actual !== null ? r.actual : `${YELLOW}n/a${RESET}`;
		log(`  ${icon} ${r.rule.metric} ${r.rule.operator} ${r.rule.value}  ${DIM}(actual: ${actual})${RESET}`);
	}
	log();
}

/**
 * Run quality gates for a project. Returns the result, or null if gates
 * are not configured. Displays results and exits on failure unless `quiet`.
 */
function checkGates(p: ProjectContext, quiet = false): GateResult | null {
	const gateConfig = p.config.health?.qualityGates;
	if (!gateConfig || gateConfig.enabled === false) return null;

	const snapshot = collectHealth(p);
	const score = scoreHealth(snapshot);
	const result = evaluateQualityGates(snapshot, score, gateConfig);

	if (!quiet) displayGateResult(result);
	return result;
}

// ── Non-interactive commands ────────────────────────────────────────

export const commands: Record<string, (flags: Record<string, string | boolean>, rawArgs: string[], command?: string, project?: ProjectContext) => void> = {
	publish: (flags, _r, _c, p) => {
		if (flags["dry-run"]) {
			displayDryRun(p);
			return;
		}

		// Quality gate check (skip with --skip-gates)
		if (p && !flags["skip-gates"]) {
			const result = checkGates(p);
			if (result && !result.passed) {
				log(`  ${RED}Publish blocked by quality gates.${RESET}`);
				log(`  ${DIM}Use --skip-gates to bypass, or fix the issues above.${RESET}\n`);
				proc.exit(1);
			}
		}

		const { buildCmd, cwd } = resolvePublishCommands(p);
		shell.run(buildCmd, { cwd, label: "Publishing..." });
	},

	"publish:all": (flags, _r, _c, p) => {
		// Quality gate check (skip with --skip-gates)
		if (p && !flags["skip-gates"]) {
			const result = checkGates(p);
			if (result && !result.passed) {
				log(`  ${RED}Publish blocked by quality gates.${RESET}`);
				log(`  ${DIM}Use --skip-gates to bypass, or fix the issues above.${RESET}\n`);
				proc.exit(1);
			}
		}

		const { buildCmd, testCmd, cwd } = resolvePublishCommands(p);
		const b = shell.run(buildCmd, { cwd, label: "Step 1/2: Building..." });
		if (b !== 0) proc.exit(b);
		const t = shell.run(testCmd, { cwd, label: "Step 2/2: Testing..." });
		if (t !== 0) proc.exit(t);
	},

	"publish:check": (flags, _r, _c, p) => {
		if (!p) {
			log(`\n  ${RED}No project selected.${RESET}\n`);
			return;
		}

		const snapshot = collectHealth(p);
		const score = scoreHealth(snapshot);
		const gateConfig = p.config.health?.qualityGates;
		const result = evaluateQualityGates(snapshot, score, gateConfig);

		const format = resolveFormat(flags);
		printOutput(format, { ...result, score: score.overall, grade: score.grade }, () => {
			displayGateResult(result);
		});

		if (!result.passed) proc.exit(1);
	},
};
