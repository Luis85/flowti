/**
 * health-reference.ts — Generates a Health Scoring Reference document.
 *
 * Documents scoring categories, weights, thresholds, grade scale,
 * and quality gate configuration.
 */

import { Document } from "../../../infrastructure/document.js";
import { ReportService } from "../cli/report-service.js";
import { WEIGHTS, DEFAULT_THRESHOLDS, letterGrade } from "../../health/health-scoring.js";
import { DEFAULT_QUALITY_GATES } from "../../health/quality-gate.js";
import type { ReportDeps } from "../../../infrastructure/deps.js";
import type { GeneratorOutput } from "../../../infrastructure/types.js";

// ── Category descriptions ───────────────────────────────────────────

interface CategoryMeta {
	key: string;
	label: string;
	description: string;
}

const CATEGORIES: CategoryMeta[] = [
	{ key: "tests", label: "Tests", description: "Pass rate and threshold compliance. Binary bonus for zero failures." },
	{ key: "coverage", label: "Coverage", description: "Average of line, branch, and function coverage. Scaled between min and target thresholds." },
	{ key: "build", label: "Build", description: "Binary: 100 if build succeeds, 0 if it fails." },
	{ key: "lint", label: "Lint", description: "Base 100, penalized for errors (−20 each) and warnings (−2 each) above thresholds." },
	{ key: "security", label: "Security", description: "Base 100, penalized by vulnerability severity: critical (−30), high (−15), moderate (−5), low (−1)." },
	{ key: "git", label: "Git", description: "100 for a clean working tree, 70 for a dirty tree." },
];

// ── Generator ────────────────────────────────────────────────────────

export function generateHealthReference(projectPath: string, deps: ReportDeps): GeneratorOutput {
	const svc = new ReportService(projectPath, deps);

	const doc = Document.create("Health Scoring Reference")
		.mergeFrontmatter({
			type: "HealthReference",
			date: deps.clock.iso(),
			categories: CATEGORIES.length,
			tags: ["reference", "health", "quality"],
		})
		.addBlank()
		.heading(1, "Health Scoring Reference")
		.addBlank()
		.text("Documents the health scoring algorithm, category weights, grade scale, and quality gates.")
		.addBlank();

	appendGradeScale(doc);
	appendCategoryWeights(doc);
	appendThresholds(doc);
	appendQualityGates(doc);

	const outputPath = svc.saveReference(doc, "Health Scoring Reference.md");

	return {
		success: true,
		outputPath,
		metrics: { categories: CATEGORIES.length },
	};
}

// ── Helpers ──────────────────────────────────────────────────────────

function appendGradeScale(doc: Document): void {
	doc.heading(2, "Grade Scale").addBlank();
	doc.table(
		["Grade", "Score Range"],
		[
			[letterGrade(95), "90–100"],
			[letterGrade(85), "80–89"],
			[letterGrade(75), "70–79"],
			[letterGrade(65), "60–69"],
			[letterGrade(50), "0–59"],
		],
	).addBlank();
}

function appendCategoryWeights(doc: Document): void {
	doc.heading(2, "Scoring Categories").addBlank();
	doc.table(
		["Category", "Weight", "Description"],
		CATEGORIES.map((cat) => [
			cat.label,
			`${((WEIGHTS as Record<string, number>)[cat.key] * 100).toFixed(0)}%`,
			cat.description,
		]),
	).addBlank();
}

function appendThresholds(doc: Document): void {
	doc.heading(2, "Default Thresholds").addBlank();
	doc.table(
		["Setting", "Value"],
		[
			["Coverage minimum", `${DEFAULT_THRESHOLDS.coverage.min}%`],
			["Coverage target", `${DEFAULT_THRESHOLDS.coverage.target}%`],
			["Max lint errors", String(DEFAULT_THRESHOLDS.lint.maxErrors)],
			["Max lint warnings", String(DEFAULT_THRESHOLDS.lint.maxWarnings)],
			["Min tests passed", String(DEFAULT_THRESHOLDS.tests.minPassed)],
		],
	).addBlank()
		.text("Projects can override these in `flowti.config.json` → `health.thresholds`.")
		.addBlank();
}

function appendQualityGates(doc: Document): void {
	doc.heading(2, "Quality Gates").addBlank()
		.text("Quality gates block publish when health criteria are not met.")
		.addBlank();

	doc.text(`Default minimum score: **${DEFAULT_QUALITY_GATES.minScore}** (${letterGrade(DEFAULT_QUALITY_GATES.minScore ?? 0)} grade)`).addBlank();

	if (DEFAULT_QUALITY_GATES.rules && DEFAULT_QUALITY_GATES.rules.length > 0) {
		doc.heading(3, "Default Rules").addBlank();
		doc.table(
			["Metric", "Operator", "Value"],
			DEFAULT_QUALITY_GATES.rules.map((r) => [r.metric, r.operator, String(r.value)]),
		).addBlank();
	}

	doc.heading(3, "Supported Metrics").addBlank();
	doc.list([
		"`tests.total`, `tests.passed`, `tests.failed`, `tests.suites`",
		"`coverage.lines`, `coverage.branches`, `coverage.functions`",
		"`build.success` (1 = true, 0 = false)",
		"`lint.errors`, `lint.warnings`",
		"`score.overall`, `score.tests`, `score.coverage`, `score.build`, `score.lint`, `score.git`",
		"`components`",
	]).addBlank();
}
