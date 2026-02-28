/**
 * generate-e2e-report.mjs
 *
 * Generates E2E reports from test results:
 *   1. A top-level E2E Report with test suite results and journey summaries
 *   2. A dedicated Journey Report per journey with step-level detail + screenshots
 *
 * All outputs are written to both the test vault and the development vault.
 *
 * Usage: node scripts/generate-e2e-report.mjs
 *
 * Input:
 *   docs/reports/e2e/e2e-results.json                        (vitest JSON, temp)
 *   <test-vault>/Tested Journeys/<name>/<name>-results.json   (journey details)
 *
 * Output (test vault):
 *   <test-vault>/E2E Report.md                                          (E2E summary, stable name)
 *   <test-vault>/Tested Journeys/<name>/<name>.md                       (journey report)
 *   <test-vault>/Tested Journeys/<name>/screenshots/                    (journey screenshots)
 *
 * Output (dev vault mirror):
 *   docs/reports/e2e/runs/<timestamp>-e2e-report.md                     (E2E summary)
 *   docs/journeys/<name>/<name>.md                                      (journey report)
 *   docs/journeys/<name>/screenshots/                                   (journey screenshots)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.resolve(__dirname, "..");

// Vitest JSON lives in the plugin source (temp artifact)
const VITEST_RESULTS = path.join(PLUGIN_ROOT, "docs", "reports", "e2e", "e2e-results.json");

// Test vault: sibling to the main vault under the projects root
// pluginRoot  = c:\Projects\flowti\Development\flowti
// projects    = c:\Projects
// test vault  = c:\Projects\flowti-e2e
const PROJECTS_ROOT = path.resolve(PLUGIN_ROOT, "..", "..", "..");
const TEST_VAULT = process.env.E2E_VAULT_DIR ?? path.join(PROJECTS_ROOT, "flowti-e2e");

// Journey results live in the test vault
const JOURNEYS_DIR = path.join(TEST_VAULT, "Tested Journeys");

// Development vault — separated by artifact type
const DEV_RUNS_DIR = path.join(PLUGIN_ROOT, "docs", "reports", "e2e", "runs");
const DEV_TRACES_DIR = path.join(PLUGIN_ROOT, "docs", "reports", "e2e", "traces");
const DEV_JOURNEYS_DIR = path.join(PLUGIN_ROOT, "docs", "journeys");

// Plugin data.json candidates (for startup perf metrics)
const DATA_JSON_CANDIDATES = [
	path.resolve(PLUGIN_ROOT, "..", "..", ".obsidian", "plugins", "flowti-ibde", "data.json"),
	path.join(PLUGIN_ROOT, "data.json"),
];

/**
 * Resolves the E2E execution mode label from the E2E_JOURNEY env var.
 * Supports comma-separated journey names for multi-journey runs.
 *
 * Examples:
 *   (not set)                        → "full"
 *   "installer"                      → "installer"
 *   "getting-started"                → "getting-started"
 *   "getting-started,component-library" → "getting-started,component-library"
 *   "installer,getting-started"      → "installer,getting-started"
 */
function resolveMode() {
	const journey = process.env.E2E_JOURNEY;
	if (!journey) return "full";
	return journey;
}

function yamlEscape(value) {
	if (value === null || value === undefined) return "null";
	if (typeof value === "boolean" || typeof value === "number") return String(value);
	const str = String(value);
	if (/[:\n\r\t#'"{}[\],&*?]|^\s|\s$/.test(str)) return JSON.stringify(str);
	return str;
}

function formatDuration(ms) {
	if (ms < 1000) return `${ms}ms`;
	const totalSec = ms / 1000;
	if (totalSec < 60) return `${totalSec.toFixed(1)}s`;
	const min = Math.floor(totalSec / 60);
	const sec = Math.round(totalSec % 60);
	return sec > 0 ? `${min}m ${sec}s` : `${min}m`;
}

/**
 * Returns the callout type for a given status.
 *   - "pass"    → "success"
 *   - "fail"    → "danger"
 *   - "skipped" → "warning"
 */
function statusCallout(status) {
	if (status === "skipped") return "warning";
	return status === "pass" ? "success" : "danger";
}

/**
 * Determines a suite/journey result status.
 *   - "pass"    — at least one test passed, none failed
 *   - "fail"    — one or more tests failed
 *   - "skipped" — zero tests ran (upstream failure caused skip)
 */
function resolveStatus(passed, failed, total) {
	if (failed > 0) return "fail";
	if (passed > 0) return "pass";
	if (total === 0) return "skipped";
	return "skipped";
}

function statusLabel(status) {
	if (status === "skipped") return "SKIPPED";
	return status === "pass" ? "PASS" : "FAIL";
}

/** Reads vitest JSON reporter output and extracts test suite/case results. */
function readVitestResults() {
	if (!fs.existsSync(VITEST_RESULTS)) return null;

	const raw = JSON.parse(fs.readFileSync(VITEST_RESULTS, "utf-8"));

	const suites = [];
	let totalPassed = 0;
	let totalFailed = 0;
	let totalSkipped = 0;

	for (const file of raw.testResults ?? []) {
		const suiteName = path.basename(file.name, ".test.ts");
		const cases = [];

		// A file-level failure (e.g. beforeAll hook threw) marks the suite
		// as failed even though individual tests may show as "pending".
		const suiteHookFailed = file.status === "failed";

		for (const test of file.assertionResults ?? []) {
			const status = test.status ?? "unknown";
			if (status === "passed") totalPassed++;
			else if (status === "failed") totalFailed++;
			else totalSkipped++;

			cases.push({
				name: test.fullName ?? test.ancestorTitles?.join(" > ") ?? "unknown",
				status,
				durationMs: test.duration ?? 0,
				error: test.failureMessages?.join("\n") ?? null,
			});
		}

		// Count hook failures as suite-level failures — prevents
		// misleading "PASS" when beforeAll crashes but all tests are skipped.
		const caseFailed = cases.filter((c) => c.status === "failed").length;
		if (suiteHookFailed && caseFailed === 0) {
			totalFailed++;
		}

		// Extract the hook error message so the report can show WHERE it broke.
		// Vitest puts the error on the file-level `message` property.
		let hookError = null;
		if (suiteHookFailed) {
			hookError = file.message
				|| file.assertionResults?.find((t) => t.failureMessages?.length)?.failureMessages?.[0]
				|| "Hook failed (no details available)";
		}

		suites.push({
			name: suiteName,
			file: file.name,
			cases,
			hookError,
			suiteHookFailed,
			passed: cases.filter((c) => c.status === "passed").length,
			failed: caseFailed + (suiteHookFailed && caseFailed === 0 ? 1 : 0),
			skipped: cases.filter((c) => c.status !== "passed" && c.status !== "failed").length,
		});
	}

	return {
		totalPassed,
		totalFailed,
		totalSkipped,
		totalTests: totalPassed + totalFailed + totalSkipped,
		durationMs: raw.startTime ? Date.now() - raw.startTime : 0,
		suites,
	};
}

/** Reads all journey results from the test vault journeys directory. */
function readJourneyResults() {
	if (!fs.existsSync(JOURNEYS_DIR)) return [];

	const journeys = [];
	const entries = fs.readdirSync(JOURNEYS_DIR, { withFileTypes: true });

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;

		const journeyDir = path.join(JOURNEYS_DIR, entry.name);
		const resultsFile = path.join(journeyDir, `${entry.name}-results.json`);

		if (fs.existsSync(resultsFile)) {
			journeys.push({
				dir: journeyDir,
				data: JSON.parse(fs.readFileSync(resultsFile, "utf-8")),
			});
		}
	}

	return journeys;
}

/**
 * Generates a dedicated journey report with full step details and screenshots.
 * Returns the report filename (without path) for wikilink references.
 */
function generateJourneyReport(data, date) {
	const journeySlug = data.journey ?? "unknown";
	const journeyTitle = journeySlug
		.replace(/-/g, " ")
		.replace(/\b\w/g, (c) => c.toUpperCase());

	const totalSteps = data.totalSteps ?? 0;
	const passedSteps = data.passed ?? 0;
	const failedSteps = data.failed ?? 0;
	const journeyStatus = resolveStatus(passedSteps, failedSteps, totalSteps);

	const fm = {
		type: "JourneyReport",
		mode: resolveMode(),
		journey: journeySlug,
		date,
		total_steps: totalSteps,
		passed: passedSteps,
		failed: failedSteps,
		duration_ms: data.durationMs ?? 0,
		duration: formatDuration(data.durationMs ?? 0),
		success: journeyStatus === "pass",
		status: journeyStatus,
		...(data.testSource ? { test_source: `"[[${data.testSource}]]"` } : {}),
		e2e_report: `"[[E2E Report]]"`,
		tags: "\n  - report\n  - e2e\n  - journey",
	};

	const JOURNEY_PREFORMATTED = new Set(["tags", "test_source", "e2e_report"]);

	const frontmatter = [
		"---",
		...Object.entries(fm).map(([k, v]) => {
			if (JOURNEY_PREFORMATTED.has(k)) return `${k}: ${v}`;
			return `${k}: ${yamlEscape(v)}`;
		}),
		"---",
	].join("\n");

	const lines = [
		"",
		`# Journey: ${journeyTitle}`,
		"",
		`> [!${statusCallout(journeyStatus)}] ${statusLabel(journeyStatus)} — ` +
		`${passedSteps}/${totalSteps} steps | ` +
		`${formatDuration(data.durationMs ?? 0)}`,
		`> Mode: **${fm.mode}** | Source: \`${data.testSource ?? "unknown"}\``,
		"",
	];

	for (const stepResult of data.steps ?? []) {
		const s = stepResult.step;
		const stepStatus = stepResult.status === "pass" ? "pass" : stepResult.status === "fail" ? "fail" : "skipped";
		const stepCallout = statusCallout(stepStatus);
		const icon = statusLabel(stepStatus);

		lines.push(`## Step ${s.guideSection}: ${s.title}`);
		lines.push("");
		lines.push(`> [!${stepCallout}] ${icon} (${formatDuration(stepResult.durationMs)})`);

		if (stepResult.error) {
			lines.push(`> Error: ${stepResult.error}`);
		}

		// Enhanced error context (DOM state, recent events, plugin state)
		if (stepResult.errorContext) {
			const ctx = stepResult.errorContext;
			lines.push("");
			lines.push("> [!bug] Error Context");

			if (ctx.domSnapshot) {
				const ds = ctx.domSnapshot;
				lines.push(
					`> **Active view**: \`${ds.activeViewType}\` | Leaves: ${ds.leafCount} | Modal: ${ds.hasModal ? "yes" : "no"}`,
				);
				if (ds.notices && ds.notices.length > 0) {
					lines.push(
						`> **Notices**: ${ds.notices.map((n) => `\`${n.substring(0, 80)}\``).join(", ")}`,
					);
				}
				if (ds.visibleElements && ds.visibleElements.length > 0) {
					lines.push(`> **Visible**: ${ds.visibleElements.join(", ")}`);
				}
			}

			if (ctx.recentEvents && ctx.recentEvents.length > 0) {
				lines.push(">");
				lines.push("> **Recent Events** (last 10):");
				for (const e of ctx.recentEvents) {
					lines.push(`> - \`${e.type}\` (${e.relativeMs}ms ago)`);
				}
			}

			if (ctx.pluginState) {
				lines.push(">");
				lines.push(
					`> **Plugin**: loaded=${ctx.pluginState.loaded}, services=${ctx.pluginState.serviceCount}`,
				);
			}
		}

		lines.push("");

		if (s.description) {
			lines.push(s.description);
			lines.push("");
		}

		if (s.expectedInput || s.expectedOutput) {
			lines.push("| | |");
			lines.push("|---|---|");
			if (s.expectedInput) {
				lines.push(`| **Input** | ${s.expectedInput} |`);
			}
			if (s.expectedOutput) {
				lines.push(`| **Expected** | ${s.expectedOutput} |`);
			}
			lines.push("");
		}

		if (stepResult.screenshotFile) {
			lines.push(`![[${stepResult.screenshotFile}]]`);
			lines.push("");
		}
	}

	const content = frontmatter + lines.join("\n");

	return { title: journeyTitle, content };
}

/** Writes content to a file and logs the output path. */
function writeReport(dir, filename, content, label) {
	fs.mkdirSync(dir, { recursive: true });
	const outputPath = path.join(dir, filename);
	fs.writeFileSync(outputPath, content, "utf-8");
	console.log(`[report] ${label}: ${outputPath}`);
}

function round(n) {
	return Math.round(n * 100) / 100;
}

function percentile(sorted, p) {
	if (sorted.length === 0) return 0;
	const index = Math.ceil(p * sorted.length) - 1;
	return sorted[Math.max(0, index)];
}

function formatBytes(bytes) {
	if (bytes < 1024) return `${bytes}B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/** Reads the latest Event Trace JSON from the dev traces directory. */
function readLatestEventTrace() {
	if (!fs.existsSync(DEV_TRACES_DIR)) return null;

	const files = fs.readdirSync(DEV_TRACES_DIR)
		.filter((f) => f.endsWith("-Event Trace.json") || f.endsWith("-event-trace.json"))
		.sort()
		.reverse();

	if (files.length === 0) return null;

	try {
		return JSON.parse(fs.readFileSync(path.join(DEV_TRACES_DIR, files[0]), "utf-8"));
	} catch {
		return null;
	}
}

/** Reads startup history from plugin data.json. */
function readStartupPerf() {
	for (const candidate of DATA_JSON_CANDIDATES) {
		if (fs.existsSync(candidate)) {
			try {
				const data = JSON.parse(fs.readFileSync(candidate, "utf-8"));
				const sizeBytes = fs.statSync(candidate).size;
				const history = data?.perfAggregator?.startupHistory ?? [];
				return { history, sizeBytes };
			} catch { /* try next */ }
		}
	}
	return null;
}

/** Builds the Performance section lines for the E2E report. */
function buildPerfLines(startupPerf) {
	if (!startupPerf || startupPerf.history.length === 0) return [];

	const { history, sizeBytes } = startupPerf;
	const sorted = [...history].sort((a, b) => a - b);
	const last = round(history[history.length - 1] ?? 0);
	const p50 = round(percentile(sorted, 0.5));
	const p95 = round(percentile(sorted, 0.95));
	const max = round(sorted[sorted.length - 1] ?? 0);

	return [
		"## Performance",
		"",
		"> [!tip] Startup",
		`> Last: ${last}ms | p50: ${p50}ms | p95: ${p95}ms | Max: ${max}ms`,
		`> Measurements: ${history.length} | data.json: ${formatBytes(sizeBytes)}`,
		"",
	];
}

/** Builds the Event Trace section lines for the E2E report. */
function buildEventTraceLines(trace) {
	if (!trace) return [];

	const lines = [
		"## Event Trace",
		"",
		"> [!abstract] Trace Summary",
		`> Events: ${trace.summary?.totalEvents ?? 0} | Perf: ${trace.summary?.perfEvents ?? 0} | ` +
		`Types: ${trace.summary?.uniqueTypes ?? 0} | Duration: ${formatDuration(trace.durationMs ?? 0)}`,
		"",
	];

	// Top 15 events by frequency
	const freq = trace.summary?.eventFrequency;
	if (freq && Object.keys(freq).length > 0) {
		const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 15);
		lines.push("### Top Events");
		lines.push("");
		lines.push("| Event | Count |");
		lines.push("|---|---|");
		for (const [type, count] of sorted) {
			lines.push(`| \`${type}\` | ${count} |`);
		}
		lines.push("");
	}

	// Perf events summary (startup, storage, dispatches)
	const perfEvents = trace.perfEvents ?? [];
	if (perfEvents.length > 0) {
		const byCat = new Map();
		for (const e of perfEvents) {
			const cat = e.type.split(".").slice(0, 2).join(".");
			byCat.set(cat, (byCat.get(cat) ?? 0) + 1);
		}
		const sortedCats = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
		lines.push("### Perf Events");
		lines.push("");
		lines.push("| Category | Count |");
		lines.push("|---|---|");
		for (const [cat, count] of sortedCats) {
			lines.push(`| \`${cat}\` | ${count} |`);
		}
		lines.push("");
	}

	lines.push("Full details: [[Event Trace]]");
	lines.push("");

	return lines;
}

/** Copies screenshot .png files from src to dest directory. */
function copyScreenshots(srcDir, destDir) {
	if (!fs.existsSync(srcDir)) return;

	fs.mkdirSync(destDir, { recursive: true });
	for (const file of fs.readdirSync(srcDir)) {
		if (!file.endsWith(".png")) continue;
		fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
	}
}

function generateReport() {
	const vitest = readVitestResults();
	const journeys = readJourneyResults();

	if (!vitest && journeys.length === 0) {
		console.log("[report] No E2E results found — run E2E tests first.");
		return;
	}

	const now = new Date();
	const date = now.toISOString();

	// --- Journey reports (one per journey, inside their own folder) ---
	const journeyReportNames = [];

	for (const { dir, data } of journeys) {
		const { title, content } = generateJourneyReport(data, date);
		const filename = `${title}.md`;
		journeyReportNames.push({ title, data });

		// Write to test vault — inside the journey's own folder
		// e.g. Tested Journeys/Getting Started/Getting Started.md
		writeReport(dir, filename, content, "JourneyReport written");

		// Dev vault — current status file at journey root (stable name, overwrites)
		// e.g. docs/journeys/Getting Started/Getting Started.md
		const devJourneyDir = path.join(DEV_JOURNEYS_DIR, title);
		writeReport(devJourneyDir, filename, content, "JourneyReport mirrored");

		// Dev vault — timestamped archive in past-tests/ subfolder
		// e.g. docs/journeys/Getting Started/past-tests/2026-02-28T16-02-04.162Z-Getting Started.md
		const safeTs = now.toISOString().replace(/:/g, "-");
		const pastTestsDir = path.join(devJourneyDir, "past-tests");
		writeReport(pastTestsDir, `${safeTs}-${title}.md`, content, "JourneyReport archived");

		// Copy screenshots into the journey's own folder in dev vault
		const srcScreenshots = path.join(dir, "screenshots");
		const devScreenshots = path.join(devJourneyDir, "screenshots");
		copyScreenshots(srcScreenshots, devScreenshots);
	}

	// --- E2E summary report ---
	const totalPassed = vitest?.totalPassed ?? 0;
	const totalFailed = vitest?.totalFailed ?? 0;
	const totalSkipped = vitest?.totalSkipped ?? 0;
	const totalTests = vitest?.totalTests ?? 0;

	const totalDurationMs = vitest?.durationMs ?? 0;

	// Read perf/trace data for frontmatter
	const startupPerf = readStartupPerf();
	const trace = readLatestEventTrace();

	// Build wikilink arrays for frontmatter
	const testSuiteLinks = (vitest?.suites ?? []).map((s) => {
		const rel = path.relative(PLUGIN_ROOT, s.file).replace(/\\/g, "/");
		return `"[[${rel}]]"`;
	});
	const journeyReportLinks = journeyReportNames.map(({ title }) => `"[[${title}]]"`);

	const fm = {
		type: "E2EReport",
		mode: resolveMode(),
		date,
		total_tests: totalTests,
		passed: totalPassed,
		failed: totalFailed,
		skipped: totalSkipped,
		duration_ms: totalDurationMs,
		duration: formatDuration(totalDurationMs),
		journeys: journeys.length,
		success: totalFailed === 0,
		trace_events: trace?.summary?.totalEvents ?? 0,
		trace_perf_events: trace?.summary?.perfEvents ?? 0,
		startup_p50: startupPerf ? round(percentile([...startupPerf.history].sort((a, b) => a - b), 0.5)) : 0,
		test_suites: testSuiteLinks.length > 0
			? "\n" + testSuiteLinks.map((l) => `  - ${l}`).join("\n")
			: "[]",
		journey_reports: journeyReportLinks.length > 0
			? "\n" + journeyReportLinks.map((l) => `  - ${l}`).join("\n")
			: "[]",
		event_trace: `"[[Event Trace]]"`,
		tags: "\n  - report\n  - e2e",
	};

	const PREFORMATTED_KEYS = new Set(["tags", "test_suites", "journey_reports", "event_trace"]);

	const frontmatter = [
		"---",
		...Object.entries(fm).map(([k, v]) => {
			if (PREFORMATTED_KEYS.has(k)) return `${k}: ${v}`;
			return `${k}: ${yamlEscape(v)}`;
		}),
		"---",
	].join("\n");

	const lines = [
		"",
		"# E2E Report",
		"",
		"> [!info] Summary",
		`> Mode: **${fm.mode}** | Tests: ${totalTests} | Passed: ${totalPassed} | Failed: ${totalFailed} | Skipped: ${totalSkipped}`,
		`> Duration: ${formatDuration(totalDurationMs)}`,
		`> Result: ${fm.success ? "PASS" : "FAIL"}`,
		"",
	];

	// Units Under Test — show test source files for context
	if (vitest && vitest.suites.length > 0) {
		lines.push("## Units Under Test", "");
		for (const suite of vitest.suites) {
			const relativePath = path.relative(PLUGIN_ROOT, suite.file).replace(/\\/g, "/");
			lines.push(`- \`${relativePath}\``);
		}
		lines.push("");
	}

	// Test suites section
	if (vitest) {
		lines.push("## Test Suites", "");

		for (const suite of vitest.suites) {
			const suiteStatus = resolveStatus(suite.passed, suite.failed, suite.cases.length);
			const callout = statusCallout(suiteStatus);
			const icon = statusLabel(suiteStatus);

			lines.push(`### ${suite.name}`);
			lines.push("");
			lines.push(`> [!${callout}] ${icon} — ${suite.passed}/${suite.cases.length} passed`);

			// Show hook error so the reader can see WHERE the chain broke
			if (suite.hookError) {
				const firstLine = suite.hookError.split("\n")[0].substring(0, 200);
				lines.push(`> **Hook failure**: ${firstLine}`);
			}

			lines.push("");

			for (const c of suite.cases) {
				// Markers:
				//   [x] passed   — test ran and passed
				//   [!] failed   — test ran and failed (Obsidian renders as important)
				//   [ ] blocked  — never ran because a hook or prior test failed
				//   [-] skipped  — intentionally skipped (not due to failure)
				let mark;
				if (c.status === "passed") {
					mark = "[x]";
				} else if (c.status === "failed") {
					mark = "[!]";
				} else if (suite.suiteHookFailed) {
					mark = "[ ]";
				} else {
					mark = "[-]";
				}

				const dur = c.durationMs > 0 ? ` (${formatDuration(c.durationMs)})` : "";
				const blocked = suite.suiteHookFailed && c.status !== "passed" && c.status !== "failed"
					? " — *blocked*"
					: "";
				const displayName = c.name.includes(" > ")
					? c.name.substring(c.name.lastIndexOf(" > ") + 3)
					: c.name;
				lines.push(`- ${mark} ${displayName}${dur}${blocked}`);

				if (c.error) {
					lines.push(`  > Error: ${c.error.split("\n")[0]}`);
				}
			}
			lines.push("");
		}
	}

	// Performance section (from data.json startup history)
	lines.push(...buildPerfLines(startupPerf));

	// Event trace section (from latest event-trace.json)
	lines.push(...buildEventTraceLines(trace));

	// Journey summary section — wikilinks to dedicated journey reports
	if (journeyReportNames.length > 0) {
		lines.push("## Journeys", "");

		for (const { title, data } of journeyReportNames) {
			const jStatus = resolveStatus(data.passed ?? 0, data.failed ?? 0, data.totalSteps ?? 0);
			const callout = statusCallout(jStatus);

			lines.push(`### Journey: ${title}`);
			lines.push("");
			lines.push(
				`> [!${callout}] ${statusLabel(jStatus)} — ` +
				`${data.passed ?? 0}/${data.totalSteps ?? 0} steps | ` +
				`${formatDuration(data.durationMs ?? 0)}`,
			);
			lines.push("");
			lines.push(`Full details: [[${title}]]`);
			lines.push("");
		}
	}

	const content = frontmatter + lines.join("\n");

	const safeTimestamp = now.toISOString().replace(/:/g, "-");
	const e2eFilename = `${safeTimestamp}-e2e-report.md`;

	// Write to test vault — root of vault, stable name (overwrites previous run)
	writeReport(TEST_VAULT, "E2E Report.md", content, "E2EReport written");

	// Dev vault — stable name at reports/e2e/ root (current state, overwrites)
	const DEV_E2E_DIR = path.join(PLUGIN_ROOT, "docs", "reports", "e2e");
	writeReport(DEV_E2E_DIR, "E2E Report.md", content, "E2EReport current");

	// Dev vault — timestamped archive in runs/ subfolder
	writeReport(DEV_RUNS_DIR, e2eFilename, content, "E2EReport archived");

	// Clean up temp vitest results from plugin source
	try {
		if (fs.existsSync(VITEST_RESULTS)) {
			fs.rmSync(VITEST_RESULTS, { force: true });
		}
	} catch {
		// Ignore cleanup errors
	}

	// Clean up journey results JSON (screenshots stay)
	for (const { dir, data } of journeys) {
		try {
			const resultsFile = path.join(dir, `${data.journey}-results.json`);
			fs.rmSync(resultsFile, { force: true });
		} catch {
			// Ignore cleanup errors
		}
	}
}

generateReport();
