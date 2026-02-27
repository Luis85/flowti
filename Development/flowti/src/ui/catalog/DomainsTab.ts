import { TFile, TFolder, setIcon } from "obsidian";
import { EVENT_CATALOG, SYSTEM_DOMAINS, type EventCatalogEntry } from "../../infrastructure/events/catalog";
import {
	readFrontmatter, fmString, fmStringArray,
	isConfigured, discoveredToCatalogEntries,
	openFile, normalizeNonConformingFiles,
} from "./helpers";
import type { NonConformingFile } from "./helpers";
import {
	getDomainDocPathResolved, generateDomainDocContent,
	getArchitectureDocPathResolved, generateArchitectureDocContent,
} from "../eventDocTemplate";
import { InputModal } from "../modals";
import type { CatalogComponentDeps, DomainEntry } from "./types";
import { DomainDetailPanel } from "./DomainDetailPanel";

/**
 * Domains tab component for the Event Catalog view.
 * Renders the master list of domains. Detail rendering is delegated to DomainDetailPanel.
 */
export class DomainsTab {
	private entries: DomainEntry[] = [];
	private selectedDomain: string | null = null;
	private showHidden = false;
	private detailPanel: DomainDetailPanel;

	constructor(
		private masterEl: HTMLElement,
		private detailEl: HTMLElement,
		private deps: CatalogComponentDeps,
	) {
		this.detailPanel = new DomainDetailPanel(detailEl, deps, {
			getSelectedDomain: () => this.selectedDomain,
			getEntries: () => this.entries,
			createDoc: (name) => this.createDoc(name),
			deleteDoc: (path) => this.deleteDoc(path),
			createArea: (name) => this.createArea(name),
			createArchitectureDoc: (name) => this.createArchitectureDoc(name),
		});
	}

	getEntries(): DomainEntry[] { return this.entries; }
	getSelectedDomain(): string | null { return this.selectedDomain; }
	setSelectedDomain(name: string | null): void { this.selectedDomain = name; }

	render(): void {
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
				this.deps.vaultQuery,
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

		const nonConforming: NonConformingFile[] = [];
		if (folder && folder instanceof TFolder) {
			for (const child of folder.children) {
				if (!(child instanceof TFile) || child.extension !== "md") continue;

				const fm = readFrontmatter(this.deps.vaultQuery, child.path);
				const name = (fm && (fmString(fm, "domain")
					?? fmString(fm, "name"))) ?? child.basename;
				const description = (fm && fmString(fm, "description")) ?? "";
				const services = fmStringArray(fm, "services");
				const categories = fmStringArray(fm, "categories");

				fileMap.set(name, { filePath: child.path, description, services, categories });

				// Ensure this domain exists in the map even if catalog has no events for it
				if (!domainMap.has(name)) domainMap.set(name, []);

				if (!fm || fm.type !== "DomainDoc") {
					nonConforming.push({
						file: child, docType: "DomainDoc", nameField: "domain", name,
						metadata: { description, domains: [], services },
					});
				}
			}
		}
		normalizeNonConformingFiles(this.deps.app, nonConforming);

		const state = this.deps.getState();

		this.entries = Array.from(domainMap.entries())
			.map(([name, events]) => {
				const fileData = fileMap.get(name);
				const areaPath = `02 - Areas/${name}/${name}.md`;
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
						return setting ? setting.visible : true;
					})(),
					isSystem: SYSTEM_DOMAINS.has(name),
					isArea: !!this.deps.app.vault.getAbstractFileByPath(areaPath),
				};
			})
			.sort((a, b) => {
				if (a.isArea !== b.isArea) return a.isArea ? -1 : 1;
				return a.name.localeCompare(b.name);
			});
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
		const addDomainBtn = header.createSpan({ cls: "ft-visibility-toggle ft-ml-auto" });
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

		const userDomains = visibleDomains.filter((d) => !d.isSystem);
		const systemDomains = visibleDomains.filter((d) => d.isSystem);

		for (const d of userDomains) {
			this.renderItem(d, this.masterEl);
		}

		if (state.showSystemEvents && systemDomains.length > 0) {
			const divider = this.masterEl.createDiv({ cls: "ft-section-divider" });
			divider.createSpan({ text: "System Domains", cls: "ft-text-muted ft-text-sm" });
			const systemContainer = this.masterEl.createDiv({ cls: "ft-master-category-system" });
			for (const d of systemDomains) {
				this.renderItem(d, systemContainer);
			}
		}

		if (hiddenDomains.length > 0) {
			const hiddenHeader = this.masterEl.createDiv({ cls: "ft-master-category-header ft-hidden-header" });
			hiddenHeader.addClass("ft-cursor-pointer");
			hiddenHeader.createSpan({ text: `${hiddenDomains.length} hidden` });
			const expandIcon = hiddenHeader.createSpan({ cls: "ft-visibility-toggle ft-ml-auto" });
			setIcon(expandIcon, this.showHidden ? "chevron-up" : "chevron-down");

			const hiddenContainer = this.masterEl.createDiv();
			if (!this.showHidden) hiddenContainer.addClass("ft-hidden");

			hiddenHeader.addEventListener("click", () => {
				this.showHidden = !this.showHidden;
				hiddenContainer.classList.toggle("ft-hidden", !this.showHidden);
				setIcon(expandIcon, this.showHidden ? "chevron-up" : "chevron-down");
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

		if (!d.visible) item.addClass("ft-opacity-06");

		// Eye icon for visibility toggle
		const eyeBtn = item.createSpan({ cls: "ft-visibility-toggle" });
		eyeBtn.addClass("ft-flex-shrink-0");
		eyeBtn.addClass("ft-cursor-pointer");
		setIcon(eyeBtn, d.visible ? "eye" : "eye-off");
		eyeBtn.setAttribute("aria-label", d.visible ? "Hide domain" : "Show domain");
		eyeBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			this.toggleVisibility(d.name);
		});

		const iconEl = item.createSpan();
		setIcon(iconEl, "box");
		iconEl.addClass("ft-icon-muted");
		iconEl.addClass("ft-flex-shrink-0");

		item.createSpan({ text: d.name, cls: "ft-master-event-name" });

		item.createSpan({
			text: `${d.events.length}`,
			cls: "ft-master-category-count",
		});

		if (d.isArea) {
			item.createSpan({ text: "area", cls: "ft-badge ft-badge-area" });
		}

		if (d.isSystem) {
			item.createSpan({ text: "system", cls: "ft-badge ft-badge-system" });
		} else if (d.filePath === null) {
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
	// Detail panel — delegated to DomainDetailPanel
	// ─────────────────────────────────────────────────────────────

	renderDetail(): void {
		this.detailPanel.render();
	}

	// ─────────────────────────────────────────────────────────────
	// Document CRUD
	// ─────────────────────────────────────────────────────────────

	createDoc(name: string): void {
		const folder = this.deps.getEntityFolder("domains");
		const docPath = getDomainDocPathResolved(folder, name);
		const existing = this.deps.app.vault.getAbstractFileByPath(docPath);
		if (existing instanceof TFile) {
			void openFile(this.deps.workspace, docPath);
			return;
		}
		const domainEvents = this.entries.find((d) => d.name === name)?.events ?? [];
		this.selectedDomain = name;
		void this.deps.eventBus.emit("doc.create", {
			docType: "DomainDoc",
			name,
			entityType: "domains",
			content: generateDomainDocContent(name, domainEvents),
			source: "DomainsTab",
		});
	}

	deleteDoc(filePath: string): void {
		this.selectedDomain = null;
		void this.deps.eventBus.emit("doc.delete", {
			path: filePath,
			source: "DomainsTab",
		});
	}

	createArea(name: string): void {
		const areaPath = `02 - Areas/${name}/${name}.md`;
		const existing = this.deps.app.vault.getAbstractFileByPath(areaPath);
		if (existing instanceof TFile) {
			void openFile(this.deps.workspace, areaPath);
			return;
		}
		const content = [
			"---",
			`area: "${name}"`,
			`type: AreaDoc`,
			`domain: "${name}"`,
			`description: ""`,
			"---",
			"",
			`# ${name}`,
			"",
		].join("\n");
		void this.deps.eventBus.emit("doc.create", {
			docType: "AreaDoc",
			name,
			path: areaPath,
			content,
			source: "DomainsTab",
		});
	}

	createArchitectureDoc(name: string): void {
		const folder = this.deps.getEntityFolder("domains");
		const docPath = getArchitectureDocPathResolved(folder, name);
		const existing = this.deps.app.vault.getAbstractFileByPath(docPath);
		if (existing instanceof TFile) {
			void openFile(this.deps.workspace, docPath);
			return;
		}
		const domainEvents = this.entries.find((d) => d.name === name)?.events ?? [];
		this.selectedDomain = name;
		void this.deps.eventBus.emit("doc.create", {
			docType: "ArchitectureDoc",
			name,
			entityType: "domains",
			content: generateArchitectureDocContent(name, domainEvents),
			source: "DomainsTab",
		});
	}
}
