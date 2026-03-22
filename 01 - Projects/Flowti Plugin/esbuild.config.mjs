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
import { execSync } from "node:child_process";
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
const isIncrement = process.argv.includes("--increment");
const doReload = process.argv.includes("--reload");
const noReports = process.argv.includes("--no-reports");
const storybook = process.argv.includes("--storybook");
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

/**
 * Concatenates all CSS source files from css/ into styles.css.
 * Files are sorted by name (00-base → 18-misc) to ensure correct cascade order.
 */
const concatCSS = () => {
	const cssDir = path.resolve(__dirname, "css");
	if (!safeExists(cssDir)) return;

	const files = fs.readdirSync(cssDir)
		.filter((f) => f.endsWith(".css"))
		.sort();

	if (!files.length) return;

	const header = "/* Auto-generated from css/ source files — do not edit directly */\n\n";
	const parts = files.map((f) => safeReadText(path.join(cssDir, f)));
	const output = header + parts.join("\n");

	safeWriteText(path.resolve(__dirname, "styles.css"), output);
};

const syncSprites = () => {
	const charsDir = path.resolve(__dirname, "assets", "Actor", "Characters");
	if (!safeExists(charsDir)) return;

	const entries = fs.readdirSync(charsDir, { withFileTypes: true });
	for (const entry of entries) {
		if (!entry.isDirectory()) continue;

		const animDir = path.join(charsDir, entry.name, "SeparateAnim");
		if (!safeExists(animDir)) continue;

		for (const sprite of ["Idle.png", "Walk.png"]) {
			const src = path.join(animDir, sprite);
			if (!safeExists(src)) continue;

			const dest = path.join(OUTDIR, "assets", "Actor", "Characters", entry.name, "SeparateAnim", sprite);
			safeCopyFile(src, dest);
		}
	}
};

const syncAssets = () => {
	concatCSS();
	const assets = ["manifest.json", ".hotreload", "LICENSE", "styles.css"];
	for (const file of assets) {
		const src = path.resolve(__dirname, file);
		if (safeExists(src)) safeCopyFile(src, path.join(OUTDIR, file));
	}
	syncSprites();
	// Room animated props + tile art (see animated-elements.ts / scenes) — must ship with plugin
	syncBackgroundAssets();
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

/** Copy Ninja Adventure background pack used by Excalibur animated layers (flags, plants, ripples, …). */
const syncBackgroundAssets = () => {
	const srcDir = path.resolve(__dirname, "assets", "Backgrounds");
	if (!safeExists(srcDir)) return;
	const destDir = path.join(OUTDIR, "assets", "Backgrounds");
	copyDirRecursive(srcDir, destDir);
};

// ==================================================
// OUTPUT
// ==================================================

const writeBuildReport = (result, startTime) => {
	if (!prod) return;

	try {
		ensureDir(REPORTDIR);

		const duration = Date.now() - startTime;
		const warningsCount = result?.warnings?.length ?? 0;
		const errorsCount = result?.errors?.length ?? 0;

		// Write metafile to temp location for the report script
		const metafilePath = path.join(REPORTDIR, ".metafile.json");
		if (result?.metafile) {
			safeWriteText(metafilePath, JSON.stringify(result.metafile));
		}

		const script = path.resolve(__dirname, "scripts", "generate-build-report.mjs");
		if (!safeExists(script)) {
			console.warn("[build] generate-build-report.mjs not found. Skipping.");
			return;
		}

		const args = [
			`--metafile="${metafilePath}"`,
			`--duration=${duration}`,
			`--warnings=${warningsCount}`,
			`--errors=${errorsCount}`,
			isPublic ? "--release=true" : "",
			isIncrement ? "--build-type=increment" : "",
		].filter(Boolean).join(" ");

		execSync(`node "${script}" ${args}`, { cwd: __dirname, stdio: "inherit" });

		// Clean up temp metafile
		safeRmFile(metafilePath);
	} catch (err) {
		console.warn("[build] Failed to write build report (skipping).");
		console.warn(err);
	}
};

// ==================================================
// REPORT NOTES (TestReport + CoverageReport vault notes)
// ==================================================

const generateReportNotes = () => {
	if (!prod) return;

	const buildType = isIncrement ? "increment" : (isPublic || doDistribution) ? "full" : "flow";

	const scripts = [
		path.resolve(__dirname, "scripts", "generate-test-report.mjs"),
		path.resolve(__dirname, "scripts", "generate-coverage-report.mjs"),
		path.resolve(__dirname, "scripts", "generate-codebase-report.mjs"),
		path.resolve(__dirname, "scripts", "generate-cycle-report.mjs"),
		path.resolve(__dirname, "scripts", "generate-trace-report.mjs"),
		path.resolve(__dirname, "scripts", "generate-command-reference.mjs"),
		path.resolve(__dirname, "scripts", "generate-event-catalog.mjs"),
		path.resolve(__dirname, "scripts", "generate-data-dictionary.mjs"),
		path.resolve(__dirname, "scripts", "generate-performance-report.mjs"),
		path.resolve(__dirname, "scripts", "generate-complexity-report.mjs"),
		path.resolve(__dirname, "scripts", "generate-e2e-report.mjs"),
		path.resolve(__dirname, "scripts", "generate-cli-reference.mjs"),
	];

	for (const script of scripts) {
		if (!safeExists(script)) continue;
		try {
			execSync(`node "${script}" --build-type=${buildType}`, { cwd: __dirname, stdio: "inherit" });
		} catch (err) {
			console.warn(`[build] Report note generation failed (skipping): ${path.basename(script)}`);
			console.warn(err);
		}
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
		// Auto-reload plugin via CLI after each watch rebuild (--reload flag)
		const plugins = [];
		if (isWatch && doReload) {
			const reloadScript = path.resolve(__dirname, "scripts", "cli-reload.mjs");
			plugins.push({
				name: "cli-reload",
				setup(build) {
					build.onEnd(() => {
						try {
							execSync(`node "${reloadScript}"`, { cwd: __dirname, stdio: "inherit" });
						} catch {
							// Non-fatal: reload failure should not stop watch mode
						}
					});
				},
			});
		}

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
			plugins,
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

			// Watch css/ source files and rebuild styles.css on change
			const cssDir = path.resolve(__dirname, "css");
			if (safeExists(cssDir)) {
				const cssWatcher = fs.watch(cssDir, { persistent: false }, (eventType, filename) => {
					if (filename && filename.endsWith(".css")) {
						console.log(`[build] CSS changed: ${filename} — rebuilding styles.css`);
						concatCSS();
						safeCopyFile(
							path.resolve(__dirname, "styles.css"),
							path.join(OUTDIR, "styles.css"),
						);
					}
				});
				cssWatcher.on("error", () => {});
			}
		} catch (err) {
			console.error("[build] Watch mode failed.");
			throw err;
		}
		return;
	}

	try {
		const result = await ctx.rebuild();

		writeBuildReport(result, startTime);
		if (!noReports) generateReportNotes();

		// mark build failure on esbuild errors
		if (result?.errors?.length) process.exitCode = 1;

		// distribute only if build succeeded
		if (!(result?.errors?.length ?? 0)) {
			distributeBuild();
		} else {
			console.warn("[build] Skipping distribution due to build errors.");
		}

		// Storybook build (optional, --storybook flag)
		if (storybook) {
			await esbuild.build({
				entryPoints: ["stories/storybook-entry.ts"],
				bundle: true,
				outfile: "stories/storybook-bundle.js",
				format: "esm",
				target: "es2020",
				platform: "browser",
				sourcemap: true,
				minify: false,
			});
			console.log("[build] Storybook built → stories/storybook-bundle.js");
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
