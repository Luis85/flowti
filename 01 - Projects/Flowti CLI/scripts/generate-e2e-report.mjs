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
 *   <test-vault>/docs/journeys/<name>/<name>-results.json              (journey details)
 *
 * Output (test vault):
 *   <test-vault>/E2E Report.md                                                    (E2E summary, stable name)
 *   <test-vault>/docs/journeys/<name>/<name>.md                                   (journey report)
 *   <test-vault>/docs/journeys/<name>/screenshots/                                (journey screenshots)
 *
 * Output (dev vault mirror):
 *   docs/reports/e2e/runs/<timestamp>-e2e-report.md                     (E2E summary)
 *   docs/journeys/<name>/<name>.md                                      (journey report)
 *   docs/journeys/<name>/screenshots/                                   (journey screenshots)
 */

import fs from "node:fs";
import path from "node:path";
import { VAULT_ROOT, PLUGIN_ROOT } from "../src/infrastructure/config.mjs";
import { Document, yamlEscape } from "../src/infrastructure/document.mjs";

// Vitest JSON lives in the plugin source (temp artifact)
const VITEST_RESULTS = path.join(PLUGIN_ROOT, "docs", "reports", "e2e", "e2e-results.json");

// Test vault: sibling to the main vault under the projects root
// vaultRoot   = c:\Projects\flowti
// projects    = c:\Projects
// test vault  = c:\Projects\flowti-e2e
const PROJECTS_ROOT = path.resolve(VAULT_ROOT, "..");
const TEST_VAULT = process.env.E2E_VAULT_DIR ?? path.join(PROJECTS_ROOT, "flowti-e2e");

// Journey results live in the test vault
const JOURNEYS_DIR = path.join(TEST_VAULT, "docs", "journeys");

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

/**
 * Resolves {{key}} template variables in a string using a variables map.
 * Returns the original string if no variables map is provided.
 */
function resolveVars(template, variables) {
	if (!template) return "";
	return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
		if (variables && key in variables) return variables[key];
		return "\u2014"; // unresolved variable (step was skipped or variable not set)
	});
}

function formatDuration(ms) {
	if (ms < 1000) return `${Math.round(ms)}ms`;
	const totalSec = ms / 1000;
	if (totalSec < 60) return `${totalSec.toFixed(1)}s`;
	const min = Math.floor(totalSec / 60);
	const sec = Math.round(totalSec % 60);
	return sec > 0 ? `${min}m ${sec}s` : `${min}m`;
}

/**
 * Returns the callout type for a given status.
 *   - "pass"         → "success"
 *   - "fail"         → "danger"
 *   - "skipped"      → "warning"
 *   - "partial-pass" → "warning"
 *   - "dev"          → "info"
 *   - "dev-stopped"  → "info"
 */
function statusCallout(status) {
	if (status === "partial-pass") return "warning";
	if (status === "skipped") return "warning";
	if (status === "dev" || status === "dev-stopped") return "info";
	return status === "pass" ? "success" : "danger";
}

/**
 * Determines a suite/journey result status.
 *   - "pass"         — at least one test passed, none failed, none skipped, no warnings
 *   - "partial-pass" — at least one test passed, none failed, but skipped or warned
 *   - "fail"         — one or more tests failed
 *   - "dev-stopped"  — journey terminated at a dev boundary (no real failures)
 *   - "skipped"      — zero tests ran (upstream failure caused skip)
 */
function resolveStatus(passed, failed, total, skipped = 0, hasWarnings = false, devStopped = false) {
	if (devStopped) return "dev-stopped";
	if (failed > 0) return "fail";
	if (passed > 0 && (skipped > 0 || hasWarnings)) return "partial-pass";
	if (passed > 0) return "pass";
	if (total === 0) return "skipped";
	return "skipped";
}

function statusLabel(status) {
	if (status === "partial-pass") return "PARTIAL PASS";
	if (status === "skipped") return "SKIPPED";
	if (status === "dev-stopped") return "DEV";
	if (status === "dev") return "DEV";
	return status === "pass" ? "PASS" : "FAIL";
}

/**
 * Computes action statistics from journey result data.
 * Aggregates counts per tool type across all steps.
 */
function computeActionStats(data) {
	const stats = {
		total: 0,
		screenshots: 0,
		assertions: 0,
		manualChecks: 0,
		manualPassed: 0,
		manualFailed: 0,
		visualInspections: 0,
		notices: 0,
		themeChanges: 0,
		createFiles: 0,
		deleteFiles: 0,
		openFiles: 0,
		closeLeaves: 0,
		tools: new Set(),
	};

	for (const stepResult of data.steps ?? []) {
		const actions = stepResult.step?.actions ?? [];
		for (const action of actions) {
			stats.total++;
			stats.tools.add(action.tool);
			switch (action.tool) {
				case "screenshot": stats.screenshots++; break;
				case "assert": stats.assertions++; break;
				case "manual": stats.manualChecks++; break;
				case "visual-inspection": stats.visualInspections++; break;
				case "notice": stats.notices++; break;
				case "theme": stats.themeChanges++; break;
				case "create-file": stats.createFiles++; break;
				case "delete-file": stats.deleteFiles++; break;
				case "open-file": stats.openFiles++; break;
				case "close-leaves": stats.closeLeaves++; break;
			}
		}
		// Count manual verification results
		for (const mv of stepResult.manualVerifications ?? []) {
			if (mv.status === "pass") stats.manualPassed++;
			else stats.manualFailed++;
		}
	}

	return {
		total: stats.total,
		screenshots: stats.screenshots,
		assertions: stats.assertions,
		manual_checks: stats.manualChecks,
		manual_passed: stats.manualPassed,
		manual_failed: stats.manualFailed,
		visual_inspections: stats.visualInspections,
		notices: stats.notices,
		theme_changes: stats.themeChanges,
		create_files: stats.createFiles,
		delete_files: stats.deleteFiles,
		open_files: stats.openFiles,
		close_leaves: stats.closeLeaves,
		tools: [...stats.tools].sort(),
	};
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
 * Reconciles vitest suite/case data with journey runner results.
 *
 * Vitest doesn't know about journey-level skipping or dev boundaries — it sees
 * all early-returning it() blocks as "passed". The journey runner has the real
 * step statuses (pass, fail, skip, dev). This function overlays journey data
 * onto matching vitest cases so downstream report sections use correct numbers.
 *
 * For each vitest suite, we look for a matching journey (by name). For each
 * vitest case in that suite, we match it to a journey step by checking if the
 * case name contains the step's itBlock. Matched cases get their status overridden.
 *
 * Returns updated vitest data with reconciled totals.
 */
function reconcileResults(vitest, journeys) {
	if (!vitest || journeys.length === 0) return vitest;

	// Build a lookup: journey name → step statuses
	// Journey step itBlock is like "5 — Export journey JSON"
	// Vitest case name is like "Journey Builder 5 — Export journey JSON"
	const journeyStepMap = new Map();
	for (const { data } of journeys) {
		const name = data.journey;
		const steps = (data.steps ?? []).map((r) => ({
			itBlock: r.step?.itBlock ?? `${r.step?.guideSection} — ${r.step?.title}`,
			status: r.status, // "pass", "fail", "skip", "dev"
		}));
		journeyStepMap.set(name, steps);
	}

	let totalPassed = 0;
	let totalFailed = 0;
	let totalSkipped = 0;
	let totalDev = 0;

	for (const suite of vitest.suites) {
		// Find matching journey by checking if the suite name matches a journey name slug
		// Suite names are like "90-journey-journey-builder", journey names like "Journey Builder"
		let matchedJourney = null;
		for (const [name, steps] of journeyStepMap) {
			// Match by checking if the suite name contains the journey slug
			const slug = name.toLowerCase().replace(/\s+/g, "-");
			if (suite.name.includes(slug)) {
				matchedJourney = { name, steps };
				break;
			}
		}

		if (!matchedJourney) {
			// Non-journey suite (e.g. prerequisites) — keep vitest numbers as-is
			totalPassed += suite.passed;
			totalFailed += suite.failed;
			totalSkipped += suite.skipped;
			continue;
		}

		// Reconcile each case in this suite with journey step data
		let suitePassed = 0;
		let suiteFailed = 0;
		let suiteSkipped = 0;
		let suiteDev = 0;

		for (const c of suite.cases) {
			// Find matching journey step by itBlock
			const matchedStep = matchedJourney.steps.find((s) =>
				c.name.includes(s.itBlock),
			);

			if (matchedStep) {
				// Override vitest status with journey runner's truth
				if (matchedStep.status === "skip") {
					c.reconciledStatus = "skipped";
					suiteSkipped++;
				} else if (matchedStep.status === "dev") {
					c.reconciledStatus = "dev";
					suiteDev++;
				} else if (matchedStep.status === "fail") {
					c.reconciledStatus = "failed";
					suiteFailed++;
				} else {
					// "pass" — keep as passed
					c.reconciledStatus = "passed";
					suitePassed++;
				}
			} else {
				// No matching journey step — use vitest status
				c.reconciledStatus = c.status;
				if (c.status === "passed") suitePassed++;
				else if (c.status === "failed") suiteFailed++;
				else suiteSkipped++;
			}
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

	return {
		...vitest,
		totalPassed,
		totalFailed,
		totalSkipped,
		totalDev,
		totalTests: totalPassed + totalFailed + totalSkipped + totalDev,
	};
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
	const skippedSteps = data.skipped ?? 0;
	const devSteps = data.dev ?? 0;
	const hasWarnings = (data.steps ?? []).some((r) => r.warnings && r.warnings.length > 0);
	const isDevStopped = data.devStopped === true;
	const journeyStatus = resolveStatus(passedSteps, failedSteps, totalSteps, skippedSteps, hasWarnings, isDevStopped);
	const actionStats = computeActionStats(data);

	const doc = Document.create(`Journey: ${journeyTitle}`);

	doc.mergeFrontmatter({
		type: "JourneyReport",
		mode: resolveMode(),
		journey: journeySlug,
		date,
		total_steps: totalSteps,
		passed: passedSteps,
		failed: failedSteps,
		skipped: skippedSteps,
	});
	if (devSteps > 0) doc.setFrontmatter("dev", devSteps);
	if (isDevStopped) doc.setFrontmatter("dev_stopped", true);
	doc.mergeFrontmatter({
		total_actions: actionStats.total,
		screenshots: actionStats.screenshots,
		assertions: actionStats.assertions,
		manual_checks: actionStats.manual_checks,
	});
	if (actionStats.manual_passed > 0) doc.setFrontmatter("manual_passed", actionStats.manual_passed);
	if (actionStats.manual_failed > 0) doc.setFrontmatter("manual_failed", actionStats.manual_failed);
	doc.mergeFrontmatter({
		visual_inspections: actionStats.visual_inspections,
		notices: actionStats.notices,
		theme_changes: actionStats.theme_changes,
		create_files: actionStats.create_files,
		delete_files: actionStats.delete_files,
		open_files: actionStats.open_files,
		close_leaves: actionStats.close_leaves,
	});
	if (actionStats.tools.length > 0) {
		doc.setFrontmatter("tools", actionStats.tools);
	} else {
		doc.setRawFrontmatter("tools", "[]");
	}
	doc.mergeFrontmatter({
		duration_ms: data.durationMs ?? 0,
		duration: formatDuration(data.durationMs ?? 0),
		success: journeyStatus === "pass" || journeyStatus === "partial-pass" || journeyStatus === "dev-stopped",
		status: journeyStatus,
	});
	if (data.testSource) doc.setRawFrontmatter("test_source", `"[[${data.testSource}]]"`);
	doc.setRawFrontmatter("e2e_report", '"[[E2E Report]]"');
	doc.setRawFrontmatter("canvas", `"[[${journeyTitle}]]"`);
	const tags = ["report", "e2e", "journey"];
	if (journeyStatus === "partial-pass") tags.push("partial");
	else if (journeyStatus === "dev-stopped") tags.push("dev");
	doc.setTags(tags);

	const titleSuffix = journeyStatus === "partial-pass" ? " (Partial)"
		: journeyStatus === "dev-stopped" ? " (Dev)" : "";
	const stepsSummary = isDevStopped
		? `${passedSteps}/${totalSteps} steps (${devSteps} dev, ${skippedSteps} skipped)`
		: skippedSteps > 0
			? `${passedSteps}/${totalSteps} steps (${skippedSteps} skipped)`
			: `${passedSteps}/${totalSteps} steps`;

	doc.addBlank()
		.heading(1, `Journey: ${journeyTitle}${titleSuffix}`)
		.addBlank();
	doc.callout(statusCallout(journeyStatus), `${statusLabel(journeyStatus)} — ${stepsSummary} | ${formatDuration(data.durationMs ?? 0)}`, [
		`Mode: **${resolveMode()}** | Source: \`${data.testSource ?? "unknown"}\``,
		`Actions: ${actionStats.total} | Screenshots: ${actionStats.screenshots} | Assertions: ${actionStats.assertions} | Manual: ${actionStats.manual_checks}` + (actionStats.visual_inspections > 0 ? ` | Visual: ${actionStats.visual_inspections}` : "") + ` | Notices: ${actionStats.notices}` + (actionStats.theme_changes > 0 ? ` | Themes: ${actionStats.theme_changes}` : ""),
		`Tools: ${actionStats.tools.map((t) => `\`${t}\``).join(" ")}`,
	]);
	doc.addBlank()
		.text(`Canvas: [[${journeyTitle}.canvas|${journeyTitle} Canvas]]`)
		.addBlank()
		.addSeparator()
		.addBlank();

	// ── Partition steps by phase ──
	const allSteps = data.steps ?? [];
	const setupSteps = allSteps.filter((r) => r.step?.phase === "setup");
	const journeySteps = allSteps.filter((r) => !r.step?.phase || r.step.phase === "journey");
	const teardownSteps = allSteps.filter((r) => r.step?.phase === "teardown");

	const vars = data.variables ?? {};

	/** Renders a single step result into the document. */
	function renderStep(stepResult) {
		const s = stepResult.step;
		const rawStatus = stepResult.status === "dev" ? "dev"
			: stepResult.status === "pass" ? "pass"
			: stepResult.status === "fail" ? "fail"
			: "skipped";
		const hasStepWarnings = stepResult.warnings && stepResult.warnings.length > 0;
		const stepStatus = (rawStatus === "pass" && hasStepWarnings) ? "partial-pass" : rawStatus;
		const stepCallout = statusCallout(stepStatus);
		const icon = statusLabel(stepStatus);

		const statusTag = stepStatus === "fail" ? " FAIL"
			: stepStatus === "skipped" ? " [SKIP]"
			: stepStatus === "dev" ? " [DEV]"
			: "";
		doc.heading(3, `Step ${s.guideSection}: ${s.title}${statusTag}`);
		doc.addBlank();

		const mainCalloutLines = [];
		if (stepResult.error) {
			mainCalloutLines.push(`**Error**: ${stepResult.error}`);
		}
		doc.callout(stepCallout, `${icon} (${formatDuration(stepResult.durationMs)})`, mainCalloutLines);

		// Enhanced error context (DOM state, recent events, plugin state)
		if (stepResult.errorContext) {
			const ctx = stepResult.errorContext;
			doc.addBlank();

			const ecLines = [];
			if (ctx.domSnapshot) {
				const ds = ctx.domSnapshot;
				ecLines.push(
					`**Active view**: \`${ds.activeViewType}\` | Leaves: ${ds.leafCount} | Modal: ${ds.hasModal ? "yes" : "no"}`,
				);
				if (ds.notices && ds.notices.length > 0) {
					ecLines.push(
						`**Notices**: ${ds.notices.map((n) => `\`${n.substring(0, 80)}\``).join(", ")}`,
					);
				}
				if (ds.visibleElements && ds.visibleElements.length > 0) {
					ecLines.push(`**Visible**: ${ds.visibleElements.join(", ")}`);
				}
			}

			if (ctx.recentEvents && ctx.recentEvents.length > 0) {
				ecLines.push("");
				ecLines.push("**Recent Events** (last 10):");
				for (const e of ctx.recentEvents) {
					ecLines.push(`- \`${e.type}\` (${e.relativeMs}ms ago)`);
				}
			}

			if (ctx.consoleErrors && ctx.consoleErrors.length > 0) {
				ecLines.push("");
				ecLines.push("**Console Errors**:");
				for (const e of ctx.consoleErrors) {
					ecLines.push(`- \`${e.substring(0, 120)}\``);
				}
			}

			if (ctx.availableVariables && ctx.availableVariables.length > 0) {
				ecLines.push("");
				ecLines.push(
					`**Variables**: ${ctx.availableVariables.map((v) => `\`${v}\``).join(", ")}`,
				);
			}

			if (ctx.pluginState) {
				ecLines.push("");
				ecLines.push(
					`**Plugin**: loaded=${ctx.pluginState.loaded}, services=${ctx.pluginState.serviceCount}`,
				);
			}

			doc.callout("bug", "Error Context", ecLines);
		}

		doc.addBlank();

		if (s.description) {
			doc.text(s.description);
			doc.addBlank();
		}

		if (s.expectedInput || s.expectedOutput) {
			doc.text("| | |");
			doc.text("|---|---|");
			if (s.expectedInput) {
				doc.text(`| **Input** | ${s.expectedInput} |`);
			}
			if (s.expectedOutput) {
				doc.text(`| **Expected** | ${s.expectedOutput} |`);
			}
			doc.addBlank();
		}

		const screenshots = stepResult.screenshotFiles ??
			(stepResult.screenshotFile ? [stepResult.screenshotFile] : []);
		for (const file of screenshots) {
			doc.text(`![[${file}]]`);
		}
		if (screenshots.length > 0) doc.addBlank();

		// Manual actions — interactive verification or static checklist fallback
		const manualActions = (s.actions ?? []).filter((a) => a.tool === "manual");
		const manualResults = stepResult.manualVerifications ?? [];
		if (manualResults.length > 0) {
			const allPassed = manualResults.every((m) => m.status === "pass");
			const mqCallout = allPassed ? "success" : "failure";
			const mqLabel = allPassed ? "Manual QA — PASSED" : "Manual QA — FAILED";
			const mqLines = [];
			for (const m of manualResults) {
				const mqIcon = m.status === "pass" ? "✓" : "✗";
				mqLines.push(`- ${mqIcon} ${m.instruction}`);
				if (m.notes) mqLines.push(`  *Notes*: ${m.notes}`);
			}
			doc.callout(mqCallout, mqLabel, mqLines);
			doc.addBlank();
		} else if (manualActions.length > 0) {
			doc.callout("todo", "Manual QA", manualActions.map((m) => `- [ ] ${resolveVars(m.instruction, vars)}`));
			doc.addBlank();
		}

		// Visual inspection actions — interactive pass/fail checkpoints
		const viActions = (s.actions ?? []).filter((a) => a.tool === "visual-inspection");
		if (viActions.length > 0) {
			const hasWarnings = stepResult.warnings && stepResult.warnings.length > 0;
			const viCallout = hasWarnings ? "warning" : "eye";
			const viLabel = hasWarnings ? "Visual Inspection — FAILED" : "Visual Inspection";
			const viLines = viActions.map((vi) => `- ${resolveVars(vi.prompt, vars)}`);
			if (hasWarnings) {
				viLines.push("");
				for (const w of stepResult.warnings) {
					const reasonMatch = w.match(/\nReason:\s*(.+)/);
					const reason = reasonMatch ? reasonMatch[1].trim() : w;
					viLines.push(`**Reason**: ${reason}`);
				}
			}
			doc.callout(viCallout, viLabel, viLines);
			doc.addBlank();
		}

		// Step-level warnings (visual-inspection soft-fails) — shown even without vi actions
		if (!viActions.length && stepResult.warnings && stepResult.warnings.length > 0) {
			doc.callout("warning", "Warnings", stepResult.warnings.map((w) => `- ${w}`));
			doc.addBlank();
		}

		// Notice actions — runtime annotations shown during test execution
		const noticeActions = (s.actions ?? []).filter((a) => a.tool === "notice");
		if (noticeActions.length > 0) {
			const nLines = noticeActions.map((n) => {
				const dur = n.duration ? ` (${n.duration}ms)` : "";
				return `- ${resolveVars(n.message, vars)}${dur}`;
			});
			doc.callout("quote", "Notices", nLines);
			doc.addBlank();
		}
	}

	// ── Render Setup section ──
	if (setupSteps.length > 0) {
		const setupPassed = setupSteps.filter((r) => r.status === "pass").length;
		doc.heading(2, `Setup (${setupPassed}/${setupSteps.length})`);
		doc.addBlank();
		for (const stepResult of setupSteps) {
			renderStep(stepResult);
		}
		doc.addSeparator().addBlank();
	}

	// ── Render Journey steps ──
	doc.heading(2, `Steps (${passedSteps}/${totalSteps})`);
	doc.addBlank();
	for (const stepResult of journeySteps) {
		renderStep(stepResult);
	}
	doc.addSeparator().addBlank();

	// ── Render Teardown section ──
	if (teardownSteps.length > 0) {
		const teardownPassed = teardownSteps.filter((r) => r.status === "pass").length;
		doc.heading(2, `Teardown (${teardownPassed}/${teardownSteps.length})`);
		doc.addBlank();
		for (const stepResult of teardownSteps) {
			renderStep(stepResult);
		}
		doc.addSeparator().addBlank();
	}

	const content = doc.toString();

	return { title: journeyTitle, status: journeyStatus, content };
}

// ── Canvas Layout Constants ─────────────────────────────────────
const GROUP_WIDTH = 947;
const GROUP_HEIGHT = 600;
const GROUP_SPACING_X = 120;
const INNER_MARGIN_LEFT = 370; // offset from group left — leaves screenshot visible
const ACTION_WIDTH = 560;
const CANVAS_PREFIX = "e2e-";

// Circle nodes (Start, Events, End)
const CIRCLE_WIDTH = 280;
const CIRCLE_HEIGHT = 239;
const START_X = -460;
const FIRST_GROUP_X = 170; // absolute x of first group

// UI context badges (inside groups, right section)
const UI_BADGE_Y = 216;
const UI_BADGE_WIDTH = 250;
const UI_BADGE_HEIGHT = 68;
const UI_BADGE_GAP_X = 60;
const UI_COMPONENTS_Y = 304;
const UI_COMPONENTS_HEIGHT = 80;

// Action node (inside groups, bottom section)
const ACTION_Y_WITH_UI = 404;
const ACTION_HEIGHT_WITH_UI = 168;
const ACTION_Y_NO_UI = 216;
const ACTION_MARGIN_BOTTOM = 28;

// Result badge (inside groups, top-right — shows it() checklist item + metadata)
const RESULT_BADGE_WIDTH = 560;
const RESULT_BADGE_HEIGHT = 180;

// Action groups (vertical stack below step groups)
const ACTION_GROUP_WIDTH = 400;
const ACTION_GROUP_HEIGHT_SCREENSHOT = 300;
const ACTION_GROUP_HEIGHT_DEFAULT = 100;
const ACTION_GROUP_GAP_Y = 3 * ACTION_GROUP_HEIGHT_DEFAULT;         // 3× node height between actions
const ACTION_GROUP_START_Y = GROUP_HEIGHT + 4 * ACTION_GROUP_HEIGHT_DEFAULT; // 4× node height from step to first action

// Events summary
const EVENTS_SIZE = 420;

// Improvement card dimensions (yellow cards stacked above step groups)
const IMPROVEMENT_WIDTH = ACTION_GROUP_WIDTH * 2;                    // 2× normal node width
const IMPROVEMENT_HEIGHT = ACTION_GROUP_HEIGHT_DEFAULT * 3;          // 3× normal node height
const IMPROVEMENT_GAP = ACTION_GROUP_HEIGHT_DEFAULT * 2;             // 2× node height spacing between cards

/**
 * Returns a color code for an action tool type on the canvas.
 *   - screenshot → 6 (cyan)
 *   - assert → 4 (green)
 *   - manual → 3 (yellow)
 *   - notice → 5 (purple)
 *   - emit → 1 (red)
 *   - theme → 2 (orange)
 *   - lifecycle tools → 0 (gray)
 *   - others → undefined (default)
 */
function actionColor(tool) {
	switch (tool) {
		case "screenshot": return "6";
		case "assert": return "4";
		case "manual": return "3";
		case "visual-inspection": return "3";
		case "notice": return "5";
		case "emit": return "1";
		case "theme": return "2";
		case "create-file":
		case "delete-file":
		case "open-file":
		case "close-leaves":
			return "0";
		default: return undefined;
	}
}

/**
 * Formats a single action into a concise text label for canvas rendering.
 */
function formatActionText(action, vars) {
	const desc = action.description ? `\n${action.description}` : "";
	const r = (s) => resolveVars(s, vars);
	switch (action.tool) {
		case "command":
			return `**command** \`${r(action.id)}\`${desc}`;
		case "click":
			return `**click** \`${action.selector}\`${desc}`;
		case "input":
			return `**input** \`${action.selector}\`\n→ "${r(action.value)}"${desc}`;
		case "highlight":
			return `**highlight** \`${action.selector}\` [${action.style ?? "element"}]${desc}`;
		case "wait":
			return `**wait** ${action.ms}ms`;
		case "screenshot":
			return `**screenshot** ${action.label ?? "(auto)"}${desc}`;
		case "navigate":
			return `**navigate** ${r(action.hub)} → ${r(action.tab)}${desc}`;
		case "assert":
			if (action.type === "visible" || action.type === "not-visible" || action.type === "text") {
				return `**assert ${action.type}** \`${action.selector}\`${desc}`;
			}
			if (action.type === "event") return `**assert event** \`${r(action.event)}\`${desc}`;
			if (action.type === "leaf") return `**assert leaf** \`${r(action.viewType)}\`${desc}`;
			return `**assert ${action.type}**${desc}`;
		case "emit":
			return `**emit** \`${r(action.event)}\`${desc}`;
		case "eval":
			return `**eval**${action.store ? ` → \`${action.store}\`` : ""}${desc}`;
		case "notice":
			return `**notice** ${r(action.message)}${desc}`;
		case "manual":
			return `**manual**\n${r(action.instruction)}`;
		case "visual-inspection":
			return `**visual-inspection**\n${r(action.prompt)}`;
		case "theme":
			return `**theme** → \`${r(action.theme)}\`${desc}`;
		case "create-file":
			return `**create-file** \`${r(action.path)}\`${desc}`;
		case "delete-file":
			return `**delete-file** \`${r(action.path)}\`${desc}`;
		case "open-file":
			return `**open-file** \`${r(action.path)}\`${desc}`;
		case "close-leaves":
			return `**close-leaves** \`${r(action.viewType)}\`${desc}`;
		default:
			return `**${action.tool}**${desc}`;
	}
}

/**
 * Generates an Obsidian Canvas JSON object for a journey.
 * Pure function — no I/O.
 *
 * Layout: START (circle) → Step groups (with screenshot backgrounds) → Events (circle) → END (circle)
 * All elements flow left-to-right along a shared vertical baseline.
 * Each step group contains: UI context nodes (top), action node (bottom).
 *
 * @param {object} data - Journey results (from <name>-results.json)
 * @param {string} screenshotBasePath - Vault-root-relative path to screenshots folder
 * @param {object|null} trace - Optional event trace summary
 * @param {string|null} configFilePath - Vault-root-relative path to the config JSON file
 * @returns {{ metadata: object, nodes: object[], edges: object[] }}
 */
function generateJourneyCanvas(data, screenshotBasePath, trace, configFilePath) {
	const nId = (key) => `${CANVAS_PREFIX}n-${key}`;
	const gId = (key) => `${CANVAS_PREFIX}g-${key}`;
	const eId = (from, to) => `${CANVAS_PREFIX}e-${from}-${to}`;

	const statusColor = (status) => {
		if (status === "pass") return "4"; // green
		if (status === "partial-pass") return "5"; // yellow/orange
		if (status === "fail") return "1"; // red
		return undefined;
	};

	const statusLabel = (status) => {
		if (status === "pass") return "PASS";
		if (status === "fail") return "FAIL";
		return "SKIP";
	};

	const canvasVars = data.variables ?? {};

	const journeySlug = data.journey ?? "unknown";
	const journeyTitle = journeySlug
		.replace(/-/g, " ")
		.replace(/\b\w/g, (c) => c.toUpperCase());
	const steps = data.steps ?? [];
	const passedSteps = data.passed ?? 0;
	const failedSteps = data.failed ?? 0;
	const skippedSteps = data.skipped ?? 0;
	const totalSteps = data.totalSteps ?? 0;
	const journeyPassed = failedSteps === 0 && passedSteps > 0;
	const journeyPartial = journeyPassed && skippedSteps > 0;

	const circleCenterY = Math.round((GROUP_HEIGHT - CIRCLE_HEIGHT) / 2);

	const nodes = [];
	const edges = [];

	// ── START node (circle) ──
	nodes.push({
		id: nId("start"),
		type: "text",
		text: `# Start\n**${journeyTitle}**\n${data.date?.substring(0, 10) ?? ""}`,
		styleAttributes: { shape: "circle", textAlign: "center" },
		x: START_X,
		y: circleCenterY,
		width: CIRCLE_WIDTH,
		height: CIRCLE_HEIGHT,
		color: "4",
	});

	// ── Config file node (below START) ──
	if (configFilePath) {
		const CONFIG_FILE_WIDTH = 400;
		const CONFIG_FILE_HEIGHT = 400;
		nodes.push({
			id: nId("config"),
			type: "file",
			file: configFilePath,
			x: START_X - Math.round((CONFIG_FILE_WIDTH - CIRCLE_WIDTH) / 2),
			y: circleCenterY + CIRCLE_HEIGHT + 60,
			width: CONFIG_FILE_WIDTH,
			height: CONFIG_FILE_HEIGHT,
		});

		// Edge: config → start
		edges.push({
			id: eId("config", "start"),
			fromNode: nId("config"),
			fromSide: "top",
			toNode: nId("start"),
			toSide: "bottom",
		});
	}

	// ── Step groups + action nodes + UI context nodes ──
	let prevNodeId = nId("start");
	const firstGroupX = FIRST_GROUP_X;

	for (let i = 0; i < steps.length; i++) {
		const stepResult = steps[i];
		const s = stepResult.step;
		const groupX = firstGroupX + i * (GROUP_WIDTH + GROUP_SPACING_X);
		const hasStepWarnings = stepResult.warnings && stepResult.warnings.length > 0;
		const effectiveStatus = (stepResult.status === "pass" && hasStepWarnings) ? "partial-pass" : stepResult.status;
		const stepColor = statusColor(effectiveStatus);

		// Screenshot path (vault-root-relative) — use first screenshot for canvas background
		const stepScreenshots = stepResult.screenshotFiles ??
			(stepResult.screenshotFile ? [stepResult.screenshotFile] : []);
		const screenshotPath = stepScreenshots.length > 0
			? `${screenshotBasePath}/${stepScreenshots[0]}`
			: null;

		// Group node — screenshot as background
		const groupNode = {
			id: gId(s.id),
			type: "group",
			backgroundStyle: "ratio",
			label: `${s.guideSection}. ${s.title}`,
			x: groupX,
			y: 0,
			width: GROUP_WIDTH,
			height: GROUP_HEIGHT,
		};
		if (stepColor) groupNode.color = stepColor;
		if (screenshotPath) {
			groupNode.background = screenshotPath;
		}
		nodes.push(groupNode);

		// Step config node — shows the full step configuration as a structured card
		const innerX = groupX + INNER_MARGIN_LEFT;
		const durationStr = stepResult.durationMs ? formatDuration(stepResult.durationMs) : "";
		const cb = (stepResult.status === "pass" && hasStepWarnings) ? "[~]"
			: stepResult.status === "pass" ? "[x]"
			: stepResult.status === "fail" ? "[!]"
			: "[ ]";

		const configLines = [];

		// Test context — describe() and it() blocks
		const describeStr = s.describeBlock ?? data.journey ?? "";
		const itStr = s.itBlock ?? `${s.guideSection} — ${s.title}`;
		configLines.push(`**describe** ${describeStr}`);
		configLines.push(`- ${cb} **it** ${itStr} (${durationStr})`);
		configLines.push("");

		// Description
		if (s.description) {
			configLines.push(s.description);
			configLines.push("");
		}

		// Input / Output
		if (s.expectedInput) configLines.push(`**Input**: ${s.expectedInput}`);
		if (s.expectedOutput) configLines.push(`**Expected**: ${s.expectedOutput}`);
		if (s.expectedInput || s.expectedOutput) configLines.push("");

		// UI context
		const ui = s.uiContext;
		if (ui?.viewName) configLines.push(`**View**: ${ui.viewName} (\`${ui.view}\`)`);
		if (ui?.tabName) configLines.push(`**Tab**: ${ui.tabName} (\`${ui.tab}\`)`);

		// Components
		if (ui?.components?.length) {
			configLines.push(`**Components**: ${ui.components.map((c) => `\`${c}\``).join(" ")}`);
		}

		// Events
		if (s.events?.length) {
			configLines.push(`**Events**: ${s.events.map((e) => `\`${e}\``).join(" ")}`);
		}

		// Commands
		if (s.commands?.length) {
			configLines.push(`**Commands**: ${s.commands.map((c) => `\`${c}\``).join(" ")}`);
		}

		// Queries
		if (s.queries?.length) {
			configLines.push(`**Queries**: ${s.queries.map((q) => `\`${q}\``).join(" ")}`);
		}

		// Interactions
		if (s.interactions?.length) {
			configLines.push(`**Interactions**: ${s.interactions.map((i) => `*${i}*`).join(", ")}`);
		}

		// Manual actions — dynamic results or static checklist fallback
		const canvasManualActions = (s.actions ?? []).filter((a) => a.tool === "manual");
		const canvasManualResults = stepResult.manualVerifications ?? [];
		if (canvasManualResults.length > 0) {
			const allPassed = canvasManualResults.every((m) => m.status === "pass");
			configLines.push("");
			configLines.push(allPassed ? "**Manual QA — PASSED**:" : "**Manual QA — FAILED**:");
			for (const m of canvasManualResults) {
				const icon = m.status === "pass" ? "✓" : "✗";
				configLines.push(`- ${icon} ${m.instruction}`);
				if (m.notes) configLines.push(`  *Notes*: ${m.notes}`);
			}
		} else if (canvasManualActions.length > 0) {
			configLines.push("");
			configLines.push("**Manual QA**:");
			for (const m of canvasManualActions) {
				configLines.push(`- [ ] ${resolveVars(m.instruction, canvasVars)}`);
			}
		}

		// Visual inspection actions
		const viActions = (s.actions ?? []).filter((a) => a.tool === "visual-inspection");
		if (viActions.length > 0) {
			const hasWarnings = stepResult.warnings && stepResult.warnings.length > 0;
			configLines.push("");
			configLines.push(hasWarnings ? "**Visual Inspection — FAILED**:" : "**Visual Inspection**:");
			for (const vi of viActions) {
				configLines.push(`- ${resolveVars(vi.prompt, canvasVars)}`);
			}
			if (hasWarnings) {
				for (const w of stepResult.warnings) {
					configLines.push(`**Reason**: ${w}`);
				}
			}
		}

		// Notice actions — runtime annotations
		const noticeActions = (s.actions ?? []).filter((a) => a.tool === "notice");
		if (noticeActions.length > 0) {
			configLines.push("");
			configLines.push(`**Notices**: ${noticeActions.map((n) => `*${resolveVars(n.message, canvasVars)}*`).join(", ")}`);
		}

		// Error (if failed)
		if (stepResult.error) {
			configLines.push("");
			configLines.push(`**Error**: ${stepResult.error}`);
		}

		const configNode = {
			id: nId(`${s.id}-config`),
			type: "text",
			text: configLines.join("\n"),
			x: innerX,
			y: 16,
			width: ACTION_WIDTH,
			height: GROUP_HEIGHT - 16 - ACTION_MARGIN_BOTTOM,
		};
		if (stepColor) configNode.color = stepColor;
		nodes.push(configNode);

		// ── Improvement cards (yellow, stacked above the step group) ──
		const improvements = s.improvements ?? [];
		if (improvements.length > 0) {
			const improvCenterX = groupX + Math.round((GROUP_WIDTH - IMPROVEMENT_WIDTH) / 2);

			for (let ii = 0; ii < improvements.length; ii++) {
				const imp = improvements[ii];
				// Stack bottom-up: closest improvement is nearest to the group top
				const distFromTop = (ii + 1) * (IMPROVEMENT_HEIGHT + IMPROVEMENT_GAP);
				const improvY = -distFromTop;

				const impLines = [];
				impLines.push(`## ${imp.title}`);
				if (imp.description) {
					impLines.push("");
					impLines.push(imp.description);
				}
				if (imp.priority) {
					impLines.push("");
					impLines.push(`**Priority**: ${imp.priority}`);
				}

				nodes.push({
					id: nId(`${s.id}-imp-${ii}`),
					type: "text",
					text: impLines.join("\n"),
					x: improvCenterX,
					y: improvY,
					width: IMPROVEMENT_WIDTH,
					height: IMPROVEMENT_HEIGHT,
					color: "3", // yellow
				});
			}
		}

		// ── Action groups (vertical stack below the step group) ──
		const actions = s.actions ?? [];
		if (actions.length > 0) {
			const actionCenterX = groupX + Math.round((GROUP_WIDTH - ACTION_GROUP_WIDTH) / 2);
			let actionY = ACTION_GROUP_START_Y;
			let prevActionNodeId = gId(s.id);
			// Track screenshot counter for auto-numbered screenshots
			let screenshotCounter = 0;

			for (let ai = 0; ai < actions.length; ai++) {
				const action = actions[ai];
				const actionId = `${s.id}-a${ai}`;
				const isScreenshot = action.tool === "screenshot";
				const height = isScreenshot ? ACTION_GROUP_HEIGHT_SCREENSHOT : ACTION_GROUP_HEIGHT_DEFAULT;

				// Build the screenshot background path for screenshot actions
				let actionBackground = null;
				if (isScreenshot) {
					const label = action.label ?? String(++screenshotCounter);
					actionBackground = `${screenshotBasePath}/${s.id}--${label}.png`;
				}

				const actionGroupNode = {
					id: gId(actionId),
					type: "group",
					label: formatActionText(action, data.variables),
					x: actionCenterX,
					y: actionY,
					width: ACTION_GROUP_WIDTH,
					height,
				};

				const color = actionColor(action.tool);
				if (color) actionGroupNode.color = color;

				if (actionBackground) {
					actionGroupNode.backgroundStyle = "ratio";
					actionGroupNode.background = actionBackground;
				}

				nodes.push(actionGroupNode);

				// Edge: previous action (or step group) → this action
				edges.push({
					id: eId(
						prevActionNodeId.replace(`${CANVAS_PREFIX}n-`, "").replace(`${CANVAS_PREFIX}g-`, ""),
						actionId,
					),
					fromNode: prevActionNodeId,
					fromSide: "bottom",
					toNode: gId(actionId),
					toSide: "top",
				});

				prevActionNodeId = gId(actionId);
				actionY += height + ACTION_GROUP_GAP_Y;
			}
		}

		// Edge from previous element to this group
		const currentGroupId = gId(s.id);
		edges.push({
			id: eId(prevNodeId.replace(`${CANVAS_PREFIX}n-`, "").replace(`${CANVAS_PREFIX}g-`, ""), s.id),
			fromNode: prevNodeId,
			fromSide: "right",
			toNode: currentGroupId,
			toSide: "left",
		});

		prevNodeId = currentGroupId;
	}

	// ── Events summary node (circle) ──
	const lastGroupX = steps.length > 0
		? firstGroupX + (steps.length - 1) * (GROUP_WIDTH + GROUP_SPACING_X)
		: START_X + CIRCLE_WIDTH;
	const eventsX = lastGroupX + GROUP_WIDTH + GROUP_SPACING_X;

	const eventsLines = ["## Events Summary"];
	eventsLines.push(`**Steps**: ${passedSteps} passed, ${failedSteps} failed`);
	eventsLines.push(`**Duration**: ${formatDuration(data.durationMs ?? 0)}`);
	eventsLines.push("");

	// Step checklist — uses exact it() descriptions from the journey config
	for (const sr of steps) {
		const cb = sr.status === "pass" ? "[x]" : sr.status === "fail" ? "[!]" : "[ ]";
		const itStr = sr.step.itBlock ?? `${sr.step.guideSection} — ${sr.step.title}`;
		eventsLines.push(`- ${cb} ${itStr} (${formatDuration(sr.durationMs)})`);
	}

	// Event trace top events (if available)
	if (trace?.summary?.eventFrequency) {
		const freq = trace.summary.eventFrequency;
		const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8);
		eventsLines.push("");
		eventsLines.push("### Top Events");
		eventsLines.push("| Event | Count |");
		eventsLines.push("|---|---|");
		for (const [type, count] of sorted) {
			eventsLines.push(`| \`${type}\` | ${count} |`);
		}
	}

	const eventsY = Math.round((GROUP_HEIGHT - EVENTS_SIZE) / 2);

	nodes.push({
		id: nId("events"),
		type: "text",
		text: eventsLines.join("\n"),
		x: eventsX,
		y: eventsY,
		width: EVENTS_SIZE,
		height: EVENTS_SIZE,
	});

	// Edge: last step → events
	edges.push({
		id: eId(prevNodeId.replace(`${CANVAS_PREFIX}n-`, "").replace(`${CANVAS_PREFIX}g-`, ""), "events"),
		fromNode: prevNodeId,
		fromSide: "right",
		toNode: nId("events"),
		toSide: "left",
	});

	// ── END node (circle) ──
	const endX = eventsX + EVENTS_SIZE + GROUP_SPACING_X;
	const endLabel = journeyPartial ? "PARTIAL PASS" : journeyPassed ? "PASS" : "FAIL";
	const stepsSummary = skippedSteps > 0
		? `${passedSteps}/${totalSteps} steps (${skippedSteps} skipped)`
		: `${passedSteps}/${totalSteps} steps`;
	const endText = `# ${endLabel}\n${stepsSummary}\n${formatDuration(data.durationMs ?? 0)}`;
	const endColor = journeyPartial ? "5" : journeyPassed ? "4" : "1";

	nodes.push({
		id: nId("end"),
		type: "text",
		text: endText,
		styleAttributes: { shape: "circle", textAlign: "center" },
		x: endX,
		y: circleCenterY,
		width: CIRCLE_WIDTH,
		height: CIRCLE_HEIGHT,
		color: endColor,
	});

	// Edge: events → end
	edges.push({
		id: eId("events", "end"),
		fromNode: nId("events"),
		fromSide: "right",
		toNode: nId("end"),
		toSide: "left",
	});

	return {
		metadata: {
			version: "1.0-1.0",
			frontmatter: {},
			startNode: nId("start"),
		},
		nodes,
		edges,
	};
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

/** Appends the Performance section to the document. */
function buildPerfLines(startupPerf, doc) {
	if (!startupPerf || startupPerf.history.length === 0) return;

	const { history, sizeBytes } = startupPerf;
	const sorted = [...history].sort((a, b) => a - b);
	const last = round(history[history.length - 1] ?? 0);
	const p50 = round(percentile(sorted, 0.5));
	const p95 = round(percentile(sorted, 0.95));
	const max = round(sorted[sorted.length - 1] ?? 0);

	doc.addSeparator().addBlank();
	doc.heading(2, "Performance").addBlank();
	doc.callout("tip", "Startup", [
		`Last: ${last}ms | p50: ${p50}ms | p95: ${p95}ms | Max: ${max}ms`,
		`Measurements: ${history.length} | data.json: ${formatBytes(sizeBytes)}`,
	]);
	doc.addBlank();
}

/** Appends the Event Trace section to the document. */
function buildEventTraceLines(trace, doc) {
	if (!trace) return;

	doc.addSeparator().addBlank();
	doc.heading(2, "Event Trace").addBlank();
	doc.callout("abstract", "Trace Summary", [
		`Events: ${trace.summary?.totalEvents ?? 0} | Perf: ${trace.summary?.perfEvents ?? 0} | ` +
		`Types: ${trace.summary?.uniqueTypes ?? 0} | Duration: ${formatDuration(trace.durationMs ?? 0)}`,
	]);
	doc.addBlank();

	// Top 15 events by frequency
	const freq = trace.summary?.eventFrequency;
	if (freq && Object.keys(freq).length > 0) {
		const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 15);
		doc.heading(3, "Top Events").addBlank();
		doc.table(
			["Event", "Count"],
			sorted.map(([type, count]) => [`\`${type}\``, String(count)]),
		);
		doc.addBlank();
	}

	// Detailed perf event statistics (startup, storage, queries, dispatches, alerts)
	buildPerfEventStats(trace.perfEvents ?? [], doc);

	doc.text("Full details: [[Event Trace]]");
	doc.addBlank();
}

/**
 * Builds detailed performance statistics from perf.* trace events.
 * Parses event payloads and groups metrics by type (startup, storage,
 * query, dispatch, alert) with aggregate statistics tables.
 */
function buildPerfEventStats(perfEvents, doc) {
	if (!perfEvents || perfEvents.length === 0) return;

	const startupServices = [];
	let startupTotal = null;
	const storageOps = [];
	const queries = [];
	const dispatches = [];
	const alerts = [];

	for (const e of perfEvents) {
		let p;
		try {
			p = typeof e.payload === "string" ? JSON.parse(e.payload) : e.payload;
		} catch {
			continue;
		}

		switch (e.type) {
			case "perf.startup.service":
				if (p.service && p.durationMs !== undefined) {
					startupServices.push({ service: p.service, durationMs: p.durationMs });
				}
				break;
			case "perf.startup.total":
				if (p.durationMs !== undefined) {
					startupTotal = { durationMs: p.durationMs, serviceCount: p.serviceCount ?? 0 };
				}
				break;
			case "perf.storage.loaded":
			case "perf.storage.saved":
				if (p.key && p.durationMs !== undefined) {
					storageOps.push({
						key: p.key,
						op: e.type === "perf.storage.loaded" ? "load" : "save",
						durationMs: p.durationMs,
						sizeBytes: p.sizeBytes ?? 0,
					});
				}
				break;
			case "perf.query.executed":
				if (p.queryId && p.durationMs !== undefined) {
					queries.push({
						queryId: p.queryId,
						durationMs: p.durationMs,
						sourceRows: p.sourceRows ?? 0,
						resultRows: p.resultRows ?? 0,
					});
				}
				break;
			case "perf.event.dispatched":
				if (p.eventType && p.durationMs !== undefined) {
					dispatches.push({
						eventType: p.eventType,
						handlerCount: p.handlerCount ?? 0,
						durationMs: p.durationMs,
					});
				}
				break;
			case "perf.alert":
				if (p.metric) {
					alerts.push({
						metric: p.metric,
						value: p.value ?? 0,
						threshold: p.threshold ?? 0,
					});
				}
				break;
		}
	}

	doc.heading(3, "Event Performance Statistics").addBlank();
	doc.callout("info", "Metrics", [
		`Perf events: ${perfEvents.length} | Startup services: ${startupServices.length} | Storage ops: ${storageOps.length} | Queries: ${queries.length} | Dispatches: ${dispatches.length} | Alerts: ${alerts.length}`,
	]);
	doc.addBlank();

	// Startup
	if (startupTotal || startupServices.length > 0) {
		doc.heading(4, "Startup").addBlank();
		if (startupTotal) {
			doc.text(`Total startup: **${Math.round(startupTotal.durationMs)}ms** (${startupTotal.serviceCount} services)`);
			doc.addBlank();
		}
		if (startupServices.length > 0) {
			const sorted = [...startupServices].sort((a, b) => b.durationMs - a.durationMs);
			doc.table(
				["Service", "Duration"],
				sorted.map((s) => [s.service, `${Math.round(s.durationMs)}ms`]),
			);
			doc.addBlank();
		}
	}

	// Storage
	if (storageOps.length > 0) {
		const STORAGE_OPS_LIMIT = 20;
		doc.heading(4, "Storage Operations").addBlank();
		const totalLoadMs = Math.round(storageOps.filter(o => o.op === "load").reduce((s, o) => s + o.durationMs, 0));
		const totalSaveMs = Math.round(storageOps.filter(o => o.op === "save").reduce((s, o) => s + o.durationMs, 0));
		doc.text(`Load: ${storageOps.filter(o => o.op === "load").length} ops (${totalLoadMs}ms) | Save: ${storageOps.filter(o => o.op === "save").length} ops (${totalSaveMs}ms)`);
		doc.addBlank();
		const sorted = [...storageOps].sort((a, b) => b.durationMs - a.durationMs);
		const display = sorted.slice(0, STORAGE_OPS_LIMIT);
		const rows = display.map((o) => {
			const size = o.sizeBytes > 1024 ? `${(o.sizeBytes / 1024).toFixed(1)}KB` : `${o.sizeBytes}B`;
			return [o.key, o.op, `${Math.round(o.durationMs)}ms`, size];
		});
		if (sorted.length > STORAGE_OPS_LIMIT) {
			rows.push([`*...and ${sorted.length - STORAGE_OPS_LIMIT} more*`, "", "", ""]);
		}
		doc.table(["Key", "Op", "Duration", "Size"], rows);
		doc.addBlank();
	}

	// Queries
	if (queries.length > 0) {
		doc.heading(4, "Query Execution").addBlank();
		const totalMs = Math.round(queries.reduce((s, q) => s + q.durationMs, 0));
		const avgMs = (totalMs / queries.length).toFixed(1);
		const maxQ = queries.reduce((m, q) => q.durationMs > m.durationMs ? q : m, queries[0]);
		doc.text(`Queries: ${queries.length} | Total: ${totalMs}ms | Avg: ${avgMs}ms | Slowest: ${maxQ.queryId} (${Math.round(maxQ.durationMs)}ms)`);
		doc.addBlank();
		const sorted = [...queries].sort((a, b) => b.durationMs - a.durationMs);
		doc.table(
			["Query", "Duration", "Source Rows", "Result Rows"],
			sorted.map((q) => [q.queryId, `${Math.round(q.durationMs)}ms`, String(q.sourceRows), String(q.resultRows)]),
		);
		doc.addBlank();
	}

	// Event Dispatch
	if (dispatches.length > 0) {
		doc.heading(4, "Event Dispatch Timing").addBlank();
		const totalMs = dispatches.reduce((s, d) => s + d.durationMs, 0);
		const avgMs = (totalMs / dispatches.length).toFixed(2);
		const byType = new Map();
		for (const d of dispatches) {
			const existing = byType.get(d.eventType) ?? { count: 0, totalMs: 0, maxMs: 0 };
			existing.count++;
			existing.totalMs += d.durationMs;
			existing.maxMs = Math.max(existing.maxMs, d.durationMs);
			byType.set(d.eventType, existing);
		}
		const sortedByTotal = [...byType.entries()].sort((a, b) => b[1].totalMs - a[1].totalMs);
		doc.text(`Dispatches: ${dispatches.length} | Total: ${Math.round(totalMs)}ms | Avg: ${avgMs}ms`);
		doc.addBlank();
		doc.table(
			["Event", "Dispatches", "Total", "Avg", "Max"],
			sortedByTotal.map(([type, stats]) => {
				const avg = (stats.totalMs / stats.count).toFixed(2);
				return [`\`${type}\``, String(stats.count), `${Math.round(stats.totalMs)}ms`, `${avg}ms`, `${Math.round(stats.maxMs)}ms`];
			}),
		);
		doc.addBlank();
	}

	// Alerts
	if (alerts.length > 0) {
		doc.heading(4, "Performance Alerts").addBlank();
		doc.callout("warning", "Threshold Violations",
			alerts.map((a) => `- **${a.metric}**: ${Math.round(a.value)}ms (threshold: ${Math.round(a.threshold)}ms)`),
		);
		doc.addBlank();
	}
}

/** Copies screenshot .png files from src to dest directory, removing stale dest files first. */
function copyScreenshots(srcDir, destDir) {
	if (!fs.existsSync(srcDir)) return;

	fs.mkdirSync(destDir, { recursive: true });

	// Remove stale screenshots in dest that are not in src
	const srcFiles = new Set(fs.readdirSync(srcDir).filter((f) => f.endsWith(".png")));
	for (const file of fs.readdirSync(destDir)) {
		if (!file.endsWith(".png")) continue;
		if (!srcFiles.has(file)) {
			fs.rmSync(path.join(destDir, file), { force: true });
		}
	}

	// Copy current screenshots
	for (const file of srcFiles) {
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

	// Read trace data early — needed for both canvas generation and E2E summary
	const startupPerf = readStartupPerf();
	const trace = readLatestEventTrace();

	// --- Journey reports + canvases (one per journey, inside their own folder) ---
	const journeyReportNames = [];

	for (const { dir, data } of journeys) {
		const { title, status: jReportStatus, content } = generateJourneyReport(data, date);
		const filename = `${title}.md`;
		const canvasFilename = `${title}.canvas`;
		journeyReportNames.push({ title, data });

		// Write markdown report to test vault
		// e.g. docs/journeys/Getting Started/Getting Started.md
		writeReport(dir, filename, content, "JourneyReport written");

		// Generate canvas for test vault (screenshots relative to test vault root)
		const testScreenshotPath = `docs/journeys/${title}/screenshots`;
		const testConfigPath = `docs/journeys/${title}/${title}-config.json`;
		const testCanvas = generateJourneyCanvas(data, testScreenshotPath, trace, testConfigPath);
		writeReport(dir, canvasFilename, JSON.stringify(testCanvas, null, "\t"), "JourneyCanvas written");

		// Dev vault — current status file at journey root (stable name, overwrites)
		// e.g. docs/journeys/Getting Started/Getting Started.md
		// Convert wikilink screenshot embeds to relative markdown embeds
		// so Obsidian resolves them via path (vault index may not cover Development/)
		const devContent = content.replace(
			/!\[\[([^\]]+\.png)\]\]/g,
			(_, file) => `![](screenshots/${file})`,
		);
		const devJourneyDir = path.join(DEV_JOURNEYS_DIR, title);
		writeReport(devJourneyDir, filename, devContent, "JourneyReport mirrored");

		// Mirror config JSON (step definitions without runtime data)
		const configFile = path.join(dir, `${title}-config.json`);
		if (fs.existsSync(configFile)) {
			const configContent = fs.readFileSync(configFile, "utf-8");
			writeReport(devJourneyDir, `${title}-config.json`, configContent, "JourneyConfig mirrored");
		}

		// Generate canvas for dev vault (vault-root-relative path)
		const devScreenshotPath = `Development/flowti/docs/journeys/${title}/screenshots`;
		const devConfigPath = `Development/flowti/docs/journeys/${title}/${title}-config.json`;
		const devCanvas = generateJourneyCanvas(data, devScreenshotPath, trace, devConfigPath);
		writeReport(devJourneyDir, canvasFilename, JSON.stringify(devCanvas, null, "\t"), "JourneyCanvas mirrored");

		// Dev vault — timestamped archive in past-tests/ subfolder
		// e.g. docs/journeys/Getting Started/past-tests/2026-02-28T16-02-04.162Z-Getting Started.md
		// Archived reports point up one level to the shared screenshots/ folder
		const archivedContent = content.replace(
			/!\[\[([^\]]+\.png)\]\]/g,
			(_, file) => `![](../screenshots/${file})`,
		);
		const safeTs = now.toISOString().replace(/:/g, "-");
		const archiveSuffix = jReportStatus === "partial-pass" ? " (Partial)" : "";
		const pastTestsDir = path.join(devJourneyDir, "past-tests");
		writeReport(pastTestsDir, `${safeTs}-${title}${archiveSuffix}.md`, archivedContent, "JourneyReport archived");
		writeReport(pastTestsDir, `${safeTs}-${title}${archiveSuffix}.canvas`, JSON.stringify(devCanvas, null, "\t"), "JourneyCanvas archived");

		// Copy screenshots into the journey's own folder in dev vault
		const srcScreenshots = path.join(dir, "screenshots");
		const devScreenshots = path.join(devJourneyDir, "screenshots");
		copyScreenshots(srcScreenshots, devScreenshots);
	}

	// --- Reconcile vitest results with journey runner truth ---
	const reconciled = reconcileResults(vitest, journeys);

	// --- E2E summary report ---
	const totalPassed = reconciled?.totalPassed ?? 0;
	const totalFailed = reconciled?.totalFailed ?? 0;
	const totalSkipped = reconciled?.totalSkipped ?? 0;
	const totalDev = reconciled?.totalDev ?? 0;
	const totalTests = reconciled?.totalTests ?? 0;

	// Mode-based partial detection: not "full" means a subset of journeys was selected
	const isPartialMode = resolveMode() !== "full";
	// Effective skipped: reconciled skipped already includes journey-level skips
	const effectiveSkipped = totalSkipped + totalDev + (isPartialMode ? 1 : 0);
	// Visual-inspection warnings elevate status to partial-pass
	const hasJourneyWarnings = journeys.some(({ data }) =>
		(data.steps ?? []).some((r) => r.warnings && r.warnings.length > 0));
	const overallStatus = resolveStatus(totalPassed, totalFailed, totalTests, effectiveSkipped, hasJourneyWarnings);

	const totalDurationMs = vitest?.durationMs ?? 0;

	// Aggregate action stats across all journeys
	const aggregateActions = {
		total: 0, screenshots: 0, assertions: 0, manual_checks: 0, manual_passed: 0, manual_failed: 0,
		visual_inspections: 0, notices: 0, theme_changes: 0,
		create_files: 0, delete_files: 0, open_files: 0, close_leaves: 0,
		tools: new Set(),
	};
	const perJourneyStats = new Map();
	for (const { data } of journeys) {
		const stats = computeActionStats(data);
		aggregateActions.total += stats.total;
		aggregateActions.screenshots += stats.screenshots;
		aggregateActions.assertions += stats.assertions;
		aggregateActions.manual_checks += stats.manual_checks;
		aggregateActions.manual_passed += stats.manual_passed;
		aggregateActions.manual_failed += stats.manual_failed;
		aggregateActions.visual_inspections += stats.visual_inspections;
		aggregateActions.notices += stats.notices;
		aggregateActions.theme_changes += stats.theme_changes;
		aggregateActions.create_files += stats.create_files;
		aggregateActions.delete_files += stats.delete_files;
		aggregateActions.open_files += stats.open_files;
		aggregateActions.close_leaves += stats.close_leaves;
		for (const t of stats.tools) aggregateActions.tools.add(t);
		perJourneyStats.set(data.journey, stats);
	}
	const allTools = [...aggregateActions.tools].sort();

	// Build wikilink arrays for frontmatter
	const testSuiteLinks = (vitest?.suites ?? []).map((s) => {
		const rel = path.relative(PLUGIN_ROOT, s.file).replace(/\\/g, "/");
		return `[[${rel}]]`;
	});
	const journeyReportLinks = journeyReportNames.map(({ title }) => `[[${title}]]`);
	const journeyCanvasLinks = journeyReportNames.map(({ title }) => `[[${title}]]`);

	const doc = Document.create("E2E Report");

	doc.mergeFrontmatter({
		type: "E2EReport",
		mode: resolveMode(),
		date,
		total_tests: totalTests,
		passed: totalPassed,
		failed: totalFailed,
		skipped: totalSkipped,
	});
	if (totalDev > 0) doc.setFrontmatter("dev", totalDev);
	doc.mergeFrontmatter({
		total_actions: aggregateActions.total,
		total_screenshots: aggregateActions.screenshots,
		total_assertions: aggregateActions.assertions,
		total_manual_checks: aggregateActions.manual_checks,
	});
	if (aggregateActions.manual_passed > 0) doc.setFrontmatter("total_manual_passed", aggregateActions.manual_passed);
	if (aggregateActions.manual_failed > 0) doc.setFrontmatter("total_manual_failed", aggregateActions.manual_failed);
	doc.mergeFrontmatter({
		total_visual_inspections: aggregateActions.visual_inspections,
		total_notices: aggregateActions.notices,
		total_theme_changes: aggregateActions.theme_changes,
		total_create_files: aggregateActions.create_files,
		total_delete_files: aggregateActions.delete_files,
		total_open_files: aggregateActions.open_files,
		total_close_leaves: aggregateActions.close_leaves,
	});
	if (allTools.length > 0) {
		doc.setFrontmatter("tools", allTools);
	} else {
		doc.setRawFrontmatter("tools", "[]");
	}
	doc.mergeFrontmatter({
		duration_ms: totalDurationMs,
		duration: formatDuration(totalDurationMs),
		journeys: journeys.length,
		status: overallStatus,
		success: overallStatus === "pass" || overallStatus === "partial-pass",
		trace_events: trace?.summary?.totalEvents ?? 0,
		trace_perf_events: trace?.summary?.perfEvents ?? 0,
		startup_p50: startupPerf ? round(percentile([...startupPerf.history].sort((a, b) => a - b), 0.5)) : 0,
	});
	doc.setFrontmatter("test_suites", testSuiteLinks);
	doc.setFrontmatter("journey_reports", journeyReportLinks);
	doc.setFrontmatter("journey_canvases", journeyCanvasLinks);
	doc.setRawFrontmatter("event_trace", '"[[Event Trace]]"');
	doc.setRawFrontmatter("event_trace_json", '"[[Event Trace.json]]"');
	doc.setRawFrontmatter("event_trace_csv", '"[[Event Trace.csv]]"');
	const e2eTags = ["report", "e2e"];
	if (overallStatus === "partial-pass") e2eTags.push("partial");
	doc.setTags(e2eTags);

	const reportTitleSuffix = overallStatus === "partial-pass" ? " (Partial)" : "";

	doc.addBlank()
		.heading(1, `E2E Report${reportTitleSuffix}`)
		.addBlank();
	doc.callout(statusCallout(overallStatus), `Summary — ${statusLabel(overallStatus)}`, [
		`Mode: **${resolveMode()}** | Tests: ${totalTests} | Passed: ${totalPassed} | Failed: ${totalFailed} | Skipped: ${totalSkipped}` +
		(totalDev > 0 ? ` | Dev: ${totalDev}` : ""),
		`Duration: ${formatDuration(totalDurationMs)}`,
	]);
	doc.addBlank();

	// ── Failures section — surfaces failed steps at the top ──
	// Collects from two sources:
	// 1. Journey results (step-level failures with rich errorContext)
	// 2. Vitest results (test-level failures — catches retried tests that
	//    passed in the journey runner but are still recorded as failed in vitest)

	const failedSteps = [];
	for (const { title, data } of journeyReportNames) {
		for (const stepResult of (data.steps ?? [])) {
			if (stepResult.status === "fail") {
				failedSteps.push({ journeyTitle: title, stepResult });
			}
		}
	}

	// Vitest-level failures not captured by journey results (e.g. retry dedup)
	const vitestFailures = [];
	if (vitest) {
		for (const suite of vitest.suites) {
			for (const c of suite.cases) {
				if (c.status !== "failed") continue;
				vitestFailures.push({ suite: suite.name, testCase: c, hookError: suite.hookError });
			}
			// Surface hook-level failures (beforeAll crashed, no individual test failed)
			if (suite.suiteHookFailed && suite.cases.filter((c) => c.status === "failed").length === 0) {
				vitestFailures.push({
					suite: suite.name,
					testCase: { name: "Hook failure (beforeAll)", status: "failed", durationMs: 0, error: suite.hookError },
					hookError: suite.hookError,
				});
			}
		}
	}

	const totalFailures = failedSteps.length + vitestFailures.length;

	if (totalFailures > 0) {
		doc.addSeparator().addBlank();
		doc.heading(2, `Failures (${totalFailures})`).addBlank();

		// Journey-level failures (rich context)
		for (const { journeyTitle, stepResult } of failedSteps) {
			const s = stepResult.step;
			const stepLabel = `Step ${s.guideSection}: ${s.title}`;

			doc.heading(3, `${stepLabel} [FAIL]`);
			doc.addBlank();

			const dangerLines = [];
			if (stepResult.error) {
				dangerLines.push(`**Error**: ${stepResult.error}`);
			}
			doc.callout("danger", `${journeyTitle} — ${stepLabel} (${formatDuration(stepResult.durationMs)})`, dangerLines);
			doc.addBlank();

			// Compact error trace for quick diagnosis
			if (stepResult.errorContext) {
				const ctx = stepResult.errorContext;
				const traceLines = [];

				if (ctx.domSnapshot) {
					const ds = ctx.domSnapshot;
					traceLines.push(
						`View: \`${ds.activeViewType}\` | Leaves: ${ds.leafCount} | Modal: ${ds.hasModal ? "yes" : "no"}`,
					);
					if (ds.notices && ds.notices.length > 0) {
						traceLines.push(
							`Notices: ${ds.notices.map((n) => `\`${n.substring(0, 80)}\``).join(", ")}`,
						);
					}
				}

				if (ctx.recentEvents && ctx.recentEvents.length > 0) {
					traceLines.push("");
					traceLines.push("**Recent Events**:");
					for (const e of ctx.recentEvents) {
						traceLines.push(`- \`${e.type}\` (${e.relativeMs}ms ago)`);
					}
				}

				if (ctx.consoleErrors && ctx.consoleErrors.length > 0) {
					traceLines.push("");
					traceLines.push("**Console Errors**:");
					for (const e of ctx.consoleErrors) {
						traceLines.push(`- \`${e.substring(0, 120)}\``);
					}
				}

				if (ctx.pluginState) {
					traceLines.push("");
					traceLines.push(
						`Plugin: loaded=${ctx.pluginState.loaded}, services=${ctx.pluginState.serviceCount}`,
					);
				}

				doc.callout("bug", "Trace", traceLines);
				doc.addBlank();
			}

			doc.text(`Details: [[${journeyTitle}#${stepLabel} FAIL]] | Canvas: [[${journeyTitle}.canvas|Canvas]]`);
			doc.addBlank();
		}

		// Vitest-level failures (catches retries that passed in journey runner
		// but are still recorded as failed by vitest's first-attempt tracking)
		if (vitestFailures.length > 0) {
			if (failedSteps.length > 0) {
				doc.addSeparator().addBlank();
			}
			const vtLabel = failedSteps.length > 0
				? "Vitest Failures (not captured by journey runner)"
				: "Test Runner Failures";
			doc.heading(3, vtLabel).addBlank();

			for (const { suite, testCase, hookError } of vitestFailures) {
				const dur = testCase.durationMs > 0 ? ` (${formatDuration(testCase.durationMs)})` : "";
				const vtLines = [];
				if (testCase.error) {
					const firstLine = testCase.error.split("\n")[0].substring(0, 200);
					vtLines.push(`**Error**: ${firstLine}`);
				}
				if (hookError && !testCase.error) {
					const firstLine = hookError.split("\n")[0].substring(0, 200);
					vtLines.push(`**Hook error**: ${firstLine}`);
				}
				doc.callout("danger", `${suite} — ${testCase.name}${dur}`, vtLines);
				doc.addBlank();
			}
		}
	}

	// ── Warnings section — surfaces visual-inspection soft-fails ──
	const stepsWithWarnings = [];
	for (const { title, data } of journeyReportNames) {
		for (const stepResult of (data.steps ?? [])) {
			if (stepResult.warnings && stepResult.warnings.length > 0) {
				stepsWithWarnings.push({ journeyTitle: title, stepResult });
			}
		}
	}

	if (stepsWithWarnings.length > 0) {
		doc.addSeparator().addBlank();
		doc.heading(2, `Warnings (${stepsWithWarnings.length})`).addBlank();

		for (const { journeyTitle, stepResult } of stepsWithWarnings) {
			const s = stepResult.step;
			const stepLabel = `Step ${s.guideSection}: ${s.title}`;
			const warnLines = stepResult.warnings.map((w) => {
				const reasonMatch = w.match(/\nReason:\s*(.+)/);
				return reasonMatch ? reasonMatch[1].trim() : w;
			});
			doc.callout("warning", `${journeyTitle} — ${stepLabel}`, warnLines);
			doc.addBlank();
		}
	}

	// Action coverage summary (aggregate across all journeys)
	if (aggregateActions.total > 0) {
		doc.addSeparator().addBlank();
		doc.heading(2, "Action Coverage").addBlank();
		const lifecycleCount = aggregateActions.create_files + aggregateActions.delete_files + aggregateActions.open_files + aggregateActions.close_leaves;
		doc.callout("abstract", `${aggregateActions.total} actions across ${journeys.length} journeys`, [
			`Screenshots: **${aggregateActions.screenshots}** | Assertions: **${aggregateActions.assertions}** | Manual QA: **${aggregateActions.manual_checks}**` +
			(aggregateActions.visual_inspections > 0 ? ` | Visual: **${aggregateActions.visual_inspections}**` : "") +
			` | Notices: **${aggregateActions.notices}**` +
			(aggregateActions.theme_changes > 0 ? ` | Themes: **${aggregateActions.theme_changes}**` : "") +
			(lifecycleCount > 0 ? ` | Lifecycle: **${lifecycleCount}**` : ""),
			`Tools: ${allTools.map((t) => `\`${t}\``).join(" ")}`,
		]);
		doc.addBlank();

		// Per-journey breakdown table
		if (journeyReportNames.length > 1) {
			const rows = [];
			for (const { title, data } of journeyReportNames) {
				const stats = perJourneyStats.get(data.journey);
				if (!stats) continue;
				const lc = stats.create_files + stats.delete_files + stats.open_files + stats.close_leaves;
				rows.push([`[[${title}]]`, String(stats.total), String(stats.screenshots), String(stats.assertions), String(stats.manual_checks), String(stats.notices), String(lc), String(stats.tools.length)]);
			}
			doc.table(["Journey", "Actions", "Screenshots", "Assertions", "Manual", "Notices", "Lifecycle", "Tools"], rows);
			doc.addBlank();
		}
	}

	// Units Under Test — show test source files for context
	if (vitest && vitest.suites.length > 0) {
		doc.addSeparator().addBlank();
		doc.heading(2, "Units Under Test").addBlank();
		doc.list(vitest.suites.map((suite) => {
			const relativePath = path.relative(PLUGIN_ROOT, suite.file).replace(/\\/g, "/");
			return `\`${relativePath}\``;
		}));
		doc.addBlank();
	}

	// Test suites section (uses reconciled data for accurate status)
	if (reconciled) {
		doc.addSeparator().addBlank();
		doc.heading(2, "Test Suites").addBlank();

		// Build lookup of test names with visual-inspection warnings
		// so the checklist can render [~] instead of [x] for partial-pass steps
		const warningItBlocks = new Set();
		for (const { data } of journeyReportNames) {
			for (const stepResult of (data.steps ?? [])) {
				if (stepResult.warnings && stepResult.warnings.length > 0) {
					const s = stepResult.step;
					const itStr = s.itBlock ?? `${s.guideSection} — ${s.title}`;
					warningItBlocks.add(itStr);
				}
			}
		}

		for (const suite of reconciled.suites) {
			const sPassed = suite.reconciledPassed ?? suite.passed;
			const sFailed = suite.reconciledFailed ?? suite.failed;
			const sSkipped = suite.reconciledSkipped ?? suite.skipped;
			const sDev = suite.reconciledDev ?? 0;
			const sTotal = suite.cases.length;
			const suiteStatus = resolveStatus(sPassed, sFailed, sTotal, sSkipped + sDev);

			doc.heading(3, suite.name);
			doc.addBlank();
			const summaryParts = [`${sPassed}/${sTotal} passed`];
			if (sSkipped > 0) summaryParts.push(`${sSkipped} skipped`);
			if (sDev > 0) summaryParts.push(`${sDev} dev`);
			const hookLines = [];
			if (suite.hookError) {
				const firstLine = suite.hookError.split("\n")[0].substring(0, 200);
				hookLines.push(`**Hook failure**: ${firstLine}`);
			}
			doc.callout(statusCallout(suiteStatus), `${statusLabel(suiteStatus)} — ${summaryParts.join(", ")}`, hookLines);
			doc.addBlank();

			for (const c of suite.cases) {
				const status = c.reconciledStatus ?? c.status;

				let mark;
				let suffix = "";
				if (status === "passed") {
					const hasWarning = warningItBlocks.size > 0 &&
						[...warningItBlocks].some((w) => c.name.includes(w));
					mark = hasWarning ? "[~]" : "[x]";
				} else if (status === "failed") {
					mark = "[!]";
				} else if (status === "skipped") {
					mark = "[-]";
					suffix = " — *Skipped (previous run passed)*";
				} else if (status === "dev") {
					mark = "[-]";
					suffix = " — *Dev (not yet implemented)*";
				} else if (suite.suiteHookFailed) {
					mark = "[ ]";
				} else {
					mark = "[-]";
				}

				const dur = c.durationMs > 0 ? ` (${formatDuration(c.durationMs)})` : "";
				const blocked = suite.suiteHookFailed && status !== "passed" && status !== "failed"
					? " — *blocked*"
					: "";
				const displayName = c.name.includes(" > ")
					? c.name.substring(c.name.lastIndexOf(" > ") + 3)
					: c.name;
				doc.text(`- ${mark} ${displayName}${dur}${blocked}${suffix}`);

				if (c.error) {
					doc.text(`  > Error: ${c.error.split("\n")[0]}`);
				}
			}
			doc.addBlank();
		}
	}

	// Performance section (from data.json startup history)
	buildPerfLines(startupPerf, doc);

	// Event trace section (from latest event-trace.json)
	buildEventTraceLines(trace, doc);

	// Journey summary section — wikilinks to dedicated journey reports
	if (journeyReportNames.length > 0) {
		doc.addSeparator().addBlank();
		doc.heading(2, "Journeys").addBlank();

		for (const { title, data } of journeyReportNames) {
			const jSkipped = data.skipped ?? 0;
			const jDevStopped = data.devStopped === true;
			const jDevSteps = data.dev ?? 0;
			const jStatus = resolveStatus(data.passed ?? 0, data.failed ?? 0, data.totalSteps ?? 0, jSkipped, false, jDevStopped);
			const stats = perJourneyStats.get(data.journey);
			const jTitleSuffix = jStatus === "partial-pass" ? " (Partial)"
				: jStatus === "dev-stopped" ? " (Dev)" : "";
			const jStepsSummary = jDevStopped
				? `${data.passed ?? 0}/${data.totalSteps ?? 0} steps (${jDevSteps} dev, ${jSkipped} skipped)`
				: jSkipped > 0
					? `${data.passed ?? 0}/${data.totalSteps ?? 0} steps (${jSkipped} skipped)`
					: `${data.passed ?? 0}/${data.totalSteps ?? 0} steps`;

			doc.heading(3, `Journey: ${title}${jTitleSuffix}`);
			doc.addBlank();
			const jCalloutLines = [];
			if (stats && stats.total > 0) {
				const lc = stats.create_files + stats.delete_files + stats.open_files + stats.close_leaves;
				jCalloutLines.push(
					`Actions: ${stats.total} | Screenshots: ${stats.screenshots} | Assertions: ${stats.assertions} | Manual: ${stats.manual_checks}` +
					(stats.visual_inspections > 0 ? ` | Visual: ${stats.visual_inspections}` : "") +
					` | Notices: ${stats.notices}` +
					(stats.theme_changes > 0 ? ` | Themes: ${stats.theme_changes}` : "") +
					(lc > 0 ? ` | Lifecycle: ${lc}` : ""),
				);
			}
			doc.callout(statusCallout(jStatus), `${statusLabel(jStatus)} — ${jStepsSummary} | ${formatDuration(data.durationMs ?? 0)}`, jCalloutLines);
			doc.addBlank();
			doc.text(`Full details: [[${title}]] | Canvas: [[${title}.canvas|Canvas]]`);
			doc.addBlank();
		}
	}

	const content = doc.toString();

	const safeTimestamp = now.toISOString().replace(/:/g, "-");
	const e2ePartialSuffix = overallStatus === "partial-pass" ? " (Partial)" : "";
	const e2eFilename = `${safeTimestamp}-e2e-report${e2ePartialSuffix}.md`;

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
