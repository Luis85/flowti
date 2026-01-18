import esbuild from "esbuild";
import { builtinModules } from "module";
import fs from "fs";
import path from "path";

// Read plugin metadata from manifest.json
const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf-8"));
const PLUGIN_ID = manifest.id;
const OUTDIR = path.resolve(process.cwd(), "..", "..", ".obsidian", "plugins", PLUGIN_ID);
const isWatch = process.argv.includes("--watch");
const prod = !isWatch;

const copyFile = (src, dest) => {
	fs.mkdirSync(path.dirname(dest), { recursive: true });
	fs.copyFileSync(src, dest);
};

const ensureOutdir = () => fs.mkdirSync(OUTDIR, { recursive: true });

/**
 * Copies CSS from src/styles/main.css to styles.css
 * We use custom CSS utilities instead of Tailwind's build process
 * to avoid conflicts with Obsidian's styles.
 */
const buildCSS = () => {
	const inputPath = path.resolve("src/styles/main.css");
	const outputPath = path.resolve("styles.css");

	if (!fs.existsSync(inputPath)) {
		console.warn("No src/styles/main.css found, skipping CSS build");
		return;
	}

	fs.copyFileSync(inputPath, outputPath);
	console.log("CSS copied: styles.css");
};

const syncAssets = () => {
	if (fs.existsSync(path.resolve("manifest.json"))) {
		copyFile(path.resolve("manifest.json"), path.join(OUTDIR, "manifest.json"));
	}
	if (fs.existsSync(path.resolve(".hotreload"))) {
		copyFile(path.resolve(".hotreload"), path.join(OUTDIR, ".hotreload"));
	}
	if (fs.existsSync(path.resolve("LICENSE"))) {
		copyFile(path.resolve("LICENSE"), path.join(OUTDIR, "LICENSE"));
	}
	// copy compiled styles.css
	if (fs.existsSync(path.resolve("styles.css"))) {
		copyFile(path.resolve("styles.css"), path.join(OUTDIR, "styles.css"));
	}
};

// include node: prefixed builtins too
const nodeBuiltins = builtinModules.flatMap((m) => [m, `node:${m}`]);

const run = async () => {
	ensureOutdir();

	// Build CSS first
	buildCSS();

	const ctx = await esbuild.context({
		entryPoints: ["src/main.ts"],
		bundle: true,
		outdir: OUTDIR,
		entryNames: "[name]",
		format: "cjs",
		target: "node16",
		platform: "node",
		sourcemap: prod ? false : "inline",
		external: [
			"obsidian",
			"electron",
			...nodeBuiltins,
		],
		logLevel: "info",
		treeShaking: true,
		minify: prod,
	});

	syncAssets();

	if (isWatch) {
		await ctx.watch();
		console.log("Watching... ", OUTDIR);
	} else {
		await ctx.rebuild();
		await ctx.dispose();
		console.log("Build done... ", OUTDIR);
	}
};

run().catch((e) => {
	console.error(e);
	process.exit(1);
});
