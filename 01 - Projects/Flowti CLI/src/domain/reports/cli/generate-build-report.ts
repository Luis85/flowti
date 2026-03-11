/**
 * generate-build-report.ts — Build Report generator.
 *
 * Captures the result of a build command and generates a markdown BuildReport.
 * Called programmatically from the Build tool action, not as a standalone script.
 */

import { shell } from "../../../infrastructure/shell.js";
import { Document } from "../../../infrastructure/document.js";
import { ReportService } from "./report-service.js";
import type { ReportDeps } from "../../../infrastructure/deps.js";
import { createDefaultDeps } from "../../../infrastructure/deps.js";
import { recordBuild, resolveBuildPaths } from "../../build/build-freshness.js";

export interface BuildResult {
	command: string;
	exitCode: number;
	durationMs: number;
	output: string;
	errors: string;
}

function runBuild(cmd: string, cwd: string, deps: ReportDeps): BuildResult {
	const startTime = deps.clock.ms();

	const output = shell.runSilent(cmd, { cwd });
	const durationMs = deps.clock.ms() - startTime;

	if (output !== null) {
		return { command: cmd, exitCode: 0, durationMs, output, errors: "" };
	}

	return { command: cmd, exitCode: 1, durationMs, output: "", errors: "Build command failed" };
}

function countIssues(output: string): { errors: number; warnings: number } {
	const errorMatch = output.match(/(\d+)\s+errors?/i);
	const warningMatch = output.match(/(\d+)\s+warnings?/i);
	// Also count tsc-style "Found X errors"
	const tscMatch = output.match(/Found\s+(\d+)\s+errors?/i);
	return {
		errors: tscMatch ? parseInt(tscMatch[1], 10) : errorMatch ? parseInt(errorMatch[1], 10) : 0,
		warnings: warningMatch ? parseInt(warningMatch[1], 10) : 0,
	};
}

function generateReport(result: BuildResult, projectPath: string, deps: ReportDeps): string {
	const svc = new ReportService(projectPath, deps);
	const projectName = deps.paths.basename(projectPath);
	const success = result.exitCode === 0;
	const issues = countIssues(result.output + "\n" + result.errors);

	const fm: Record<string, string | number | boolean> = {
		type: "BuildReport",
		project: projectName,
		date: deps.clock.iso(),
		success,
		exit_code: result.exitCode,
		duration_ms: result.durationMs,
		errors: issues.errors,
		warnings: issues.warnings,
		command: result.command,
	};

	const doc = Document.create("Build Report")
		.mergeFrontmatter(fm)
		.addBlank()
		.heading(1, "Build Report")
		.addBlank()
		.callout(success ? "info" : "warning", "Summary", [
			`Result: ${success ? "SUCCESS" : "FAILED"}`,
			`Duration: ${(result.durationMs / 1000).toFixed(1)}s`,
			`Command: \`${result.command}\``,
			...(issues.errors > 0 ? [`Errors: ${issues.errors}`] : []),
			...(issues.warnings > 0 ? [`Warnings: ${issues.warnings}`] : []),
		])
		.addBlank();

	if (result.errors) {
		doc.heading(2, "Errors").addBlank();
		doc.codeBlock("", result.errors).addBlank();
	}

	if (result.output) {
		doc.heading(2, "Output").addBlank();
		// Truncate very long output
		const truncated = result.output.length > 5000
			? result.output.substring(0, 5000) + "\n\n... (truncated)"
			: result.output;
		doc.codeBlock("", truncated).addBlank();
	}

	// Save timestamped JSON with the raw build result
	const jsonPath = deps.paths.join(svc.subdir("builds"), "_latest-build.json");
	deps.disk.mkdirSync(svc.subdir("builds"), { recursive: true });
	deps.disk.writeFileSync(jsonPath, JSON.stringify(result, null, 2), "utf-8");

	const outputPath = svc.save(doc, {
		subdir: "builds",
		slug: "build-report",
		stableFilename: "Build Report.md",
		sourceJson: jsonPath,
	});

	// Clean up temp JSON
	deps.disk.unlinkSync(jsonPath);

	return outputPath;
}

/**
 * Execute a build command and generate a Build Report.
 * Returns the exit code from the build.
 */
export function buildWithReport(cmd: string, projectPath: string): number {
	const deps = createDefaultDeps();
	const result = runBuild(cmd, projectPath, deps);
	generateReport(result, projectPath, deps);

	if (result.exitCode === 0) {
		const { srcDir, binDir } = resolveBuildPaths(projectPath);
		recordBuild(srcDir, binDir);
	}

	return result.exitCode;
}
