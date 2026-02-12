import { TFile, TFolder, setIcon } from "obsidian";
import { EVENT_CATALOG } from "../../infrastructure/events/catalog";
import {
	readFrontmatter, fmString, fmStringArray, normalizeDocFrontmatter,
	discoveredToCatalogEntries,
	renderStat, renderRelatedSection,
	findRelatedFlows, findRelatedActors,
	openFile,
} from "./helpers";
import {
	getSystemDocPathResolved, generateSystemDocContent,
} from "../eventDocTemplate";
import { InputModal, ConfirmModal } from "../modals";
import type { CatalogComponentDeps, SystemEntry } from "./types";

/**
 * Systems tab component for the Event Catalog view.
 * Renders the master list of systems and the detail panel for a selected system.
 */
export class SystemsTab {
	private entries: SystemEntry[] = [];
	private selectedSystem: string | null = null;

	constructor(
		private masterEl: HTMLElement,
		private detailEl: HTMLElement,
		private deps: CatalogComponentDeps,
	) {}

	getEntries(): SystemEntry[] { return this.entries; }
	getSelectedSystem(): string | null { return this.selectedSystem; }
	setSelectedSystem(name: string | null): void { this.selectedSystem = name; }

	render(): void {
		this.scan();
		this.renderMaster();
		this.renderDetail();
	}

	// ─────────────────────────────────────────────────────────────
	// Scanning
	// ─────────────────────────────────────────────────────────────

	scan(): void {
		const systemsFolder = this.deps.getEntityFolder("systems");
		const folder = this.deps.app.vault.getAbstractFileByPath(systemsFolder);

		if (!folder || !(folder instanceof TFolder)) {
			this.entries = [];
			return;
		}

		const allEntries = [
			...EVENT_CATALOG,
			...discoveredToCatalogEntries(
				this.deps.getState().discoveredEvents,
				this.deps.app,
				this.deps.getEntityFolder("events"),
			),
		];
		const entries: SystemEntry[] = [];

		for (const child of folder.children) {
			if (!(child instanceof TFile) || child.extension !== "md") continue;

			const fm = readFrontmatter(this.deps.app, child.path);

			const name = (fm && (fmString(fm, "system")
				?? fmString(fm, "name"))) ?? child.basename;
			const description = (fm && fmString(fm, "description")) ?? "";
			const domains = [
				...fmStringArray(fm, "domains"),
				...fmStringArray(fm, "Domains"),
			];
			const services = [
				...fmStringArray(fm, "services"),
				...fmStringArray(fm, "Systems"),
			];

			const domainSet = new Set(domains);
			const serviceSet = new Set(services);
			const events = allEntries.filter(
				(e) => domainSet.has(e.domain) || serviceSet.has(e.services),
			);

			entries.push({ name, description, domains, services, filePath: child.path, events });

			if (!fm || fm.type !== "SystemDoc") {
				normalizeDocFrontmatter(
					this.deps.app, child, "SystemDoc", "system", name,
					{ description, domains, services },
				);
			}
		}

		this.entries = entries.sort((a, b) => a.name.localeCompare(b.name));
	}

	// ─────────────────────────────────────────────────────────────
	// Master list
	// ─────────────────────────────────────────────────────────────

	renderMaster(): void {
		this.scan();
		this.masterEl.empty();

		const state = this.deps.getState();
		let systems = this.entries;

		if (state.filterText) {
			systems = systems.filter(
				(s) =>
					s.name.toLowerCase().includes(state.filterText) ||
					s.description.toLowerCase().includes(state.filterText) ||
					s.domains.some((d) => d.toLowerCase().includes(state.filterText)) ||
					s.services.some((svc) => svc.toLowerCase().includes(state.filterText)),
			);
		}

		// Header with add button
		const header = this.masterEl.createDiv({ cls: "ft-master-category-header" });
		header.createSpan({ text: "Systems" });
		const addBtn = header.createSpan({ cls: "ft-visibility-toggle" });
		addBtn.style.marginLeft = "auto";
		setIcon(addBtn, "plus");
		addBtn.setAttribute("aria-label", "Create new system");
		addBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			new InputModal(this.deps.app, {
				title: "Create New System",
				placeholder: "My System",
				submitLabel: "Create",
				inputName: "System name",
				inputDesc: "A name for this system",
				onSubmit: (name) => {
					void this.createDoc(name);
				},
			}).open();
		});

		for (const s of systems) {
			const isSelected = this.selectedSystem === s.name;
			const item = this.masterEl.createDiv({
				cls: `ft-master-event-item${isSelected ? " ft-master-event-selected" : ""}`,
			});

			const iconEl = item.createSpan();
			setIcon(iconEl, "layout-grid");
			iconEl.style.opacity = "0.5";
			iconEl.style.flexShrink = "0";

			item.createSpan({ text: s.name, cls: "ft-master-event-name" });

			item.createSpan({
				text: `${s.events.length}`,
				cls: "ft-master-category-count",
			});

			item.addEventListener("click", () => {
				this.selectedSystem = s.name;
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

		if (!this.selectedSystem) {
			this.renderDetailEmpty();
			return;
		}

		const systemData = this.entries.find((s) => s.name === this.selectedSystem);
		if (!systemData) {
			this.renderDetailEmpty();
			return;
		}

		// Header
		const header = this.detailEl.createDiv({ cls: "ft-detail-header" });
		const left = header.createDiv();
		left.createDiv({ text: systemData.name, cls: "ft-detail-event-type" });
		const badges = left.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
		badges.createSpan({ text: `${systemData.events.length} events`, cls: "ft-badge ft-badge-muted" });
		badges.createSpan({ text: `${systemData.domains.length} domains`, cls: "ft-badge ft-badge-muted" });
		badges.createSpan({ text: `${systemData.services.length} services`, cls: "ft-badge ft-badge-muted" });

		// Description
		if (systemData.description) {
			const descCard = this.detailEl.createDiv({ cls: "ft-card ft-mt-2" });
			descCard.createEl("p", {
				text: systemData.description,
				cls: "ft-text-muted ft-text-sm",
			});
		}

		// Info card
		const card = this.detailEl.createDiv({ cls: "ft-card ft-mt-2" });
		const grid = card.createDiv({ cls: "ft-detail-info-grid" });

		// Domains — clickable
		grid.createDiv({ text: "Domains", cls: "ft-detail-info-label" });
		const domVal = grid.createDiv({ cls: "ft-detail-info-value ft-flex ft-gap-1" });
		if (systemData.domains.length > 0) {
			for (const dom of systemData.domains) {
				const domLink = domVal.createEl("span", { text: dom, cls: "ft-nav-link" });
				domLink.addEventListener("click", () => this.deps.navigation.navigateToDomain(dom));
			}
		} else {
			domVal.createSpan({ text: "(none)", cls: "ft-text-muted" });
		}

		// Services — clickable
		grid.createDiv({ text: "Services", cls: "ft-detail-info-label" });
		const svcVal = grid.createDiv({ cls: "ft-detail-info-value ft-flex ft-gap-1" });
		if (systemData.services.length > 0) {
			for (const svc of systemData.services) {
				const svcLink = svcVal.createEl("span", { text: svc, cls: "ft-nav-link" });
				svcLink.addEventListener("click", () => this.deps.navigation.navigateToService(svc));
			}
		} else {
			svcVal.createSpan({ text: "(none)", cls: "ft-text-muted" });
		}

		// Actions
		const actions = this.detailEl.createDiv({ cls: "ft-detail-actions" });

		// Open doc file
		const docBtn = actions.createEl("span", { cls: "ft-nav-link" });
		const docIcon = docBtn.createSpan();
		setIcon(docIcon, "file-text");
		docBtn.appendText(" Open Doc");
		docBtn.addEventListener("click", () => {
			void openFile(this.deps.app, systemData.filePath);
		});

		// Delete system
		const delBtn = actions.createEl("button", { cls: "ft-btn ft-btn-ghost ft-text-sm" });
		delBtn.style.color = "var(--text-error)";
		const delIcon = delBtn.createSpan();
		setIcon(delIcon, "trash-2");
		delBtn.appendText(" Delete");
		delBtn.addEventListener("click", () => {
			new ConfirmModal(this.deps.app, {
				message: `Delete system "${systemData.name}" and its doc file?`,
				confirmLabel: "Delete",
				onConfirm: () => {
					void this.deleteDoc(systemData.filePath);
				},
			}).open();
		});

		// Events list
		const section = this.detailEl.createDiv({ cls: "ft-detail-section" });
		const sectionHeader = section.createDiv({ cls: "ft-detail-section-header" });
		sectionHeader.createSpan({
			text: `Events (${systemData.events.length})`,
			cls: "ft-heading ft-heading-sm",
		});

		for (const entry of systemData.events) {
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
		const criteria = { domains: systemData.domains, services: systemData.services };

		renderRelatedSection(
			this.detailEl, "Related Flows",
			findRelatedFlows(state.flowEntries, criteria).map((f) => ({
				name: f.name,
				onClick: () => this.deps.navigation.navigateToFlow(f.name),
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
		setIcon(icon, "layout-grid");
		icon.style.opacity = "0.3";

		empty.createEl("p", { text: "Select a system to view details" });

		const stats = empty.createDiv({ cls: "ft-catalog-quick-stats" });
		renderStat(stats, `${this.entries.length}`, "systems");
		const totalEvents = this.entries.reduce((sum, s) => sum + s.events.length, 0);
		renderStat(stats, `${totalEvents}`, "events");
		const totalDomains = new Set(this.entries.flatMap((s) => s.domains)).size;
		renderStat(stats, `${totalDomains}`, "domains");
	}

	// ─────────────────────────────────────────────────────────────
	// Document CRUD
	// ─────────────────────────────────────────────────────────────

	async createDoc(name: string): Promise<void> {
		const docPath = getSystemDocPathResolved(this.deps.getEntityFolder("systems"), name);

		const existing = this.deps.app.vault.getAbstractFileByPath(docPath);
		if (existing) {
			if (existing instanceof TFile) {
				const leaf = this.deps.app.workspace.getLeaf(false);
				await leaf.openFile(existing);
			}
			return;
		}

		const content = generateSystemDocContent(name);
		try {
			await this.deps.fileSystemClient.createFile(docPath, content, { createFolders: true });
		} catch (err) {
			console.error(`[Flowti] Failed to create system doc: ${docPath}`, err);
			return;
		}

		this.selectedSystem = name;
		setTimeout(() => this.deps.scheduleRender(), 500);
	}

	async deleteDoc(filePath: string): Promise<void> {
		try {
			await this.deps.fileSystemClient.deleteFile(filePath);
		} catch (err) {
			console.error(`[Flowti] Failed to delete system doc: ${filePath}`, err);
			return;
		}

		this.selectedSystem = null;
		this.deps.scheduleRender();
	}
}
