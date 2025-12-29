/**
 * QuickAdd Domain Pack Generator (Batch, Typed) — Clean Flat v3
 *
 * What it does
 * Generates typed building blocks for an event-driven architecture in Obsidian:
 * - script     (generic utility)
 * - event      (fact: something happened)
 * - command    (intent: change state)
 * - query      (read-only computation/retrieval)
 * - apiquery   (read-only external API retrieval)
 * - notifier   (emit notifications / triggers)
 * - policy     (guards/rules: allow/deny decisions)
 * - validator  (validate inputs/payloads)
 *
 * Output rules
 * - Parent folder is ALWAYS requested (every run).
 * - Folder names begin with uppercase and may contain spaces.
 *
 * Multi-item folder structure:
 *   $out/$Parent/$Domain/$TypeFolder/
 *     - <slug>.js
 *     - <slug>.canvas (optional, copied from template)
 *     - README.md     (per type folder; contains table of generated items + contract)
 *
 * Single-item folder structure (exactly 1 item):
 *   $out/$Parent/
 *     - <slug>.js
 *     - README.md (single item)
 *     - <slug>.canvas (optional)
 *
 * Inputs (params.variables.items)
 * - JSON array of objects (recommended)
 * - JSON array of strings
 * - Multiline / CSV strings
 *
 * String format supported:
 *   "<type>:<domain>:<name>"
 *   e.g. "command:system:Move File"
 *
 * Chaining/Data Flow
 * Use params.variables for chaining.
 * - unset / undefined / null => prompts (when used via {{VALUE:key}})
 * - "" (empty string)        => will NOT prompt
 */

// -----------------------------
// Settings keys
// -----------------------------
const SET_OUTPUT_FOLDER = "Output packs folder";
const SET_TEMPLATES_FOLDER = "Skeleton templates folder";

const SET_DEFAULT_TEMPLATE = "Default skeleton template (fallback)";
const SET_DEFAULT_AUTHOR = "Default author";
const SET_FILENAME_FORMAT = "Generated script filename format";

const SET_OPEN_AFTER = "Open first generated script";
const SET_OVERWRITE = "Overwrite existing files";
const SET_DEBUG = "Debug mode";

// Canvas
const SET_CANVAS_TEMPLATE_PATH = "Canvas template path (optional)";
const SET_CANVAS_FILENAME_FORMAT = "Generated canvas filename format";

// Per-type template defaults
const SET_TEMPLATE_SCRIPT = "Default template for Script";
const SET_TEMPLATE_EVENT = "Default template for Event";
const SET_TEMPLATE_COMMAND = "Default template for Command";
const SET_TEMPLATE_QUERY = "Default template for Query";
const SET_TEMPLATE_APIQUERY = "Default template for ApiQuery";
const SET_TEMPLATE_NOTIFIER = "Default template for Notifier";
const SET_TEMPLATE_POLICY = "Default template for Policy";
const SET_TEMPLATE_VALIDATOR = "Default template for Validator";

module.exports = {
  entry: async (params, settings) => {
    try {
      const result = await run(params, settings || {});
      new Notice(result?.notice ?? "✅ OK");
      return result;
    } catch (err) {
      if (err?.name === "MacroAbortError") return { ok: false, aborted: true };
      console.error("[QADomainPackGenerator] FAILED", err);
      new Notice(`❌ Pack generation failed: ${err?.message ?? String(err)}`);
      return { ok: false, error: String(err?.message ?? err) };
    }
  },

  settings: {
    name: "QuickAdd Domain Pack Generator (Clean Flat)",
    author: "Luis Mendez",
    options: {
      [SET_DEFAULT_AUTHOR]: { type: "text", defaultValue: "Luis Mendez" },

      [SET_OUTPUT_FOLDER]: {
        type: "text",
        defaultValue: "Generated",
        description: "Root folder for generated items.",
      },

      [SET_FILENAME_FORMAT]: {
        type: "text",
        defaultValue: "{{slug}}.js",
        description: "Filename format. Tokens: {{slug}}, {{name}}",
      },

      [SET_TEMPLATES_FOLDER]: {
        type: "text",
        defaultValue: "var/scripts/templates",
        description: "Folder containing templates (*.template.*).",
      },

      [SET_DEFAULT_TEMPLATE]: {
        type: "text",
        defaultValue: "script.template.txt",
        description: "Fallback template used if no type template applies.",
      },

      // Type templates
      [SET_TEMPLATE_SCRIPT]: { type: "text", defaultValue: "script.template.txt" },
      [SET_TEMPLATE_EVENT]: { type: "text", defaultValue: "event.template.txt" },
      [SET_TEMPLATE_COMMAND]: { type: "text", defaultValue: "command.template.txt" },
      [SET_TEMPLATE_QUERY]: { type: "text", defaultValue: "query.template.txt" },
      [SET_TEMPLATE_APIQUERY]: { type: "text", defaultValue: "apiquery.template.txt" },
      [SET_TEMPLATE_NOTIFIER]: { type: "text", defaultValue: "notifier.template.txt" },
      [SET_TEMPLATE_POLICY]: { type: "text", defaultValue: "policy.template.txt" },
      [SET_TEMPLATE_VALIDATOR]: { type: "text", defaultValue: "validator.template.txt" },

      // Canvas
      [SET_CANVAS_TEMPLATE_PATH]: {
        type: "text",
        defaultValue: "",
        description: "Optional: vault path to a .canvas template to copy.",
      },
      [SET_CANVAS_FILENAME_FORMAT]: {
        type: "text",
        defaultValue: "{{slug}}.canvas",
        description: "Canvas filename. Tokens: {{slug}}, {{name}}",
      },

      [SET_OPEN_AFTER]: { type: "toggle", defaultValue: true },
      [SET_OVERWRITE]: { type: "toggle", defaultValue: false },
      [SET_DEBUG]: { type: "toggle", defaultValue: false },
    },
  },
};

// =============================
// Main
// =============================
async function run(params, settings) {
  const cfg = buildRuntimeConfig(params, settings);
  const { app, qa, variables } = cfg;

  if (!cfg.settingsRaw.outFolder) throw new Error(`"${SET_OUTPUT_FOLDER}" is not configured.`);
  if (!cfg.settingsRaw.templatesFolder) throw new Error(`"${SET_TEMPLATES_FOLDER}" is not configured.`);
  if (!qa) throw new Error("quickAddApi not available. Run via QuickAdd Macro.");

  // Discover templates
  cfg.resolved.templates = listTemplateFiles(app, cfg.settingsRaw.templatesFolder);
  if (!cfg.resolved.templates.length) throw new Error(`No templates found in: ${cfg.settingsRaw.templatesFolder}`);

  cfg.resolved.defaultTemplate =
    pickTemplateByNameOrLabel(cfg, cfg.settingsRaw.defaultTemplateName) || cfg.resolved.templates[0];

  // Resolve items payload
  const payload = await resolveItemsPayload(cfg);
  const items = normalizeItems(payload);
  if (!items.length) throw new Error("No items provided. Set variables.items or enter them in the prompt.");
  cfg.resolved.items = items;

  // Resolve author
  cfg.resolved.author = await resolveAuthor(cfg);

  // Parent folder (ALWAYS prompt)
  cfg.resolved.parentFolder = await promptParentFolder(cfg);

  // Canvas skip (global)
  cfg.resolved.canvasPathFromVars = str(cfg.util.pick(cfg.varsRaw.canvas_path, null, ""));
  cfg.resolved.shouldSkipCanvas = !!cfg.resolved.canvasPathFromVars;

  await ensureFolder(app, cfg.settingsRaw.outFolder);

  const results = [];
  const isSingle = cfg.resolved.items.length === 1;

  for (const item of cfg.resolved.items) {
    results.push(await generateOneItem(cfg, item, { isSingle }));
  }

  if (cfg.settingsRaw.openAfter && results.length) {
    const af = app.vault.getAbstractFileByPath(results[0].scriptPath);
    if (af) await app.workspace.getLeaf(true).openFile(af);
  }

  // Publish outputs
  variables.generated_items_json = JSON.stringify(results, null, 2);
  variables.generated_first_id = results[0]?.id ?? "";
  variables.generated_first_script_path = results[0]?.scriptPath ?? "";
  variables.generated_first_readme_path = results[0]?.readmePath ?? "";
  variables.generated_first_output_root = results[0]?.outputRoot ?? "";
  variables.generated_first_canvas_path = results[0]?.canvasPath ?? "";

  const notice = [
    `✅ Generated ${results.length} item(s)`,
    `• Output root: ${cfg.settingsRaw.outFolder}`,
    `• Parent: ${cfg.resolved.parentFolder}`,
    `• Author: ${cfg.resolved.author}`,
    `• Mode: ${isSingle ? "single (no domain/type folders)" : "multi (domain/type folders + README per type)"}`,
  ].join("\n");

  new Notice(notice);
  return { ok: true, notice, count: results.length, results };
}

/* ==============================
   Parent folder prompt
   ============================== */

async function promptParentFolder(cfg) {
  const { qa } = cfg;

  const resp = await qa.requestInputs([
    {
      id: "parent_folder",
      label: "Parent folder",
      type: "text",
      placeholder: "e.g. Project Alpha",
      defaultValue: "",
      description: "This folder will be created inside your output packs folder. Folder name starts with uppercase and may contain spaces.",
    },
  ]);

  const raw = str(resp?.parent_folder || "");
  if (!raw) throw new Error("Parent folder is required.");

  return normalizeFolderName(raw);
}

/* ==============================
   Per-item generation
   ============================== */

async function generateOneItem(cfg, item, { isSingle }) {
  const { app } = cfg;

  const type = normalizeType(item.type);
  const domainRaw = str(item.domain || "System");
  const domain = normalizeFolderName(domainRaw); // folder-friendly display (uppercase + spaces)
  const domainKey = str(item.domain || "system").toLowerCase(); // stable id key

  // Name model: name OR verb+noun
  const name = str(item.name || "").trim();
  const verb = str(item.verb || "");
  const noun = str(item.noun || "");
  const description = str(item.description || "");

  const displayName = name ? name : `${verb} ${noun}`.replace(/\s+/g, " ").trim();
  if (!displayName) throw new Error(`Item missing name (type=${type}, domain=${domainKey}).`);

  const slug = slugify(displayName);

  const id = `${domainKey}:${type}:${slug}`;

  const inputs = normalizeStringList(item.inputs);
  const outputs = normalizeStringList(item.outputs);

  // Template selection
  const template = pickTemplateForItem(cfg, type, item.template_name);
  const templateContent = await mustReadFile(app, template.path);

  // Output root: outFolder/Parent
  const outputRoot = joinPath(cfg.settingsRaw.outFolder, cfg.resolved.parentFolder);
  await ensureFolder(app, outputRoot);

  // Determine target folder
  const typeFolderLabel = typeToFolderLabel(type);

  const targetFolder = isSingle
    ? outputRoot
    : joinPath(joinPath(outputRoot, domain), typeFolderLabel);

  await ensureFolder(app, targetFolder);

  // Script path (always directly inside target folder)
  const jsFileName = applyFormat(cfg.settingsRaw.filenameFormat, { slug, name: displayName });
  const scriptPath = joinPath(targetFolder, ensureExt(jsFileName, ".js"));

  const renderedScript = replaceTokens(templateContent, {
    // Base
    SCRIPT_NAME: displayName,
    SCRIPT_SLUG: slug,
    SCRIPT_AUTHOR: cfg.resolved.author,
    SCRIPT_DESCRIPTION: description || `${type.toUpperCase()}: ${displayName}`,
    GENERATED_AT: new Date().toISOString(),
    TEMPLATE_NAME: template.name,
    TEMPLATE_PATH: template.path,

    // Item
    ITEM_ID: id,
    ITEM_TYPE: type,
    ITEM_DOMAIN: domainKey,
    ITEM_NAME: displayName,
    ITEM_SLUG: slug,
    ITEM_DESCRIPTION: description,

    // Optional lists
    ITEM_INPUTS_CSV: inputs.join(","),
    ITEM_OUTPUTS_CSV: outputs.join(","),
    ITEM_INPUTS_JSON: JSON.stringify(inputs),
    ITEM_OUTPUTS_JSON: JSON.stringify(outputs),
  });

  const scriptWritten = await writeFileSafe(app, scriptPath, renderedScript, { overwrite: cfg.settingsRaw.overwrite });

  // Canvas (kept)
  let canvasPath = "";
  if (cfg.resolved.shouldSkipCanvas) {
    canvasPath = cfg.resolved.canvasPathFromVars;
  } else if (cfg.settingsRaw.canvasTemplatePath) {
    const tplAf = app.vault.getAbstractFileByPath(cfg.settingsRaw.canvasTemplatePath);
    if (tplAf && "extension" in tplAf) {
      const canvasFileName = applyFormat(cfg.settingsRaw.canvasFilenameFormat, { slug, name: displayName });
      canvasPath = joinPath(targetFolder, ensureExt(canvasFileName, ".canvas"));
      const canvasContent = await app.vault.read(tplAf);
      await writeFileSafe(app, canvasPath, canvasContent, { overwrite: cfg.settingsRaw.overwrite });
    }
  }

  // README behavior
  let readmePath = "";

  if (isSingle) {
    // Single item: README.md lives in Parent folder, per-item content
    readmePath = joinPath(outputRoot, "README.md");
    const readmeContent = buildSingleReadme({
      id,
      type,
      domain: domainKey,
      domainDisplay: domain,
      name: displayName,
      description,
      author: cfg.resolved.author,
      scriptPath: fileNameFromPath(scriptPath),
      canvasPath: canvasPath ? fileNameFromPath(canvasPath) : "",
      templateLabel: template.label,
      templatePath: template.path,
      generatedAt: new Date().toISOString(),
      inputs,
      outputs,
      parentFolder: cfg.resolved.parentFolder,
      outputRoot,
    });

    await writeFileSafe(app, readmePath, readmeContent, { overwrite: true }); // single mode: always keep README aligned
  } else {
    // Multi: README per type folder + one row per item
    readmePath = joinPath(targetFolder, "README.md");
    await upsertTypeReadme(app, readmePath, {
      domain,
      domainKey,
      type,
      typeFolderLabel,
      author: cfg.resolved.author,
      generatedAt: new Date().toISOString(),
    });

    await appendTypeReadmeRow(app, readmePath, {
      id,
      name: displayName,
      description,
      scriptFile: fileNameFromPath(scriptPath),
      canvasFile: canvasPath ? fileNameFromPath(canvasPath) : "",
      templateLabel: template.label,
      inputs,
      outputs,
    });
  }

  return {
    id,
    type,
    domain: domainKey,
    domainFolder: domain,
    name: displayName,
    slug,
    outputRoot,
    targetFolder,
    scriptPath,
    readmePath,
    canvasPath: canvasPath || "",
    contract: { inputs, outputs },
    written: { scriptWritten },
  };
}

/* ==============================
   README: single item
   ============================== */

function buildSingleReadme(ctx) {
  const lines = [];
  lines.push(`# ${ctx.name}`);
  lines.push("");
  lines.push(`> Generated: \`${ctx.generatedAt}\``);
  lines.push("");
  lines.push("## Location");
  lines.push(`- Output root: \`${ctx.outputRoot}\``);
  lines.push(`- Parent folder: \`${ctx.parentFolder}\``);
  lines.push("");
  lines.push("## What this is");
  lines.push(ctx.description || `This ${ctx.type} implements **${ctx.name}** in the **${ctx.domain}** domain.`);
  lines.push("");
  lines.push("## Files");
  lines.push(`- Script: [[${ctx.scriptPath}]]`);
  if (ctx.canvasPath) lines.push(`- Canvas: [[${ctx.canvasPath}]]`);
  lines.push("");
  lines.push("## How to use");
  lines.push("1. Add the script as a **User Script** step in a QuickAdd Macro.");
  lines.push("2. Provide inputs via `params.variables` to avoid prompts.");
  lines.push("3. Read outputs from `params.variables` in later steps.");
  lines.push("");
  lines.push("## Contract");
  lines.push("### Inputs (params.variables)");
  if (ctx.inputs?.length) ctx.inputs.forEach((k) => lines.push(`- \`${k}\``));
  else lines.push("_(Define expected inputs here.)_");
  lines.push("");
  lines.push("### Outputs (params.variables)");
  if (ctx.outputs?.length) ctx.outputs.forEach((k) => lines.push(`- \`${k}\``));
  else lines.push("_(Define produced outputs here.)_");
  lines.push("");
  lines.push("### Prompt rules");
  lines.push("- Unset / `undefined` / `null` => QuickAdd will prompt when used via `{{VALUE:key}}`");
  lines.push('- `""` (empty string) => QuickAdd will NOT prompt');
  lines.push("");
  lines.push("## Template");
  lines.push(`- Skeleton: **${ctx.templateLabel}**`);
  lines.push(`- Source: \`${ctx.templatePath}\``);
  lines.push("");
  return lines.join("\n");
}

/* ==============================
   README: per type folder (multi)
   ============================== */

async function upsertTypeReadme(app, readmePath, meta) {
  const existing = app.vault.getAbstractFileByPath(readmePath);
  if (existing) return;

  const title = `${meta.domain} — ${meta.typeFolderLabel}`;
  const lines = [];
  lines.push(`# ${title}`);
  lines.push("");
  lines.push(`> Domain: \`${meta.domainKey}\`  •  Type: \`${meta.type}\`  •  Folder: \`${meta.typeFolderLabel}\``);
  lines.push("");
  lines.push("## What this is");
  lines.push(
    `This folder contains **${meta.type}** building blocks for the **${meta.domain}** domain. ` +
      "Each entry is a generated QuickAdd User Script (plus optional canvas)."
  );
  lines.push("");
  lines.push("## How to use");
  lines.push("1. Add a generated script as a **User Script** step in a QuickAdd Macro.");
  lines.push("2. Provide inputs via `params.variables` to avoid prompts.");
  lines.push("3. Read outputs from `params.variables` in later steps.");
  lines.push("");
  lines.push("## Items");
  lines.push("");
  lines.push("| ID | Name | Description | Script | Canvas | Inputs | Outputs | Template |");
  lines.push("|---|---|---|---|---|---|---|---|");
  lines.push("");
  await app.vault.create(readmePath, lines.join("\n"));
}

async function appendTypeReadmeRow(app, readmePath, row) {
  const af = app.vault.getAbstractFileByPath(readmePath);
  if (!af || !("extension" in af)) return;

  const content = await app.vault.read(af);

  // Prevent duplicates by ID
  if (content.includes(`| ${row.id} |`)) return;

  const scriptLink = row.scriptFile ? `[[${row.scriptFile}]]` : "";
  const canvasLink = row.canvasFile ? `[[${row.canvasFile}]]` : "";

  const inputs = row.inputs?.length ? row.inputs.join(", ") : "";
  const outputs = row.outputs?.length ? row.outputs.join(", ") : "";

  const line =
    `| ${mdCell(row.id)} | ${mdCell(row.name)} | ${mdCell(row.description || "")} | ${mdCell(scriptLink)} | ${mdCell(
      canvasLink
    )} | ${mdCell(inputs)} | ${mdCell(outputs)} | ${mdCell(row.templateLabel || "")} |`;

  const updated = content.replace(/\n\s*$/g, "") + "\n" + line + "\n";
  await app.vault.modify(af, updated);
}

function mdCell(v) {
  return String(v ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ")
    .trim();
}

/* ==============================
   Template selection
   ============================== */

function pickTemplateForItem(cfg, type, templateOverride) {
  const override = str(templateOverride || "");
  if (override) {
    const found = pickTemplateByNameOrLabel(cfg, override);
    if (found) return found;
  }

  const typeDefault = str(cfg.settingsRaw.typeTemplates[type] || "");
  if (typeDefault) {
    const found = pickTemplateByNameOrLabel(cfg, typeDefault);
    if (found) return found;
  }

  return cfg.resolved.defaultTemplate;
}

function pickTemplateByNameOrLabel(cfg, wanted) {
  const w = str(wanted || "");
  if (!w) return null;
  return cfg.resolved.templates.find((t) => t.name === w) || cfg.resolved.templates.find((t) => t.label === w) || null;
}

/* ==============================
   Items input: resolve + normalize
   ============================== */

async function resolveItemsPayload(cfg) {
  const { qa } = cfg;
  const rawVar = cfg.varsRaw.items.prompt ? null : cfg.varsRaw.items.value;

  if (!cfg.varsRaw.items.prompt && Array.isArray(rawVar)) return rawVar;
  if (!cfg.varsRaw.items.prompt && rawVar && typeof rawVar === "object") return rawVar;
  if (!cfg.varsRaw.items.prompt) return String(rawVar ?? "");

  const resp = await qa.requestInputs([
    {
      id: "items",
      label: "Items (typed)",
      type: "textarea",
      placeholder:
        "Examples:\n" +
        "command:system:Move File\n" +
        "event:ops:Sales Order Created\n" +
        "policy:ops:Invoice Allowed\n" +
        "validator:system:Validate Paths\n" +
        "apiquery:hubspot:Fetch Deal\n" +
        "notifier:teams:Post Message\n\n" +
        "Or JSON:\n" +
        '[{"type":"command","domain":"system","verb":"Move","noun":"File","inputs":["src_path","dest_path"],"outputs":["moved_path"]}]',
      defaultValue: "",
      description: "One per line / comma-separated, or a JSON array (strings or objects).",
    },
  ]);

  return String(resp?.items ?? "");
}

function normalizeItems(payload) {
  if (Array.isArray(payload)) return payload.map(normalizeItem).filter(Boolean);
  if (payload && typeof payload === "object") {
    const one = normalizeItem(payload);
    return one ? [one] : [];
  }

  const s = String(payload ?? "").trim();
  if (!s) return [];

  if ((s.startsWith("[") && s.endsWith("]")) || (s.startsWith("{") && s.endsWith("}"))) {
    try {
      return normalizeItems(JSON.parse(s));
    } catch (_) {}
  }

  const parts = s
    .split(/\r?\n/g)
    .flatMap((line) => line.split(","))
    .map((x) => String(x ?? "").trim())
    .filter(Boolean);

  const seen = new Set();
  const out = [];
  for (const p of parts) {
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const item = normalizeItem(p);
    if (item) out.push(item);
  }
  return out;
}

function normalizeItem(item) {
  // Object
  if (item && typeof item === "object" && !Array.isArray(item)) {
    const type = normalizeType(item.type || "script");
    const domain = str(item.domain || "system");

    const name = str(item.name || item.title || "");
    const verb = str(item.verb || "");
    const noun = str(item.noun || "");

    return {
      type,
      domain,
      name,
      verb,
      noun,
      description: str(item.description || ""),
      inputs: item.inputs,
      outputs: item.outputs,
      template_name: str(item.template_name || item.template || ""),
    };
  }

  // String: "<type>:<domain>:<name>"
  const s = str(item);
  if (!s) return null;

  const parts = s.split(":").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) {
    const type = normalizeType(parts[0]);
    const domain = str(parts[1]);
    const name = parts.slice(2).join(":").trim();
    const vn = parseVerbNoun(name);
    return { type, domain, name, verb: vn.verb, noun: vn.noun, description: "", inputs: [], outputs: [] };
  }

  // fallback
  return { type: "script", domain: "system", name: s, verb: "", noun: "", description: "", inputs: [], outputs: [] };
}

/* ==============================
   Type + folder labels
   ============================== */

function normalizeType(t) {
  const s = str(t).toLowerCase();

  if (["event", "events"].includes(s)) return "event";
  if (["command", "commands"].includes(s)) return "command";
  if (["query", "queries"].includes(s)) return "query";
  if (["apiquery", "api_query", "api-query", "apiqueries", "api_queries"].includes(s)) return "apiquery";
  if (["notifier", "notify", "notification", "notifications"].includes(s)) return "notifier";
  if (["policy", "guard", "guards", "rule", "rules"].includes(s)) return "policy";
  if (["validator", "validate", "validation"].includes(s)) return "validator";

  return "script";
}

function typeToFolderLabel(type) {
  // Capitalized, allows spaces (as requested)
  switch (type) {
    case "event":
      return "Events";
    case "command":
      return "Commands";
    case "query":
      return "Queries";
    case "apiquery":
      return "API Queries";
    case "notifier":
      return "Notifiers";
    case "policy":
      return "Policies";
    case "validator":
      return "Validators";
    default:
      return "Scripts";
  }
}

function parseVerbNoun(name) {
  const clean = String(name ?? "").replace(/\s+/g, " ").trim();
  const parts = clean.split(" ");
  if (parts.length <= 1) return { verb: parts[0] || "", noun: "" };
  return { verb: parts[0], noun: parts.slice(1).join(" ") };
}

/* ==============================
   Resolve author once
   ============================== */

async function resolveAuthor(cfg) {
  const { qa } = cfg;

  if (!cfg.varsRaw.script_author.prompt) {
    return str(cfg.varsRaw.script_author.value || cfg.settingsRaw.defaultAuthor) || "Unknown";
  }

  const resp = await qa.requestInputs([
    { id: "script_author", label: "Author", type: "text", defaultValue: cfg.settingsRaw.defaultAuthor },
  ]);

  return str(resp?.script_author || cfg.settingsRaw.defaultAuthor) || "Unknown";
}

/* ==============================
   cfg builder
   ============================== */

function buildRuntimeConfig(params, settings) {
  const app = params.app;
  const qa = params.quickAddApi;
  const variables = params.variables || {};

  const s = {
    outFolder: str(settings?.[SET_OUTPUT_FOLDER] ?? ""),
    templatesFolder: str(settings?.[SET_TEMPLATES_FOLDER] ?? ""),
    defaultTemplateName: str(settings?.[SET_DEFAULT_TEMPLATE] ?? ""),

    defaultAuthor: str(settings?.[SET_DEFAULT_AUTHOR] ?? "Unknown"),
    filenameFormat: str(settings?.[SET_FILENAME_FORMAT] ?? "{{slug}}.js"),

    openAfter: settings?.[SET_OPEN_AFTER] !== false,
    overwrite: !!settings?.[SET_OVERWRITE],
    debug: !!settings?.[SET_DEBUG],

    canvasTemplatePath: str(settings?.[SET_CANVAS_TEMPLATE_PATH] ?? ""),
    canvasFilenameFormat: str(settings?.[SET_CANVAS_FILENAME_FORMAT] ?? "{{slug}}.canvas"),

    typeTemplates: {
      script: str(settings?.[SET_TEMPLATE_SCRIPT] ?? ""),
      event: str(settings?.[SET_TEMPLATE_EVENT] ?? ""),
      command: str(settings?.[SET_TEMPLATE_COMMAND] ?? ""),
      query: str(settings?.[SET_TEMPLATE_QUERY] ?? ""),
      apiquery: str(settings?.[SET_TEMPLATE_APIQUERY] ?? ""),
      notifier: str(settings?.[SET_TEMPLATE_NOTIFIER] ?? ""),
      policy: str(settings?.[SET_TEMPLATE_POLICY] ?? ""),
      validator: str(settings?.[SET_TEMPLATE_VALIDATOR] ?? ""),
    },
  };

  const v = {
    script_author: readVarForPrompt(variables, "script_author"),
    items: readVarForPrompt(variables, "items"),
    canvas_path: readVarForPrompt(variables, "canvas_path"),
  };

  const util = {
    log: (...a) => s.debug && console.log("[QADomainPackGenerator]", ...a),
    pick: (varInfo, fallbackValue, fallbackFinal) => pickValue(varInfo, fallbackValue, fallbackFinal),
  };

  const resolved = {
    templates: [],
    defaultTemplate: null,
    author: "",
    parentFolder: "",
    items: [],
    canvasPathFromVars: "",
    shouldSkipCanvas: false,
  };

  return { app, qa, variables, settingsRaw: s, varsRaw: v, resolved, util };
}

/* ==============================
   Variables helpers
   ============================== */

function readVarForPrompt(variables, key) {
  const hasKey = Object.prototype.hasOwnProperty.call(variables || {}, key);
  if (!hasKey) return { prompt: true, value: null };
  const v = variables[key];
  if (v === undefined || v === null) return { prompt: true, value: null };
  return { prompt: false, value: v };
}

function pickValue(varInfo, fallbackValue, fallbackFinal) {
  if (varInfo && varInfo.prompt === false) return varInfo.value;
  if (fallbackValue !== undefined && fallbackValue !== null) return fallbackValue;
  return fallbackFinal;
}

/* ==============================
   Templates
   ============================== */

function replaceTokens(template, map) {
  let out = String(template ?? "");
  for (const [k, v] of Object.entries(map ?? {})) {
    out = out.replaceAll(`{{${k}}}`, String(v ?? ""));
  }
  return out;
}

function listTemplateFiles(app, folderPath) {
  const af = app.vault.getAbstractFileByPath(folderPath);
  if (!af || !af.children) return [];

  const files = [];
  walkFolder(af, files);

  return files
    .filter((f) => f && f.path && "extension" in f)
    .filter((f) => /(^|\/)[^\/]+\.template\.[^\/.]+$/i.test(f.path))
    .map((f) => {
      const name = fileNameFromPath(f.path);
      return { name, path: f.path, label: prettifyTemplateLabel(name) };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "en"));
}

function walkFolder(folderAf, out) {
  for (const child of folderAf.children || []) {
    if (child.children) walkFolder(child, out);
    else out.push(child);
  }
}

function prettifyTemplateLabel(fileName) {
  const base = String(fileName).replace(/\.[^.]+$/g, "");
  const withoutTemplate = base.replace(/\.template$/i, "");
  const parts = withoutTemplate.split(/[-_]/).filter(Boolean);
  const last = parts[parts.length - 1] || withoutTemplate;
  return toTitleCaseWords(last.replace(/[_.]+/g, " "));
}

function fileNameFromPath(p) {
  const parts = String(p).split("/");
  return parts[parts.length - 1] || String(p);
}

/* ==============================
   Vault helpers
   ============================== */

async function mustReadFile(app, path) {
  const p = str(path);
  const af = app.vault.getAbstractFileByPath(p);
  if (!af || !("extension" in af)) throw new Error(`Template file not found: ${p}`);
  return await app.vault.read(af);
}

async function ensureFolder(app, folderPath) {
  const parts = String(folderPath).split("/").filter(Boolean);
  let current = "";
  for (const p of parts) {
    current = current ? `${current}/${p}` : p;
    if (!app.vault.getAbstractFileByPath(current)) await app.vault.createFolder(current);
  }
}

async function writeFileSafe(app, path, content, { overwrite } = {}) {
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing) {
    if (!overwrite) return false;
    await app.vault.modify(existing, String(content ?? ""));
    return true;
  }
  await app.vault.create(path, String(content ?? ""));
  return true;
}

/* ==============================
   String helpers
   ============================== */

function applyFormat(fmt, ctx) {
  return String(fmt ?? "")
    .replaceAll("{{slug}}", String(ctx?.slug ?? "new-script"))
    .replaceAll("{{name}}", String(ctx?.name ?? ""));
}

function ensureExt(name, ext) {
  const s = str(name);
  return s.toLowerCase().endsWith(ext) ? s : `${s}${ext}`;
}

function joinPath(a, b) {
  return `${String(a).replace(/\/+$/, "")}/${String(b).replace(/^\/+/, "")}`.replace(/\/{2,}/g, "/");
}

function slugify(v) {
  return (
    String(v ?? "")
      .trim()
      .toLowerCase()
      .replace(/['"]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "quickadd-script"
  );
}

function str(v) {
  return String(v ?? "").trim();
}

function normalizeStringList(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => str(x)).filter(Boolean);
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return [];
    if (s.startsWith("[") && s.endsWith("]")) {
      try {
        const arr = JSON.parse(s);
        if (Array.isArray(arr)) return arr.map((x) => str(x)).filter(Boolean);
      } catch (_) {}
    }
    return s
      .split(/\r?\n/g)
      .flatMap((line) => line.split(","))
      .map((x) => str(x))
      .filter(Boolean);
  }
  return [];
}

function normalizeFolderName(input) {
  const s = String(input ?? "")
    .replace(/\s+/g, " ")
    .trim();

  if (!s) return "";

  // Ensure first character is uppercase (and keep the rest as-is)
  // Additionally, "nice" behavior: Title Case each word if user enters all-lowercase.
  const looksLower = s === s.toLowerCase();
  if (looksLower) return toTitleCaseWords(s);

  return s.charAt(0).toUpperCase() + s.slice(1);
}

function toTitleCaseWords(s) {
  return String(s)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}
