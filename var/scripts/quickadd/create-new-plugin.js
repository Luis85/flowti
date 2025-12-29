/**
 * Create Obsidian Plugin Project
 *
 * What this script is for
 * Creates a new Obsidian plugin project from a *local template folder* inside the vault.
 * Designed as a reusable building block you can chain in QuickAdd macros.
 *
 * How to use
 * - Add as "User Script" in a QuickAdd Macro.
 * - Provide inputs via `params.variables` to avoid prompts (recommended for chaining).
 * - This script publishes outputs via `params.variables` for downstream steps.
 *
 * Inputs (variables)
 * - plugin_project_name (string)   Required. Display name / human name.
 * - plugin_description (string)    Optional. If missing and prompt enabled, will ask.
 * - template_folder (string)       Optional. Vault path to the template folder.
 * - template_registry_path (string) Optional. Vault path to JSON registry (array).
 * - template_id (string)           Optional. If registry is used, pick by id (no prompt).
 * - project_root_folder (string)   Optional. Overrides setting root folder.
 *
 * Outputs (variables)
 * - plugin_id
 * - plugin_project_folder
 * - plugin_output_folder
 * - plugin_template_folder_used
 * - plugin_manifest_path
 * - plugin_package_json_path
 *
 * ID: qa.create-obsidian-plugin-project
 * Type: Script
 * Domain: dev
 * Slug: create-obsidian-plugin-project
 *
 * Author: Luis Mendez
 * Generated at: 2025-12-17T00:00:00+01:00
 */

/* global Notice */

const SET_SCRIPT_NAME = "Script name";
const SET_DEBUG = "Debug mode";
const SET_DRY_RUN = "Dry run";

const SET_ROOT_FOLDER = "Root folder";
const SET_TEMPLATES_REGISTRY_PATH = "Templates registry path";
const SET_FALLBACK_TEMPLATE_FOLDER = "Fallback template folder";
const SET_DEFAULT_TEMPLATE_ID = "Default template id";
const SET_ASK_DESCRIPTION = "Ask description on run";

const SET_DEFAULT_AUTHOR = "Default author";
const SET_DEFAULT_AUTHOR_URL = "Default author url";
const SET_DEFAULT_MIN_APP_VERSION = "Default min app version";
const SET_DEFAULT_IS_DESKTOP_ONLY = "Default is desktop only";
const SET_DEFAULT_VERSION = "Default version";
const SET_DEFAULT_LICENSE = "Default license";
const SET_FORCE_ESBUILD_CONFIG = "Force esbuild config";
const SET_OVERWRITE_EXISTING = "Overwrite existing project";

module.exports = {
  entry: async (params, settings) => {
    try {
      const result = await run(params, settings || {});
      new Notice(result?.notice ?? "✅ create-plugin OK");
      return result;
    } catch (err) {
      if (err?.name === "MacroAbortError") return { ok: false, aborted: true };
      console.error(`[plugin] FAILED`, err);
      new Notice(`❌ plugin: ${err?.message ?? String(err)}`);
      throw err;
    }
  },

  settings: {
    name: "Create Obsidian Plugin",
    author: "Luis Mendez",
    options: {
      [SET_SCRIPT_NAME]: { type: "text", defaultValue: "create-obsidian-plugin-project" },
      [SET_DEBUG]: { type: "toggle", defaultValue: false },
      [SET_DRY_RUN]: { type: "toggle", defaultValue: false },

      [SET_ROOT_FOLDER]: { type: "text", defaultValue: "Development" },
      [SET_TEMPLATES_REGISTRY_PATH]: { type: "text", defaultValue: "plugin-templates.json" },
      [SET_FALLBACK_TEMPLATE_FOLDER]: { type: "text", defaultValue: "obsidian-sample-plugin" },
      [SET_DEFAULT_TEMPLATE_ID]: { type: "text", defaultValue: "" },
      [SET_ASK_DESCRIPTION]: { type: "toggle", defaultValue: true },

      [SET_DEFAULT_AUTHOR]: { type: "text", defaultValue: "" },
      [SET_DEFAULT_AUTHOR_URL]: { type: "text", defaultValue: "" },
      [SET_DEFAULT_MIN_APP_VERSION]: { type: "text", defaultValue: "1.5.0" },
      [SET_DEFAULT_IS_DESKTOP_ONLY]: { type: "toggle", defaultValue: false },
      [SET_DEFAULT_VERSION]: { type: "text", defaultValue: "0.0.1" },
      [SET_DEFAULT_LICENSE]: { type: "text", defaultValue: "MIT" },

      [SET_FORCE_ESBUILD_CONFIG]: { type: "toggle", defaultValue: true },
      [SET_OVERWRITE_EXISTING]: { type: "toggle", defaultValue: false },
    },
  },
};

async function run(params, settings) {
  const { quickAddApi, variables, app } = params;

  const scriptName = String(settings?.[SET_SCRIPT_NAME] || "create-obsidian-plugin-project");
  const debug = !!settings?.[SET_DEBUG];
  const dryRun = !!settings?.[SET_DRY_RUN];
  const log = (...a) => debug && console.log(`[${scriptName}]`, ...a);

  if (!quickAddApi) throw new Error("quickAddApi not available. Run this via a QuickAdd Macro.");
  if (!app?.vault?.adapter) throw new Error("Obsidian app/vault adapter not available in params.");

  const now = window.moment();
  const ctx = { date: now.format("YYYY-MM-DD"), datetime: now.toISOString() };

  // ---------- helpers ----------
  const hasOwn = (k) => Object.prototype.hasOwnProperty.call(variables || {}, k);
  const shouldPrompt = (k) => !hasOwn(k) || variables[k] === undefined || variables[k] === null;

  async function requireVarOrPrompt(key, label, defaultValue = "") {
    if (!shouldPrompt(key)) return variables[key];
    const val = await quickAddApi.inputPrompt(label, defaultValue);
    if (val === null) throw macroAbort();
    variables[key] = val;
    return val;
  }

  function publish(outputs) {
    for (const [k, v] of Object.entries(outputs || {})) variables[k] = (v === undefined || v === null) ? "" : v;
  }

  function macroAbort() {
    const e = new Error("User cancelled");
    e.name = "MacroAbortError";
    return e;
  }

  function normPath(p) {
    // Obsidian normalizePath is available via app.vault? Not reliably in this env; keep simple.
    return String(p || "").replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
  }

  function joinPath(a, b) {
    if (!a) return normPath(b);
    if (!b) return normPath(a);
    return normPath(`${String(a).replace(/\/+$/, "")}/${String(b).replace(/^\/+/, "")}`);
  }

  function parentFolder(p) {
    const s = normPath(p);
    const idx = s.lastIndexOf("/");
    if (idx <= 0) return "";
    return s.slice(0, idx);
  }

  async function exists(path) {
    return await app.vault.adapter.exists(normPath(path));
  }

  async function ensureFolder(folderPath) {
    const p = normPath(folderPath);
    if (!p) return;
    if (await exists(p)) return;
    // create parent first
    const parent = parentFolder(p);
    if (parent && !(await exists(parent))) await ensureFolder(parent);
    if (!dryRun) await app.vault.adapter.mkdir(p);
  }

  async function writeText(filePath, content) {
    const p = normPath(filePath);
    const parent = parentFolder(p);
    if (parent) await ensureFolder(parent);
    if (!dryRun) await app.vault.adapter.write(p, String(content ?? ""));
  }

  async function readText(filePath) {
    const p = normPath(filePath);
    return await app.vault.adapter.read(p);
  }

  async function removeFolderRecursive(folderPath) {
    const p = normPath(folderPath);
    if (!p) return;
    if (!(await exists(p))) return;

    const listing = await app.vault.adapter.list(p);
    const files = listing?.files || [];
    const folders = listing?.folders || [];

    for (const f of files) {
      if (!dryRun) await app.vault.adapter.remove(normPath(f));
    }
    for (const d of folders) {
      await removeFolderRecursive(d);
    }
    if (!dryRun) await app.vault.adapter.rmdir(p, true);
  }

  function slugifyId(name) {
    return String(name || "")
      .trim()
      .toLowerCase()
      .replace(/['"]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "my-plugin";
  }

  function toPascal(s) {
    return String(s || "")
      .replace(/[_\- ]+/g, " ")
      .split(" ")
      .filter(Boolean)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join("");
  }

  function renderTemplate(input, map) {
    if (typeof input !== "string") return input;

    let out = input.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) =>
      map[key] != null ? String(map[key]) : ""
    );

    out = out.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\|\s*pascal\s*\}\}/g, (_, key) =>
      toPascal(map[key] != null ? String(map[key]) : "")
    );

    return out;
  }

  function shouldTokenRender(filePath) {
    const p = String(filePath || "").toLowerCase();
    return (
      p.endsWith(".md") ||
      p.endsWith(".json") ||
      p.endsWith(".ts") ||
      p.endsWith(".js") ||
      p.endsWith(".mjs") ||
      p.endsWith(".css") ||
      p.endsWith(".html") ||
      p.endsWith(".txt") ||
      p.endsWith(".yml") ||
      p.endsWith(".yaml")
    );
  }

  async function copyFolderRecursive(srcFolder, destFolder, tokenCtx) {
    const src = normPath(srcFolder);
    const dest = normPath(destFolder);

    const listing = await app.vault.adapter.list(src);
    const files = listing?.files || [];
    const folders = listing?.folders || [];

    for (const folder of folders) {
      const rel = normPath(folder).slice(src.length).replace(/^\/+/, "");
      const target = joinPath(dest, rel);
      await ensureFolder(target);
      await copyFolderRecursive(folder, target, tokenCtx);
    }

    for (const file of files) {
      const rel = normPath(file).slice(src.length).replace(/^\/+/, "");
      const target = joinPath(dest, rel);

      const raw = await app.vault.adapter.read(normPath(file));
      const rendered = shouldTokenRender(file) ? renderTemplate(raw, tokenCtx) : raw;

      await writeText(target, rendered);
    }
  }

	async function loadRegistry(registryPath) {
	  let p = normPath(registryPath);
	  if (!p) return [];
	
	  // Allow registryPath to be a folder OR a file.
	  // If it's a folder, try common registry filenames inside.
	  if (await exists(p)) {
	    const looksLikeJson = p.toLowerCase().endsWith(".json");
	    if (!looksLikeJson) {
	      const candidates = [
	        joinPath(p, "plugin-template.json"),
	        joinPath(p, "plugin-templates.json"),
	      ];
	      let found = "";
	      for (const c of candidates) {
	        if (await exists(c)) { found = c; break; }
	      }
	      if (!found) return [];
	      p = found;
	    }
	  } else {
	    return [];
	  }
	
	  try {
	    const raw = await readText(p);
	    const json = JSON.parse(raw);
	    if (!Array.isArray(json)) return [];
	
	    // Registry base dir is used to resolve relative sources
	    const baseDir = parentFolder(p);
	
	    return json
	      .map((t) => ({
	        id: String(t.id || "").trim(),
	        label: String(t.label || t.id || "").trim(),
	        source: resolveRelativePath(String(t.source || "").trim(), baseDir),
	        type: String(t.type || "local_folder").trim(),
	      }))
	      .filter((t) => t.id && t.source && t.type === "local_folder");
	  } catch (e) {
	    log("Registry parse failed", e);
	    return [];
	  }
	}


	async function pickTemplateFolder() {
	  // Direct override always wins
	  const direct = String(variables?.template_folder || "").trim();
	  if (direct) {
	    const fixed = await resolveTemplateRoot(direct, "");
	    return { label: fixed, source: fixed };
	  }
	
	  const registryPath = String(
	    variables?.template_registry_path || settings?.[SET_TEMPLATES_REGISTRY_PATH] || ""
	  ).trim();
	
	  const registry = await loadRegistry(registryPath);
	
	  const templateId = String(
	    variables?.template_id || settings?.[SET_DEFAULT_TEMPLATE_ID] || ""
	  ).trim();
	
	  // If template_id is provided, pick without prompting
	  if (templateId && registry.length) {
	    const found = registry.find((t) => t.id === templateId);
	    if (!found) throw new Error(`Template id not found in registry: ${templateId}`);
	
	    const fixed = await resolveTemplateRoot(found.source, templateId);
	    return { label: found.label || found.id, source: fixed };
	  }
	
	  // Otherwise prompt if registry exists
	  if (registry.length) {
	    const options = [
	      ...registry.map((t) => ({ label: t.label || t.id, source: t.source, id: t.id })),
	      { label: "Manual: Enter template folder path…", source: "__manual__", id: "" },
	    ];
	
	    const labels = options.map((o) => o.label);
	    const chosen = await quickAddApi.suggester(labels, options);
	    if (!chosen) throw macroAbort();
	
	    if (chosen.source === "__manual__") {
	      const manual = await quickAddApi.inputPrompt(
	        "Template folder (vault path):",
	        String(settings?.[SET_FALLBACK_TEMPLATE_FOLDER] || "")
	      );
	      if (manual === null) throw macroAbort();
	
	      const fixed = await resolveTemplateRoot(manual, "");
	      return { label: `Manual: ${fixed}`, source: fixed };
	    }
	
	    const fixed = await resolveTemplateRoot(chosen.source, chosen.id || "");
	    return { label: chosen.label, source: fixed };
	  }
	
	  // No registry -> fallback
	  const fallback = String(settings?.[SET_FALLBACK_TEMPLATE_FOLDER] || "").trim();
	  if (fallback) {
	    const fixed = await resolveTemplateRoot(fallback, "");
	    return { label: fixed, source: fixed };
	  }
	
	  const manual = await quickAddApi.inputPrompt("Template folder (vault path):", "");
	  if (manual === null) throw macroAbort();
	  const fixed = await resolveTemplateRoot(manual, "");
	  return { label: `Manual: ${fixed}`, source: fixed };
	}
	
	function resolveRelativePath(p, baseDir) {
  const s = String(p || "").trim();
  if (!s) return "";
  if (s.includes("://")) return s; // not expected here but safe
  if (s.startsWith("/")) return normPath(s);
  if (!baseDir) return normPath(s);
  return normPath(joinPath(baseDir, s));
}

async function isTemplateRoot(folderPath) {
  const p = normPath(folderPath);
  if (!(await exists(p))) return false;

  // Heuristic: if it contains typical plugin root files, treat as root
  const markers = ["manifest.json", "package.json", "main.ts", "esbuild.config.mjs", "tsconfig.json"];
  for (const m of markers) {
    if (await exists(joinPath(p, m))) return true;
  }
  return false;
}
	
	/**
	 * Ensures we copy *contents* of the actual template root into the project folder.
	 * If user selected a container folder, this tries to find a better root:
	 * - container/<templateId> if exists and looks like a template root
	 * - single child folder that looks like template root
	 */
	async function resolveTemplateRoot(inputPath, templateId) {
	  let p = normPath(inputPath);
	  if (!p) throw new Error("Template folder not set.");
	  if (!(await exists(p))) throw new Error(`Template folder not found: ${p}`);
	
	  // If it's already a valid template root, use it
	  if (await isTemplateRoot(p)) return p;
	
	  // Try container/<templateId>
	  if (templateId) {
	    const candidate = joinPath(p, templateId);
	    if ((await exists(candidate)) && (await isTemplateRoot(candidate))) return candidate;
	  }
	
	  // Try: if container has exactly one subfolder and that looks like template root -> use it
	  const listing = await app.vault.adapter.list(p);
	  const folders = (listing?.folders || []).map((f) => normPath(f));
	
	  const rootCandidates = [];
	  for (const f of folders) {
	    if (await isTemplateRoot(f)) rootCandidates.push(f);
	  }
	
	  if (rootCandidates.length === 1) return rootCandidates[0];
	
	  // Last resort: keep original (will copy container contents)
	  // But tell the user what happened
	  log("Template root unresolved; using folder as-is", { inputPath: p, templateId, rootCandidates });
	  return p;
	}



  function knownGoodEsbuildConfig() {
    return `import esbuild from "esbuild";
import { builtinModules } from "module";
import fs from "fs";
import path from "path";

const PLUGIN_ID = "{{plugin_id}}";
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
`;
  }

  async function ensureManifest(projectFolder, tokenCtx) {
    const p = joinPath(projectFolder, "manifest.json");
    if (await exists(p)) return;
    const content = `{
  "id": "{{plugin_id}}",
  "name": "{{plugin_name}}",
  "version": "{{version}}",
  "minAppVersion": "{{min_app_version}}",
  "description": "{{description}}",
  "author": "{{author}}",
  "authorUrl": "{{author_url}}",
  "isDesktopOnly": {{is_desktop_only}}
}
`;
    await writeText(p, renderTemplate(content, tokenCtx));
  }

  async function ensurePackageJson(projectFolder, tokenCtx) {
    const p = joinPath(projectFolder, "package.json");
    if (await exists(p)) return;
    const content = `{
  "name": "{{plugin_id}}",
  "version": "{{version}}",
  "description": "{{description}}",
  "main": "main.js",
  "scripts": {
    "dev": "node esbuild.config.mjs --watch",
    "build": "node esbuild.config.mjs"
  },
  "keywords": ["obsidian", "plugin"],
  "author": "{{author}}",
  "license": "{{license}}"
}
`;
    await writeText(p, renderTemplate(content, tokenCtx));
  }

  // ---------- start ----------
  log("START", { dryRun, ctx });

  const overwriteExisting = !!settings?.[SET_OVERWRITE_EXISTING];

  const projectName = String(await requireVarOrPrompt("plugin_project_name", "New plugin project name:")).trim();
  if (!projectName) throw new Error("plugin_project_name is required.");

  // Description can come from variables (preferred) or prompt (optional) or default empty
  let description = String(variables?.plugin_description ?? "").trim();
  if (!description) {
    const askDesc = !!settings?.[SET_ASK_DESCRIPTION];
    if (askDesc) {
      const val = await quickAddApi.inputPrompt("Short description:", "");
      if (val === null) throw macroAbort();
      description = String(val || "").trim();
      variables.plugin_description = description;
    }
  }

  const pluginId = slugifyId(projectName);

  // root folder: variable override -> setting -> vault root
  const rootFolder = String(variables?.project_root_folder ?? settings?.[SET_ROOT_FOLDER] ?? "").trim();
  const projectFolder = normPath(joinPath(rootFolder, pluginId));

  const template = await pickTemplateFolder();
  const templateFolder = normPath(template?.source || "");

  if (!templateFolder) throw new Error("Template folder not resolved.");
  if (!(await exists(templateFolder))) throw new Error(`Template folder not found: ${templateFolder}`);

  // Handle existing project folder
  if (await exists(projectFolder)) {
    if (!overwriteExisting) throw new Error(`Target folder exists: ${projectFolder} (enable overwrite in settings)`);
    await removeFolderRecursive(projectFolder);
  }

  await ensureFolder(projectFolder);

  const tokenCtx = {
    plugin_id: pluginId,
    plugin_name: projectName,
    description: description || "",
    author: String(settings?.[SET_DEFAULT_AUTHOR] || "").trim(),
    author_url: String(settings?.[SET_DEFAULT_AUTHOR_URL] || "").trim(),
    min_app_version: String(settings?.[SET_DEFAULT_MIN_APP_VERSION] || "1.5.0").trim(),
    is_desktop_only: !!settings?.[SET_DEFAULT_IS_DESKTOP_ONLY],
    version: String(settings?.[SET_DEFAULT_VERSION] || "0.0.1").trim(),
    license: String(settings?.[SET_DEFAULT_LICENSE] || "MIT").trim(),
    created_at: ctx.datetime,
    year: String(new Date().getFullYear()),
  };

  log("Copying template", { templateFolder, projectFolder });
  await copyFolderRecursive(templateFolder, projectFolder, tokenCtx);

  // Optional: Force known esbuild config
  if (!!settings?.[SET_FORCE_ESBUILD_CONFIG]) {
    const esbuildPath = joinPath(projectFolder, "esbuild.config.mjs");
    await writeText(esbuildPath, renderTemplate(knownGoodEsbuildConfig(), tokenCtx));
  }

  // Ensure essential files exist if template didn't have them
  await ensureManifest(projectFolder, tokenCtx);
  await ensurePackageJson(projectFolder, tokenCtx);

  // Ensure output folder exists
  const pluginOutputFolder = normPath(joinPath(".obsidian/plugins", pluginId));
  await ensureFolder(pluginOutputFolder);

  // Publish for downstream steps
  publish({
    plugin_id: pluginId,
    plugin_project_folder: projectFolder,
    plugin_output_folder: pluginOutputFolder,
    plugin_template_folder_used: templateFolder,
    plugin_manifest_path: joinPath(projectFolder, "manifest.json"),
    plugin_package_json_path: joinPath(projectFolder, "package.json"),

    last_item_id: "create-plugin",
    last_item_ran_at: ctx.datetime,
  });

  log("END", { ok: true, pluginId, projectFolder });

  return {
    ok: true,
    ctx,
    notice: `✅ Plugin project created: ${projectFolder}`,
  };
}
