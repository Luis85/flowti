/**
 * QuickAdd User Script: Sales Performance Report (v1)
 * - Loads current + last year Sales Detail CSVs
 * - Computes last-3-month item performance + YoY vs same window last year
 * - Produces stock recommendation
 * - Token-based templates {{token}} (no Dataview inline tags)
 * - Idempotent: updates frontmatter + replaces report section between markers
 * - Chaining/programmatic mode supported
 *
 * Requires:
 * - Dataview plugin enabled (for dv.io.csv)
 */

const SET_TARGET_FOLDER = "Target folder";
const SET_TEMPLATE_PATH = "Template path";
const SET_FILENAME_FORMAT = "Filename format";

const SET_SALES_CSV_FOLDER = "Sales CSV folder";
const SET_SALES_CSV_FILE_PATTERN = "Sales CSV filename pattern"; // supports {{YEAR}}
const SET_WINDOW_DAYS = "Window days (last N days)";
const SET_USE_FIXED_SCHEMA = "Use fixed schema";

const SET_TOP_N = "Top N items";
const SET_EXCLUDE_ITEM_PREFIXES = "Exclude item prefixes (CSV)";

const SET_MIN_REVENUE_3M = "Threshold: min revenue (3m)";
const SET_MIN_ORDERS_3M = "Threshold: min orders (3m)";
const SET_MIN_QTY_3M = "Threshold: min qty (3m)";

const SET_DEBUG = "Debug mode";

// Markers for idempotent body updates
const REPORT_START = "<!-- SALES_REPORT_START -->";
const REPORT_END = "<!-- SALES_REPORT_END -->";

module.exports = {
  entry: async (QuickAdd, settings) => {
    const { app } = QuickAdd;

    try {
      const result = await runSalesPerformanceReport(app, { settings });

      if (result?.file) {
        await app.workspace.getLeaf(true).openFile(result.file);
      }
      new Notice(result?.notice ?? "✅ Sales report completed.");
    } catch (err) {
      console.error("[SalesReport] Script failed:", err);
      new Notice(`❌ Sales report failed: ${err?.message ?? err}`);
    }
  },

  settings: {
    name: "Sales Performance Report",
    author: "Luis Mendez",
    options: {
      [SET_TARGET_FOLDER]: {
        type: "text",
        defaultValue: "02 - Areas/Operations/Sales",
        placeholder: "02 - Areas/Operations/Sales",
        description: "Folder where the report note is created/updated.",
      },
      [SET_TEMPLATE_PATH]: {
        type: "text",
        defaultValue: "03 - Resources/Templates/Sales Performance Template.md",
        placeholder: "03 - Resources/Templates/Sales Performance Template.md",
        description: "Template body with tokens like {{title}}, {{report_table}}, etc.",
      },
      [SET_FILENAME_FORMAT]: {
        type: "text",
        defaultValue: "{{DATE:YYYY-MM-DD}} - Sales Performance Report.md",
        placeholder: "{{DATE:YYYY-MM-DD}} - Sales Performance Report.md",
        description: "Filename format. Supports {{DATE:...}} token.",
      },

      [SET_SALES_CSV_FOLDER]: {
        type: "text",
        defaultValue: "03 - Resources/Sales",
        placeholder: "03 - Resources/Sales",
        description: "Folder containing the yearly Sales Detail CSV files.",
      },
      [SET_SALES_CSV_FILE_PATTERN]: {
        type: "text",
        defaultValue: "Sales Detail for Selected Year {{YEAR}}.csv",
        placeholder: "Sales Detail for Selected Year {{YEAR}}.csv",
        description: "Filename pattern. Use {{YEAR}} placeholder.",
      },
      
      [SET_USE_FIXED_SCHEMA]: {
			  type: "toggle",
			  defaultValue: true,
			  description: "If enabled, uses the exact CSV column names for P21 Sales Detail exports.",
			},

      [SET_WINDOW_DAYS]: {
        type: "text",
        defaultValue: "90",
        placeholder: "90",
        description: "Lookback window in days (default: 90 ≈ last 3 months).",
      },

      [SET_TOP_N]: {
        type: "text",
        defaultValue: "30",
        placeholder: "30",
        description: "How many items to show in the report table.",
      },

      [SET_EXCLUDE_ITEM_PREFIXES]: {
        type: "text",
        defaultValue: "",
        placeholder: "TMP-,TEST-,NIC-",
        description: "Optional. Comma-separated item prefixes to exclude.",
      },

      [SET_MIN_REVENUE_3M]: {
        type: "text",
        defaultValue: "1000",
        placeholder: "1000",
        description: "Recommendation threshold: minimum revenue in window (base currency).",
      },
      [SET_MIN_ORDERS_3M]: {
        type: "text",
        defaultValue: "3",
        placeholder: "3",
        description: "Recommendation threshold: minimum number of orders in window.",
      },
      [SET_MIN_QTY_3M]: {
        type: "text",
        defaultValue: "0",
        placeholder: "0",
        description: "Recommendation threshold: minimum quantity shipped/sold in window.",
      },

      [SET_DEBUG]: {
        type: "toggle",
        defaultValue: false,
        description: "Enable verbose console logging.",
      },
    },
  },

  // Optional exports for chaining (other scripts can require() this file)
  runSalesPerformanceReport,
};

// ------------------------------
// Chaining/programmatic API
// ------------------------------
async function runSalesPerformanceReport(app, opts = {}) {
  const settings = opts.settings ?? {};
  const runtime = opts.runtime ?? {};

  const debug = !!settings[SET_DEBUG];
  const log = (...args) => {
    if (debug) console.log("[SalesReport]", ...args);
  };

  // ------------------------------
  // Read settings with defaults
  // ------------------------------
  const TARGET_FOLDER = str(settings[SET_TARGET_FOLDER]) || "02 - Areas/Operations/Sales";
  const TEMPLATE_PATH = str(settings[SET_TEMPLATE_PATH]) || "03 - Resources/Templates/Sales Performance Template.md";
  const FILENAME_FORMAT = str(settings[SET_FILENAME_FORMAT]) || "{{DATE:YYYY-MM-DD}} - Sales Performance Report.md";

  const SALES_CSV_FOLDER = str(settings[SET_SALES_CSV_FOLDER]) || "03 - Resources/Sales";
  const SALES_CSV_PATTERN = str(settings[SET_SALES_CSV_FILE_PATTERN]) || "Sales Detail for Selected Year {{YEAR}}.csv";

  const windowDays = toInt(settings[SET_WINDOW_DAYS], 90);
  const topN = toInt(settings[SET_TOP_N], 30);

  const excludePrefixes = parseCsvList(settings[SET_EXCLUDE_ITEM_PREFIXES]);
  const minRevenue = toNum(settings[SET_MIN_REVENUE_3M], 1000);
  const minOrders = toInt(settings[SET_MIN_ORDERS_3M], 3);
  const minQty = toNum(settings[SET_MIN_QTY_3M], 0);

  // ------------------------------
  // Date context
  // ------------------------------
  const asOf = runtime.asOfDate
    ? window.moment(runtime.asOfDate).startOf("day")
    : window.moment().startOf("day");

  const start = asOf.clone().subtract(windowDays, "days").startOf("day");
  const startLy = start.clone().subtract(1, "year");
  const asOfLy = asOf.clone().subtract(1, "year");

  const ctx = {
    date: asOf.format("YYYY-MM-DD"),
    generated_at: window.moment().toISOString(),
    window_days: String(windowDays),
    window_start: start.format("YYYY-MM-DD"),
    window_end: asOf.format("YYYY-MM-DD"),
    window_start_ly: startLy.format("YYYY-MM-DD"),
    window_end_ly: asOfLy.format("YYYY-MM-DD"),
  };

  // ------------------------------
  // Resolve CSV paths
  // ------------------------------
  const currentYear = asOf.year();
  const lastYear = currentYear - 1;

  const currentCsvPath = joinPath(SALES_CSV_FOLDER, SALES_CSV_PATTERN.replaceAll("{{YEAR}}", String(currentYear)));
  const lastYearCsvPath = joinPath(SALES_CSV_FOLDER, SALES_CSV_PATTERN.replaceAll("{{YEAR}}", String(lastYear)));

  log("Resolved CSV paths", { currentCsvPath, lastYearCsvPath });

  // ------------------------------
  // Load CSVs once (robustly)
  // ------------------------------
  const dvApi = app?.plugins?.plugins?.dataview?.api;
  if (!dvApi?.io?.csv) {
    throw new Error("Dataview API not available. Enable Dataview plugin to read CSV files.");
  }

  const csvCurrent = await safeReadCsv(dvApi, currentCsvPath, log);
  const csvLast = await safeReadCsv(dvApi, lastYearCsvPath, log);

  // ------------------------------
  // Normalize rows (flexible column detection)
  // ------------------------------
	const useFixedSchema = settings[SET_USE_FIXED_SCHEMA] !== false;
	
	const normCurrent = normalizeSalesRows(csvCurrent.rows, { excludePrefixes, log, useFixedSchema });
	const normLast = normalizeSalesRows(csvLast.rows, { excludePrefixes, log, useFixedSchema });

  // Filter window: current window uses current-year file, LY window uses last-year file
  const inWindowCurrent = normCurrent.filter(r => r.date && r.date.isSameOrAfter(start) && r.date.isSameOrBefore(asOf));
  const inWindowLy = normLast.filter(r => r.date && r.date.isSameOrAfter(startLy) && r.date.isSameOrBefore(asOfLy));

  log("Window rows", { inWindowCurrent: inWindowCurrent.length, inWindowLy: inWindowLy.length });

  // ------------------------------
  // Aggregate by item
  // ------------------------------
  const aggNow = aggregateByItem(inWindowCurrent);
  const aggLy = aggregateByItem(inWindowLy);

  const combined = combineNowVsLy(aggNow, aggLy);

  // Score + recommend + sort
	const scored = combined
	  .map(row => {
	    // Compute YoY first (recommendation uses trendUp which relies on yoy_revenue_pct)
	    const yoyRevenueAbs = safeNum(row.revenue_3m - row.revenue_3m_ly);
	    const yoyRevenuePct = pct(row.revenue_3m, row.revenue_3m_ly);
	    const yoyOrdersAbs  = safeNum(row.orders_3m - row.orders_3m_ly);
	
	    const enriched = {
	      ...row,
	      yoy_revenue_abs: yoyRevenueAbs,
	      yoy_revenue_pct: yoyRevenuePct,
	      yoy_orders_abs: yoyOrdersAbs,
	    };
	
	    // Recommendation + stock quantity recommendation
	    const rec = recommendStock(enriched, { minRevenue, minOrders, minQty });
	    const qtyRec = recommendStockQty({ ...enriched, recommendation: rec }, windowDays);
	
	    return {
	      ...enriched,
	      recommendation: rec,
	      adu: qtyRec.adu,
	      coverage_days: qtyRec.coverage_days,
	      recommended_stock_qty: qtyRec.recommended_stock_qty,
	    };
	  })
	  .sort((a, b) => (b.revenue_3m ?? 0) - (a.revenue_3m ?? 0));

  const top = scored.slice(0, Math.max(1, topN));

  // ------------------------------
  // Build markdown outputs
  // ------------------------------
  const summary = buildSummaryMarkdown({
    ctx,
    totals: computeTotals(aggNow, aggLy),
    thresholds: { minRevenue, minOrders, minQty },
    sources: { currentCsvPath, lastYearCsvPath, currentLoaded: csvCurrent.loaded, lastLoaded: csvLast.loaded },
  });

  const table = buildItemsTableMarkdown(top);

  const notes = buildNotesMarkdown({
    csvIssues: [...csvCurrent.issues, ...csvLast.issues],
    detected: {
      current: csvCurrent.detectedColumns,
      last: csvLast.detectedColumns,
    },
  });

  // ------------------------------
  // Create/update note
  // ------------------------------
  await ensureFolder(app, TARGET_FOLDER);

  const fileName = formatFilenameWithDate(FILENAME_FORMAT, asOf);
  const filePath = joinPath(TARGET_FOLDER, fileName);

  let file = app.vault.getAbstractFileByPath(filePath);

  // Prepare tokens
  const tokens = {
    ...ctx,
    title: stripExtension(fileName),
    report_summary: summary,
    report_table: table,
    report_notes: notes,
  };

  if (!file) {
    let body = await safeLoadTemplate(app, TEMPLATE_PATH);
    body = replaceTokens(body, tokens);

    // Ensure report markers exist for future idempotent updates
    body = ensureReportMarkers(body);

    file = await app.vault.create(filePath, body);
    log("Created report note", filePath);
  } else {
    // Update existing: replace section + refresh tokens (only inside section)
    const existing = await app.vault.read(file);
    const updated = updateReportSection(existing, tokens);
    if (updated !== existing) {
      await app.vault.modify(file, updated);
      log("Updated report section", filePath);
    } else {
      log("No changes detected in report section", filePath);
    }
  }

  // Always snapshot frontmatter (idempotent)
  await app.fileManager.processFrontMatter(file, (fm) => {
    fm.type = fm.type || "SalesPerformanceReport";
    fm.version = "v1";
    fm.sales_report_as_of = ctx.date;
    fm.sales_report_generated_at = ctx.generated_at;

    fm.sales_report_window_days = windowDays;
    fm.sales_report_window_start = ctx.window_start;
    fm.sales_report_window_end = ctx.window_end;
    fm.sales_report_window_start_ly = ctx.window_start_ly;
    fm.sales_report_window_end_ly = ctx.window_end_ly;

    fm.sales_csv_current_year_path = csvCurrent.loaded ? currentCsvPath : "";
    fm.sales_csv_last_year_path = csvLast.loaded ? lastYearCsvPath : "";

    fm.sales_rows_current_year_loaded = csvCurrent.rows.length;
    fm.sales_rows_last_year_loaded = csvLast.rows.length;

    fm.sales_items_in_report = scored.length;

    const totals = computeTotals(aggNow, aggLy);
    fm.sales_total_revenue_3m = totals.revenue_3m;
    fm.sales_total_revenue_3m_ly = totals.revenue_3m_ly;
    fm.sales_total_revenue_yoy_pct = totals.revenue_yoy_pct;

    fm.sales_threshold_min_revenue_3m = minRevenue;
    fm.sales_threshold_min_orders_3m = minOrders;
    fm.sales_threshold_min_qty_3m = minQty;

    fm.sales_filter_exclude_item_prefixes = excludePrefixes.join(", ");
  });

  return {
    file,
    notice: `✅ Sales report ready: ${fileName}`,
    filePath,
    loaded: { current: csvCurrent.loaded, last: csvLast.loaded },
  };
}

// ------------------------------
// CSV reading (robust)
// ------------------------------
async function safeReadCsv(dvApi, path, log) {
  const issues = [];
  try {
    const raw = await dvApi.io.csv(path);
    const rows = raw?.array ? raw.array() : Array.from(raw ?? []);
    if (!rows?.length) issues.push(`CSV loaded but empty: ${path}`);

    // Detect likely columns for transparency (best-effort)
    const detectedColumns = rows?.length ? detectColumns(rows[0]) : null;

    return { loaded: true, rows, issues, detectedColumns };
  } catch (err) {
    issues.push(`Failed to load CSV: ${path} (${err?.message ?? err})`);
    log("CSV load failed", path, err);
    return { loaded: false, rows: [], issues, detectedColumns: null };
  }
}

function detectColumns(sampleRow) {
  const keys = Object.keys(sampleRow || {});
  return {
    keys,
    date: findFirstKey(keys, ["date", "order date", "invoice date", "ship date", "posting date", "created"]),
    item: findFirstKey(keys, ["item", "itemid", "item id", "sku", "product", "part", "part number"]),
    qty: findFirstKey(keys, ["qty", "quantity", "shipped qty", "sold qty", "order qty"]),
    revenue: findFirstKey(keys, ["revenue", "sales", "amount", "extended", "ext price", "net sales", "line total", "total"]),
    order: findFirstKey(keys, ["order", "order no", "order number", "invoice", "invoice no", "document"]),
  };
}

function findFirstKey(keys, candidates) {
  const lower = keys.map(k => ({ k, l: String(k).toLowerCase().trim() }));
  for (const c of candidates) {
    const needle = String(c).toLowerCase();
    const hit = lower.find(x => x.l === needle) || lower.find(x => x.l.includes(needle));
    if (hit) return hit.k;
  }
  return null;
}

// ------------------------------
// Normalization
// ------------------------------
function normalizeSalesRows(rows, { excludePrefixes, log, useFixedSchema = true }) {
  if (!rows?.length) return [];

  // Fixed schema (your header)
  const FIXED = {
    date: "Invoice_Date",
    item: "Item_ID",
    qty: "Qty_Shipped",
    revenue: "Extd_Price",
    branch: "Branch_ID",
    customer: "customer_id",
    ship_to: "ship_to_id",
    rep: "Ship_To_Salerep_ID",
    desc: "Item_Description",
  };

  // Fallback to detection if needed (kept for safety)
  const detected = useFixedSchema ? null : detectColumns(rows[0]);
  if (!useFixedSchema) log("Detected columns", detected);

  const out = [];

  for (const r of rows) {
    const itemRaw = useFixedSchema
      ? r[FIXED.item]
      : (detected?.item ? r[detected.item] : (r.Item ?? r.SKU ?? r.item ?? r.sku));

    const item = String(itemRaw ?? "").trim();
    if (!item) continue;
    if (excludePrefixes?.length && excludePrefixes.some(p => item.startsWith(p))) continue;

    const dateStr = useFixedSchema
      ? r[FIXED.date]
      : (detected?.date ? r[detected.date] : (r.Date ?? r.date));

    const date = parseMomentDate(dateStr);
    if (!date) continue;

    const qtyVal = useFixedSchema
      ? r[FIXED.qty]
      : (detected?.qty ? r[detected.qty] : (r.Qty ?? r.qty ?? r.Quantity));

    const revenueVal = useFixedSchema
      ? r[FIXED.revenue]
      : (detected?.revenue ? r[detected.revenue] : (r.Revenue ?? r.Amount ?? r.Sales ?? r.Total));

    // Deterministic surrogate "order id" because CSV has no invoice/order number
    const branch = String(useFixedSchema ? r[FIXED.branch] : "").trim();
    const cust = String(useFixedSchema ? r[FIXED.customer] : "").trim();
    const shipTo = String(useFixedSchema ? r[FIXED.ship_to] : "").trim();

    const order_key = `${branch}|${cust}|${shipTo}|${date.format("YYYY-MM-DD")}`;

    out.push({
      item,
      item_description: useFixedSchema ? String(r[FIXED.desc] ?? "").trim() : "",
      date,
      qty: toNum(qtyVal, 0),
      revenue: toNum(revenueVal, 0),
      order_id: order_key, // used for unique order counting
    });
  }

  return out;
}


function parseMomentDate(v) {
  const s = String(v ?? "").trim();
  if (!s) return null;

  // Strict formats first (including MM/DD/YY)
  const m = window.moment(
    s,
    [
      "YYYY-MM-DD",
      "MM/DD/YYYY",
      "MM/DD/YY",      // ✅ your export format
      "DD.MM.YYYY",
      "YYYY-MM-DDTHH:mm:ss",
      window.moment.ISO_8601
    ],
    true
  );

  if (m?.isValid?.()) return m.startOf("day");

  // Fallback (non-strict)
  const m2 = window.moment(s);
  return m2?.isValid?.() ? m2.startOf("day") : null;
}


// ------------------------------
// Aggregation
// ------------------------------
function aggregateByItem(rows) {
  const map = new Map();

  for (const r of rows) {
    const key = r.item;
    if (!map.has(key)) {
      map.set(key, { item: key, revenue_3m: 0, qty_3m: 0, orders_3m: 0, _orders: new Set() });
    }
    const a = map.get(key);
    a.revenue_3m += safeNum(r.revenue);
    a.qty_3m += safeNum(r.qty);

    if (r.order_id) a._orders.add(r.order_id);
  }

  // finalize orders count
  const out = [];
  for (const v of map.values()) {
    v.orders_3m = v._orders.size;
    delete v._orders;
    out.push(v);
  }
  return out;
}

function combineNowVsLy(nowAgg, lyAgg) {
  const lyMap = new Map((lyAgg ?? []).map(x => [x.item, x]));
  const out = [];

  for (const n of nowAgg ?? []) {
    const ly = lyMap.get(n.item);
    out.push({
      item: n.item,
      revenue_3m: round2(n.revenue_3m),
      qty_3m: round2(n.qty_3m),
      orders_3m: n.orders_3m,

      revenue_3m_ly: round2(ly?.revenue_3m ?? 0),
      qty_3m_ly: round2(ly?.qty_3m ?? 0),
      orders_3m_ly: ly?.orders_3m ?? 0,
    });
  }

  // Include LY-only items? Usually not needed for “what to stock now”
  return out;
}

function computeTotals(nowAgg, lyAgg) {
  const sum = (arr, k) => round2((arr ?? []).reduce((a, r) => a + safeNum(r[k]), 0));
  const revenue_3m = sum(nowAgg, "revenue_3m");
  const revenue_3m_ly = sum(lyAgg, "revenue_3m");
  return {
    revenue_3m,
    revenue_3m_ly,
    revenue_yoy_pct: pct(revenue_3m, revenue_3m_ly),
  };
}

// ------------------------------
// Recommendation logic
// ------------------------------
function recommendStock(row, { minRevenue, minOrders, minQty }) {
  const revenueOk = safeNum(row.revenue_3m) >= minRevenue;
  const ordersOk = safeNum(row.orders_3m) >= minOrders;
  const qtyOk = safeNum(row.qty_3m) >= minQty;

  const yoyPct = Number(row.yoy_revenue_pct);
  const trendUp = Number.isFinite(yoyPct) ? yoyPct >= 0 : true;

  // Simple, explainable rules
  if (revenueOk && ordersOk && qtyOk && trendUp) return "✅ Stock";
  if ((revenueOk && (ordersOk || qtyOk)) || (ordersOk && qtyOk)) return "🟡 Consider";
  return "⛔ Do not stock";
}

// ------------------------------
// Rendering
// ------------------------------
function buildSummaryMarkdown({ ctx, totals, thresholds, sources }) {
  const srcLines = [
    `- Current year CSV: ${sources.currentLoaded ? sources.currentCsvPath : "⚠️ Missing / not loaded"}`,
    `- Last year CSV: ${sources.lastLoaded ? sources.lastYearCsvPath : "⚠️ Missing / not loaded"}`,
  ].join("\n");

  return [
    `**Window (last ${ctx.window_days} days):** ${ctx.window_start} → ${ctx.window_end}`,
    `**Same window last year:** ${ctx.window_start_ly} → ${ctx.window_end_ly}`,
    ``,
    `**Totals (window):**`,
    `- Revenue: ${formatMoney(totals.revenue_3m)} (LY: ${formatMoney(totals.revenue_3m_ly)}, YoY: ${formatPct(totals.revenue_yoy_pct)})`,
    ``,
    `**Recommendation thresholds:**`,
    `- Min revenue (window): ${formatMoney(thresholds.minRevenue)}`,
    `- Min orders (window): ${thresholds.minOrders}`,
    `- Min qty (window): ${thresholds.minQty}`,
    ``,
    `**Sources:**`,
    srcLines,
  ].join("\n");
}

function buildItemsTableMarkdown(rows) {
	  const header = [
	  "| Item | Rec | Revenue (3m) | Orders (3m) | Qty (3m) | Revenue LY | YoY Δ | YoY % | ADU | Coverage (days) | Recommended Stock |",
	  "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
	].join("\n");


  const lines = (rows ?? []).map(r => {
    const yoyAbs = safeNum(r.yoy_revenue_abs);
    const yoyPct = r.yoy_revenue_pct;
    return [
      escapePipes(r.item),
      r.recommendation,
      formatMoney(r.revenue_3m),
      String(r.orders_3m ?? 0),
      formatNum(r.qty_3m),
      formatMoney(r.revenue_3m_ly),
      formatSignedMoney(yoyAbs),
      formatPct(yoyPct),
      formatNum(r.adu),
			r.coverage_days,
			r.recommended_stock_qty,
    ].join(" | ");
  });

  return [header, ...lines.map(l => `| ${l} |`)].join("\n");
}

function buildNotesMarkdown({ csvIssues, detected }) {
  const issues = (csvIssues ?? []).filter(Boolean);
  const issueBlock = issues.length
    ? ["**Warnings:**", ...issues.map(x => `- ${x}`)].join("\n")
    : "**Warnings:** None ✅";

  const det = [
    "**Detected columns (best-effort):**",
    `- Current: ${detected?.current ? JSON.stringify(detected.current) : "—"}`,
    `- Last: ${detected?.last ? JSON.stringify(detected.last) : "—"}`,
  ].join("\n");

  return [issueBlock, "", det].join("\n");
}

// ------------------------------
// Idempotent note updates
// ------------------------------
function ensureReportMarkers(body) {
  const s = String(body ?? "");
  if (s.includes(REPORT_START) && s.includes(REPORT_END)) return s;

  // Append a default report section at the end
  return [
    s.trimEnd(),
    "",
    REPORT_START,
    "{{report_summary}}",
    "",
    "{{report_table}}",
    "",
    "{{report_notes}}",
    REPORT_END,
    "",
  ].join("\n");
}

function updateReportSection(existing, tokens) {
  const base = ensureReportMarkers(existing);

  const section = [
    REPORT_START,
    tokens.report_summary ?? "",
    "",
    tokens.report_table ?? "",
    "",
    tokens.report_notes ?? "",
    REPORT_END,
  ].join("\n");

  // Replace entire marked section
  const out = base.replace(
    new RegExp(`${escapeRegex(REPORT_START)}[\\s\\S]*?${escapeRegex(REPORT_END)}`, "m"),
    section
  );

  // Also fill lightweight tokens outside the report section (safe/common ones)
  // (If you want "strictly deterministic", keep it minimal)
  return replaceTokens(out, {
    title: tokens.title,
    date: tokens.date,
    generated_at: tokens.generated_at,
    window_days: tokens.window_days,
    window_start: tokens.window_start,
    window_end: tokens.window_end,
  });
}

// ------------------------------
// File + template helpers
// ------------------------------
async function ensureFolder(app, folderPath) {
  const parts = folderPath.split("/").filter(Boolean);
  let current = "";
  for (const p of parts) {
    current = current ? `${current}/${p}` : p;
    if (!app.vault.getAbstractFileByPath(current)) {
      await app.vault.createFolder(current);
    }
  }
}

async function safeLoadTemplate(app, templatePath) {
  const af = app.vault.getAbstractFileByPath(templatePath);
  if (!af) {
    // Fallback template (never abort just because template is missing)
    return [
      "# {{title}}",
      "",
      "_Generated: {{generated_at}}_",
      "",
      REPORT_START,
      "{{report_summary}}",
      "",
      "{{report_table}}",
      "",
      "{{report_notes}}",
      REPORT_END,
      "",
    ].join("\n");
  }
  return await app.vault.read(af);
}

function replaceTokens(content, tokens) {
  let out = String(content ?? "");
  for (const [k, v] of Object.entries(tokens ?? {})) {
    out = out.replaceAll(`{{${k}}}`, String(v ?? ""));
  }
  return out;
}

function formatFilenameWithDate(fmt, dateMoment) {
  return String(fmt).replace(/\{\{DATE:([^}]+)\}\}/g, (_, pattern) => dateMoment.format(pattern));
}

function stripExtension(name) {
  return String(name ?? "").replace(/\.[^/.]+$/, "");
}

function joinPath(folder, name) {
  return `${String(folder).replace(/\/+$/, "")}/${String(name).replace(/^\/+/, "")}`.replace(/\/{2,}/g, "/");
}

// ------------------------------
// Utilities
// ------------------------------
function str(v) {
  return String(v ?? "").trim();
}

function parseCsvList(v) {
  return String(v ?? "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

function toNum(v, fallback = 0) {
  const s0 = String(v ?? "").trim();
  if (!s0 || s0 === "-" ) return fallback;

  // Remove currency symbols and spaces
  // Support (123.45) as negative
  let s = s0.replace(/\s+/g, "");
  const isParenNeg = /^\(.*\)$/.test(s);
  s = s.replace(/[$€£]/g, "");
  s = s.replace(/[()]/g, "");
  s = s.replace(/,/g, "");

  const n = Number(s);
  if (!Number.isFinite(n)) return fallback;
  return isParenNeg ? -n : n;
}


function toInt(v, fallback = 0) {
  const n = parseInt(String(v ?? "").trim(), 10);
  return Number.isFinite(n) ? n : fallback;
}

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function round2(n) {
  const x = safeNum(n);
  return Math.round(x * 100) / 100;
}

function pct(now, ly) {
  const a = safeNum(now);
  const b = safeNum(ly);
  if (b === 0) return a === 0 ? 0 : 100; // interpret as growth from zero
  return round2(((a - b) / b) * 100);
}

function formatMoney(n) {
  const x = safeNum(n);
  // No currency symbol assumption; you can add one if you want
  return x.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatSignedMoney(n) {
  const x = safeNum(n);
  const sign = x > 0 ? "+" : "";
  return sign + formatMoney(x);
}

function formatNum(n) {
  const x = safeNum(n);
  return x.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatPct(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  const sign = x > 0 ? "+" : "";
  return `${sign}${x.toFixed(1)}%`;
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapePipes(s) {
  return String(s ?? "").replaceAll("|", "\\|");
}

function recommendStockQty(row, windowDays) {
  const adu = safeNum(row.qty_3m) / Math.max(1, windowDays);

  let coverageDays = 0;
  if (row.recommendation === "✅ Stock") coverageDays = 45;
  else if (row.recommendation === "🟡 Consider") coverageDays = 25;

  return {
    adu: round2(adu),
    coverage_days: coverageDays,
    recommended_stock_qty: Math.ceil(adu * coverageDays),
  };
}
