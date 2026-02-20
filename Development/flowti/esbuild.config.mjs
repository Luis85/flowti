/**
 * build.mjs
 *
 * Enhancement:
 * - Reads an endpoints JSON file containing an array of destination paths
 * - After a successful (non-watch) build, distributes the built plugin folder to each endpoint
 *
 * Endpoints file example (default: docs/reports/build-endpoints.json):
 * [
 *   "C:/some/obsidian/.obsidian/plugins/your-plugin-id",
 *   "D:/Vaults/TeamVault/.obsidian/plugins/your-plugin-id"
 * ]
 */

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
// Load manifest (safe)
// --------------------------------------------------

const readJson = (filePath) => {
	try {
		return JSON.parse(fs.readFileSync(filePath, "utf-8"));
	} catch (err) {
		console.error(`[build] Failed to read/parse JSON: ${filePath}`);
		throw err;
	}
};

const manifestPath = path.resolve(__dirname, "manifest.json");
const manifest = readJson(manifestPath);

const PLUGIN_ID = manifest.id;

// Local dev output (your default)
const OUTDIR = path.resolve(process.cwd(), "..", "..", ".obsidian", "plugins", PLUGIN_ID);

// Build report output
const REPORTDIR = path.resolve(process.cwd(), "docs", "reports", "builds");

// Endpoints config (JSON array of paths)
const ENDPOINTS_FILE =
	process.env.BUILD_ENDPOINTS_FILE ||
	path.resolve(process.cwd(), "docs", "reports", "build-endpoints.json");

const isWatch = process.argv.includes("--watch");
const isPublic = process.argv.includes("--publish");
const prod = !isWatch;

// --------------------------------------------------
// Utilities (safe filesystem)
// --------------------------------------------------

const ensureDir = (dirPath) => {
	try {
		fs.mkdirSync(dirPath, { recursive: true });
	} catch (err) {
		console.error(`[build] Failed to create dir: ${dirPath}`);
		throw err;
	}
};

const safeExists = (p) => {
	try {
		return fs.existsSync(p);
	} catch {
		return false;
	}
};

const safeReadText = (p) => {
	try {
		return fs.readFileSync(p, "utf-8");
	} catch (err) {
		console.error(`[build] Failed to read file: ${p}`);
		throw err;
	}
};

const safeWriteText = (p, content) => {
	try {
		ensureDir(path.dirname(p));
		fs.writeFileSync(p, content, "utf-8");
	} catch (err) {
		console.error(`[build] Failed to write file: ${p}`);
		throw err;
	}
};

const safeCopyFile = (src, dest) => {
	try {
		ensureDir(path.dirname(dest));
		fs.copyFileSync(src, dest);
	} catch (err) {
		console.warn(`[build] Failed to copy: ${src} -> ${dest}`);
		console.warn(err);
	}
};

const removeDirRecursive = (dirPath) => {
	if (!safeExists(dirPath)) return;
	try {
		fs.rmSync(dirPath, { recursive: true, force: true });
	} catch (err) {
		console.warn(`[build] Failed to remove dir: ${dirPath}`);
		console.warn(err);
	}
};

const listFilesRecursive = (rootDir) => {
	const results = [];
	const walk = (dir) => {
		const entries = fs.readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			const abs = path.join(dir, entry.name);
			if (entry.isDirectory()) walk(abs);
			else if (entry.isFile()) results.push(abs);
		}
	};
	walk(rootDir);
	return results;
};

const copyDirRecursive = (srcDir, destDir) => {
	ensureDir(destDir);
	const files = listFilesRecursive(srcDir);
	for (const absSrc of files) {
		const rel = path.relative(srcDir, absSrc);
		const absDest = path.join(destDir, rel);
		safeCopyFile(absSrc, absDest);
	}
};

const ensureOutdir = () => ensureDir(OUTDIR);
const ensureReportdir = () => ensureDir(REPORTDIR);

const syncAssets = () => {
	const assets = ["manifest.json", ".hotreload", "LICENSE", "styles.css"];
	for (const file of assets) {
		const src = path.resolve(__dirname, file);
		if (safeExists(src)) safeCopyFile(src, path.join(OUTDIR, file));
	}
};

const safeLocalTime = (d) => {
	const pad = (n) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
		d.getHours()
	)}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
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
	if (typeof value === "boolean" || typeof value === "number") return String(value);

	const str = String(value);
	if (/[:\n\r\t#'"{}[\],&*?]|^\s|\s$/.test(str)) return JSON.stringify(str);
	return str;
};

// --------------------------------------------------
// Build Report Generator (safe)
// --------------------------------------------------

const writeBuildReport = (result, startTime) => {
	if (!prod) return;

	try {
		ensureReportdir();

		const templatePath = path.resolve(__dirname, "docs", "templates", "Build Report.md");
		if (!safeExists(templatePath)) {
			console.warn("[build] BuildReport template not found. Skipping.");
			return;
		}

		const templateBody = safeReadText(templatePath);
		const endTime = Date.now();
		const duration = endTime - startTime;
		const now = new Date();

		let totalBytes = 0;
		let jsBytes = 0;
		let cssBytes = 0;
		let otherBytes = 0;
		const outputs = [];

		if (result?.metafile?.outputs) {
			for (const [file, info] of Object.entries(result.metafile.outputs)) {
				const bytes = info.bytes || 0;
				totalBytes += bytes;
				if (file.endsWith(".js")) jsBytes += bytes;
				else if (file.endsWith(".css")) cssBytes += bytes;
				else otherBytes += bytes;

				outputs.push({ file: file.replace(OUTDIR + path.sep, ""), bytes });
			}
		}

		const safeTimestamp = now.toISOString().replace(/:/g, "-");
		let reportName = `${safeTimestamp}-build-report.${manifest.version}.md`;
		if (isPublic) reportName = `${safeTimestamp}-release-build-report.${manifest.version}.md`;

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
			`warnings_count: ${result?.warnings?.length ?? 0}`,
			`errors_count: ${result?.errors?.length ?? 0}`,
			`total_bytes: ${totalBytes}`,
			`js_bytes: ${jsBytes}`,
			`css_bytes: ${cssBytes}`,
			`other_bytes: ${otherBytes}`,
			`node_version: ${yamlEscape(process.version)}`,
			`esbuild_version: ${yamlEscape(esbuild.version)}`,
			`ci: ${Boolean(process.env.CI)}`,
			process.env.GITHUB_SHA ? `git_commit: ${yamlEscape(process.env.GITHUB_SHA)}` : null,
			"---",
		]
			.filter(Boolean)
			.join("\n");

		const outputsTable =
			outputs.length > 0
				? [
						"",
						"## Outputs",
						"",
						"| File | Size |",
						"|---|---:|",
						...outputs
							.sort((a, b) => b.bytes - a.bytes)
							.map((o) => `| ${o.file} | ${humanBytes(o.bytes)} |`),
				  ].join("\n")
				: "";

		const summary = `
> [!info] Build Summary
> Mode: ${prod ? "production" : "watch"}
> Duration: ${duration} ms
> Bundle Size: ${humanBytes(totalBytes)}
> Warnings: ${result?.warnings?.length ?? 0}
> Errors: ${result?.errors?.length ?? 0}
`;

		const content = `${frontmatter}\n\n${templateBody.trim()}\n${summary}\n${outputsTable}\n`;
		safeWriteText(reportPath, content);

		console.log("[build] Build report written:", reportPath);
	} catch (err) {
		console.warn("[build] Failed to write build report (skipping).");
		console.warn(err);
	}
};

// --------------------------------------------------
// Build Distribution
// --------------------------------------------------

const readEndpoints = () => {
	if (!safeExists(ENDPOINTS_FILE)) {
		console.log(`[build] No endpoints file found at: ${ENDPOINTS_FILE} (skipping distribution).`);
		return [];
	}

	const raw = safeReadText(ENDPOINTS_FILE);
	let json;
	try {
		json = JSON.parse(raw);
	} catch (err) {
		console.warn(`[build] Endpoints file is not valid JSON: ${ENDPOINTS_FILE} (skipping distribution).`);
		console.warn(err);
		return [];
	}

	// Support either ["path1", "path2"] or { "endpoints": ["path1", ...] }
	const endpoints = Array.isArray(json) ? json : Array.isArray(json?.endpoints) ? json.endpoints : [];

	return endpoints
		.map((p) => (typeof p === "string" ? p.trim() : ""))
		.filter(Boolean)
		.map((p) => path.resolve(p));
};

const distributeBuild = () => {
	// Only distribute on non-watch builds
	if (isWatch) return;

	const endpoints = readEndpoints();
	if (!endpoints.length) return;

	console.log(`[build] Distributing build to ${endpoints.length} endpoint(s)...`);

	let failures = 0;

	for (const dest of endpoints) {
		try {
			// Safety: require the destination to contain the plugin id folder name
			// (prevents accidentally wiping random folders)
			const destBase = path.basename(dest);
			if (destBase !== PLUGIN_ID) {
				console.warn(
					`[build] Skipping endpoint (basename must be "${PLUGIN_ID}"): ${dest}`
				);
				continue;
			}

			// Clean destination then copy
			removeDirRecursive(dest);
			ensureDir(dest);
			copyDirRecursive(OUTDIR, dest);

			console.log(`[build] ✅ Distributed to: ${dest}`);
		} catch (err) {
			failures++;
			console.warn(`[build] ❌ Failed to distribute to: ${dest}`);
			console.warn(err);
		}
	}

	if (failures > 0) {
		// Do not hard-fail the build by default, but expose it for CI
		console.warn(`[build] Distribution completed with ${failures} failure(s).`);
		if (process.env.CI) process.exitCode = 1;
	} else {
		console.log("[build] Distribution finished successfully.");
	}
};

// --------------------------------------------------
// ESBuild
// --------------------------------------------------

const nodeBuiltins = builtinModules.flatMap((m) => [m, `node:${m}`]);

const run = async () => {
	ensureOutdir();
	ensureReportdir();

	const startTime = Date.now();

	let ctx;
	try {
		ctx = await esbuild.context({
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
	} catch (err) {
		console.error("[build] esbuild context init failed.");
		throw err;
	}

	// Asset sync should not crash the build
	try {
		syncAssets();
	} catch (err) {
		console.warn("[build] syncAssets failed (continuing).");
		console.warn(err);
	}

	if (isWatch) {
		try {
			await ctx.watch();
			console.log("[build] Watching...", OUTDIR);
		} catch (err) {
			console.error("[build] Watch mode failed.");
			throw err;
		}
		return;
	}

	// One-off build
	try {
		const result = await ctx.rebuild();
		writeBuildReport(result, startTime);

		// Treat esbuild errors as failure
		if (result?.errors?.length) process.exitCode = 1;

		// Only distribute if build succeeded (no esbuild errors)
		if (!(result?.errors?.length ?? 0)) {
			distributeBuild();
		} else {
			console.warn("[build] Skipping distribution due to build errors.");
		}

		console.log("[build] Build done...", OUTDIR);
	} catch (err) {
		console.error("[build] Build failed.");
		throw err;
	} finally {
		try {
			await ctx.dispose();
		} catch {
			console.warn("[build] Failed to dispose esbuild context (ignored).");
		}
	}
};

run().catch((err) => {
	console.error("[build] Fatal error:");
	console.error(err);
	process.exit(1);
});
