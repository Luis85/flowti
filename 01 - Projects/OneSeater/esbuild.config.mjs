import esbuild from "esbuild";
import { builtinModules } from "module";
import fs from "fs";
import path from "path";

const PLUGIN_ID = "oneseater";
const OUTDIR = path.resolve(
	process.cwd(),
	"..",
	"..",
	".obsidian",
	"plugins",
	PLUGIN_ID
);
const isWatch = process.argv.includes("--watch");
const prod = !isWatch;

const copyFile = (src, dest) => {
	fs.mkdirSync(path.dirname(dest), { recursive: true });
	fs.copyFileSync(src, dest);
};

const ensureOutdir = () => fs.mkdirSync(OUTDIR, { recursive: true });

const syncAssets = () => {
	if (fs.existsSync(path.resolve("manifest.json"))) {
		copyFile(
			path.resolve("manifest.json"),
			path.join(OUTDIR, "manifest.json")
		);
	}
	if (fs.existsSync(path.resolve(".hotreload"))) {
		copyFile(path.resolve(".hotreload"), path.join(OUTDIR, ".hotreload"));
	}
	if (fs.existsSync(path.resolve("LICENSE"))) {
		copyFile(path.resolve("LICENSE"), path.join(OUTDIR, "LICENSE"));
	}
};

const run = async () => {
	ensureOutdir();

	const ctx = await esbuild.context({
		entryPoints: ["main.ts", "styles.css"],
		bundle: true,
		outdir: OUTDIR,
		entryNames: "[name]",
		format: "cjs",
		target: "es2018",
		platform: "browser",
		sourcemap: prod ? false : "inline",
		external: ["obsidian", "electron", ...builtinModules],
		logLevel: "info",
		treeShaking: true,
		minify: prod,
	});

	if (isWatch) {
		await ctx.watch();
		syncAssets();
		console.log("Watching... ", OUTDIR);
	} else {
		await ctx.rebuild();
		syncAssets();
		await ctx.dispose();
		console.log("Build done... ", OUTDIR);
	}
};

run().catch((e) => {
	console.error(e);
	process.exit(1);
});
