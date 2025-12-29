// Create Operations Daily Brief
// - Daily KPI snapshot in frontmatter
// - Demand Breakdown (total vs inventory-relevant vs excluded)
// - Inventory pressure (short/tight/coverage)
// - Value-at-Risk (VaR) based on inventory avg cost
// - Fills template tokens (no Dataview inline tags required)
// - Adds Yesterday Delta section (if yesterday brief exists)
//
// Requires: Dataview plugin enabled (dvApi.io.csv)

const SET_DAILY_FOLDER = "Daily folder";
const SET_TEMPLATE_PATH = "Template path";
const SET_OPEN_ORDERS_CSV = "Open Orders CSV path";
const SET_OPEN_PO_CSV = "Open PO CSV path";
const SET_INVENTORY_CSV = "Inventory CSV path";
const SET_FILENAME_FORMAT = "Filename format";

// Optional filters/settings
const SET_EXCLUDE_ITEM_PREFIXES = "Exclude item prefixes (CSV)";
const SET_EXCLUDE_SALES_DISPOSITIONS = "Exclude sales dispositions (CSV)";
const SET_EXCLUDE_SCHEDULED_VALUES = "Exclude scheduled values (CSV)";

module.exports = {
  entry: async (QuickAdd, settings) => {
    const { app } = QuickAdd;

    // -----------------------------
    // Read settings
    // -----------------------------
    const DAILY_FOLDER = String(settings[SET_DAILY_FOLDER] ?? "").trim();
    const TEMPLATE_PATH = String(settings[SET_TEMPLATE_PATH] ?? "").trim();
    const OPEN_ORDERS_CSV = String(settings[SET_OPEN_ORDERS_CSV] ?? "").trim();
    const OPEN_PO_CSV = String(settings[SET_OPEN_PO_CSV] ?? "").trim();
    const INVENTORY_CSV = String(settings[SET_INVENTORY_CSV] ?? "").trim();
    const FILENAME_FORMAT = String(settings[SET_FILENAME_FORMAT] ?? "").trim();

    const EXCLUDE_ITEM_PREFIXES = String(settings[SET_EXCLUDE_ITEM_PREFIXES] ?? "NIC-").trim();
    const EXCLUDE_SALES_DISPOSITIONS = String(settings[SET_EXCLUDE_SALES_DISPOSITIONS] ?? "D").trim();
    const EXCLUDE_SCHEDULED_VALUES = String(settings[SET_EXCLUDE_SCHEDULED_VALUES] ?? "Y").trim();

    if (!DAILY_FOLDER || !TEMPLATE_PATH || !OPEN_ORDERS_CSV || !OPEN_PO_CSV || !INVENTORY_CSV || !FILENAME_FORMAT) {
      new Notice("❌ Ops Daily Brief v2: Please fill in all script settings (⚙️).");
      return;
    }

    const ITEM_FILTERS = {
      excludePrefixes: EXCLUDE_ITEM_PREFIXES
        ? EXCLUDE_ITEM_PREFIXES.split(",").map(s => s.trim()).filter(Boolean)
        : [],
    };

    const ACTIVITY_FILTERS = {
      excludeSalesDispositions: EXCLUDE_SALES_DISPOSITIONS
        ? EXCLUDE_SALES_DISPOSITIONS.split(",").map(s => s.trim()).filter(Boolean)
        : [],
      excludeScheduledValues: EXCLUDE_SCHEDULED_VALUES
        ? EXCLUDE_SCHEDULED_VALUES.split(",").map(s => s.trim()).filter(Boolean)
        : [],
    };

    // -----------------------------
    // Helpers
    // -----------------------------
    const ensureFolder = async (folderPath) => {
      const parts = folderPath.split("/").filter(Boolean);
      let current = "";
      for (const p of parts) {
        current = current ? `${current}/${p}` : p;
        if (!app.vault.getAbstractFileByPath(current)) {
          await app.vault.createFolder(current);
        }
      }
    };

    const toArray = (x) => (x?.array ? x.array() : Array.from(x ?? []));

    const num = (v) => {
      const s = String(v ?? "").trim();
      if (!s) return 0;
      const n = Number(s.replace(/[$,]/g, ""));
      return Number.isFinite(n) ? n : 0;
    };

    const parseDate = (v) => {
      if (!v) return null;
      const s = String(v).trim();
      if (!s) return null;
      const m = window.moment(s, ["MM/DD/YY", "MM/DD/YYYY", "YYYY-MM-DD"], true);
      return m.isValid() ? m.startOf("day") : null;
    };

    const fmtTsd = (n) => Math.round((Number(n ?? 0)) / 1000);

    const round2 = (n) => Math.round(Number(n ?? 0) * 100) / 100;

    const passesItemFilters = (itemId) => {
      const item = String(itemId ?? "").trim();
      if (!item) return false;
      const exc = ITEM_FILTERS.excludePrefixes ?? [];
      if (exc.some((p) => item.startsWith(p))) return false;
      return true;
    };

    // Template tokens replacement: {{token}}
    const replaceTokens = (content, tokens) => {
      let out = String(content ?? "");
      for (const [k, v] of Object.entries(tokens ?? {})) {
        out = out.replaceAll(`{{${k}}}`, String(v ?? ""));
      }
      return out;
    };

    // Filename tokens: {{DATE:YYYY-MM-DD}}
    const formatFilenameWithDate = (fmt, dateMoment) => {
      return String(fmt).replace(/\{\{DATE:([^}]+)\}\}/g, (_, pattern) => dateMoment.format(pattern));
    };

    const getFrontmatter = (file) => {
      const cache = app.metadataCache.getFileCache(file);
      return cache?.frontmatter ?? null;
    };

    const deltaNumber = (todayVal, yVal, digits = 2) => {
      const a = Number(todayVal ?? 0);
      const b = Number(yVal ?? 0);
      const d = a - b;
      const p = Math.pow(10, digits);
      return Math.round(d * p) / p;
    };

    const deltaText = (todayVal, yVal) => {
      const a = Number(todayVal ?? 0);
      const b = Number(yVal ?? 0);
      const d = a - b;
      const sign = d > 0 ? "+" : "";
      return `${sign}${d}`;
    };

    const deltaStatusText = (todayStatus, yesterdayStatus) => {
      if (!yesterdayStatus) return "—";
      if (todayStatus === yesterdayStatus) return "—";
      return `${yesterdayStatus} → ${todayStatus}`;
    };

    // -----------------------------
    // Dataview API
    // -----------------------------
    const dvApi = app?.plugins?.plugins?.dataview?.api;
    if (!dvApi?.io?.csv) {
      new Notice("❌ Ops Daily Brief v2: Dataview API not available. Please enable Dataview plugin.");
      return;
    }
    const readCsv = async (path) => toArray(await dvApi.io.csv(path));

    const loadTemplate = async (path) => {
      const af = app.vault.getAbstractFileByPath(path);
      if (!af) throw new Error(`Template not found: ${path}`);
      return await app.vault.read(af);
    };

    // -----------------------------
    // Resolve date context + paths
    // -----------------------------
    const now = window.moment();
    const yesterday = now.clone().subtract(1, "day");
    const today = now.clone().startOf("day");

    const ctx = {
      date: now.format("YYYY-MM-DD"),
      week: now.format("GGGG-[W]WW"),
      month: now.format("YYYY-MM"),
    };

    const todayFileName = formatFilenameWithDate(FILENAME_FORMAT, now);
    const yesterdayFileName = formatFilenameWithDate(FILENAME_FORMAT, yesterday);

    const filePath = `${DAILY_FOLDER}/${todayFileName}`.replace(/\/{2,}/g, "/");
    const yesterdayPath = `${DAILY_FOLDER}/${yesterdayFileName}`.replace(/\/{2,}/g, "/");

    const yFile = app.vault.getAbstractFileByPath(yesterdayPath);
    const yFm = yFile ? getFrontmatter(yFile) : null;

    // -----------------------------
    // Load CSV data (once)
    // -----------------------------
    const [oo, po, inv] = await Promise.all([
      readCsv(OPEN_ORDERS_CSV),
      readCsv(OPEN_PO_CSV),
      readCsv(INVENTORY_CSV),
    ]);

    // =========================================================
    // 1) VOLUME KPIs (classic)
    // =========================================================
    const sales_open_orders = new Set(
      oo.map((r) => String(r.order_no ?? "").trim()).filter(Boolean)
    ).size;

    const sales_open_line_items = oo.length;

    const sales_due_today = oo.filter((r) => {
      const d = parseDate(r.required_date);
      return d && d.isSame(today, "day");
    }).length;

    const sales_backorders = oo.filter((r) => String(r.disposition ?? "").trim() === "B").length;

    let sales_value = 0;
    for (const r of oo) sales_value += num(r.ext_cost);

    const purchase_open_pos = new Set(
      po.map((r) => String(r.po_no ?? "").trim()).filter(Boolean)
    ).size;

    const purchase_open_po_lines = po.length;

    const purchase_due_today = po.filter((r) => {
      const d = parseDate(r.date_due) ?? parseDate(r.required_date);
      return d && d.isSame(today, "day");
    }).length;

    const purchase_past_due = po.filter((r) => {
      const d = parseDate(r.date_due) ?? parseDate(r.required_date);
      return d && d.isBefore(today, "day");
    }).length;

    const purchase_received_lines = po.filter((r) => num(r.qty_received) > 0).length;

    const purchase_suppliers = new Set(
      po.map((r) => String(r.supplier_name ?? "").trim()).filter(Boolean)
    ).size;

    let purchase_value = 0;
    for (const r of po) {
      const tc = num(r.total_cost);
      purchase_value += tc > 0 ? tc : num(r.unit_price) * num(r.unit_quantity);
    }

    // =========================================================
    // 2) DEMAND BREAKDOWN (inventory-relevant vs excluded)
    // =========================================================
    let demand_total_lines = 0;
    let demand_total_qty = 0;

    let demand_included_lines = 0;
    let demand_included_qty = 0;

    let demand_excl_dispo_lines = 0;
    let demand_excl_dispo_qty = 0;

    let demand_excl_scheduled_lines = 0;
    let demand_excl_scheduled_qty = 0;

    const demandMap = new Map(); // item_id -> sum(qty_ordered)

    for (const r of oo) {
      const item = String(r.item_id ?? "").trim();
      if (!passesItemFilters(item)) continue;

      const q = num(r.qty_ordered);
      if (!q) continue;

      demand_total_lines++;
      demand_total_qty += q;

      const dispo = String(r?.disposition ?? "").trim();
      if ((ACTIVITY_FILTERS.excludeSalesDispositions ?? []).includes(dispo)) {
        demand_excl_dispo_lines++;
        demand_excl_dispo_qty += q;
        continue;
      }

      const scheduled = String(r?.scheduled ?? "").trim();
      if ((ACTIVITY_FILTERS.excludeScheduledValues ?? []).includes(scheduled)) {
        demand_excl_scheduled_lines++;
        demand_excl_scheduled_qty += q;
        continue;
      }

      demand_included_lines++;
      demand_included_qty += q;
      demandMap.set(item, (demandMap.get(item) ?? 0) + q);
    }

    const demand_excluded_qty = (demand_total_qty - demand_included_qty);
    const demand_excluded_share_pct =
      demand_total_qty > 0 ? Math.round((demand_excluded_qty / demand_total_qty) * 1000) / 10 : 0;

    // =========================================================
    // 3) SUPPLY MAP
    // =========================================================
    const supplyMap = new Map(); // item_id -> sum(unit_quantity)
    for (const r of po) {
      const item = String(r.item_id ?? "").trim();
      if (!passesItemFilters(item)) continue;

      const q = num(r.unit_quantity);
      if (!q) continue;

      supplyMap.set(item, (supplyMap.get(item) ?? 0) + q);
    }

    // =========================================================
    // 4) INVENTORY AGG (available + avg_cost)
    // =========================================================
    const invAgg = new Map();
    for (const r of inv) {
      const item = String(r.item_id ?? "").trim();
      if (!passesItemFilters(item)) continue;

      const onHand = num(r.qty_on_hand);
      const alloc = num(r.qty_allocated);
      const avail = Math.max(0, onHand - alloc);

      const cost = num(r.moving_average_cost) || num(r.standard_cost);

      const cur = invAgg.get(item) ?? {
        item_id: item,
        item_desc: "",
        available: 0,
        _cost_sum: 0,
        _cost_weight: 0,
        avg_cost: 0,
      };

      cur.item_desc = cur.item_desc || String(r.item_desc ?? "").trim();
      cur.available += avail;

      if (cost > 0 && onHand > 0) {
        cur._cost_sum += cost * onHand;
        cur._cost_weight += onHand;
      }

      invAgg.set(item, cur);
    }

    for (const rec of invAgg.values()) {
      rec.avg_cost = rec._cost_weight > 0 ? rec._cost_sum / rec._cost_weight : 0;
      delete rec._cost_sum;
      delete rec._cost_weight;
    }

    // =========================================================
    // 5) ITEM ACTIVITY + RISK
    // =========================================================
    const items = new Set([...demandMap.keys(), ...supplyMap.keys(), ...invAgg.keys()]);
    let items_active = 0;
    let items_short = 0;
    let items_tight = 0;

    let total_available_qty = 0;
    let total_supply_qty = 0;

    let short_qty_total = 0;
    let var_value_total = 0;

    let worst_item_net_qty = null;
    let worst_item_id = "";

    for (const item of items) {
      const demand = demandMap.get(item) ?? 0;
      const supply = supplyMap.get(item) ?? 0;
      const invRec = invAgg.get(item) ?? { available: 0, avg_cost: 0 };

      if (demand <= 0 && supply <= 0) continue;
      items_active++;

      total_available_qty += invRec.available;
      total_supply_qty += supply;

      const net = invRec.available + supply - demand;

      if (worst_item_net_qty === null || net < worst_item_net_qty) {
        worst_item_net_qty = net;
        worst_item_id = item;
      }

      if (demand > 0 && net < 0) items_short++;
      else if (demand > 0 && net <= Math.max(1, demand * 0.1)) items_tight++;

      const short_qty = Math.max(0, demand - (invRec.available + supply));
      short_qty_total += short_qty;
      var_value_total += short_qty * (invRec.avg_cost ?? 0);
    }

    const coverage_ratio =
      demand_included_qty > 0 ? (total_available_qty + total_supply_qty) / demand_included_qty : 0;
    const coverage_ratio_pct = demand_included_qty > 0 ? Math.round(coverage_ratio * 1000) / 10 : 0;

    // =========================================================
    // 6) TRAFFIC LIGHT (ampel)
    // =========================================================
    let overall_status = "green";
    let overall_text = "🟢 Green - stable coverage";

    if (items_short > 0 || coverage_ratio < 1) {
      overall_status = "red";
      overall_text = "🔴 Red - shortage risk (short items and/or coverage < 100%)";
    } else if (items_tight > 0 || coverage_ratio < 1.1) {
      overall_status = "yellow";
      overall_text = "🟡 Yellow - tight buffers (watchlist)";
    }

    // =========================================================
    // Yesterday deltas (based on yesterday frontmatter)
    // =========================================================
    const today_value_at_risk_tsd = fmtTsd(var_value_total);
    const today_short_qty_total = round2(short_qty_total);
    const today_demand_inv_qty = round2(demand_included_qty);

    const delta_tokens = {
      delta_status_text: deltaStatusText(overall_status, yFm?.overall_status),
      delta_coverage_ratio_pct: yFm ? deltaNumber(coverage_ratio_pct, yFm.coverage_ratio_pct, 1) : "—",
      delta_items_short: yFm ? deltaText(items_short, yFm.items_short) : "—",
      delta_items_tight: yFm ? deltaText(items_tight, yFm.items_tight) : "—",
      delta_items_active: yFm ? deltaText(items_active, yFm.items_active) : "—",
      delta_value_at_risk_tsd: yFm ? deltaNumber(today_value_at_risk_tsd, yFm.value_at_risk_tsd, 0) : "—",
      delta_short_qty_total: yFm ? deltaNumber(today_short_qty_total, yFm.short_qty_total, 2) : "—",
      delta_demand_inventory_relevant_qty: yFm ? deltaNumber(today_demand_inv_qty, yFm.demand_inventory_relevant_qty, 2) : "—",
    };

    // =========================================================
    // Create or open file
    // =========================================================
    await ensureFolder(DAILY_FOLDER);

    let file = app.vault.getAbstractFileByPath(filePath);
    if (!file) {
      let body = await loadTemplate(TEMPLATE_PATH);

      const tokens = {
        date: ctx.date,
        week: ctx.week,
        month: ctx.month,
        generated_at: window.moment().toISOString(),

        overall_status_text: overall_text,
        coverage_ratio_pct,
        items_short,
        items_tight,
        items_active,

        value_at_risk_tsd: today_value_at_risk_tsd,
        short_qty_total: today_short_qty_total,
        worst_item_id,
        worst_item_net_qty: worst_item_net_qty === null ? 0 : round2(worst_item_net_qty),

        demand_total_qty: round2(demand_total_qty),
        demand_total_lines,
        demand_inventory_relevant_qty: today_demand_inv_qty,
        demand_inventory_relevant_lines: demand_included_lines,

        demand_excluded_direct_ship_qty: round2(demand_excl_dispo_qty),
        demand_excluded_direct_ship_lines: demand_excl_dispo_lines,
        demand_excluded_scheduled_qty: round2(demand_excl_scheduled_qty),
        demand_excluded_scheduled_lines: demand_excl_scheduled_lines,
        demand_excluded_share_pct,

        ...delta_tokens,
      };

      body = replaceTokens(body, tokens);
      file = await app.vault.create(filePath, body);
    }

    // =========================================================
    // Write frontmatter snapshot (incl. deltas)
    // =========================================================
    await app.fileManager.processFrontMatter(file, (fm) => {
      fm.type = "OperationsDailyBrief";
      fm.version = "v2";
      fm.date = ctx.date;
      fm.week = ctx.week;
      fm.month = ctx.month;

      // --- Status / Ampel ---
      fm.overall_status = overall_status;     // green | yellow | red
      fm.overall_status_text = overall_text;  // emoji + sentence

      // --- Sales (Volume) ---
      fm.sales_open_orders = sales_open_orders;
      fm.sales_open_line_items = sales_open_line_items;
      fm.sales_due_today = sales_due_today;
      fm.sales_backorders = sales_backorders;
      fm.sales_value_tsd = fmtTsd(sales_value);

      // --- Purchase / PO (Volume) ---
      fm.po_open_pos = purchase_open_pos;
      fm.po_open_po_lines = purchase_open_po_lines;
      fm.po_due_today = purchase_due_today;
      fm.po_past_due = purchase_past_due;
      fm.po_received_lines = purchase_received_lines;
      fm.po_suppliers = purchase_suppliers;
      fm.po_value_tsd = fmtTsd(purchase_value);

      // --- Demand breakdown (pressure) ---
      fm.demand_total_lines = demand_total_lines;
      fm.demand_total_qty = round2(demand_total_qty);

      fm.demand_inventory_relevant_lines = demand_included_lines;
      fm.demand_inventory_relevant_qty = round2(demand_included_qty);

      fm.demand_excluded_direct_ship_lines = demand_excl_dispo_lines;
      fm.demand_excluded_direct_ship_qty = round2(demand_excl_dispo_qty);

      fm.demand_excluded_scheduled_lines = demand_excl_scheduled_lines;
      fm.demand_excluded_scheduled_qty = round2(demand_excl_scheduled_qty);

      fm.demand_excluded_share_pct = demand_excluded_share_pct;

      // --- Inventory pressure & risk ---
      fm.items_active = items_active;
      fm.items_short = items_short;
      fm.items_tight = items_tight;

      fm.coverage_ratio_pct = coverage_ratio_pct;

      fm.short_qty_total = today_short_qty_total;
      fm.value_at_risk_tsd = today_value_at_risk_tsd;

      fm.worst_item_net_qty = worst_item_net_qty === null ? 0 : round2(worst_item_net_qty);
      fm.worst_item_id = worst_item_id;

      // --- Yesterday delta (stored too) ---
      fm.delta_status_text = delta_tokens.delta_status_text;
      fm.delta_coverage_ratio_pct = delta_tokens.delta_coverage_ratio_pct;
      fm.delta_items_short = delta_tokens.delta_items_short;
      fm.delta_items_tight = delta_tokens.delta_items_tight;
      fm.delta_items_active = delta_tokens.delta_items_active;
      fm.delta_value_at_risk_tsd = delta_tokens.delta_value_at_risk_tsd;
      fm.delta_short_qty_total = delta_tokens.delta_short_qty_total;
      fm.delta_demand_inventory_relevant_qty = delta_tokens.delta_demand_inventory_relevant_qty;

      // --- Filters & meta (traceability) ---
      fm.filter_exclude_item_prefixes = (ITEM_FILTERS.excludePrefixes ?? []).join(", ");
      fm.filter_exclude_sales_dispositions = (ACTIVITY_FILTERS.excludeSalesDispositions ?? []).join(", ");
      fm.filter_exclude_scheduled_values = (ACTIVITY_FILTERS.excludeScheduledValues ?? []).join(", ");

      fm.generated_at = window.moment().toISOString();
      fm.source_open_orders_csv = OPEN_ORDERS_CSV;
      fm.source_open_po_csv = OPEN_PO_CSV;
      fm.source_inventory_csv = INVENTORY_CSV;
      fm.yesterday_brief_path = yFile ? yesterdayPath : "";
    });

    // Open file
    await app.workspace.getLeaf(true).openFile(file);
    new Notice(`✅ Ops Daily Brief vady: ${todayFileName}`);
  },

  settings: {
    name: "Create Operations Daily Brief",
    author: "Luis Mendez",
    options: {
      [SET_DAILY_FOLDER]: {
        type: "text",
        defaultValue: "02 - Areas/Operations/Daily Briefs",
        placeholder: "02 - Areas/Operations/Daily Briefs",
        description: "Folder where daily brief notes will be created.",
      },
      [SET_TEMPLATE_PATH]: {
        type: "text",
        defaultValue: "03 - Resources/Templates/Operations Daily Brief.md",
        placeholder: "03 - Resources/Templates/Operations Daily Brief.md",
        description: "Template body (tokens like {{date}}, {{overall_status_text}}, {{delta_*}} will be filled).",
      },
      [SET_OPEN_ORDERS_CSV]: {
        type: "text",
        defaultValue: "03 - Resources/Reports/Open Orders.csv",
        placeholder: "03 - Resources/Reports/Open Orders.csv",
        description: "CSV path for open sales order lines.",
      },
      [SET_OPEN_PO_CSV]: {
        type: "text",
        defaultValue: "03 - Resources/Reports/Open PO Report.csv",
       placeholder: "03 - Resources/Reports/Open PO Report.csv",
        description: "CSV path for open purchase order lines.",
      },
      [SET_INVENTORY_CSV]: {
        type: "text",
        defaultValue: "03 - Resources/Reports/Inventory Value by Location (Detailed).csv",
        placeholder: "03 - Resources/Reports/Inventory Value by Location (Detailed).csv",
        description: "CSV path for inventory report.",
      },
      [SET_FILENAME_FORMAT]: {
        type: "text",
        defaultValue: "{{DATE:YYYY-MM-DD}} - Operations Daily Brief.md",
        placeholder: "{{DATE:YYYY-MM-DD}} - Operations Daily Brief.md",
        description: "Filename format with {{DATE:...}} token.",
      },

      // Filters
      [SET_EXCLUDE_ITEM_PREFIXES]: {
        type: "text",
        defaultValue: "NIC-",
        placeholder: "NIC-,TMP-",
        description: "Comma-separated item_id prefixes to exclude from the snapshot.",
      },
      [SET_EXCLUDE_SALES_DISPOSITIONS]: {
        type: "text",
        defaultValue: "D",
        placeholder: "D",
        description: "Comma-separated dispositions excluded from inventory demand (e.g., D=Direct Ship).",
      },
      [SET_EXCLUDE_SCHEDULED_VALUES]: {
        type: "text",
        defaultValue: "Y",
        placeholder: "Y",
        description: "Comma-separated scheduled flags excluded from inventory demand (e.g., Y).",
      },
    },
  },
};
