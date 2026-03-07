/**
 * generate-build-report.mjs
 *
 * Reads esbuild metafile JSON (passed via --metafile arg or BUILD_METAFILE env)
 * and generates a BuildReport vault note with queryable YAML frontmatter.
 *
 * Usage: node scripts/generate-build-report.mjs --metafile=path/to/metafile.json [--release] [--duration=ms]
 *
 * Can also be called from esbuild.config.mjs by writing the metafile to a temp location.
 */

import fs from "node:fs";
import path from "node:path";
const CLI_PROJECT = path.resolve(import.meta.dirname, "..");
const VAULT_ROOT = path.resolve(CLI_PROJECT, "..", "..");
const ROOT = path.resolve(VAULT_ROOT, "Development", "flowti");

const OUTPUT_DIR = path.join(ROOT, "docs", "reports", "builds");
const MANIFEST_PATH = path.join(ROOT, "manifest.json");
const TEMPLATE_PATH = path.join(ROOT, "docs", "templates", "Build Report.md");

function yamlEscape(value) {
	if (value === null || value === undefined) return "null";
	if (typeof value === "boolean" || typeof value === "number") return String(value);
	const str = String(value);
	if (/[:\n\r\t#'"{}[\],&*?]|^\s|\s$/.test(str)) return JSON.stringify(str);
	return str;
}

function humanBytes(bytes) {
	const units = ["B", "KB", "MB", "GB"];
	let i = 0;
	let n = bytes;
	while (n >= 1024 && i < units.length - 1) {
		n /= 1024;
		i++;
	}
	return `${n.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

function safeLocalTime(d) {
	const pad = (n) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function parseArgs() {
	const args = {};
	for (const arg of process.argv.slice(2)) {
		const [key, ...rest] = arg.replace(/^--/, "").split("=");
		args[key] = rest.join("=") || "true";
	}
	return args;
}

function main() {
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
	const outputs = [];

	if (metafile?.outputs) {
		for (const [file, info] of Object.entries(metafile.outputs)) {
			const bytes = info.bytes || 0;
			totalBytes += bytes;
			if (file.endsWith(".js")) jsBytes += bytes;
			else if (file.endsWith(".css")) cssBytes += bytes;
			else otherBytes += bytes;
			outputs.push({ file: path.basename(file), bytes });
		}
	}

	const fm = {
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

	const frontmatter = ["---", ...Object.entries(fm).map(([k, v]) => `${k}: ${yamlEscape(v)}`), "---"].join("\n");

	let templateBody = "";
	if (fs.existsSync(TEMPLATE_PATH)) {
		templateBody = fs.readFileSync(TEMPLATE_PATH, "utf-8").trim();
	}

	const summary = [
		"",
		"> [!info] Build Summary",
		`> Mode: production`,
		`> Duration: ${duration} ms`,
		`> Bundle Size: ${humanBytes(totalBytes)}`,
		`> Warnings: ${warningsCount}`,
		`> Errors: ${errorsCount}`,
		"",
	].join("\n");

	const outputsTable =
		outputs.length > 0
			? [
					"## Outputs",
					"",
					"| File | Size |",
					"|---|---:|",
					...outputs.sort((a, b) => b.bytes - a.bytes).map((o) => `| ${o.file} | ${humanBytes(o.bytes)} |`),
					"",
			  ].join("\n")
			: "";

	const content = `${frontmatter}\n\n${templateBody}\n${summary}\n${outputsTable}`;

	const safeTimestamp = now.toISOString().replace(/:/g, "-");
	const prefix = buildType === "increment"
		? "increment-build-report"
		: isRelease ? "release-build-report" : "build-report";
	const filename = `${safeTimestamp}-${prefix}.${manifest.version}.md`;
	const outputPath = path.join(OUTPUT_DIR, filename);

	fs.mkdirSync(OUTPUT_DIR, { recursive: true });
	fs.writeFileSync(outputPath, content, "utf-8");

	console.log(`[report] BuildReport written: ${outputPath}`);
}

main();
