/**
 * health-loader.ts — Health dashboard loader.
 *
 * Reads report markdown files from the project's reports/ directory
 * and parses test, coverage, and lint metrics from their contents.
 */

import type { LoaderContext } from "./loader-types.js";

export interface HealthTestMetrics {
	readonly total: number;
	readonly passed: number;
	readonly failed: number;
}

export interface HealthCoverageMetrics {
	readonly lines: number;
	readonly branches: number;
	readonly functions: number;
}

export interface HealthLintMetrics {
	readonly errors: number;
	readonly warnings: number;
}

export interface HealthData {
	readonly available: boolean;
	readonly tests: HealthTestMetrics;
	readonly coverage: HealthCoverageMetrics;
	readonly lint: HealthLintMetrics;
}

const EMPTY_HEALTH: HealthData = {
	available: false,
	tests: { total: 0, passed: 0, failed: 0 },
	coverage: { lines: 0, branches: 0, functions: 0 },
	lint: { errors: 0, warnings: 0 },
};

function parseNumber(content: string, pattern: RegExp): number {
	const match = pattern.exec(content);
	if (!match) return 0;
	const value = parseFloat(match[1]);
	return isNaN(value) ? 0 : value;
}

function parseReportContent(content: string): Omit<HealthData, "available"> {
	const total = parseNumber(content, /tests?[:\s]+(\d+)\s+total/i);
	const passed = parseNumber(content, /(\d+)\s+passed/i);
	const failed = parseNumber(content, /(\d+)\s+failed/i);

	const lines = parseNumber(content, /lines[:\s]+([\d.]+)%/i);
	const branches = parseNumber(content, /branches[:\s]+([\d.]+)%/i);
	const functions = parseNumber(content, /functions[:\s]+([\d.]+)%/i);

	const errors = parseNumber(content, /(\d+)\s+errors?/i);
	const warnings = parseNumber(content, /(\d+)\s+warnings?/i);

	return {
		tests: { total, passed, failed },
		coverage: { lines, branches, functions },
		lint: { errors, warnings },
	};
}

export function loadHealth(ctx: LoaderContext): HealthData {
	const { deps, projectPath } = ctx;

	if (!projectPath) {
		return EMPTY_HEALTH;
	}

	const reportsDir = deps.paths.join(projectPath, "reports");

	try {
		if (!deps.disk.existsSync(reportsDir)) {
			return EMPTY_HEALTH;
		}

		const files = deps.disk.readdirSync(reportsDir)
			.filter((f: string) => f.endsWith(".md"))
			.sort()
			.reverse();

		if (files.length === 0) {
			return EMPTY_HEALTH;
		}

		let aggregated: Omit<HealthData, "available"> = {
			tests: { total: 0, passed: 0, failed: 0 },
			coverage: { lines: 0, branches: 0, functions: 0 },
			lint: { errors: 0, warnings: 0 },
		};

		for (const file of files) {
			const filePath = deps.paths.join(reportsDir, file);
			const content = deps.disk.readFileSync(filePath, "utf-8");
			const parsed = parseReportContent(content);

			if (parsed.tests.total > aggregated.tests.total) {
				aggregated = { ...aggregated, tests: parsed.tests };
			}
			if (parsed.coverage.lines > aggregated.coverage.lines) {
				aggregated = { ...aggregated, coverage: parsed.coverage };
			}
			if (parsed.lint.errors > 0 || parsed.lint.warnings > 0) {
				aggregated = { ...aggregated, lint: parsed.lint };
			}
		}

		return { available: true, ...aggregated };
	} catch {
		return EMPTY_HEALTH;
	}
}
