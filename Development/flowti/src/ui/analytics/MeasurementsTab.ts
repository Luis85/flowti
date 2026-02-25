/**
 * Measurements tab — master/detail split for measurement management.
 *
 * Master panel: measurement list with name, type badge, source query, favorites.
 * Detail panel: rich measurement detail with editable fields, format config,
 * dashboard usage, and quick actions.
 */

import { setIcon } from "obsidian";
import type {
	Measurement,
	MeasurementType,
	NumberDisplayFormat,
	NumberFormatStyle,
} from "../../domain/analytics/types";
import type { AnalyticsHubDeps } from "./types";

const FORMAT_STYLES: Array<{ id: NumberFormatStyle; label: string; description: string }> = [
	{ id: "plain", label: "Plain", description: "No formatting" },
	{ id: "currency", label: "Currency", description: "With symbol" },
	{ id: "percent", label: "Percent", description: "Multiply by 100" },
];

type MeasurementSortKey = "name" | "type" | "updated";

export class MeasurementsTab {
	private sortKey: MeasurementSortKey = "name";

	constructor(
		private masterEl: HTMLElement,
		private detailEl: HTMLElement,
		private deps: AnalyticsHubDeps,
	) {}

	// ── Master panel ─────────────────────────────────────────

	renderMaster(): void {
		this.masterEl.empty();

		const state = this.deps.getState();

		// Consume pending entity ID from cross-tab navigation
		if (state.pendingEntityId) {
			this.deps.setState({ selectedMeasurementId: state.pendingEntityId, pendingEntityId: null });
		}

		let measurements = state.measurements ?? [];
		if (state.filterText) {
			measurements = measurements.filter((m) =>
				m.name.toLowerCase().includes(state.filterText.toLowerCase()) ||
				(m.description ?? "").toLowerCase().includes(state.filterText.toLowerCase()),
			);
		}

		// Sort: favorites first, then by selected key
		measurements = [...measurements].sort((a, b) => {
			if (a.isFavorite && !b.isFavorite) return -1;
			if (!a.isFavorite && b.isFavorite) return 1;
			if (this.sortKey === "type") return a.type.localeCompare(b.type);
			if (this.sortKey === "updated") return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
			return a.name.localeCompare(b.name);
		});

		// Header
		const header = this.masterEl.createDiv({ cls: "ft-master-category-header" });
		header.createSpan({ text: "Measurements" });
		header.createSpan({ text: `${measurements.length}`, cls: "ft-master-category-count" });
		const spacer = header.createDiv();
		spacer.addClass("ft-flex-1");

		// Sort dropdown
		const sortSelect = header.createEl("select", { cls: "ft-text-xs" });
		sortSelect.style.cssText = "padding:1px 4px;border-radius:4px;border:1px solid var(--background-modifier-border);background:var(--background-primary);cursor:pointer;font-size:var(--font-ui-smaller)";
		for (const opt of [{ v: "name", l: "Name" }, { v: "type", l: "Type" }, { v: "updated", l: "Updated" }]) {
			const o = sortSelect.createEl("option");
			o.value = opt.v;
			o.textContent = opt.l;
			if (opt.v === this.sortKey) o.selected = true;
		}
		sortSelect.addEventListener("change", () => {
			this.sortKey = sortSelect.value as MeasurementSortKey;
			this.renderMaster();
		});

		const addBtn = header.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		const addIcon = addBtn.createSpan();
		setIcon(addIcon, "plus");
		addBtn.setAttribute("aria-label", "Create Measurement");
		addBtn.addEventListener("click", () => {
			this.showCreateForm();
		});

		if (measurements.length === 0) {
			const empty = this.masterEl.createDiv({ cls: "ft-text-muted ft-p-3 ft-text-center ft-text-sm" });
			empty.textContent = state.filterText
				? "No matching measurements"
				: "No measurements yet. Save a query to auto-create measurements.";
			return;
		}

		// List
		for (const m of measurements) {
			const item = this.masterEl.createDiv({ cls: "ft-master-event-item" });
			if (m.id === state.selectedMeasurementId) item.addClass("is-active");

			// Star
			const star = item.createSpan({ cls: "ft-nav-link" });
			star.style.flexShrink = "0";
			const starIcon = star.createSpan();
			setIcon(starIcon, "star");
			starIcon.style.opacity = m.isFavorite ? "1" : "0.3";
			starIcon.style.width = "14px";
			starIcon.style.height = "14px";
			star.addEventListener("click", (e) => {
				e.stopPropagation();
				void this.deps.analyticsService.toggleMeasurementFavorite(m.id);
			});

			// Icon + name
			const icon = item.createSpan();
			setIcon(icon, "ruler");
			icon.style.width = "14px";
			icon.style.height = "14px";
			icon.style.flexShrink = "0";

			const textBlock = item.createDiv({ cls: "ft-master-event-name" });
			textBlock.style.minWidth = "0";
			textBlock.createDiv({ text: m.name });

			// Type badge + query name
			const meta = textBlock.createDiv({ cls: "ft-text-muted ft-text-sm" });
			meta.style.display = "flex";
			meta.style.gap = "4px";
			meta.style.alignItems = "center";

			const typeBadge = meta.createSpan({ cls: "ft-tag" });
			typeBadge.textContent = m.type;
			typeBadge.style.fontSize = "10px";

			const query = this.deps.analyticsService.getQuery(m.queryId);
			if (query) {
				meta.createSpan({ text: query.name, cls: "ft-text-muted" });
			} else {
				const orphan = meta.createSpan({ text: "Query not found", cls: "ft-text-muted" });
				orphan.style.color = "var(--text-error)";
			}

			item.addEventListener("click", () => {
				this.deps.setState({ selectedMeasurementId: m.id });
				this.deps.scheduleRender();
			});
		}
	}

	// ── Detail panel ─────────────────────────────────────────

	renderDetail(): void {
		const scrollParent = this.detailEl.parentElement;
		const scrollTop = scrollParent?.scrollTop ?? 0;

		this.detailEl.empty();

		const state = this.deps.getState();
		if (!state.selectedMeasurementId) {
			const empty = this.detailEl.createDiv({ cls: "ft-text-muted ft-p-3 ft-text-center ft-text-sm" });
			const emptyIcon = empty.createDiv();
			setIcon(emptyIcon, "ruler");
			emptyIcon.style.cssText = "opacity:0.3;margin-bottom:0.5rem";
			empty.createDiv({ text: "Select a measurement to view details" });
			return;
		}

		const measurement = this.deps.analyticsService.getMeasurement(state.selectedMeasurementId);
		if (!measurement) {
			const empty = this.detailEl.createDiv({ cls: "ft-text-muted ft-p-3 ft-text-center ft-text-sm" });
			empty.textContent = "Measurement not found";
			return;
		}

		this.renderMeasurementDetail(measurement);

		if (scrollParent && scrollTop > 0) {
			requestAnimationFrame(() => { scrollParent.scrollTop = scrollTop; });
		}
	}

	private renderMeasurementDetail(m: Measurement): void {
		const query = this.deps.analyticsService.getQuery(m.queryId);

		// ── Header card ─────────────────────────────
		const headerCard = this.detailEl.createDiv({ cls: "ft-card" });

		const nameRow = headerCard.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const rulerIcon = nameRow.createSpan();
		setIcon(rulerIcon, "ruler");
		rulerIcon.style.cssText = "width:18px;height:18px;opacity:0.6;flex-shrink:0";

		const nameInput = nameRow.createEl("input", { type: "text" });
		nameInput.style.cssText = "flex:1;padding:4px 8px;border:1px solid var(--background-modifier-border);border-radius:4px;background:var(--background-primary);font-weight:600;font-size:var(--font-ui-medium)";
		nameInput.value = m.name;
		nameInput.addEventListener("change", () => {
			const val = nameInput.value.trim();
			if (val && val !== m.name) {
				void this.deps.analyticsService.updateMeasurement(m.id, { name: val });
			}
		});

		// Type + favorite toggle
		const typeBadge = nameRow.createSpan({ cls: "ft-tag" });
		typeBadge.textContent = m.type === "single" ? "Single" : "Series";

		const favBtn = nameRow.createEl("span", { cls: "ft-nav-link" });
		favBtn.style.flexShrink = "0";
		const favIcon = favBtn.createSpan();
		setIcon(favIcon, "star");
		favIcon.style.cssText = `width:14px;height:14px;${m.isFavorite ? "color:var(--text-accent)" : "opacity:0.3"}`;
		favBtn.title = m.isFavorite ? "Remove from favorites" : "Add to favorites";
		favBtn.addEventListener("click", () => {
			void this.deps.analyticsService.toggleMeasurementFavorite(m.id);
		});

		// Description
		const descInput = headerCard.createEl("textarea", { cls: "ft-text-sm" });
		descInput.style.cssText = "width:100%;padding:4px 8px;border:1px solid var(--background-modifier-border);border-radius:4px;background:var(--background-primary);min-height:40px;resize:vertical;margin-top:0.5rem";
		descInput.value = m.description ?? "";
		descInput.placeholder = "Describe what this measurement tracks...";
		descInput.addEventListener("change", () => {
			void this.deps.analyticsService.updateMeasurement(m.id, { description: descInput.value.trim() || undefined });
		});

		// ── Source Query section ─────────────────────
		const sourceCard = this.detailEl.createDiv({ cls: "ft-card ft-mt-2" });
		const sourceHeader = sourceCard.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const srcIcon = sourceHeader.createSpan();
		setIcon(srcIcon, "search");
		srcIcon.style.cssText = "width:14px;height:14px;opacity:0.6";
		sourceHeader.createSpan({ text: "Source Query", cls: "ft-text-sm" }).style.fontWeight = "500";

		// Warning callout for missing query
		if (!query) {
			const warning = sourceCard.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-text-xs" });
			warning.style.cssText = "padding:0.35rem 0.5rem;margin-top:0.35rem;border-radius:4px;background:var(--background-modifier-error);color:var(--text-error)";
			const warnIcon = warning.createSpan();
			setIcon(warnIcon, "alert-triangle");
			warnIcon.style.cssText = "width:14px;height:14px;flex-shrink:0";
			warning.createSpan({ text: "Source query has been deleted. Select a replacement or delete this measurement." });
		}

		const queries = this.deps.getState().queries;
		const querySelect = sourceCard.createEl("select");
		querySelect.style.cssText = "width:100%;padding:4px 8px;border:1px solid var(--background-modifier-border);border-radius:4px;background:var(--background-primary);margin-top:0.35rem";
		for (const q of queries) {
			const opt = querySelect.createEl("option");
			opt.value = q.id;
			opt.textContent = q.name;
			if (q.id === m.queryId) opt.selected = true;
		}
		if (!queries.some((q) => q.id === m.queryId)) {
			const missing = querySelect.createEl("option");
			missing.value = m.queryId;
			missing.textContent = "Query not found";
			missing.selected = true;
			missing.style.color = "var(--text-error)";
		}
		querySelect.addEventListener("change", () => {
			void this.deps.analyticsService.updateMeasurement(m.id, { queryId: querySelect.value }).then(() => {
				this.deps.scheduleRender();
			});
		});

		// Query info row
		if (query) {
			const infoRow = sourceCard.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mt-1" });
			infoRow.style.flexWrap = "wrap";

			// Source files
			if (query.sources.length > 0) {
				for (const src of query.sources) {
					const badge = infoRow.createSpan({
						text: src.csvPath.split("/").pop() ?? src.csvPath,
						cls: "ft-badge ft-badge-muted",
					});
					badge.style.fontSize = "0.65rem";
				}
			}

			// Measure count
			infoRow.createSpan({ text: `${query.measures.length} measures`, cls: "ft-text-xs ft-text-muted" });

			// Navigate link
			const navLink = infoRow.createEl("span", { text: "Open query", cls: "ft-nav-link ft-text-xs" });
			navLink.style.marginLeft = "auto";
			navLink.addEventListener("click", () => {
				this.deps.navigation.navigateToTab("queries", m.queryId);
			});
		}

		// ── Measure Column section ──────────────────
		const colCard = this.detailEl.createDiv({ cls: "ft-card ft-mt-2" });
		const colHeader = colCard.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const colIcon = colHeader.createSpan();
		setIcon(colIcon, "columns-3");
		colIcon.style.cssText = "width:14px;height:14px;opacity:0.6";
		colHeader.createSpan({ text: "Measure Column", cls: "ft-text-sm" }).style.fontWeight = "500";

		// Populate column picker from query measures
		const colSelect = colCard.createEl("select");
		colSelect.style.cssText = "width:100%;padding:4px 8px;border:1px solid var(--background-modifier-border);border-radius:4px;background:var(--background-primary);margin-top:0.35rem";

		const noneOpt = colSelect.createEl("option");
		noneOpt.value = "";
		noneOpt.textContent = "Full query result (all measures)";
		if (!m.measureColumn) noneOpt.selected = true;

		if (query) {
			for (const measure of query.measures) {
				const label = measure.label ?? `${measure.function}(${measure.column})`;
				const opt = colSelect.createEl("option");
				opt.value = label;
				opt.textContent = label;
				if (m.measureColumn === label) opt.selected = true;
			}
		}

		colSelect.addEventListener("change", () => {
			void this.deps.analyticsService.updateMeasurement(m.id, {
				measureColumn: colSelect.value || undefined,
			});
		});

		colCard.createDiv({
			text: m.measureColumn
				? "Extracts a single value from the query result."
				: "Uses the full query result with all measures.",
			cls: "ft-text-xs ft-text-muted",
		}).style.marginTop = "0.25rem";

		// ── Type section ────────────────────────────
		const typeCard = this.detailEl.createDiv({ cls: "ft-card ft-mt-2" });
		const typeHeader = typeCard.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const typeIcon = typeHeader.createSpan();
		setIcon(typeIcon, "activity");
		typeIcon.style.cssText = "width:14px;height:14px;opacity:0.6";
		typeHeader.createSpan({ text: "Measurement Type", cls: "ft-text-sm" }).style.fontWeight = "500";

		const typeRow = typeCard.createDiv({ cls: "ft-flex ft-gap-2 ft-mt-1" });
		for (const t of [{ id: "single" as MeasurementType, label: "Single Value", icon: "hash", desc: "One metric (e.g., Total Revenue)" }, { id: "series" as MeasurementType, label: "Time Series", icon: "trending-up", desc: "Values over time periods" }]) {
			const btn = typeRow.createDiv({ cls: `ft-toggle-btn${m.type === t.id ? " is-active" : ""}` });
			btn.style.cssText = "flex:1;padding:0.5rem;border-radius:6px;text-align:center";
			btn.addEventListener("click", () => {
				if (m.type !== t.id) {
					void this.deps.analyticsService.updateMeasurement(m.id, { type: t.id }).then(() => {
						this.deps.scheduleRender();
					});
				}
			});

			const btnIcon = btn.createDiv();
			const iconSpan = btnIcon.createSpan();
			setIcon(iconSpan, t.icon);
			iconSpan.style.cssText = `width:16px;height:16px;${m.type === t.id ? "" : "opacity:0.5"}`;
			btn.createDiv({ text: t.label, cls: "ft-text-xs" }).style.fontWeight = "500";
			btn.createDiv({ text: t.desc, cls: "ft-text-xs" }).style.cssText = "opacity:0.7;line-height:1.2";
		}

		// ── Display Format section ──────────────────
		this.renderDisplayFormat(m);

		// ── Dashboard Usage section ──────────────────
		this.renderDashboardUsage(m);

		// ── Metadata + Actions ───────────────────────
		const metaCard = this.detailEl.createDiv({ cls: "ft-card ft-mt-2" });

		// Timestamps
		const timestamps = metaCard.createDiv({ cls: "ft-flex ft-gap-2 ft-text-xs ft-text-muted" });
		timestamps.createSpan({ text: `Created: ${new Date(m.createdAt).toLocaleDateString()}` });
		timestamps.createSpan({ text: `Updated: ${new Date(m.updatedAt).toLocaleDateString()}` });

		// Actions
		const actions = metaCard.createDiv({ cls: "ft-detail-actions ft-mt-2" });

		// Add to Dashboard
		const addDashBtn = actions.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		const addDashIcon = addDashBtn.createSpan();
		setIcon(addDashIcon, "layout-dashboard");
		addDashBtn.appendText(" Add to Dashboard");
		addDashBtn.addEventListener("click", () => {
			this.showDashboardPicker(m);
		});

		// Delete
		const delBtn = actions.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		delBtn.style.color = "var(--text-error)";
		const delIcon = delBtn.createSpan();
		setIcon(delIcon, "trash-2");
		delBtn.appendText(" Delete");
		delBtn.addEventListener("click", () => {
			void this.deps.analyticsService.deleteMeasurement(m.id).then(() => {
				this.deps.setState({ selectedMeasurementId: null });
				this.deps.scheduleRender();
			});
		});
	}

	private renderDisplayFormat(m: Measurement): void {
		const card = this.detailEl.createDiv({ cls: "ft-card ft-mt-2" });
		const header = card.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const headerIcon = header.createSpan();
		setIcon(headerIcon, "palette");
		headerIcon.style.cssText = "width:14px;height:14px;opacity:0.6";
		header.createSpan({ text: "Display Format", cls: "ft-text-sm" }).style.fontWeight = "500";

		const fmt = m.displayFormat ?? { style: "plain" as NumberFormatStyle };

		// Style selector
		const styleRow = card.createDiv({ cls: "ft-flex ft-gap-2 ft-mt-1" });
		for (const fs of FORMAT_STYLES) {
			const btn = styleRow.createDiv({ cls: `ft-toggle-btn${fmt.style === fs.id ? " is-active" : ""}` });
			btn.style.cssText = "flex:1;padding:0.35rem;text-align:center";
			btn.textContent = fs.label;
			btn.title = fs.description;
			btn.addEventListener("click", () => {
				const update: NumberDisplayFormat = { ...fmt, style: fs.id };
				if (fs.id === "currency" && !update.symbol) update.symbol = "$";
				void this.deps.analyticsService.updateMeasurement(m.id, { displayFormat: update }).then(() => {
					this.deps.scheduleRender();
				});
			});
		}

		// Currency symbol (visible for currency style)
		if (fmt.style === "currency") {
			const symRow = card.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mt-1" });
			symRow.createSpan({ text: "Symbol:", cls: "ft-text-xs ft-text-muted" });
			const symInput = symRow.createEl("input", { type: "text" });
			symInput.style.cssText = "padding:2px 4px;border-radius:4px;border:1px solid var(--background-modifier-border);background:var(--background-primary);width:40px;text-align:center";
			symInput.value = fmt.symbol ?? "$";
			symInput.addEventListener("change", () => {
				void this.deps.analyticsService.updateMeasurement(m.id, {
					displayFormat: { ...fmt, symbol: symInput.value.trim() || "$" },
				});
			});
		}

		// Decimals
		const decRow = card.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mt-1" });
		decRow.createSpan({ text: "Decimal places:", cls: "ft-text-xs ft-text-muted" });
		const decSelect = decRow.createEl("select");
		decSelect.style.cssText = "padding:2px 6px;font-size:var(--font-ui-small);background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:4px";
		for (const d of [{ v: "", label: "Auto" }, { v: "0", label: "0" }, { v: "1", label: "1" }, { v: "2", label: "2" }, { v: "3", label: "3" }]) {
			const opt = decSelect.createEl("option");
			opt.value = d.v;
			opt.textContent = d.label;
			if ((fmt.decimals === undefined && d.v === "") || String(fmt.decimals) === d.v) opt.selected = true;
		}
		decSelect.addEventListener("change", () => {
			const val = decSelect.value === "" ? undefined : parseInt(decSelect.value, 10);
			void this.deps.analyticsService.updateMeasurement(m.id, {
				displayFormat: { ...fmt, decimals: val },
			});
		});
	}

	private renderDashboardUsage(m: Measurement): void {
		const dashboards = this.deps.getState().dashboards;
		const usages: Array<{ dashName: string; tileTitle: string; dashId: string }> = [];

		for (const dash of dashboards) {
			for (const tile of dash.tiles) {
				if (tile.measurementId === m.id) {
					usages.push({
						dashName: dash.name,
						tileTitle: tile.title ?? "Untitled tile",
						dashId: dash.id,
					});
				}
			}
		}

		if (usages.length === 0) return;

		const card = this.detailEl.createDiv({ cls: "ft-card ft-mt-2" });
		const header = card.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const headerIcon = header.createSpan();
		setIcon(headerIcon, "layout-dashboard");
		headerIcon.style.cssText = "width:14px;height:14px;opacity:0.6";
		header.createSpan({ text: "Used in Dashboards", cls: "ft-text-sm" }).style.fontWeight = "500";
		header.createSpan({ text: `${usages.length}`, cls: "ft-badge ft-badge-muted" });

		for (const usage of usages) {
			const row = card.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
			row.style.cssText = "padding:0.25rem 0;border-bottom:1px solid var(--background-modifier-border)";

			const dashIcon = row.createSpan();
			setIcon(dashIcon, "grid-3x3");
			dashIcon.style.cssText = "width:12px;height:12px;opacity:0.5";

			const link = row.createEl("span", { text: usage.dashName, cls: "ft-nav-link ft-text-xs" });
			link.addEventListener("click", () => {
				this.deps.navigation.navigateToTab("dashboards", usage.dashId);
			});

			row.createSpan({ text: usage.tileTitle, cls: "ft-text-xs ft-text-muted" }).style.marginLeft = "auto";
		}
	}

	private showDashboardPicker(m: Measurement): void {
		const dashboards = this.deps.getState().dashboards;
		if (dashboards.length === 0) return;

		// Simple: add to first dashboard (could be enhanced with a picker modal)
		const dash = dashboards[0];
		void this.deps.analyticsService.addTile(dash.id, m.queryId, "stat-card").then(async (tile) => {
			if (tile) {
				await this.deps.analyticsService.updateTile(dash.id, tile.id, {
					measurementId: m.id,
					title: m.name,
				});
			}
			this.deps.scheduleRender();
		});
	}

	// ── Create measurement form ──────────────────────────────

	private showCreateForm(): void {
		this.detailEl.empty();
		const state = this.deps.getState();
		const queries = state.queries;

		if (queries.length === 0) {
			const empty = this.detailEl.createDiv({ cls: "ft-text-muted ft-p-3 ft-text-center ft-text-sm" });
			empty.textContent = "No queries available. Create a query first.";
			return;
		}

		const card = this.detailEl.createDiv({ cls: "ft-card" });

		// Header
		const headerRow = card.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const headerIcon = headerRow.createSpan();
		setIcon(headerIcon, "plus-square");
		headerIcon.style.cssText = "width:16px;height:16px;opacity:0.6";
		headerRow.createSpan({ text: "New Measurement", cls: "ft-text-sm" }).style.fontWeight = "600";

		// Name
		const nameRow = card.createDiv({ cls: "ft-mt-2" });
		nameRow.createDiv({ text: "Name", cls: "ft-text-xs ft-text-muted" });
		const nameInput = nameRow.createEl("input", { type: "text" });
		nameInput.style.cssText = "width:100%;padding:4px 8px;border:1px solid var(--background-modifier-border);border-radius:4px;background:var(--background-primary);margin-top:0.25rem";
		nameInput.placeholder = "e.g., Total Revenue";

		// Query picker
		const queryRow = card.createDiv({ cls: "ft-mt-2" });
		queryRow.createDiv({ text: "Source Query", cls: "ft-text-xs ft-text-muted" });
		const querySelect = queryRow.createEl("select");
		querySelect.style.cssText = "width:100%;padding:4px 8px;border:1px solid var(--background-modifier-border);border-radius:4px;background:var(--background-primary);margin-top:0.25rem";
		for (const q of queries) {
			const opt = querySelect.createEl("option");
			opt.value = q.id;
			opt.textContent = q.name;
		}

		// Column picker (populated from selected query's measures)
		const colRow = card.createDiv({ cls: "ft-mt-2" });
		colRow.createDiv({ text: "Measure Column", cls: "ft-text-xs ft-text-muted" });
		const colSelect = colRow.createEl("select");
		colSelect.style.cssText = "width:100%;padding:4px 8px;border:1px solid var(--background-modifier-border);border-radius:4px;background:var(--background-primary);margin-top:0.25rem";

		const populateColumns = () => {
			colSelect.empty();
			const noneOpt = colSelect.createEl("option");
			noneOpt.value = "";
			noneOpt.textContent = "Full query result (all measures)";
			const q = queries.find((qq) => qq.id === querySelect.value);
			if (q) {
				for (const measure of q.measures) {
					const label = measure.label ?? `${measure.function}(${measure.column})`;
					const opt = colSelect.createEl("option");
					opt.value = label;
					opt.textContent = label;
				}
			}
		};
		populateColumns();
		querySelect.addEventListener("change", () => {
			populateColumns();
			// Auto-fill name from measure label
			if (!nameInput.value.trim() && colSelect.value) {
				nameInput.value = colSelect.value;
			}
		});
		colSelect.addEventListener("change", () => {
			// Auto-fill name from measure label
			if (!nameInput.value.trim() && colSelect.value) {
				nameInput.value = colSelect.value;
			}
		});

		// Type
		const typeRow = card.createDiv({ cls: "ft-mt-2" });
		typeRow.createDiv({ text: "Type", cls: "ft-text-xs ft-text-muted" });
		const typeSelectRow = typeRow.createDiv({ cls: "ft-flex ft-gap-2 ft-mt-1" });
		let selectedType: MeasurementType = "single";

		const typeButtons: HTMLElement[] = [];
		for (const t of [{ id: "single" as MeasurementType, label: "Single Value", icon: "hash" }, { id: "series" as MeasurementType, label: "Time Series", icon: "trending-up" }]) {
			const btn = typeSelectRow.createDiv();
			btn.style.cssText = `flex:1;padding:0.35rem;border:1px solid var(--background-modifier-border);border-radius:4px;cursor:pointer;text-align:center;font-size:var(--font-ui-small);${selectedType === t.id ? "border-color:var(--interactive-accent);background:var(--background-primary-alt)" : ""}`;
			const iconSpan = btn.createSpan();
			setIcon(iconSpan, t.icon);
			iconSpan.style.cssText = "width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:4px";
			btn.appendText(t.label);
			typeButtons.push(btn);
			btn.addEventListener("click", () => {
				selectedType = t.id;
				typeButtons[0].style.borderColor = selectedType === "single" ? "var(--interactive-accent)" : "var(--background-modifier-border)";
				typeButtons[0].style.background = selectedType === "single" ? "var(--background-primary-alt)" : "transparent";
				typeButtons[1].style.borderColor = selectedType === "series" ? "var(--interactive-accent)" : "var(--background-modifier-border)";
				typeButtons[1].style.background = selectedType === "series" ? "var(--background-primary-alt)" : "transparent";
			});
		}

		// Action buttons
		const btnRow = card.createDiv({ cls: "ft-flex ft-gap-2 ft-mt-3" });
		btnRow.style.justifyContent = "flex-end";

		const cancelBtn = btnRow.createEl("button", { text: "Cancel", cls: "ft-text-sm" });
		cancelBtn.addEventListener("click", () => {
			this.deps.setState({ selectedMeasurementId: null });
			this.deps.scheduleRender();
		});

		const createBtn = btnRow.createEl("button", { text: "Create", cls: "mod-cta ft-text-sm" });
		createBtn.addEventListener("click", () => {
			const name = nameInput.value.trim();
			if (!name) return;
			const queryId = querySelect.value;
			const col = colSelect.value || undefined;
			void this.deps.analyticsService.createMeasurement(name, queryId, selectedType, col).then((result) => {
				this.deps.setState({ selectedMeasurementId: result.id });
				this.deps.scheduleRender();
			});
		});
	}
}
