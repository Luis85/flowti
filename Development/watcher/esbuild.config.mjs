/**
 * build.mjs
 *
 * Distribution enhancements:
 * - Distribution runs ONLY if --distribution flag is set (and not --watch)
 * - Endpoints JSON supports named endpoints + per-endpoint "clean" option
 * - Clean list approach: remove only known build artifacts (never delete folder, preserve data.json)
 *
 * Endpoints config (default): ./build-endpoints.json
 *
 * Supported formats:
 * 1) New (recommended):
 * {
 *   "endpoints": [
 *     { "name": "TeamVault", "path": "D:/Vaults/Team/.obsidian/plugins/<plugin-id>", "clean": true },
 *     { "name": "MyVault",   "path": "C:/Vault/.obsidian/plugins/<plugin-id>",       "clean": false }
 *   ]
 * }
 *
 * 2) Backward compatible:
 * [
 *   "C:/.../.obsidian/plugins/<plugin-id>",
 *   "D:/.../.obsidian/plugins/<plugin-id>"
 * ]
 *
 * Env:
 *   BUILD_ENDPOINTS_FILE=path/to/endpoints.json
 */

import esbuild from "esbuild";
import { builtinModules } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ==================================================
// INPUT
// ==================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const readJson = (filePath) => {
	try {
		return JSON.parse(fs.readFileSync(filePath, "utf-8"));
	} catch (err) {
		console.error(`[build] Failed to read/parse JSON: ${filePath}`);
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

const ensureDir = (dirPath) => {
	try {
		fs.mkdirSync(dirPath, { recursive: true });
	} catch (err) {
		console.error(`[build] Failed to create dir: ${dirPath}`);
		throw err;
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

const safeRmFile = (p) => {
	try {
		fs.rmSync(p, { force: true });
	} catch (err) {
		console.warn(`[build] Failed to remove file (ignored): ${p}`);
		console.warn(err);
	}
};

const safeRmDir = (p) => {
	try {
		fs.rmSync(p, { recursive: true, force: true });
	} catch (err) {
		console.warn(`[build] Failed to remove dir (ignored): ${p}`);
		console.warn(err);
	}
};

// Load manifest
const manifestPath = path.resolve(__dirname, "manifest.json");
const manifest = readJson(manifestPath);
const PLUGIN_ID = manifest.id;

// CLI flags
const isWatch = process.argv.includes("--watch");
const isPublic = process.argv.includes("--publish");
const doDistribution = process.argv.includes("--distribution");
const prod = !isWatch;

// Paths
const OUTDIR = path.resolve(process.cwd(), "..", "..", ".obsidian", "plugins", PLUGIN_ID);
const REPORTDIR = path.resolve(process.cwd(), "docs", "reports", "builds");
const ENDPOINTS_FILE =
	process.env.BUILD_ENDPOINTS_FILE ||
	path.resolve(process.cwd(), "build-endpoints.json");

// Builtins for esbuild externals
const nodeBuiltins = builtinModules.flatMap((m) => [m, `node:${m}`]);

// ==================================================
// PROCESS
// ==================================================

const syncAssets = () => {
	const assets = ["manifest.json", ".hotreload", "LICENSE", "styles.css"];
	for (const file of assets) {
		const src = path.resolve(__dirname, file);
		if (safeExists(src)) safeCopyFile(src, path.join(OUTDIR, file));
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

const copyDirRecursive = (srcDir, destDir, options = {}) => {
	const { excludeBasenames = new Set(), excludeRelPaths = [] } = options;

	ensureDir(destDir);

	const files = listFilesRecursive(srcDir);
	for (const absSrc of files) {
		const rel = path.relative(srcDir, absSrc);
		const relPosix = rel.replace(/\\/g, "/");
		const base = path.basename(rel);

		if (excludeBasenames.has(base)) continue;

		const excludedByRel = excludeRelPaths.some((p) => {
			if (p instanceof RegExp) return p.test(relPosix);
			return relPosix === String(p);
		});
		if (excludedByRel) continue;

		const absDest = path.join(destDir, rel);
		safeCopyFile(absSrc, absDest);
	}
};

// ==================================================
// OUTPUT
// ==================================================

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

const writeBuildReport = (result, startTime) => {
	if (!prod) return;

	try {
		ensureDir(REPORTDIR);

		const templatePath = path.resolve(__dirname, "docs", "templates", "Build Report.md");
		if (!safeExists(templatePath)) {
			console.warn("[build] BuildReport template not found. Skipping.");
			return;
		}

		const templateBody = safeReadText(templatePath);

		const duration = Date.now() - startTime;
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

// ==================================================
// DISTRIBUTION
// ==================================================

// User data that must never be overwritten / deleted:
const PRESERVE_BASENAMES = new Set(["data.json"]);

// Clean list = only remove known build artifacts before copying.
const CLEAN_REL_PATHS = [
	"main.js",
	"styles.css",
	"manifest.json",
	".hotreload",
	"LICENSE",
	"main.js.map",
	"styles.css.map",
	// Add folders if you have them:
	// "assets",
];

const normalizeEndpoint = (ep, idx) => {
	// New format object
	if (ep && typeof ep === "object" && !Array.isArray(ep)) {
		const name = typeof ep.name === "string" && ep.name.trim() ? ep.name.trim() : `endpoint-${idx + 1}`;
		const p = typeof ep.path === "string" ? ep.path.trim() : "";
		const clean = Boolean(ep.clean);
		if (!p) return null;
		return { name, path: path.resolve(p), clean };
	}

	// Legacy: string path
	if (typeof ep === "string" && ep.trim()) {
		return { name: `endpoint-${idx + 1}`, path: path.resolve(ep.trim()), clean: true };
	}

	return null;
};

const readEndpoints = () => {
	if (!safeExists(ENDPOINTS_FILE)) {
		console.log(`[build] No endpoints file found at: ${ENDPOINTS_FILE} (skipping distribution).`);
		return [];
	}

	let json;
	try {
		json = JSON.parse(safeReadText(ENDPOINTS_FILE));
	} catch (err) {
		console.warn(`[build] Endpoints file is not valid JSON: ${ENDPOINTS_FILE} (skipping distribution).`);
		console.warn(err);
		return [];
	}

	const rawEndpoints = Array.isArray(json) ? json : Array.isArray(json?.endpoints) ? json.endpoints : [];
	const normalized = rawEndpoints.map(normalizeEndpoint).filter(Boolean);

	if (!normalized.length) {
		console.log(`[build] Endpoints file has no valid endpoints: ${ENDPOINTS_FILE}`);
	}

	return normalized;
};

const cleanEndpoint = (endpointDir) => {
	for (const rel of CLEAN_REL_PATHS) {
		const target = path.join(endpointDir, rel);
		if (!safeExists(target)) continue;

		const base = path.basename(target);
		if (PRESERVE_BASENAMES.has(base)) continue;

		try {
			const stat = fs.lstatSync(target);
			if (stat.isDirectory()) safeRmDir(target);
			else safeRmFile(target);
		} catch (err) {
			console.warn(`[build] Failed to clean artifact (ignored): ${target}`);
			console.warn(err);
		}
	}
};

const distributeBuild = () => {
	// Gate distribution behind flag
	if (!doDistribution) {
		console.log("[build] Distribution disabled (use --distribution to enable).");
		return;
	}

	// Never distribute in watch mode
	if (isWatch) {
		console.log("[build] Distribution skipped in watch mode.");
		return;
	}

	const endpoints = readEndpoints();
	if (!endpoints.length) return;

	console.log(`[build] Distributing build to ${endpoints.length} endpoint(s)...`);

	let failures = 0;

	for (const ep of endpoints) {
		try {
			// Safety: endpoint folder should end with the plugin id
			const destBase = path.basename(ep.path);
			if (destBase !== PLUGIN_ID) {
				console.warn(
					`[build] Skipping "${ep.name}" (basename must be "${PLUGIN_ID}"): ${ep.path}`
				);
				continue;
			}

			ensureDir(ep.path);

			if (ep.clean) {
				cleanEndpoint(ep.path);
			}

			// Copy build output over, but never overwrite user data
			copyDirRecursive(OUTDIR, ep.path, {
				excludeBasenames: PRESERVE_BASENAMES,
			});

			console.log(`[build] ✅ Distributed to "${ep.name}": ${ep.path}`);
		} catch (err) {
			failures++;
			console.warn(`[build] ❌ Failed to distribute to "${ep.name}": ${ep.path}`);
			console.warn(err);
		}
	}

	if (failures > 0) {
		console.warn(`[build] Distribution completed with ${failures} failure(s).`);
		if (process.env.CI) process.exitCode = 1;
	} else {
		console.log("[build] Distribution finished successfully.");
	}
};

// ==================================================
// MAIN (orchestration)
// ==================================================

const run = async () => {
	ensureDir(OUTDIR);
	ensureDir(REPORTDIR);

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

	try {
		const result = await ctx.rebuild();

		writeBuildReport(result, startTime);

		// mark build failure on esbuild errors
		if (result?.errors?.length) process.exitCode = 1;

		// distribute only if build succeeded
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
