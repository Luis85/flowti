import { TFile, TFolder, setIcon } from "obsidian";
import { EVENT_CATALOG, type EventCatalogEntry } from "../../infrastructure/events/catalog";
import {
	readFrontmatter, fmString, fmStringArray, normalizeDocFrontmatter,
	isConfigured, isSystemOnly, discoveredToCatalogEntries,
	renderStat, renderRelatedSection,
	findRelatedFlows, findRelatedSystems, findRelatedActors,
	openFile,
} from "./helpers";
import {
	getDomainDocPathResolved, generateDomainDocContent,
	getArchitectureDocPathResolved, generateArchitectureDocContent,
} from "../eventDocTemplate";
import { InputModal, ConfirmModal } from "../modals";
import type { CatalogComponentDeps, DomainEntry } from "./types";

/**
 * Domains tab component for the Event Catalog view.
 * Renders the master list of domains and the detail panel for a selected domain.
 */
export class DomainsTab {
	private entries: DomainEntry[] = [];
	private selectedDomain: string | null = null;

	constructor(
		private masterEl: HTMLElement,
		private detailEl: HTMLElement,
		private deps: CatalogComponentDeps,
	) {}

	getEntries(): DomainEntry[] { return this.entries; }
	getSelectedDomain(): string | null { return this.selectedDomain; }
	setSelectedDomain(name: string | null): void { this.selectedDomain = name; }

	render(): void {
		this.scan();
		this.renderMaster();
		this.renderDetail();
	}

	// ─────────────────────────────────────────────────────────────
	// Scanning
	// ─────────────────────────────────────────────────────────────

	scan(): void {
		const allEntries = [
			...EVENT_CATALOG,
			...discoveredToCatalogEntries(
				this.deps.getState().discoveredEvents,
				this.deps.app,
				this.deps.getEntityFolder("events"),
			),
		];
		const domainMap = new Map<string, EventCatalogEntry[]>();

		for (const entry of allEntries) {
			const list = domainMap.get(entry.domain) ?? [];
			list.push(entry);
			domainMap.set(entry.domain, list);
		}

		// Scan folder for documented domains
		const domainsFolder = this.deps.getEntityFolder("domains");
		const folder = this.deps.app.vault.getAbstractFileByPath(domainsFolder);
		const fileMap = new Map<string, {
			filePath: string;
			description: string;
			services: string[];
			categories: string[];
		}>();

		if (folder && folder instanceof TFolder) {
			for (const child of folder.children) {
				if (!(child instanceof TFile) || child.extension !== "md") continue;

				const fm = readFrontmatter(this.deps.app, child.path);
				const name = (fm && (fmString(fm, "domain")
					?? fmString(fm, "name"))) ?? child.basename;
				const description = (fm && fmString(fm, "description")) ?? "";
				const services = fmStringArray(fm, "services");
				const categories = fmStringArray(fm, "categories");

				fileMap.set(name, { filePath: child.path, description, services, categories });

				// Ensure this domain exists in the map even if catalog has no events for it
				if (!domainMap.has(name)) domainMap.set(name, []);

				if (!fm || fm.type !== "DomainDoc") {
					normalizeDocFrontmatter(
						this.deps.app, child, "DomainDoc", "domain", name,
						{ description, domains: [], services },
					);
				}
			}
		}

		const state = this.deps.getState();

		this.entries = Array.from(domainMap.entries())
			.map(([name, events]) => {
				const fileData = fileMap.get(name);
				return {
					name,
					description: fileData?.description ?? "",
					events,
					services: fileData?.services.length
						? fileData.services
						: [...new Set(events.map((e) => e.services))].sort(),
					categories: fileData?.categories.length
						? fileData.categories
						: [...new Set(events.map((e) => e.category))].sort(),
					filePath: fileData?.filePath ?? null,
					configuredCount: events.filter((e) =>
						isConfigured(e.type, state.subscriptions, state.definitions),
					).length,
					visibleCount: events.filter((e) => !state.excludedTypes.has(e.type)).length,
					visible: (() => {
						const setting = state.catalogDomains.find((d) => d.name === name);
						return setting ? setting.visible : !isSystemOnly(events);
					})(),
				};
			})
			.sort((a, b) => a.name.localeCompare(b.name));
	}

	// ─────────────────────────────────────────────────────────────
	// Master list
	// ─────────────────────────────────────────────────────────────

	renderMaster(): void {
		this.scan();
		this.masterEl.empty();

		const state = this.deps.getState();
		let domains = this.entries;

		if (state.filterText) {
			domains = domains.filter(
				(d) =>
					d.name.toLowerCase().includes(state.filterText) ||
					d.description.toLowerCase().includes(state.filterText) ||
					d.events.some((e) => e.type.toLowerCase().includes(state.filterText)),
			);
		}

		// Header with add button
		const header = this.masterEl.createDiv({ cls: "ft-master-category-header" });
		header.createSpan({ text: "Domains" });
		const addDomainBtn = header.createSpan({ cls: "ft-visibility-toggle" });
		addDomainBtn.style.marginLeft = "auto";
		setIcon(addDomainBtn, "plus");
		addDomainBtn.setAttribute("aria-label", "Create new domain");
		addDomainBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			new InputModal(this.deps.app, {
				title: "Create New Domain",
				placeholder: "my-domain",
				submitLabel: "Create",
				inputName: "Domain name",
				inputDesc: "A short identifier for this domain",
				onSubmit: (name) => {
					void this.createDoc(name);
				},
			}).open();
		});

		const visibleDomains = domains.filter((d) => d.visible);
		const hiddenDomains = domains.filter((d) => !d.visible);

		for (const d of visibleDomains) {
			this.renderItem(d, this.masterEl);
		}

		if (hiddenDomains.length > 0) {
			const hiddenHeader = this.masterEl.createDiv({ cls: "ft-master-category-header" });
			hiddenHeader.style.marginTop = "8px";
			hiddenHeader.style.opacity = "0.6";
			hiddenHeader.style.cursor = "pointer";
			hiddenHeader.createSpan({ text: `${hiddenDomains.length} hidden` });
			const expandIcon = hiddenHeader.createSpan({ cls: "ft-visibility-toggle" });
			expandIcon.style.marginLeft = "auto";
			setIcon(expandIcon, "chevron-down");

			const hiddenContainer = this.masterEl.createDiv();
			hiddenContainer.style.display = "none";

			hiddenHeader.addEventListener("click", () => {
				const expanded = hiddenContainer.style.display !== "none";
				hiddenContainer.style.display = expanded ? "none" : "block";
				setIcon(expandIcon, expanded ? "chevron-down" : "chevron-up");
			});

			for (const d of hiddenDomains) {
				this.renderItem(d, hiddenContainer);
			}
		}
	}

	// ─────────────────────────────────────────────────────────────
	// Master list item
	// ─────────────────────────────────────────────────────────────

	private renderItem(d: DomainEntry, container: HTMLElement): void {
		const isSelected = this.selectedDomain === d.name;
		const item = container.createDiv({
			cls: `ft-master-event-item${isSelected ? " ft-master-event-selected" : ""}`,
		});

		if (!d.visible) item.style.opacity = "0.6";

		// Eye icon for visibility toggle
		const eyeBtn = item.createSpan({ cls: "ft-visibility-toggle" });
		eyeBtn.style.flexShrink = "0";
		eyeBtn.style.cursor = "pointer";
		setIcon(eyeBtn, d.visible ? "eye" : "eye-off");
		eyeBtn.setAttribute("aria-label", d.visible ? "Hide domain" : "Show domain");
		eyeBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			this.toggleVisibility(d.name);
		});

		const iconEl = item.createSpan();
		setIcon(iconEl, "box");
		iconEl.style.opacity = "0.5";
		iconEl.style.flexShrink = "0";

		item.createSpan({ text: d.name, cls: "ft-master-event-name" });

		item.createSpan({
			text: `${d.events.length}`,
			cls: "ft-master-category-count",
		});

		if (d.filePath === null) {
			item.createSpan({ text: "undocumented", cls: "ft-badge ft-badge-muted" });
		}

		if (d.configuredCount > 0) {
			const dots = item.createDiv({ cls: "ft-master-status-dots" });
			const dot = dots.createDiv({ cls: "ft-master-status-dot ft-master-dot-configured" });
			dot.title = `${d.configuredCount} configured`;
		}

		item.addEventListener("click", () => {
			this.selectedDomain = d.name;
			this.renderMaster();
			this.renderDetail();
		});
	}

	// ─────────────────────────────────────────────────────────────
	// Visibility toggle
	// ─────────────────────────────────────────────────────────────

	private toggleVisibility(name: string): void {
		const entry = this.entries.find((d) => d.name === name);
		const currentVisible = entry?.visible ?? true;
		const state = this.deps.getState();
		const updated = state.catalogDomains
			.filter((d) => d.name !== name)
			.concat([{ name, visible: !currentVisible }]);
		void this.deps.eventBus.emit("settings.updateCatalogDomains", { domains: updated });
		this.renderMaster();
		this.renderDetail();
	}

	// ─────────────────────────────────────────────────────────────
	// Detail panel
	// ─────────────────────────────────────────────────────────────

	renderDetail(): void {
		this.detailEl.empty();

		if (!this.selectedDomain) {
			this.renderDetailEmpty();
			return;
		}

		const domainData = this.entries.find((d) => d.name === this.selectedDomain);
		if (!domainData) {
			this.renderDetailEmpty();
			return;
		}

		// Header
		const header = this.detailEl.createDiv({ cls: "ft-detail-header" });
		const left = header.createDiv();
		left.createDiv({ text: domainData.name, cls: "ft-detail-event-type" });
		const badges = left.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
		badges.createSpan({ text: `${domainData.events.length} events`, cls: "ft-badge ft-badge-muted" });
		if (domainData.filePath === null) {
			badges.createSpan({ text: "undocumented", cls: "ft-badge ft-badge-muted" });
		}

		// Description
		if (domainData.description) {
			const descCard = this.detailEl.createDiv({ cls: "ft-card ft-mt-2" });
			descCard.createEl("p", {
				text: domainData.description,
				cls: "ft-text-muted ft-text-sm",
			});
		}

		// Info card
		const card = this.detailEl.createDiv({ cls: "ft-card ft-mt-2" });
		const grid = card.createDiv({ cls: "ft-detail-info-grid" });

		const addRow = (label: string, value: string) => {
			grid.createDiv({ text: label, cls: "ft-detail-info-label" });
			grid.createDiv({ text: value, cls: "ft-detail-info-value" });
		};

		addRow("Total Events", String(domainData.events.length));
		addRow("Configured", String(domainData.configuredCount));
		addRow("Visible in Log", `${domainData.visibleCount} / ${domainData.events.length}`);
		addRow("Categories", domainData.categories.join(", "));

		// Services — each clickable, navigates to Services tab
		grid.createDiv({ text: "Services", cls: "ft-detail-info-label" });
		const svcVal = grid.createDiv({ cls: "ft-detail-info-value ft-flex ft-gap-1" });
		if (domainData.services.length > 0) {
			for (const svc of domainData.services) {
				const svcLink = svcVal.createEl("span", { text: svc, cls: "ft-nav-link" });
				svcLink.addEventListener("click", () => this.deps.navigation.navigateToService(svc));
			}
		} else {
			svcVal.createSpan({ text: "(none)", cls: "ft-text-muted" });
		}

		// Actions
		const actions = this.detailEl.createDiv({ cls: "ft-detail-actions" });

		// Open / create doc
		const docBtn = actions.createEl("span", { cls: "ft-nav-link" });
		const docIcon = docBtn.createSpan();
		setIcon(docIcon, "file-text");
		docBtn.appendText(domainData.filePath ? " Open Doc" : " Create Doc");
		docBtn.addEventListener("click", () => {
			if (domainData.filePath) {
				void openFile(this.deps.app, domainData.filePath);
			} else {
				void this.createDoc(domainData.name);
			}
		});

		// Architecture Doc button
		const archBtn = actions.createEl("span", { cls: "ft-nav-link" });
		const archIcon = archBtn.createSpan();
		setIcon(archIcon, "layout");
		const archDocPath = getArchitectureDocPathResolved(
			this.deps.getEntityFolder("domains"), domainData.name,
		);
		const archExists = !!this.deps.app.vault.getAbstractFileByPath(archDocPath);
		archBtn.appendText(archExists ? " Architecture Doc" : " Create Architecture Doc");
		archBtn.addEventListener("click", () => {
			void this.createArchitectureDoc(domainData.name);
		});

		// Delete button for documented domains (file-based only)
		if (domainData.filePath) {
			const delBtn = actions.createEl("button", { cls: "ft-btn ft-btn-ghost ft-text-sm" });
			delBtn.style.color = "var(--text-error)";
			const delIcon = delBtn.createSpan();
			setIcon(delIcon, "trash-2");
			delBtn.appendText(" Delete");
			delBtn.addEventListener("click", () => {
				new ConfirmModal(this.deps.app, {
					message: `Delete domain doc "${domainData.name}"?`,
					confirmLabel: "Delete",
					onConfirm: () => {
						void this.deleteDoc(domainData.filePath!);
					},
				}).open();
			});
		}

		// Events list
		const section = this.detailEl.createDiv({ cls: "ft-detail-section" });
		const sectionHeader = section.createDiv({ cls: "ft-detail-section-header" });
		sectionHeader.createSpan({
			text: `Events (${domainData.events.length})`,
			cls: "ft-heading ft-heading-sm",
		});

		for (const entry of domainData.events) {
			const row = section.createDiv({ cls: "ft-catalog-row" });
			row.style.cursor = "pointer";

			row.createSpan({ text: entry.type, cls: "ft-event-type" });
			row.createSpan({ text: entry.category, cls: "ft-catalog-meta" });

			row.addEventListener("click", () => {
				this.deps.navigation.navigateToEvent(entry.type);
			});
		}

		// Related entities
		const state = this.deps.getState();
		const criteria = { domains: [domainData.name] };

		renderRelatedSection(
			this.detailEl, "Related Flows",
			findRelatedFlows(state.flowEntries, criteria).map((f) => ({
				name: f.name,
				onClick: () => this.deps.navigation.navigateToFlow(f.name),
			})),
		);
		renderRelatedSection(
			this.detailEl, "Related Systems",
			findRelatedSystems(state.systemEntries, criteria).map((s) => ({
				name: s.name,
				onClick: () => this.deps.navigation.navigateToSystem(s.name),
			})),
		);
		renderRelatedSection(
			this.detailEl, "Related Actors",
			findRelatedActors(state.actorEntries, criteria).map((a) => ({
				name: a.name,
				onClick: () => this.deps.navigation.navigateToActor(a.name),
			})),
		);
	}

	// ─────────────────────────────────────────────────────────────
	// Detail empty state
	// ─────────────────────────────────────────────────────────────

	private renderDetailEmpty(): void {
		const empty = this.detailEl.createDiv({ cls: "ft-catalog-detail-empty" });

		const icon = empty.createDiv();
		setIcon(icon, "boxes");
		icon.style.opacity = "0.3";

		empty.createEl("p", { text: "Select a domain to view details" });

		const stats = empty.createDiv({ cls: "ft-catalog-quick-stats" });
		renderStat(stats, `${this.entries.length}`, "domains");
		const totalEvents = this.entries.reduce((sum, d) => sum + d.events.length, 0);
		renderStat(stats, `${totalEvents}`, "events");
		const totalConfigured = this.entries.reduce((sum, d) => sum + d.configuredCount, 0);
		renderStat(stats, `${totalConfigured}`, "configured");
	}

	// ─────────────────────────────────────────────────────────────
	// Document CRUD
	// ─────────────────────────────────────────────────────────────

	async createDoc(name: string): Promise<void> {
		const docPath = getDomainDocPathResolved(this.deps.getEntityFolder("domains"), name);

		const existing = this.deps.app.vault.getAbstractFileByPath(docPath);
		if (existing) {
			if (existing instanceof TFile) {
				const leaf = this.deps.app.workspace.getLeaf(false);
				await leaf.openFile(existing);
			}
			return;
		}

		const domainEvents = this.entries.find((d) => d.name === name)?.events ?? [];
		const content = generateDomainDocContent(name, domainEvents);
		try {
			await this.deps.fileSystemClient.createFile(docPath, content, { createFolders: true });
		} catch (err) {
			console.error(`[Flowti] Failed to create domain doc: ${docPath}`, err);
			return;
		}

		this.selectedDomain = name;
		setTimeout(() => this.deps.scheduleRender(), 500);
	}

	async deleteDoc(filePath: string): Promise<void> {
		try {
			await this.deps.fileSystemClient.deleteFile(filePath);
		} catch (err) {
			console.error(`[Flowti] Failed to delete domain doc: ${filePath}`, err);
			return;
		}

		this.selectedDomain = null;
		this.deps.scheduleRender();
	}

	async createArchitectureDoc(name: string): Promise<void> {
		const docPath = getArchitectureDocPathResolved(this.deps.getEntityFolder("domains"), name);

		const existing = this.deps.app.vault.getAbstractFileByPath(docPath);
		if (existing) {
			if (existing instanceof TFile) {
				const leaf = this.deps.app.workspace.getLeaf(false);
				await leaf.openFile(existing);
			}
			return;
		}

		const domainEvents = this.entries.find((d) => d.name === name)?.events ?? [];
		const content = generateArchitectureDocContent(name, domainEvents);
		try {
			await this.deps.fileSystemClient.createFile(docPath, content, { createFolders: true });
		} catch (err) {
			console.error(`[Flowti] Failed to create architecture doc: ${docPath}`, err);
			return;
		}

		this.selectedDomain = name;
		setTimeout(() => this.deps.scheduleRender(), 500);
	}
}
