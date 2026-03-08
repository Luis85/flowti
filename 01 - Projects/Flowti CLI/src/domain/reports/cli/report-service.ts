/**
 * report-service.ts — Shared service for CLI report generation.
 *
 * Centralizes reports directory resolution (from project config),
 * timestamped file naming, and the save pattern (stable md + timestamped md + timestamped JSON).
 */

import { paths } from "../../../infrastructure/paths.js";
import { disk } from "../../../infrastructure/filesystem.js";
import { CLI_PROJECT } from "../../../infrastructure/config.js";
import { clock } from "../../../infrastructure/clock.js";
import { readProjectConfig } from "../../project/project-config.js";
import type { Document } from "../../../infrastructure/document.js";

export class ReportService {
	readonly projectPath: string;
	readonly reportsDir: string;
	readonly referenceDir: string;

	constructor(projectPath: string = CLI_PROJECT) {
		this.projectPath = projectPath;
		const { config } = readProjectConfig(projectPath);
		this.reportsDir = paths.join(projectPath, config?.reports?.dir ?? "reports");
		this.referenceDir = paths.join(projectPath, config?.docs?.referenceDir ?? "docs/reference");
	}

	/** Resolve an absolute path to a subdirectory within the reports dir. */
	subdir(name: string): string {
		return paths.join(this.reportsDir, name);
	}

	/** Resolve the stable report path (e.g., "Test Report.md"). */
	stablePath(filename: string): string {
		return paths.join(this.reportsDir, filename);
	}

	/**
	 * Save a report document with the standard triple-output pattern:
	 *   1. Timestamped markdown in the subdirectory
	 *   2. Stable markdown at the reports root
	 *   3. Timestamped JSON snapshot of the source data (if provided)
	 *
	 * Returns the timestamped markdown path.
	 */
	save(doc: Document, opts: {
		subdir: string;
		slug: string;
		stableFilename: string;
		sourceJson?: string;
	}): string {
		const outputDir = this.subdir(opts.subdir);
		const safeTimestamp = clock.safeIso();
		const outputPath = paths.join(outputDir, `${safeTimestamp}-${opts.slug}.md`);

		disk.mkdirSync(outputDir, { recursive: true });
		doc.save(outputPath);
		doc.save(this.stablePath(opts.stableFilename));

		if (opts.sourceJson && disk.existsSync(opts.sourceJson)) {
			const jsonSnapshot = paths.join(outputDir, `${safeTimestamp}-${opts.slug}.json`);
			disk.copyFileSync(opts.sourceJson, jsonSnapshot);
		}

		return outputPath;
	}

	/**
	 * Save a reference document (stable file only, no timestamps).
	 * Reference docs live in docs/reference/ — they are living documents,
	 * not point-in-time snapshots like reports.
	 *
	 * Returns the output path.
	 */
	saveReference(doc: Document, filename: string): string {
		disk.mkdirSync(this.referenceDir, { recursive: true });
		const outputPath = paths.join(this.referenceDir, filename);
		doc.save(outputPath);
		return outputPath;
	}

	/** Resolve the coverage subdirectory path (relative, for CLI args). */
	get coverageDir(): string {
		const { config } = readProjectConfig(this.projectPath);
		const reportsRel = config?.reports?.dir ?? "reports";
		return `${reportsRel}/coverage`;
	}
}
