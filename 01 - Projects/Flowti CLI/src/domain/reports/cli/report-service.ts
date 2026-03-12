/**
 * report-service.ts — Shared service for CLI report generation.
 *
 * Centralizes reports directory resolution (from project config),
 * timestamped file naming, and the save pattern (stable md + timestamped md + timestamped JSON).
 */

import type { ReportDeps } from "../../../infrastructure/deps.js";
import type { IFileSystem, IPaths, IClock } from "../../../infrastructure/types.js";
import { readProjectConfig } from "../../project/project-config.js";
import type { Document } from "../../../infrastructure/document.js";

export interface ReportServiceOptions {
	reportsDir?: string;
	referenceDir?: string;
}

function readConfigDirs(projectPath: string, p: IPaths, fs: IFileSystem) {
	const { config } = readProjectConfig(projectPath, { disk: fs, paths: p });
	const reportsRel = config?.reports?.dir ?? "reports";
	const referenceRel = config?.docs?.referenceDir ?? "docs/reference";
	return { reportsRel, referenceRel };
}

function resolveDirs(projectPath: string, p: IPaths, fs: IFileSystem, opts?: ReportServiceOptions) {
	if (opts?.reportsDir && opts?.referenceDir) {
		return { reportsDir: opts.reportsDir, referenceDir: opts.referenceDir, reportsRelDir: "reports" };
	}
	const { reportsRel, referenceRel } = readConfigDirs(projectPath, p, fs);
	const reportsDir = opts?.reportsDir ?? p.join(projectPath, reportsRel);
	const referenceDir = opts?.referenceDir ?? p.join(projectPath, referenceRel);
	return { reportsDir, referenceDir, reportsRelDir: reportsRel };
}

export class ReportService {
	readonly projectPath: string;
	readonly reportsDir: string;
	readonly referenceDir: string;
	private readonly reportsRelDir: string;
	private readonly disk: IFileSystem;
	private readonly paths: IPaths;
	private readonly clock: IClock;

	constructor(projectPath: string, deps: ReportDeps, opts?: ReportServiceOptions) {
		this.projectPath = projectPath;
		this.disk = deps.disk;
		this.paths = deps.paths;
		this.clock = deps.clock;
		const resolved = resolveDirs(projectPath, deps.paths, deps.disk, opts);
		this.reportsDir = resolved.reportsDir;
		this.referenceDir = resolved.referenceDir;
		this.reportsRelDir = resolved.reportsRelDir;
	}

	/** Resolve an absolute path to a subdirectory within the reports dir. */
	subdir(name: string): string {
		return this.paths.join(this.reportsDir, name);
	}

	/** Resolve the stable report path (e.g., "Test Report.md"). */
	stablePath(filename: string): string {
		return this.paths.join(this.reportsDir, filename);
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
		const safeTimestamp = this.clock.safeIso();
		const outputPath = this.paths.join(outputDir, `${safeTimestamp}-${opts.slug}.md`);

		this.disk.mkdirSync(outputDir, { recursive: true });
		doc.save(outputPath);
		doc.save(this.stablePath(opts.stableFilename));

		if (opts.sourceJson && this.disk.existsSync(opts.sourceJson)) {
			const jsonSnapshot = this.paths.join(outputDir, `${safeTimestamp}-${opts.slug}.json`);
			this.disk.copyFileSync(opts.sourceJson, jsonSnapshot);
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
		this.disk.mkdirSync(this.referenceDir, { recursive: true });
		const outputPath = this.paths.join(this.referenceDir, filename);
		doc.save(outputPath);
		return outputPath;
	}

	/** Resolve the coverage subdirectory path (relative to project root). */
	get coverageDir(): string {
		return `${this.reportsRelDir}/coverage`;
	}
}
