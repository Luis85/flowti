import esbuild from "esbuild";
import { builtinModules } from "node:module";
import fs from "node:fs";
import path from "node:path";

const isWatch = process.argv.includes("--watch");
const prod = !isWatch;

const OUTDIR = path.resolve(process.cwd(), "..", "..", ".obsidian", "plugins", "my-test-app");

const concatCSS = () => {
	const cssDir = path.resolve(import.meta.dirname, "css");
	if (!fs.existsSync(cssDir)) return;
	const files = fs.readdirSync(cssDir).filter((f) => f.endsWith(".css")).sort();
	if (!files.length) return;
	const header = "/* Auto-generated from css/ — do not edit directly */\n\n";
	const parts = files.map((f) => fs.readFileSync(path.join(cssDir, f), "utf-8"));
	fs.writeFileSync(path.resolve(import.meta.dirname, "styles.css"), header + parts.join("\n"), "utf-8");
};

const syncAssets = () => {
	concatCSS();
	for (const file of ["manifest.json", "styles.css"]) {
		const src = path.resolve(import.meta.dirname, file);
		if (fs.existsSync(src)) {
			fs.mkdirSync(OUTDIR, { recursive: true });
			fs.copyFileSync(src, path.join(OUTDIR, file));
		}
	}
};

const run = async () => {
	fs.mkdirSync(OUTDIR, { recursive: true });

	const ctx = await esbuild.context({
		entryPoints: ["src/main.ts"],
		bundle: true,
		outdir: OUTDIR,
		format: "cjs",
		target: "node16",
		platform: "node",
		sourcemap: prod ? false : "inline",
		external: ["obsidian", "electron", ...builtinModules.flatMap((m) => [m, `node:${m}`])],
		treeShaking: true,
		minify: prod,
		logLevel: "info",
	});

	syncAssets();

	if (isWatch) {
		await ctx.watch();
		console.log("[build] Watching...", OUTDIR);
		return;
	}

	await ctx.rebuild();
	await ctx.dispose();
	console.log("[build] Done.", OUTDIR);
};

run().catch((err) => { console.error(err); process.exit(1); });
