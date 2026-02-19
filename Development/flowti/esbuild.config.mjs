import esbuild from "esbuild";
import { builtinModules } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// --------------------------------------------------
// ESM __dirname equivalent
// --------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --------------------------------------------------
// Load manifest
// --------------------------------------------------

const manifestPath = path.resolve(__dirname, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

const PLUGIN_ID = manifest.id;
const OUTDIR = path.resolve(
	process.cwd(),
	"..",
	"..",
	".obsidian",
	"plugins",
	PLUGIN_ID
);
const REPORTDIR = path.resolve(
	process.cwd(),
  "docs",
  "reports",
);

const isWatch = process.argv.includes("--watch");
const prod = !isWatch;

// --------------------------------------------------
// Utilities
// --------------------------------------------------

const ensureOutdir = () => {
	fs.mkdirSync(OUTDIR, { recursive: true });
};

const copyFile = (src, dest) => {
	fs.mkdirSync(path.dirname(dest), { recursive: true });
	fs.copyFileSync(src, dest);
};

const syncAssets = () => {
	const assets = ["manifest.json", ".hotreload", "LICENSE", "styles.css"];

	for (const file of assets) {
		const src = path.resolve(__dirname, file);
		if (fs.existsSync(src)) {
			copyFile(src, path.join(OUTDIR, file));
		}
	}
};

const safeLocalTime = (d) => {
	const pad = (n) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
		d.getDate()
	)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const humanBytes = (bytes) => {
	const units = ["B", "KB", "MB", "GB"];
	let i = 0;
	let n = bytes;
	while (n >= 1024 && i < units.length - 1) {
		n /= 1024;
		i++;
	}
	return `${n.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
};

const yamlEscape = (value) => {
	if (value === null || value === undefined) return "null";
	if (typeof value === "boolean" || typeof value === "number")
		return String(value);

	const str = String(value);

	if (/[:\n\r\t#'"{}[\],&*?]|^\s|\s$/.test(str)) {
		return JSON.stringify(str);
	}

	return str;
};

// --------------------------------------------------
// Build Report Generator
// --------------------------------------------------

const writeBuildReport = (result, startTime) => {
	if (!prod) return;

	const templatePath = path.resolve(
		__dirname,
		"docs",
		"templates",
		"Build Report.md"
	);

	if (!fs.existsSync(templatePath)) {
		console.warn("BuildReport template not found. Skipping.");
		return;
	}

	const templateBody = fs.readFileSync(templatePath, "utf-8");

	const endTime = Date.now();
	const duration = endTime - startTime;
	const now = new Date();

	let totalBytes = 0;
	let jsBytes = 0;
	let cssBytes = 0;
	let otherBytes = 0;

	const outputs = [];

	if (result.metafile?.outputs) {
		for (const [file, info] of Object.entries(result.metafile.outputs)) {
			const bytes = info.bytes || 0;
			totalBytes += bytes;

			if (file.endsWith(".js")) jsBytes += bytes;
			else if (file.endsWith(".css")) cssBytes += bytes;
			else otherBytes += bytes;

			outputs.push({
				file: file.replace(OUTDIR + path.sep, ""),
				bytes,
			});
		}
	}

	const reportName = `${now.toISOString()}-build-report.${manifest.version}.md`;
	const reportPath = path.join(REPORTDIR, reportName);

	const frontmatter = [
		"---",
		`type: ${yamlEscape("BuildReport")}`,
		`plugin_id: ${yamlEscape(PLUGIN_ID)}`,
		`plugin_version: ${yamlEscape(manifest.version)}`,
		`mode: ${yamlEscape(prod ? "production" : "watch")}`,
		`build_time_iso: ${yamlEscape(now.toISOString())}`,
		`build_time_local: ${yamlEscape(safeLocalTime(now))}`,
		`duration_ms: ${duration}`,
		`minified: ${prod}`,
		`sourcemap: ${!prod}`,
		`warnings_count: ${result.warnings.length}`,
		`errors_count: ${result.errors.length}`,
		`total_bytes: ${totalBytes}`,
		`js_bytes: ${jsBytes}`,
		`css_bytes: ${cssBytes}`,
		`other_bytes: ${otherBytes}`,
		`node_version: ${yamlEscape(process.version)}`,
		`esbuild_version: ${yamlEscape(esbuild.version)}`,
		`ci: ${Boolean(process.env.CI)}`,
		process.env.GITHUB_SHA
			? `git_commit: ${yamlEscape(process.env.GITHUB_SHA)}`
			: null,
		"---",
	]
		.filter(Boolean)
		.join("\n");

	const summary = `
> [!info] Build Summary
> Mode: ${prod ? "production" : "watch"}
> Duration: ${duration} ms
> Bundle Size: ${humanBytes(totalBytes)}
> Warnings: ${result.warnings.length}
> Errors: ${result.errors.length}
`;

	const content = `${frontmatter}\n\n${templateBody.trim()}\n${summary}\n`;

	fs.writeFileSync(reportPath, content, "utf-8");

	console.log("Build report written:", reportPath);
};

// --------------------------------------------------
// ESBuild
// --------------------------------------------------

const nodeBuiltins = builtinModules.flatMap((m) => [m, `node:${m}`]);

const run = async () => {
	ensureOutdir();

	const startTime = Date.now();

	const ctx = await esbuild.context({
		entryPoints: ["src/main.ts"],
		bundle: true,
		outdir: OUTDIR,
		format: "cjs",
		target: "node16",
		platform: "node",
		sourcemap: prod ? false : "inline",
		external: ["obsidian", "electron", ...nodeBuiltins],
		treeShaking: true,
		minify: prod,
		logLevel: "info",
		metafile: true,
	});

	syncAssets();

	if (isWatch) {
		await ctx.watch();
		console.log("Watching...", OUTDIR);
	} else {
		const result = await ctx.rebuild();
		writeBuildReport(result, startTime);
		await ctx.dispose();
		console.log("Build done...", OUTDIR);
	}
};

run().catch((err) => {
	console.error(err);
	process.exit(1);
});
