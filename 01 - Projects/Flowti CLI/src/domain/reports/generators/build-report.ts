/**
 * generate-build-report.ts
 *
 * Reads esbuild metafile JSON (passed via --metafile arg or BUILD_METAFILE env)
 * and generates a BuildReport vault note with queryable YAML frontmatter.
 *
 * Usage: node scripts/generate-build-report.ts --metafile=path/to/metafile.json [--release] [--duration=ms]
 *
 * Can also be called from esbuild.config.mjs by writing the metafile to a temp location.
 */

import { disk } from "../../../infrastructure/filesystem.js";
import { paths } from "../../../infrastructure/paths.js";
import { PLUGIN_ROOT } from "../../../infrastructure/config.js";
import { Document } from "../../../infrastructure/document.js";
import { log } from "../../../infrastructure/logger.js";
import { proc } from "../../../infrastructure/proc.js";
import { clock } from "../../../infrastructure/clock.js";

const OUTPUT_DIR = paths.join(PLUGIN_ROOT, "docs", "reports", "builds");
const MANIFEST_PATH = paths.join(PLUGIN_ROOT, "manifest.json");
const TEMPLATE_PATH = paths.join(PLUGIN_ROOT, "docs", "templates", "Build Report.md");

function humanBytes(bytes: number): string {
	const units = ["B", "KB", "MB", "GB"];
	let i = 0;
	let n = bytes;
	while (n >= 1024 && i < units.length - 1) {
		n /= 1024;
		i++;
	}
	return `${n.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

function safeLocalTime(d: Date): string {
	const pad = (n: number): string => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function parseArgs(): Record<string, string> {
	const args: Record<string, string> = {};
	for (const arg of proc.argv()) {
		const [key, ...rest] = arg.replace(/^--/, "").split("=");
		args[key] = rest.join("=") || "true";
	}
	return args;
}

interface OutputEntry {
	file: string;
	bytes: number;
}

interface ByteSummary {
	totalBytes: number;
	jsBytes: number;
	cssBytes: number;
	otherBytes: number;
	outputs: OutputEntry[];
}

function collectOutputs(metafile: Record<string, unknown>): ByteSummary {
	const result: ByteSummary = { totalBytes: 0, jsBytes: 0, cssBytes: 0, otherBytes: 0, outputs: [] };
	const outputs = metafile?.outputs as Record<string, { bytes?: number }> | undefined;
	if (!outputs) return result;

	for (const [file, info] of Object.entries(outputs)) {
		const bytes = info.bytes || 0;
		result.totalBytes += bytes;
		if (file.endsWith(".js")) result.jsBytes += bytes;
		else if (file.endsWith(".css")) result.cssBytes += bytes;
		else result.otherBytes += bytes;
		result.outputs.push({ file: paths.basename(file), bytes });
	}
	return result;
}

function buildBuildFm(
	manifest: Record<string, string>, now: Date, args: Record<string, string>, sizes: ByteSummary,
): Record<string, string | number | boolean> {
	const fm: Record<string, string | number | boolean> = {
		type: "BuildReport",
		plugin_id: manifest.id,
		plugin_version: manifest.version,
		mode: "production",
		build_time_iso: now.toISOString(),
		build_time_local: safeLocalTime(now),
		duration_ms: parseInt(args.duration || "0", 10),
		minified: true,
		sourcemap: false,
		warnings_count: parseInt(args.warnings || "0", 10),
		errors_count: parseInt(args.errors || "0", 10),
		total_bytes: sizes.totalBytes,
		js_bytes: sizes.jsBytes,
		css_bytes: sizes.cssBytes,
		other_bytes: sizes.otherBytes,
		node_version: process.version,
	};
	const sha = proc.env().GITHUB_SHA;
	if (sha) fm.git_commit = sha;
	return fm;
}

function main(): void {
	const args = parseArgs();
	const metafilePath = args.metafile || proc.env().BUILD_METAFILE;

	if (!metafilePath || !disk.existsSync(metafilePath)) {
		log("[report] No metafile found — skipping build report.");
		return;
	}

	const manifest = JSON.parse(disk.readFileSync(MANIFEST_PATH, "utf-8")) as Record<string, string>;
	const metafile = JSON.parse(disk.readFileSync(metafilePath, "utf-8")) as Record<string, unknown>;
	const now = clock.now();
	const sizes = collectOutputs(metafile);
	const fm = buildBuildFm(manifest, now, args, sizes);

	const duration = fm.duration_ms as number;
	const warningsCount = fm.warnings_count as number;
	const errorsCount = fm.errors_count as number;

	const doc = Document.create("Build Report").mergeFrontmatter(fm);

	if (disk.existsSync(TEMPLATE_PATH)) {
		doc.addBlank().text(disk.readFileSync(TEMPLATE_PATH, "utf-8").trim());
	}

	doc.addBlank()
		.callout("info", "Build Summary", [
			`Mode: production`,
			`Duration: ${duration} ms`,
			`Bundle Size: ${humanBytes(sizes.totalBytes)}`,
			`Warnings: ${warningsCount}`,
			`Errors: ${errorsCount}`,
		])
		.addBlank();

	if (sizes.outputs.length > 0) {
		doc.heading(2, "Outputs")
			.addBlank()
			.table(
				["File", "Size"],
				sizes.outputs.sort((a, b) => b.bytes - a.bytes).map((o) => [o.file, humanBytes(o.bytes)]),
				{ alignRight: [1] },
			)
			.addBlank();
	}

	const isRelease = args.release === "true";
	const buildType = args["build-type"];
	const safeTimestamp = clock.safeIso();
	const prefix = buildType === "increment"
		? "increment-build-report"
		: isRelease ? "release-build-report" : "build-report";
	const filename = `${safeTimestamp}-${prefix}.${manifest.version}.md`;
	const outputPath = paths.join(OUTPUT_DIR, filename);

	doc.save(outputPath);

	log(`[report] BuildReport written: ${outputPath}`);
}

main();
