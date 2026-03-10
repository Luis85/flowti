/**
 * e2e-session-note.ts — Session note generation for E2E test runs.
 */

import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import type { E2EPaths } from "./e2e-paths.js";
import type { SessionConfig, PrerequisiteResults, TestStats } from "./e2e-types.js";
import { yamlStr } from "./e2e-helpers.js";
import { loadJourneyEntries } from "./e2e-session.js";

// ── Session note ────────────────────────────────────────────────────

export function buildSessionFrontmatter(sessionName: string, config: SessionConfig, stats: TestStats, status: string, duration: string, now: Date): string[] {
	return [
		"---",
		"type: E2ESession",
		`session: ${yamlStr(sessionName)}`,
		`date: ${now.toISOString()}`,
		`status: ${status}`,
		`duration_s: ${duration}`,
		`total_tests: ${stats.totalTests}`,
		`passed: ${stats.passed}`,
		`failed: ${stats.failed}`,
		`skipped: ${stats.skipped}`,
		`installer: ${config.includeInstaller}`,
		`prerequisites: ${config.includePrerequisites}`,
		`journeys:`,
		...config.selectedSlugs.map((s) => `  - ${s}`),
		"tags:",
		"  - e2e",
		"  - session",
		"---",
	];
}

export function buildPrereqRows(prereqResults: PrerequisiteResults): string[] {
	return [
		`| Test vault exists | ${prereqResults.vaultExists ? "\u2713" : "\u2717"} |`,
		`| Plugin artifacts | ${prereqResults.artifactsPresent ? "\u2713" : "\u2717"} |`,
		`| Obsidian CLI responsive | ${prereqResults.cliResponsive ? "\u2713" : "\u2717"} |`,
		`| Vault installed | ${prereqResults.vaultInstalled ? "\u2713" : "\u25CB not yet"} |`,
		`| Test data present | ${prereqResults.testDataPresent ? "\u2713" : "\u25CB generated during setup"} |`,
	];
}

export function writeSessionNote(sessionName: string, config: SessionConfig, selectedNames: string[], prereqResults: PrerequisiteResults, stats: TestStats, startTime: number, exitCode: number, e2e: E2EPaths, log: (msg: string) => void = () => {}): string {
	const now = new Date();
	const duration = ((Date.now() - startTime) / 1000).toFixed(1);
	const status = exitCode === 0 ? "passed" : "failed";

	const journeyEntries = loadJourneyEntries(e2e);
	const journeyRows = config.selectedSlugs.map((slug, i) => {
		const name = selectedNames[i] || slug;
		const entry = journeyEntries.find((e) => e.slug === slug);
		return `| ${i + 1} | ${name} | ${entry ? entry.steps : "?"} |`;
	});

	const lines: string[] = [
		...buildSessionFrontmatter(sessionName, config, stats, status, duration, now),
		"",
		`# E2E Session: ${sessionName}`,
		"",
		`> [!${exitCode === 0 ? "success" : "danger"}] ${exitCode === 0 ? "All tests passed" : "Some tests failed"}`,
		`> Duration: ${duration}s | Tests: ${stats.totalTests} | Passed: ${stats.passed} | Failed: ${stats.failed} | Skipped: ${stats.skipped}`,
		"",
		"## Configuration",
		"",
		`| Setting | Value |`,
		`|---|---|`,
		`| Session | ${sessionName} |`,
		`| Date | ${now.toISOString().slice(0, 19).replace("T", " ")} |`,
		`| Installer | ${config.includeInstaller ? "yes" : "no"} |`,
		`| Prerequisites | ${config.includePrerequisites ? "force" : "skip"} |`,
		`| Journeys | ${selectedNames.join(", ")} |`,
		"",
		"---",
		"",
		"## Prerequisites (local)",
		"",
		`| Check | Status |`,
		`|---|---|`,
		...buildPrereqRows(prereqResults),
		"",
		"---",
		"",
		"## Journeys",
		"",
		`| # | Journey | Steps |`,
		`|---|---|---|`,
		...journeyRows,
		"",
		"---",
		"",
		"## Results",
		"",
		`| Metric | Value |`,
		`|---|---|`,
		`| Duration | ${duration}s |`,
		`| Total tests | ${stats.totalTests} |`,
		`| Passed | ${stats.passed} |`,
		`| Failed | ${stats.failed} |`,
		`| Skipped | ${stats.skipped} |`,
		`| Exit code | ${exitCode} |`,
		"",
		"---",
		"",
		"## Links",
		"",
		"- [[E2E Report]]",
		"- [[Event Trace]]",
		"",
	];

	const content = lines.join("\n");

	// Write to test vault
	const sessionDir = paths.join(e2e.testVault, "03 - Resources", "Sessions", sessionName);
	const notePath = paths.join(sessionDir, `${sessionName}.md`);
	disk.mkdirSync(sessionDir, { recursive: true });
	disk.writeFileSync(notePath, content, "utf-8");
	log(`[e2e] Session note written: ${notePath}`);

	// Mirror to dev vault
	const devSessionDir = paths.join(e2e.projectRoot, "docs", "reports", "e2e", "sessions", sessionName);
	const devNotePath = paths.join(devSessionDir, `${sessionName}.md`);
	disk.mkdirSync(devSessionDir, { recursive: true });
	disk.writeFileSync(devNotePath, content, "utf-8");
	log(`[e2e] Session note mirrored: ${devNotePath}`);

	return notePath;
}
