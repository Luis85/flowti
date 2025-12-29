import esbuild from "esbuild";
import { builtinModules } from "module";
import fs from "fs";
import path from "path";

const PLUGIN_ID = "singleseater";
const OUTDIR = path.resolve(process.cwd(), "..", "..", ".obsidian", "plugins", PLUGIN_ID);
const isWatch = process.argv.includes("--watch");

const copyFile = (src, dest) => {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
};

const ensureOutdir = () => fs.mkdirSync(OUTDIR, { recursive: true });

const syncAssets = () => {
  if (fs.existsSync(path.resolve("manifest.json"))) {
    copyFile(path.resolve("manifest.json"), path.join(OUTDIR, "manifest.json"));
  }
  if (fs.existsSync(path.resolve("styles.css"))) {
    copyFile(path.resolve("styles.css"), path.join(OUTDIR, "styles.css"));
  }
};

const run = async () => {
  ensureOutdir();

  const ctx = await esbuild.context({
    entryPoints: ["main.ts"],
    bundle: true,
    outfile: path.join(OUTDIR, "main.js"),
    format: "cjs",
    target: "es2018",
    platform: "browser",
    sourcemap: "inline",
    external: ["obsidian", "electron", ...builtinModules],
    logLevel: "info"
  });

  if (isWatch) {
    await ctx.watch();
    syncAssets();
    console.log("Watching... Output:", OUTDIR);
  } else {
    await ctx.rebuild();
    syncAssets();
    await ctx.dispose();
    console.log("Build done. Output:", OUTDIR);
  }
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
