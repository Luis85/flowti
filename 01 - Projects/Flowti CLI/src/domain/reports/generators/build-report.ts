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

import fs from "node:fs";
import path from "node:path";
import { ROOT } from "../../../infrastructure/config.js";
import { Document } from "../../../infrastructure/document.js";

const OUTPUT_DIR = path.join(ROOT, "docs", "reports", "builds");
const MANIFEST_PATH = path.join(ROOT, "manifest.json");
const TEMPLATE_PATH = path.join(ROOT, "docs", "templates", "Build Report.md");

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
	for (const arg of process.argv.slice(2)) {
		const [key, ...rest] = arg.replace(/^--/, "").split("=");
		args[key] = rest.join("=") || "true";
	}
	return args;
}

interface OutputEntry {
	file: string;
	bytes: number;
}

function main(): void {
	const args = parseArgs();
	const metafilePath = args.metafile || process.env.BUILD_METAFILE;

	if (!metafilePath || !fs.existsSync(metafilePath)) {
		console.log("[report] No metafile found — skipping build report.");
		return;
	}

	const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
	const metafile = JSON.parse(fs.readFileSync(metafilePath, "utf-8"));
	const isRelease = args.release === "true";
	const buildType = args["build-type"];
	const duration = parseInt(args.duration || "0", 10);
	const warningsCount = parseInt(args.warnings || "0", 10);
	const errorsCount = parseInt(args.errors || "0", 10);
	const now = new Date();

	let totalBytes = 0;
	let jsBytes = 0;
	let cssBytes = 0;
	let otherBytes = 0;
	const outputs: OutputEntry[] = [];

	if (metafile?.outputs) {
		for (const [file, info] of Object.entries(metafile.outputs) as [string, { bytes?: number }][]) {
			const bytes = info.bytes || 0;
			totalBytes += bytes;
			if (file.endsWith(".js")) jsBytes += bytes;
			else if (file.endsWith(".css")) cssBytes += bytes;
			else otherBytes += bytes;
			outputs.push({ file: path.basename(file), bytes });
		}
	}

	const fm: Record<string, string | number | boolean> = {
		type: "BuildReport",
		plugin_id: manifest.id,
		plugin_version: manifest.version,
		mode: "production",
		build_time_iso: now.toISOString(),
		build_time_local: safeLocalTime(now),
		duration_ms: duration,
		minified: true,
		sourcemap: false,
		warnings_count: warningsCount,
		errors_count: errorsCount,
		total_bytes: totalBytes,
		js_bytes: jsBytes,
		css_bytes: cssBytes,
		other_bytes: otherBytes,
		node_version: process.version,
	};

	if (process.env.GITHUB_SHA) fm.git_commit = process.env.GITHUB_SHA;

	const doc = Document.create("Build Report").mergeFrontmatter(fm);

	// Optional template body
	if (fs.existsSync(TEMPLATE_PATH)) {
		const templateBody = fs.readFileSync(TEMPLATE_PATH, "utf-8").trim();
		doc.addBlank().text(templateBody);
	}

	doc.addBlank()
		.callout("info", "Build Summary", [
			`Mode: production`,
			`Duration: ${duration} ms`,
			`Bundle Size: ${humanBytes(totalBytes)}`,
			`Warnings: ${warningsCount}`,
			`Errors: ${errorsCount}`,
		])
		.addBlank();

	if (outputs.length > 0) {
		doc.heading(2, "Outputs")
			.addBlank()
			.table(
				["File", "Size"],
				outputs.sort((a, b) => b.bytes - a.bytes).map((o) => [o.file, humanBytes(o.bytes)]),
				{ alignRight: [1] },
			)
			.addBlank();
	}

	const safeTimestamp = now.toISOString().replace(/:/g, "-");
	const prefix = buildType === "increment"
		? "increment-build-report"
		: isRelease ? "release-build-report" : "build-report";
	const filename = `${safeTimestamp}-${prefix}.${manifest.version}.md`;
	const outputPath = path.join(OUTPUT_DIR, filename);

	doc.save(outputPath);

	console.log(`[report] BuildReport written: ${outputPath}`);
}

main();
