// --------------------------------------------------
// QuickAdd User Script — Publish Daily Brief (EN)
// Adds: Risk thresholds + Teams summary
// --------------------------------------------------

const SET_DAILY_BRIEF_FOLDER = "Daily brief folder";
const SET_PUBLISH_FOLDER = "Publish folder";
const SET_PUBLISH_FILENAME_FORMAT = "Publish filename format";
const SET_BODY_TEMPLATE_PATH = "Publish body template path";

const SET_TASK_FOLDER = "Task folder (optional)";
const SET_TASK_TAG = "Task tag";
const SET_TASK_STATUSES = "Task statuses (CSV)";

const SET_OPEN_AFTER_CREATE = "Open note after create";

// Risk thresholds (numbers)
const SET_WARN_BACKORDERS = "Warn: Sales backorders ≥";
const SET_CRIT_BACKORDERS = "Crit: Sales backorders ≥";
const SET_WARN_PO_PAST_DUE = "Warn: PO past due ≥";
const SET_CRIT_PO_PAST_DUE = "Crit: PO past due ≥";

// Optional value thresholds in $k (thousands)
const SET_WARN_SALES_VALUE_K = "Warn: Sales value ($k) ≥";
const SET_CRIT_SALES_VALUE_K = "Crit: Sales value ($k) ≥";

// Dataview helper
const toArray = (x) => (x?.array ? x.array() : Array.from(x ?? []));

module.exports = {
  entry: async (QuickAdd, settings) => {
    const { app, quickAddApi } = QuickAdd;

    // --------------------------------------------------
    // Read settings
    // --------------------------------------------------
    const DAILY_BRIEF_FOLDER = String(settings[SET_DAILY_BRIEF_FOLDER] ?? "").trim();
    const PUBLISH_FOLDER = String(settings[SET_PUBLISH_FOLDER] ?? "").trim();
    const PUBLISH_FILENAME_FORMAT = String(settings[SET_PUBLISH_FILENAME_FORMAT] ?? "").trim();
    const BODY_TEMPLATE_PATH = String(settings[SET_BODY_TEMPLATE_PATH] ?? "").trim();

    const TASK_FOLDER = String(settings[SET_TASK_FOLDER] ?? "").trim();
    const TASK_TAG = String(settings[SET_TASK_TAG] ?? "#type/task").trim();
    const TASK_STATUSES_RAW = String(settings[SET_TASK_STATUSES] ?? "new");

		const parseCsvList = (s) =>
		  s
		    .split(",")
		    .map(x => String(x).trim().toLowerCase())
		    .filter(Boolean);
		
		const TASK_STATUSES = new Set(parseCsvList(TASK_STATUSES_RAW));
		const statusesText = Array.from(TASK_STATUSES).join(", ");
		
    const OPEN_AFTER_CREATE = !!settings[SET_OPEN_AFTER_CREATE];

    // thresholds
    const warnBackorders = Number(settings[SET_WARN_BACKORDERS] ?? 10);
    const critBackorders = Number(settings[SET_CRIT_BACKORDERS] ?? 25);

    const warnPoPastDue = Number(settings[SET_WARN_PO_PAST_DUE] ?? 5);
    const critPoPastDue = Number(settings[SET_CRIT_PO_PAST_DUE] ?? 15);

    const warnSalesValueK = Number(settings[SET_WARN_SALES_VALUE_K] ?? 500);
    const critSalesValueK = Number(settings[SET_CRIT_SALES_VALUE_K] ?? 1000);

    if (!DAILY_BRIEF_FOLDER || !PUBLISH_FOLDER || !PUBLISH_FILENAME_FORMAT || !BODY_TEMPLATE_PATH) {
      new Notice("❌ Publish Daily Brief: Please configure the script settings (⚙️).");
      return;
    }

    // --------------------------------------------------
    // Helpers
    // --------------------------------------------------
    const ensureFolder = async (folderPath) => {
      const parts = folderPath.split("/").filter(Boolean);
      let current = "";
      for (const p of parts) {
        current = current ? `${current}/${p}` : p;
        if (!app.vault.getAbstractFileByPath(current)) await app.vault.createFolder(current);
      }
    };

    const evaluateFormat = async (fmt) => {
      if (quickAddApi?.format) return await quickAddApi.format(fmt);
      return fmt.replace(/\{\{DATE:([^}]+)\}\}/g, (_, p) => window.moment().format(p));
    };

    const getFrontmatter = (file) =>
      app.metadataCache.getFileCache(file)?.frontmatter ?? null;

    const loadTemplateOrFallback = async (path) => {
		  const af = app.vault.getAbstractFileByPath(path);
		  if (!af) return null;
		  return await app.vault.read(af);
		};
		
		const buildFallbackBody = ({
		  date,
		  autoTitle,
		  sourceDailyBrief,
		  kpiSummary,
		  riskSummary,
		  executiveSummary,
		  executionPlanCount,
		  executionPlanTable,
		}) => {
		  return [
		    `# ${autoTitle} - ${date}`,
		    ``,
		    `Source Daily Brief: ${sourceDailyBrief}`,
		    ``,
		    kpiSummary,
		    ``,
		    riskSummary,
		    ``,
		    `## Executive Summary`,
		    executiveSummary?.trim() ? executiveSummary.trim() : "_No executive summary provided._",
		    ``,
		    `## Daily Execution Plan`,
		    `_Tasks: ${executionPlanCount}_`,
		    ``,
		    executionPlanTable || "_No tasks included._",
		  ].join("\n");
		};

    const replaceTokens = (text, tokens) => {
      let out = text;
      for (const [k, v] of Object.entries(tokens)) out = out.replaceAll(k, v ?? "");
      return out;
    };

    const normalizeTag = (t) => (t.startsWith("#") ? t : `#${t}`);

    // --------------------------------------------------
    // Pick Daily Brief (active or latest)
    // --------------------------------------------------
    const pickDailyBriefFile = async () => {
      const active = app.workspace.getActiveFile();
      if (active) {
        const fm = getFrontmatter(active);
        if (fm?.type === "OperationsDailyBrief") return active;
        if (active.path.startsWith(`${DAILY_BRIEF_FOLDER}/`)) return active;
      }

      const dvApi = app?.plugins?.plugins?.dataview?.api;
      if (!dvApi) throw new Error("Dataview API not available.");

      const pages = toArray(dvApi.pages(`"${DAILY_BRIEF_FOLDER}"`));
      if (!pages.length) return null;

      pages.sort((a, b) =>
        String(b.date ?? b.file?.name).localeCompare(String(a.date ?? a.file?.name))
      );

      return app.vault.getAbstractFileByPath(pages[0].file.path);
    };

    // --------------------------------------------------
    // KPI helpers + deltas
    // --------------------------------------------------
    const n = (v) => (v == null || v === "" ? 0 : Number(v));
    const moneyK = (v) => `$${n(v).toLocaleString("de-DE")}k`;

    const delta = (today, yesterday) => {
      const d = n(today) - n(yesterday);
      if (d === 0) return "→ 0";
      return d > 0 ? `↑ ${d}` : `↓ ${Math.abs(d)}`;
    };

    // Risk scoring: crit >= crit, warn >= warn, else ok
    const riskBadge = (value, warn, crit) => {
      const v = n(value);
      if (Number.isFinite(crit) && v >= crit) return "🔴";
      if (Number.isFinite(warn) && v >= warn) return "🟡";
      return "🟢";
    };

    const riskLine = (label, value, warn, crit) => {
      const badge = riskBadge(value, warn, crit);
      return `${badge} ${label}: **${n(value)}** (warn≥${warn}, crit≥${crit})`;
    };
    
    // --------------------------------------------------
		// Auto Title (risk-aware)
		// --------------------------------------------------
		const computeOverallRisk = (fm) => {
		  const salesBackorders = riskBadge(fm.sales_backorders, warnBackorders, critBackorders);
		  const poPastDue = riskBadge(fm.po_past_due, warnPoPastDue, critPoPastDue);
		  const salesValue = riskBadge(fm.sales_value_tsd, warnSalesValueK, critSalesValueK);
		
		  const score = (b) => (b === "🔴" ? 2 : b === "🟡" ? 1 : 0);
		  const total = score(salesBackorders) + score(poPastDue) + score(salesValue);
		
		  const worst = [salesBackorders, poPastDue, salesValue].sort((a, b) => score(b) - score(a))[0];
		  return { total, worst, salesBackorders, poPastDue, salesValue };
		};
		
		const buildAutoTitle = (fm, prevFm) => {
		  const { worst } = computeOverallRisk(fm);
		
		  const backordersD = delta(fm.sales_backorders, prevFm?.sales_backorders);
		  const pastDueD = delta(fm.po_past_due, prevFm?.po_past_due);
		
		  // pick the most “meaningful” driver
		  if (worst === "🔴") {
		    if (n(fm.po_past_due) >= critPoPastDue) return `🔴 Critical: PO Past Due ${n(fm.po_past_due)} (${pastDueD})`;
		    if (n(fm.sales_backorders) >= critBackorders) return `🔴 Critical: Backorders ${n(fm.sales_backorders)} (${backordersD})`;
		    return `🔴 Critical Risk Signals`;
		  }
		
		  if (worst === "🟡") {
		    if (n(fm.po_past_due) >= warnPoPastDue) return `🟡 Watch: PO Past Due ${n(fm.po_past_due)} (${pastDueD})`;
		    if (n(fm.sales_backorders) >= warnBackorders) return `🟡 Watch: Backorders ${n(fm.sales_backorders)} (${backordersD})`;
		    return `🟡 Watch: Risk Signals Elevated`;
		  }
		
		  return `🟢 Stable Operations`;
		};


    // --------------------------------------------------
    // Build KPI Summary (with DoD delta)
    // --------------------------------------------------
    const buildKpiSummary = (fm, prevFm) => {
      return [
        `**Open Sales Orders**`,
        `- 📦 Open Orders: **${n(fm.sales_open_orders)}** (${delta(fm.sales_open_orders, prevFm?.sales_open_orders)})`,
        `- 🧾 Line Items: **${n(fm.sales_open_line_items)}** (${delta(fm.sales_open_line_items, prevFm?.sales_open_line_items)})`,
        `- 🗓️ Due Today: **${n(fm.sales_due_today)}**`,
        `- ⏳ Backorders: **${n(fm.sales_backorders)}** (${delta(fm.sales_backorders, prevFm?.sales_backorders)})`,
        `- 💰 Value: **${moneyK(fm.sales_value_tsd)}** (${delta(fm.sales_value_tsd, prevFm?.sales_value_tsd)})`,
        ``,
        `**Open Purchase Orders**`,
        `- 📄 Open POs: **${n(fm.po_open_pos)}** (${delta(fm.po_open_pos, prevFm?.po_open_pos)})`,
        `- 🧾 PO Lines: **${n(fm.po_open_po_lines)}**`,
        `- 🗓️ Due Today: **${n(fm.po_due_today)}**`,
        `- ⚠️ Past Due: **${n(fm.po_past_due)}** (${delta(fm.po_past_due, prevFm?.po_past_due)})`,
        `- 💰 Value: **${moneyK(fm.po_value_tsd)}** (${delta(fm.po_value_tsd, prevFm?.po_value_tsd)})`,
      ].join("\n");
    };

    // --------------------------------------------------
    // Build Risk Summary (threshold-driven)
    // --------------------------------------------------
    const buildRiskSummary = (fm) => {
      const lines = [
        `## Risk Signals`,
        ``,
        riskLine("Sales Backorders", fm.sales_backorders, warnBackorders, critBackorders),
        riskLine("PO Past Due", fm.po_past_due, warnPoPastDue, critPoPastDue),
        `${riskBadge(fm.sales_value_tsd, warnSalesValueK, critSalesValueK)} Sales Value ($k): **${n(fm.sales_value_tsd)}** (warn≥${warnSalesValueK}, crit≥${critSalesValueK})`,
      ];
      return lines.join("\n");
    };


		// --------------------------------------------------
		// Execution Plan
		// Table: Task | Bucket | Status
		// Task: filename only (no extension), no links
		// --------------------------------------------------
		const buildExecutionPlan = async () => {
		  const dvApi = app?.plugins?.plugins?.dataview?.api;
		  if (!dvApi) throw new Error("Dataview API not available.");
		
		  const tag = normalizeTag(TASK_TAG);
		  const source = TASK_FOLDER ? dvApi.pages(`"${TASK_FOLDER}"`) : dvApi.pages();
		  const pages = toArray(source);
		
		  const tasks = pages
		    .filter((p) => {
		      const tags = p.file?.tags ?? p.file?.etags ?? [];
		      const arr = Array.isArray(tags) ? tags : toArray(tags);
		      return arr.includes(tag) && TASK_STATUSES.has(String(p.status ?? "").trim().toLowerCase());
		    })
		    .map((p) => ({
				  task: String(p.file?.name ?? "").replace(/\.md$/i, ""),
				  bucket: String(p.bucket ?? p.Bucket ?? "").trim(),
				  status: String(p.status ?? "").trim(),
				}));

		  // sort: bucket, task
		  tasks.sort(
		    (a, b) =>
		      String(a.bucket ?? "").localeCompare(String(b.bucket ?? "")) ||
		      String(a.task ?? "").localeCompare(String(b.task ?? ""))
		  );
		
		  const header = `| Task | Bucket | Status |\n|---|---|---|`;
		  const rows = tasks.map((t) => `| ${t.task || ""} | ${t.bucket || ""} | ${t.status || ""} |`);
		
		  return {
		    count: tasks.length,
		    markdown: tasks.length ? [header, ...rows].join("\n") : "_No tasks found._",
		  };
		};

		// --------------------------------------------------
		// Task Status Counts (for tracking in frontmatter)
		// --------------------------------------------------
		const buildTaskStatusCounts = async () => {
		  const dvApi = app?.plugins?.plugins?.dataview?.api;
		  if (!dvApi) throw new Error("Dataview API not available.");
		
		  const tag = normalizeTag(TASK_TAG);
		  const source = TASK_FOLDER ? dvApi.pages(`"${TASK_FOLDER}"`) : dvApi.pages();
		  const pages = toArray(source);
		
		  // Only task-tagged files
		  const taskPages = pages.filter((p) => {
		    const tags = p.file?.tags ?? p.file?.etags ?? [];
		    const arr = Array.isArray(tags) ? tags : toArray(tags);
		    return arr.includes(tag);
		  });
		
		  // Normalize to your 4 tracking buckets
		  const normalizeStatus = (raw) => {
		    const s = String(raw ?? "").trim().toLowerCase();
		    if (!s) return "new"; // fallback: treat missing as "new"
		    if (["new"].includes(s)) return "new";
		    if (["open", "todo", "to do"].includes(s)) return "open";
		    if (["active", "in progress", "in_progress", "doing"].includes(s)) return "active";
		    if (["done", "closed", "resolved"].includes(s)) return "done";
		    return s; // keep unknown status as-is (we’ll still count it)
		  };
		
		  const counts = Object.create(null);
		
		  for (const p of taskPages) {
		    const st = normalizeStatus(p.status);
		    counts[st] = (counts[st] ?? 0) + 1;
		  }
		
		  const total = taskPages.length;
		
		  return {
		    total,
		    byStatus: counts,
		    // convenience fields (0 if missing)
		    new: counts["new"] ?? 0,
		    open: counts["open"] ?? 0,
		    active: counts["active"] ?? 0,
		    done: counts["done"] ?? 0,
		  };
		};

    // --------------------------------------------------
    // 1) Load Daily Brief + Yesterday
    // --------------------------------------------------
    const todayBrief = await pickDailyBriefFile();
    if (!todayBrief) {
      new Notice("❌ No Daily Brief found.");
      return;
    }

    const fmToday = getFrontmatter(todayBrief);
    if (!fmToday) {
      new Notice("❌ Daily Brief has no frontmatter.");
      return;
    }

    // Find yesterday (latest other brief in folder)
    const dvApi = app?.plugins?.plugins?.dataview?.api;
    let fmYesterday = null;
    if (dvApi) {
      const pages = toArray(dvApi.pages(`"${DAILY_BRIEF_FOLDER}"`))
        .filter((p) => p.file.path !== todayBrief.path)
        .sort((a, b) => String(b.date ?? b.file.name).localeCompare(String(a.date ?? a.file.name)));
      if (pages[0]) {
        const yFile = app.vault.getAbstractFileByPath(pages[0].file.path);
        fmYesterday = yFile ? getFrontmatter(yFile) : null;
      }
    }

    // --------------------------------------------------
    // 2) User input via QuickAdd
    // --------------------------------------------------
    const execSummary = await quickAddApi.wideInputPrompt(
      "Executive Summary",
      "What does the team need to know today? Focus on risks, blockers, priorities, decisions."
    );
    if (execSummary == null) return;

    const includeTasks = await quickAddApi.yesNoPrompt(
		  "Include Daily Execution Plan?",
		  `Include tasks tagged "${normalizeTag(TASK_TAG)}" with statuses: ${statusesText}?`
		);

    // --------------------------------------------------
    // 3) Build content pieces
    // --------------------------------------------------
    const autoTitle = buildAutoTitle(fmToday, fmYesterday);
    const kpiSummary = buildKpiSummary(fmToday, fmYesterday);
    const riskSummary = buildRiskSummary(fmToday);

    let executionPlan = { count: 0, markdown: "" };
    if (includeTasks) executionPlan = await buildExecutionPlan();

		const taskCounts = await buildTaskStatusCounts();

    // --------------------------------------------------
    // 4) Create publish note from template
    // --------------------------------------------------
    const template = await loadTemplateOrFallback(BODY_TEMPLATE_PATH);

    const todayStr = window.moment().format("YYYY-MM-DD");
    const publishName = await evaluateFormat(PUBLISH_FILENAME_FORMAT);
    const publishPath = `${PUBLISH_FOLDER}/${publishName}`.replace(/\/{2,}/g, "/");

    await ensureFolder(PUBLISH_FOLDER);

    // Tokens you can use in the publish body template:
    // {{date}}, {{source_daily_brief}}, {{kpi_summary}}, {{risk_summary}},
    // {{executive_summary}}, {{teams_summary}},
    // {{execution_plan_count}}, {{execution_plan_table}}
    let body;
		if (template) {
		  body = replaceTokens(template, {
  			"{{auto_title}}": autoTitle,
		    "{{date}}": todayStr,
		    "{{source_daily_brief}}": todayBrief.path,
		    "{{kpi_summary}}": kpiSummary,
		    "{{risk_summary}}": riskSummary,
		    "{{executive_summary}}": execSummary.trim(),
		    "{{execution_plan_count}}": String(executionPlan.count),
		    "{{execution_plan_table}}": executionPlan.markdown,
		    "{{task_statuses}}": statusesText,
		  });
		} else {
		  new Notice("ℹ️ Publish template not found – using fallback layout.");
		  body = buildFallbackBody({
		    date: todayStr,
		    autoTitle,
		    sourceDailyBrief: todayBrief.path,
		    kpiSummary,
		    riskSummary,
		    executiveSummary: execSummary,
		    executionPlanCount: executionPlan.count,
		    executionPlanTable: executionPlan.markdown,
		  });
		}

		const frontmatter = [
		  `---`,
		  `type: OperationsUpdate`,
		  `date: ${todayStr}`,
		  `source_daily_brief: "[[${todayBrief.path}]]"`,
		  `generated_at: ${window.moment().toISOString()}`,
		
		  `task_count_total: ${taskCounts.total}`,
		  `task_count_new: ${taskCounts.new}`,
		  `task_count_open: ${taskCounts.open}`,
		  `task_count_active: ${taskCounts.active}`,
		  `task_count_done: ${taskCounts.done}`,

		  `---`,
		  ``,
		].join("\n");


    const finalContent = frontmatter + body;

    const existing = app.vault.getAbstractFileByPath(publishPath);
    let outFile;
    if (!existing) outFile = await app.vault.create(publishPath, finalContent);
    else {
      await app.vault.modify(existing, finalContent);
      outFile = existing;
    }

    if (OPEN_AFTER_CREATE) {
      await app.workspace.getLeaf(true).openFile(outFile);
    }

    new Notice("✅ Operations Update published");
  },

  settings: {
    name: "Publish Daily Brief",
    author: "Luis Mendez",
    options: {
      [SET_DAILY_BRIEF_FOLDER]: {
        type: "text",
        defaultValue: "02 - Areas/Operations/Daily Briefs",
        description: "Folder containing Daily Brief notes.",
      },
      [SET_PUBLISH_FOLDER]: {
        type: "text",
        defaultValue: "00 - Connectivity/publish/Operations/Updates",
        description: "Target folder for published updates.",
      },
      [SET_PUBLISH_FILENAME_FORMAT]: {
        type: "format",
        defaultValue: "{{DATE:YYYY-MM-DD}} - Operations Update.md",
        description: "QuickAdd format string for the update filename.",
      },
      [SET_BODY_TEMPLATE_PATH]: {
        type: "text",
        defaultValue: "03 - Resources/Templates/Operations Daily Update Template.md",
        description: "Path to the publish note body template (markdown).",
      },

      [SET_TASK_FOLDER]: {
        type: "text",
        defaultValue: "02 - Areas/MOR - Operations Day to Day/Tasks",
        description: "Optional: restrict task search to this folder (leave empty for whole vault).",
      },
      [SET_TASK_TAG]: {
        type: "text",
        defaultValue: "#type/task",
        description: "Tag identifying tasks (e.g. #type/task).",
      },
      [SET_TASK_STATUSES]: {
			  type: "text",
			  defaultValue: "new",
			  description: 'Comma-separated list of statuses to include (e.g. "new,in_progress,blocked").',
			},

      // Risk thresholds
      [SET_WARN_BACKORDERS]: { type: "text", defaultValue: "10", description: "Yellow if Sales Backorders >= this number." },
      [SET_CRIT_BACKORDERS]: { type: "text", defaultValue: "25", description: "Red if Sales Backorders >= this number." },
      [SET_WARN_PO_PAST_DUE]: { type: "text", defaultValue: "5", description: "Yellow if PO Past Due >= this number." },
      [SET_CRIT_PO_PAST_DUE]: { type: "text", defaultValue: "15", description: "Red if PO Past Due >= this number." },
      [SET_WARN_SALES_VALUE_K]: { type: "text", defaultValue: "500", description: "Yellow if Sales Value ($k) >= this number." },
      [SET_CRIT_SALES_VALUE_K]: { type: "text", defaultValue: "1000", description: "Red if Sales Value ($k) >= this number." },

      [SET_OPEN_AFTER_CREATE]: {
        type: "checkbox",
        defaultValue: true,
        description: "Open the published update note after creation.",
      },
    },
  },
};
