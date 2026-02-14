/**
 * Abstract base class for entity tabs (Flows, Actors, Products, Systems).
 *
 * Captures the structural duplication (TD-34): constructor, scan lifecycle,
 * master list rendering, detail panel layout, CRUD, and empty state are
 * identical across all four tabs. Tab-specific behaviour is injected via
 * the EntityTabConfig object.
 */

import { TFile, setIcon } from "obsidian";
import type { EventCatalogEntry } from "../../infrastructure/events/catalog";
import {
	renderStat, renderRelatedSection,
	openFile, normalizeNonConformingFiles,
} from "./helpers";
import type { RelatedCriteria } from "./helpers";
import { InputModal, ConfirmModal } from "../modals";
import type { CatalogComponentDeps } from "./types";
import { scanEntityFolder } from "./entityScanner";
import type { EntityScanConfig, RawScanEntry, ScanContext } from "./entityScanner";
import type { EntityType } from "../../domain/docs/pathResolver";
import type { DocType } from "../../domain/docs/types";

// ─────────────────────────────────────────────────────────────
// Base entry shape: every entity has at least these fields
// ─────────────────────────────────────────────────────────────

export interface BaseEntityEntry {
	name: string;
	description: string;
	domains: string[];
	services: string[];
	filePath: string;
}

// ─────────────────────────────────────────────────────────────
// Related section descriptor
// ─────────────────────────────────────────────────────────────

export interface RelatedSectionConfig {
	/** Section title, e.g. "Related Flows" */
	title: string;
	/** State key holding the entries to search */
	stateKey: "flowEntries" | "systemEntries" | "actorEntries" | "productEntries";
	/** Finder function */
	findFn: (entries: unknown[], criteria: RelatedCriteria) => Array<{ name: string }>;
	/** Navigation handler */
	navigate: (deps: CatalogComponentDeps, name: string) => void;
}

// ─────────────────────────────────────────────────────────────
// Configuration — everything that differs between tabs
// ─────────────────────────────────────────────────────────────

export interface EntityTabConfig<T extends BaseEntityEntry> {
	/** Display name (plural), e.g. "Flows" */
	label: string;
	/** Singular noun for modals, e.g. "flow" */
	singular: string;
	/** Lucide icon name for list items */
	icon: string;
	/** Entity type for folder resolution */
	entityType: EntityType;
	/** Doc type tag, e.g. "FlowDoc" */
	docType: DocType;
	/** Source identifier for events */
	source: string;
	/** Frontmatter field used to resolve the doc path */
	pathResolver: (folder: string, name: string) => string;

	// ── Scan config ──
	scanConfig: Omit<EntityScanConfig<T>, "mapEntry">;
	mapEntry: (raw: RawScanEntry, ctx: ScanContext) => T;

	// ── Master list ──
	/** Returns the count shown as a badge on each master list item */
	getItemCount: (entry: T) => number;
	/** Whether filterText should match events. False for Systems. */
	filterIncludesEvents: boolean;

	// ── Detail events section ──
	/** Renders the events section in the detail panel. */
	renderEventsSection: (container: HTMLElement, entry: T, deps: CatalogComponentDeps) => void;

	// ── Related sections ──
	/** Which related entity sections to show. */
	relatedSections: RelatedSectionConfig[];

	// ── Related criteria ──
	/** Builds the criteria object from an entry (Systems omits events). */
	buildCriteria: (entry: T) => RelatedCriteria;

	// ── Empty state ──
	/** Computes the quick stats for the empty detail state. */
	getQuickStats: (entries: T[]) => Array<{ value: string; label: string }>;
}

// ─────────────────────────────────────────────────────────────
// Base class
// ─────────────────────────────────────────────────────────────

export class BaseEntityTab<T extends BaseEntityEntry> {
	protected entries: T[] = [];
	protected selected: string | null = null;

	constructor(
		protected masterEl: HTMLElement,
		protected detailEl: HTMLElement,
		protected deps: CatalogComponentDeps,
		protected config: EntityTabConfig<T>,
	) {}

	getEntries(): T[] { return this.entries; }
	getSelected(): string | null { return this.selected; }
	setSelected(name: string | null): void { this.selected = name; }

	render(): void {
		this.renderMaster();
		this.renderDetail();
	}

	// ─────────────────────────────────────────────────────────────
	// Scanning
	// ─────────────────────────────────────────────────────────────

	scan(): void {
		const result = scanEntityFolder<T>({
			...this.config.scanConfig,
			mapEntry: this.config.mapEntry,
		}, this.deps);
		this.entries = result.entries;
		normalizeNonConformingFiles(this.deps.app, result.nonConforming);
	}

	// ─────────────────────────────────────────────────────────────
	// Master list
	// ─────────────────────────────────────────────────────────────

	renderMaster(): void {
		this.scan();
		this.masterEl.empty();

		const state = this.deps.getState();
		let items = this.entries;

		if (state.filterText) {
			items = items.filter((entry) => {
				if (entry.name.toLowerCase().includes(state.filterText)) return true;
				if (entry.description.toLowerCase().includes(state.filterText)) return true;
				if (entry.domains.some((d) => d.toLowerCase().includes(state.filterText))) return true;
				if (entry.services.some((s) => s.toLowerCase().includes(state.filterText))) return true;
				if (this.config.filterIncludesEvents && "events" in entry) {
					const events = entry.events as unknown[];
					if (events.some((e) => {
						const str = typeof e === "string" ? e : (e as EventCatalogEntry).type;
						return str.toLowerCase().includes(state.filterText);
					})) return true;
				}
				return false;
			});
		}

		// Header with add button
		const header = this.masterEl.createDiv({ cls: "ft-master-category-header" });
		header.createSpan({ text: this.config.label });
		const addBtn = header.createSpan({ cls: "ft-visibility-toggle" });
		addBtn.style.marginLeft = "auto";
		setIcon(addBtn, "plus");
		addBtn.setAttribute("aria-label", `Create new ${this.config.singular}`);
		addBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			new InputModal(this.deps.app, {
				title: `Create New ${this.config.label.slice(0, -1)}`,
				placeholder: `My ${this.config.label.slice(0, -1)}`,
				submitLabel: "Create",
				inputName: `${this.config.label.slice(0, -1)} name`,
				inputDesc: `A name for this ${this.config.singular}`,
				onSubmit: (name) => {
					void this.createDoc(name);
				},
			}).open();
		});

		for (const entry of items) {
			const isSelected = this.selected === entry.name;
			const item = this.masterEl.createDiv({
				cls: `ft-master-event-item${isSelected ? " ft-master-event-selected" : ""}`,
			});

			const iconEl = item.createSpan();
			setIcon(iconEl, this.config.icon);
			iconEl.addClass("ft-icon-muted");
			iconEl.addClass("ft-flex-shrink-0");

			item.createSpan({ text: entry.name, cls: "ft-master-event-name" });

			item.createSpan({
				text: `${this.config.getItemCount(entry)}`,
				cls: "ft-master-category-count",
			});

			item.addEventListener("click", () => {
				this.selected = entry.name;
				this.renderMaster();
				this.renderDetail();
			});
		}
	}

	// ─────────────────────────────────────────────────────────────
	// Detail panel
	// ─────────────────────────────────────────────────────────────

	renderDetail(): void {
		this.detailEl.empty();

		if (!this.selected) {
			this.renderDetailEmpty();
			return;
		}

		const data = this.entries.find((e) => e.name === this.selected);
		if (!data) {
			this.renderDetailEmpty();
			return;
		}

		// Header
		const header = this.detailEl.createDiv({ cls: "ft-detail-header" });
		const left = header.createDiv();
		left.createDiv({ text: data.name, cls: "ft-detail-event-type" });
		const badges = left.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });

		const eventCount = this.config.getItemCount(data);
		badges.createSpan({ text: `${eventCount} events`, cls: "ft-badge ft-badge-muted" });
		badges.createSpan({ text: `${data.domains.length} domains`, cls: "ft-badge ft-badge-muted" });
		badges.createSpan({ text: `${data.services.length} services`, cls: "ft-badge ft-badge-muted" });

		// Description
		if (data.description) {
			const descCard = this.detailEl.createDiv({ cls: "ft-card ft-mt-2" });
			descCard.createEl("p", {
				text: data.description,
				cls: "ft-text-muted ft-text-sm",
			});
		}

		// Info card: Domains + Services (clickable)
		const card = this.detailEl.createDiv({ cls: "ft-card ft-mt-2" });
		const grid = card.createDiv({ cls: "ft-detail-info-grid" });

		grid.createDiv({ text: "Domains", cls: "ft-detail-info-label" });
		const domVal = grid.createDiv({ cls: "ft-detail-info-value ft-flex ft-gap-1" });
		if (data.domains.length > 0) {
			for (const dom of data.domains) {
				const domLink = domVal.createEl("span", { text: dom, cls: "ft-nav-link" });
				domLink.addEventListener("click", () => this.deps.navigation.navigateToDomain(dom));
			}
		} else {
			domVal.createSpan({ text: "(none)", cls: "ft-text-muted" });
		}

		grid.createDiv({ text: "Services", cls: "ft-detail-info-label" });
		const svcVal = grid.createDiv({ cls: "ft-detail-info-value ft-flex ft-gap-1" });
		if (data.services.length > 0) {
			for (const svc of data.services) {
				const svcLink = svcVal.createEl("span", { text: svc, cls: "ft-nav-link" });
				svcLink.addEventListener("click", () => this.deps.navigation.navigateToService(svc));
			}
		} else {
			svcVal.createSpan({ text: "(none)", cls: "ft-text-muted" });
		}

		// Actions
		const actions = this.detailEl.createDiv({ cls: "ft-detail-actions" });

		const docBtn = actions.createEl("span", { cls: "ft-nav-link" });
		const docIcon = docBtn.createSpan();
		setIcon(docIcon, "file-text");
		docBtn.appendText(" Open Doc");
		docBtn.addEventListener("click", () => {
			void openFile(this.deps.workspace, data.filePath);
		});

		const delBtn = actions.createEl("button", { cls: "ft-btn ft-btn-ghost ft-text-sm" });
		delBtn.style.color = "var(--text-error)";
		const delIcon = delBtn.createSpan();
		setIcon(delIcon, "trash-2");
		delBtn.appendText(" Delete");
		delBtn.addEventListener("click", () => {
			new ConfirmModal(this.deps.app, {
				message: `Delete ${this.config.singular} "${data.name}" and its doc file?`,
				confirmLabel: "Delete",
				onConfirm: () => {
					void this.deleteDoc(data.filePath);
				},
			}).open();
		});

		// Events section (tab-specific rendering)
		this.config.renderEventsSection(this.detailEl, data, this.deps);

		// Related sections
		const state = this.deps.getState();
		const criteria = this.config.buildCriteria(data);

		for (const section of this.config.relatedSections) {
			const entries = section.stateKey in state
				? (state as unknown as Record<string, unknown[]>)[section.stateKey] ?? []
				: [];
			const related = section.findFn(entries, criteria);
			renderRelatedSection(
				this.detailEl, section.title,
				related.map((r) => ({
					name: r.name,
					onClick: () => section.navigate(this.deps, r.name),
				})),
			);
		}
	}

	// ─────────────────────────────────────────────────────────────
	// Detail empty state
	// ─────────────────────────────────────────────────────────────

	private renderDetailEmpty(): void {
		const empty = this.detailEl.createDiv({ cls: "ft-catalog-detail-empty" });

		const icon = empty.createDiv();
		setIcon(icon, this.config.icon);
		icon.addClass("ft-icon-subtle");

		empty.createEl("p", { text: `Select a ${this.config.singular} to view details` });

		const statsEl = empty.createDiv({ cls: "ft-catalog-quick-stats" });
		for (const stat of this.config.getQuickStats(this.entries)) {
			renderStat(statsEl, stat.value, stat.label);
		}
	}

	// ─────────────────────────────────────────────────────────────
	// Document CRUD
	// ─────────────────────────────────────────────────────────────

	createDoc(name: string): void {
		const folder = this.deps.getEntityFolder(this.config.entityType);
		const docPath = this.config.pathResolver(folder, name);
		const existing = this.deps.app.vault.getAbstractFileByPath(docPath);
		if (existing instanceof TFile) {
			void openFile(this.deps.workspace, docPath);
			return;
		}
		this.selected = name;
		void this.deps.eventBus.emit("doc.create", {
			docType: this.config.docType,
			name,
			entityType: this.config.entityType,
			source: this.config.source,
		});
	}

	deleteDoc(filePath: string): void {
		this.selected = null;
		void this.deps.eventBus.emit("doc.delete", {
			path: filePath,
			source: this.config.source,
		});
	}
}
