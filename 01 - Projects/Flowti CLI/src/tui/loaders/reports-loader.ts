/**
 * reports-loader.ts — Reports listing loader.
 *
 * Lists existing report files from the project's reports/ directory.
 */

import type { LoaderContext } from "./loader-types.js";

export interface ReportEntry {
	readonly name: string;
	readonly file: string;
}

export interface ReportsData {
	readonly reports: readonly ReportEntry[];
}

export function loadReports(ctx: LoaderContext): ReportsData {
	const { deps, projectPath } = ctx;
	if (!projectPath) return { reports: [] };

	try {
		const reportsDir = deps.paths.join(projectPath, "reports");
		if (!deps.disk.existsSync(reportsDir)) return { reports: [] };

		const files = deps.disk.readdirSync(reportsDir)
			.filter((f: string) => f.endsWith(".md"));

		return {
			reports: files.map((f: string) => ({
				name: f.replace(/\.md$/, ""),
				file: f,
			})),
		};
	} catch { return { reports: [] }; }
}
