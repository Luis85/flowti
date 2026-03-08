/**
 * e2e-report-vitest.ts
 *
 * Vitest JSON parsing, suite/case extraction, and journey reconciliation.
 */

import { disk } from "../../../../infrastructure/filesystem.js";
import { paths } from "../../../../infrastructure/paths.js";
import { clock } from "../../../../infrastructure/clock.js";
import type {
	VitestCase, VitestSuite, VitestResults,
	JourneyEntry, StepResult,
} from "./e2e-report-types.js";

/** Parses a single vitest assertion result into a VitestCase. */
export function parseVitestCase(test: Record<string, unknown>): VitestCase {
	return {
		name: (test.fullName as string) ?? (test.ancestorTitles as string[] | undefined)?.join(" > ") ?? "unknown",
		status: (test.status as string) ?? "unknown",
		durationMs: (test.duration as number) ?? 0,
		error: (test.failureMessages as string[] | undefined)?.join("\n") ?? null,
	};
}

/** Extracts the hook error message from a vitest file result. */
export function extractHookError(file: Record<string, unknown>): string {
	return (file.message as string)
		|| ((file.assertionResults as Record<string, unknown>[] | undefined)
			?.find((t) => (t.failureMessages as string[] | undefined)?.length)
			?.failureMessages as string[] | undefined)?.[0]
		|| "Hook failed (no details available)";
}

/** Parses a single vitest file result into a VitestSuite and returns case-level totals. */
export function parseVitestSuite(file: Record<string, unknown>): { suite: VitestSuite; passed: number; failed: number; skipped: number } {
	const suiteName = paths.basename(file.name as string, ".test.ts");
	const cases = (file.assertionResults as Record<string, unknown>[] ?? []).map(parseVitestCase);
	const suiteHookFailed = file.status === "failed";

	let passed = 0, failed = 0, skipped = 0;
	for (const c of cases) {
		if (c.status === "passed") passed++;
		else if (c.status === "failed") failed++;
		else skipped++;
	}

	const caseFailed = cases.filter((c) => c.status === "failed").length;
	if (suiteHookFailed && caseFailed === 0) failed++;

	const hookError = suiteHookFailed ? extractHookError(file) : null;

	return {
		suite: {
			name: suiteName,
			file: file.name as string,
			cases,
			hookError,
			suiteHookFailed,
			passed: cases.filter((c) => c.status === "passed").length,
			failed: caseFailed + (suiteHookFailed && caseFailed === 0 ? 1 : 0),
			skipped: cases.filter((c) => c.status !== "passed" && c.status !== "failed").length,
		},
		passed,
		failed,
		skipped,
	};
}

/** Reads vitest JSON reporter output and extracts test suite/case results. */
export function readVitestResults(vitestResultsPath: string): VitestResults | null {
	if (!disk.existsSync(vitestResultsPath)) return null;

	const raw = JSON.parse(disk.readFileSync(vitestResultsPath, "utf-8")) as Record<string, unknown>;
	const files = raw.testResults as Record<string, unknown>[] ?? [];

	let totalPassed = 0, totalFailed = 0, totalSkipped = 0;
	const suites: VitestSuite[] = [];

	for (const file of files) {
		const { suite, passed, failed, skipped } = parseVitestSuite(file);
		suites.push(suite);
		totalPassed += passed;
		totalFailed += failed;
		totalSkipped += skipped;
	}

	return {
		totalPassed,
		totalFailed,
		totalSkipped,
		totalTests: totalPassed + totalFailed + totalSkipped,
		durationMs: (raw.startTime as number) ? clock.ms() - (raw.startTime as number) : 0,
		suites,
	};
}

/** Reads all journey results from the test vault journeys directory. */
export function readJourneyResults(journeysDir: string): JourneyEntry[] {
	if (!disk.existsSync(journeysDir)) return [];

	const journeys: JourneyEntry[] = [];
	const entries = disk.readdirSync(journeysDir, { withFileTypes: true });

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;

		const journeyDir = paths.join(journeysDir, entry.name);
		const resultsFile = paths.join(journeyDir, `${entry.name}-results.json`);

		if (disk.existsSync(resultsFile)) {
			journeys.push({
				dir: journeyDir,
				data: JSON.parse(disk.readFileSync(resultsFile, "utf-8")) as Record<string, unknown>,
			});
		}
	}

	return journeys;
}

// ── Reconciliation ──────────────────────────────────────────────

/** Maps a journey runner step status to the reconciled vitest status string. */
const JOURNEY_STATUS_MAP: Record<string, string> = {
	skip: "skipped",
	dev: "dev",
	fail: "failed",
	pass: "passed",
};

/** Builds the journey name → step statuses lookup from journey entries. */
export function buildJourneyStepMap(journeys: JourneyEntry[]): Map<string, Array<{ itBlock: string; status: string }>> {
	const map = new Map<string, Array<{ itBlock: string; status: string }>>();
	for (const { data } of journeys) {
		const name = data.journey as string;
		const steps = ((data.steps as StepResult[] ?? []) as StepResult[]).map((r) => ({
			itBlock: r.step?.itBlock ?? `${r.step?.guideSection} — ${r.step?.title}`,
			status: r.status,
		}));
		map.set(name, steps);
	}
	return map;
}

/** Finds a matching journey for a suite by slug comparison. */
export function findMatchingJourney(
	suiteName: string,
	journeyStepMap: Map<string, Array<{ itBlock: string; status: string }>>,
): Array<{ itBlock: string; status: string }> | null {
	for (const [name, steps] of journeyStepMap) {
		const slug = name.toLowerCase().replace(/\s+/g, "-");
		if (suiteName.includes(slug)) return steps;
	}
	return null;
}

/** Reconciles a single case against journey step data and returns the status category. */
export function reconcileCase(c: VitestCase, journeySteps: Array<{ itBlock: string; status: string }>): "passed" | "failed" | "skipped" | "dev" {
	const matchedStep = journeySteps.find((s) => c.name.includes(s.itBlock));
	if (matchedStep) {
		c.reconciledStatus = JOURNEY_STATUS_MAP[matchedStep.status] ?? "passed";
	} else {
		c.reconciledStatus = c.status;
	}
	if (c.reconciledStatus === "dev") return "dev";
	if (c.reconciledStatus === "passed") return "passed";
	if (c.reconciledStatus === "failed") return "failed";
	return "skipped";
}

/**
 * Reconciles vitest suite/case data with journey runner results.
 */
export function reconcileResults(vitest: VitestResults | null, journeys: JourneyEntry[]): VitestResults | null {
	if (!vitest || journeys.length === 0) return vitest;

	const journeyStepMap = buildJourneyStepMap(journeys);
	let totalPassed = 0, totalFailed = 0, totalSkipped = 0, totalDev = 0;

	for (const suite of vitest.suites) {
		const journeySteps = findMatchingJourney(suite.name, journeyStepMap);
		if (!journeySteps) {
			totalPassed += suite.passed;
			totalFailed += suite.failed;
			totalSkipped += suite.skipped;
			continue;
		}

		let suitePassed = 0, suiteFailed = 0, suiteSkipped = 0, suiteDev = 0;
		for (const c of suite.cases) {
			const category = reconcileCase(c, journeySteps);
			if (category === "passed") suitePassed++;
			else if (category === "failed") suiteFailed++;
			else if (category === "dev") suiteDev++;
			else suiteSkipped++;
		}

		suite.reconciledPassed = suitePassed;
		suite.reconciledFailed = suiteFailed;
		suite.reconciledSkipped = suiteSkipped;
		suite.reconciledDev = suiteDev;

		totalPassed += suitePassed;
		totalFailed += suiteFailed;
		totalSkipped += suiteSkipped;
		totalDev += suiteDev;
	}

	return { ...vitest, totalPassed, totalFailed, totalSkipped, totalDev, totalTests: totalPassed + totalFailed + totalSkipped + totalDev };
}
