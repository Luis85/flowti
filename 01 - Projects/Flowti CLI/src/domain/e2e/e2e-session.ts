/**
 * e2e-session.ts — Journey loading, session configuration, and step filtering.
 */

import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import { log } from "../../infrastructure/logger.js";
import { proc } from "../../infrastructure/proc.js";
import { input } from "../../infrastructure/input.js";
import type { E2EPaths } from "./e2e-paths.js";
import type { JourneyEntry, SessionConfig, PrerequisiteResults, TestStats } from "./e2e-types.js";

// ── Journey loading ─────────────────────────────────────────────────

export function loadJourneyEntries(e2e: E2EPaths): JourneyEntry[] {
	const files = disk.readdirSync(e2e.journeysDir)
		.filter((f) => f.endsWith(".journey"))
		.sort();

	return files.map((f) => {
		const def = JSON.parse(disk.readFileSync(paths.join(e2e.journeysDir, f), "utf-8")) as Record<string, unknown>;
		const slug = f.replace(".journey", "");
		return {
			slug,
			name: (def.journey as string) ?? slug,
			chapter: (def.chapter as string) ?? "?",
			steps: Array.isArray(def.steps) ? def.steps.length : 0,
			description: (def.description as string) ?? "",
		};
	});
}

export function printJourneyTable(entries: JourneyEntry[]): void {
	log("\n  Available Journeys:\n");
	log("  #  Ch  Name                          Steps  Description");
	log("  " + "-".repeat(78));
	for (let i = 0; i < entries.length; i++) {
		const e = entries[i];
		const num = String(i + 1).padStart(2, " ");
		const ch = String(e.chapter).padStart(2, " ");
		const name = e.name.padEnd(28);
		const steps = String(e.steps).padStart(5);
		const desc = e.description.length > 40 ? e.description.slice(0, 37) + "..." : e.description;
		log(`  ${num}  ${ch}  ${name}  ${steps}  ${desc}`);
	}
	log();
}

// ── Step filtering ──────────────────────────────────────────────────

function printStepTable(def: Record<string, unknown>, steps: Array<Record<string, unknown>>): void {
	const setupSteps = (def.setup as Array<Record<string, unknown>>) ?? [];
	const teardownSteps = (def.teardown as Array<Record<string, unknown>>) ?? [];
	const dim = "\x1b[2m";
	const reset = "\x1b[0m";
	log(`  Steps for ${def.journey} (${steps.length} steps):\n`);
	log("    #  ID                          Title");
	log("   " + "-".repeat(62));

	for (const s of setupSteps) {
		const id = ((s.id as string) ?? "setup").padEnd(26);
		log(`${dim}   ·  ${id}  ${s.title}  [setup]${reset}`);
	}
	for (let i = 0; i < steps.length; i++) {
		const s = steps[i];
		const num = String(i + 1).padStart(3);
		const id = ((s.id as string) ?? `step-${i + 1}`).padEnd(26);
		log(`  ${num}  ${id}  ${s.title}`);
	}
	for (const s of teardownSteps) {
		const id = ((s.id as string) ?? "teardown").padEnd(26);
		log(`${dim}   ·  ${id}  ${s.title}  [teardown]${reset}`);
	}
	log();
}

function parseStepInput(input: string, steps: Array<Record<string, unknown>>): string[] {
	const ids: string[] = [];
	for (const token of input.split(/[\s,]+/)) {
		const range = token.match(/^(\d+)-(\d+)$/);
		if (range) {
			const lo = Number(range[1]);
			const hi = Number(range[2]);
			for (let n = lo; n <= hi; n++) {
				if (n >= 1 && n <= steps.length) ids.push(steps[n - 1].id as string);
			}
		} else {
			const n = Number(token);
			if (n >= 1 && n <= steps.length) ids.push(steps[n - 1].id as string);
		}
	}
	return ids;
}

function resolveStepFilter(input: string, steps: Array<Record<string, unknown>>): "all" | string[] {
	const normalized = input.trim().toLowerCase();
	if (normalized === "all" || normalized === "") return "all";
	if (normalized === "none") return [];
	const ids = parseStepInput(input, steps);
	return ids.length > 0 ? ids : "all";
}

async function promptStepFilter(selectedSlugs: string[], e2e: E2EPaths): Promise<Record<string, "all" | string[]>> {
	const stepFilter: Record<string, "all" | string[]> = {};

	for (const slug of selectedSlugs) {
		const journeyPath = paths.join(e2e.journeysDir, `${slug}.journey`);
		if (!disk.existsSync(journeyPath)) {
			stepFilter[slug] = "all";
			continue;
		}

		const def = JSON.parse(disk.readFileSync(journeyPath, "utf-8")) as Record<string, unknown>;
		const steps = (def.steps as Array<Record<string, unknown>>) ?? [];
		if (steps.length === 0) {
			stepFilter[slug] = "all";
			continue;
		}

		printStepTable(def, steps);
		const stepInput = await input.ask('Steps (numbers/ranges, "all", or "none")', "all");
		stepFilter[slug] = resolveStepFilter(stepInput, steps);

		const sel = stepFilter[slug];
		if (sel === "all") {
			log(`  → All ${steps.length} steps selected\n`);
		} else {
			log(`  → ${sel.length} of ${steps.length} steps selected\n`);
		}
	}

	return stepFilter;
}

// ── Session config prompt ───────────────────────────────────────────

export async function promptSessionConfig(entries: JourneyEntry[], prereqResults: PrerequisiteResults, e2e: E2EPaths): Promise<SessionConfig> {
	printJourneyTable(entries);
	const journeyInput = await input.ask('Enter journey numbers (e.g. "2" or "1 3 4") or "all"');

	if (!journeyInput) {
		log("\n  No selection — exiting.\n");
		proc.exit(0);
	}

	let selectedSlugs: string[];
	if (journeyInput.toLowerCase() === "all") {
		selectedSlugs = entries.map((e) => e.slug);
	} else {
		const indices = journeyInput.split(/[\s,]+/).map(Number).filter((n) => n >= 1 && n <= entries.length);
		if (indices.length === 0) {
			log("\n  Invalid selection — exiting.\n");
			proc.exit(1);
		}
		selectedSlugs = indices.map((i) => entries[i - 1].slug);
	}

	log();

	const stepFilter = await promptStepFilter(selectedSlugs, e2e);

	const timestamp = new Date().toISOString().replace(/:/g, "-").slice(0, 19);
	const journeySuffix = selectedSlugs.length === entries.length
		? "all"
		: selectedSlugs.join("+");
	const autoName = `${timestamp} ${journeySuffix}`;
	const sessionName = await input.ask("Session name (Enter for auto)", autoName);

	const installerLabel = prereqResults.vaultInstalled
		? "Include installer? (force)"
		: "Include installer? (not installed)";
	const includeInstaller = await input.askYesNo(installerLabel, prereqResults.vaultInstalled);

	const prereqsMet = prereqResults.vaultInstalled && prereqResults.vaultExists && prereqResults.artifactsPresent;
	const prereqLabel = prereqsMet
		? "Include prerequisites? (force)"
		: "Include prerequisites? (not yet passed)";
	const includePrerequisites = await input.askYesNo(prereqLabel, prereqsMet);

	return { sessionName, selectedSlugs, includeInstaller, includePrerequisites, stepFilter };
}

// ── Session env management ──────────────────────────────────────────

export function buildStepFilterEnv(stepFilter: Record<string, "all" | string[]>): string | null {
	const parts: string[] = [];
	for (const [slug, filter] of Object.entries(stepFilter)) {
		if (filter !== "all" && Array.isArray(filter) && filter.length > 0) {
			parts.push(`${slug}:${filter.join(",")}`);
		}
	}
	return parts.length > 0 ? parts.join(";") : null;
}

export function configureSessionEnv(config: SessionConfig): void {
	const allSlugs = [...config.selectedSlugs];
	if (config.includeInstaller && !allSlugs.includes("installer")) {
		allSlugs.unshift("installer");
	}
	proc.env().E2E_JOURNEY = allSlugs.join(",");
	proc.env().E2E_SESSION_NAME = config.sessionName;
	if (config.includeInstaller) proc.env().E2E_RUN_INSTALLER = "true";
	if (config.includePrerequisites) proc.env().E2E_RUN_PREREQUISITES = "true";

	if (config.stepFilter) {
		const stepsEnv = buildStepFilterEnv(config.stepFilter);
		if (stepsEnv) proc.env().E2E_STEPS = stepsEnv;
	}
}

export function cleanSessionEnv(): void {
	delete proc.env().E2E_JOURNEY;
	delete proc.env().E2E_SESSION_NAME;
	delete proc.env().E2E_RUN_INSTALLER;
	delete proc.env().E2E_RUN_PREREQUISITES;
	delete proc.env().E2E_STEPS;
}

// ── Session utilities ───────────────────────────────────────────────

export function rerunWithFreshTimestamp(prevConfig: SessionConfig, entries: JourneyEntry[]): SessionConfig {
	const timestamp = new Date().toISOString().replace(/:/g, "-").slice(0, 19);
	const journeySuffix = prevConfig.selectedSlugs.length === entries.length
		? "all"
		: prevConfig.selectedSlugs.join("+");
	return {
		...prevConfig,
		sessionName: `${timestamp} ${journeySuffix}`,
	};
}

export function resolveJourneyNames(slugs: string[], entries: JourneyEntry[]): string[] {
	return slugs.map((slug) => {
		const entry = entries.find((e) => e.slug === slug);
		return entry ? entry.name : slug;
	});
}

export function printExecutionBanner(config: SessionConfig, selectedNames: string[]): void {
	log(`\n  Starting session "${config.sessionName}"...`);
	log(`    Journeys:       ${selectedNames.join(", ")}`);
	const hasStepFilter = config.stepFilter && Object.values(config.stepFilter).some((f) => f !== "all");
	if (hasStepFilter) {
		for (const [slug, filter] of Object.entries(config.stepFilter)) {
			if (filter !== "all" && Array.isArray(filter)) {
				log(`    Steps (${slug}): ${filter.join(", ")}`);
			}
		}
	}
	log(`    Installer:      ${config.includeInstaller ? "yes" : "no"}`);
	log(`    Prerequisites:  ${config.includePrerequisites ? "force" : "skip"}`);
	log();
}

// ── Re-export session note functions ─────────────────────────────────
export { buildSessionFrontmatter, buildPrereqRows, writeSessionNote } from "./e2e-session-note.js";

// ── Summary printing ────────────────────────────────────────────────

export function printSummary(sessionName: string, selectedNames: string[], startTime: number, stats: TestStats): void {
	const duration = ((Date.now() - startTime) / 1000).toFixed(1);
	const failColor = stats.failed > 0 ? "\x1b[31m" : "\x1b[32m";
	const reset = "\x1b[0m";

	log(`\n  ${"=".repeat(60)}`);
	log(`  Session Summary: ${sessionName}`);
	log(`  ${"=".repeat(60)}\n`);
	log(`  Duration:     ${duration}s`);
	log(`  Journeys:     ${selectedNames.length} (${selectedNames.join(", ")})`);
	log(`  Tests:        ${stats.totalTests} total`);
	log(`  Passed:       \x1b[32m${stats.passed}${reset}`);
	log(`  Failed:       ${failColor}${stats.failed}${reset}`);
	log(`  Skipped:      ${stats.skipped}`);
	log(`  Report:       docs/reports/e2e/E2E Report.md`);
	log();
}
