/**
 * e2e-session.ts — Journey loading, session configuration, and step filtering.
 */

import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import { proc } from "../../infrastructure/proc.js";
import { input } from "../../infrastructure/input.js";
import { clock } from "../../infrastructure/clock.js";
import type { E2EPaths } from "./e2e-paths.js";
import type { JourneyEntry, SessionConfig, PrerequisiteResults } from "./e2e-types.js";
import { printJourneyTable } from "../../ui/e2e/e2e-formatters.js";

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

/** @deprecated Use `printJourneyTable` from `ui/e2e/e2e-formatters.ts` instead. */
export { printJourneyTable } from "../../ui/e2e/e2e-formatters.js";

// ── Step filtering ──────────────────────────────────────────────────

import { printStepTable } from "../../ui/e2e/e2e-formatters.js";

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

async function promptStepFilter(selectedSlugs: string[], e2e: E2EPaths, log: (msg: string) => void = () => {}): Promise<Record<string, "all" | string[]>> {
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
			log(`  → All ${steps.length} steps selected`);
		} else {
			log(`  → ${sel.length} of ${steps.length} steps selected`);
		}
	}

	return stepFilter;
}

// ── Session config prompt ───────────────────────────────────────────

export async function promptSessionConfig(entries: JourneyEntry[], prereqResults: PrerequisiteResults, e2e: E2EPaths, log: (msg: string) => void = () => {}): Promise<SessionConfig> {
	printJourneyTable(entries);
	const journeyInput = await input.ask('Enter journey numbers (e.g. "2" or "1 3 4") or "all"');

	if (!journeyInput) {
		log("  No selection — exiting.");
		proc.exit(0);
	}

	let selectedSlugs: string[];
	if (journeyInput.toLowerCase() === "all") {
		selectedSlugs = entries.map((e) => e.slug);
	} else {
		const indices = journeyInput.split(/[\s,]+/).map(Number).filter((n) => n >= 1 && n <= entries.length);
		if (indices.length === 0) {
			log("  Invalid selection — exiting.");
			proc.exit(1);
		}
		selectedSlugs = indices.map((i) => entries[i - 1].slug);
	}

	const stepFilter = await promptStepFilter(selectedSlugs, e2e, log);

	const timestamp = clock.safeIso().slice(0, 19);
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
	const timestamp = clock.safeIso().slice(0, 19);
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

/** @deprecated Use `printExecutionBanner` from `ui/e2e/e2e-formatters.ts` instead. */
export { printExecutionBanner } from "../../ui/e2e/e2e-formatters.js";

// ── Re-export session note functions ─────────────────────────────────
export { buildSessionFrontmatter, buildPrereqRows, writeSessionNote } from "./e2e-session-note.js";

/** @deprecated Use `printSessionSummary` from `ui/e2e/e2e-formatters.ts` instead. */
export { printSessionSummary as printSummary } from "../../ui/e2e/e2e-formatters.js";
