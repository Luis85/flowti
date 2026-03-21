import { TFile, TFolder, setIcon } from "obsidian";
import { EVENT_CATALOG, type EventCatalogEntry } from "../../infrastructure/events/catalog";
import {
	readFrontmatter, fmString, fmStringArray,
	isConfigured, discoveredToCatalogEntries,
	renderStat, renderRelatedSection,
	findRelatedFlows, findRelatedSystems, findRelatedActors,
	openFile, normalizeNonConformingFiles,
} from "./helpers";
import type { NonConformingFile } from "./helpers";
import {
	getServiceDocPathResolved, generateServiceDocContent,
	getServiceBlueprintPathResolved, generateServiceBlueprintContent,
} from "../eventDocTemplate";
import { InputModal, ConfirmModal } from "../modals";
import type { CatalogComponentDeps, ServiceEntry } from "./types";

/**
 * Services tab component for the Event Catalog view.
 * Renders the master list of services and the detail panel for a selected service.
 */
export class ServicesTab {
	private entries: ServiceEntry[] = [];
	private selectedService: string | null = null;
	private showHidden = false;

	constructor(
		private masterEl: HTMLElement,
		private detailEl: HTMLElement,
		private deps: CatalogComponentDeps,
	) {}

	getEntries(): ServiceEntry[] { return this.entries; }
	getSelectedService(): string | null { return this.selectedService; }
	setSelectedService(name: string | null): void { this.selectedService = name; }

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
		const serviceMap = new Map<string, EventCatalogEntry[]>();

		for (const entry of allEntries) {
			const svc = entry.services.trim();
			const list = serviceMap.get(svc) ?? [];
			list.push(entry);
			serviceMap.set(svc, list);
		}

		const { fileMap } = this.scanServiceFolder(serviceMap);

		const state = this.deps.getState();

		// Service names originating from plugin code are always system
		const catalogServiceNames = new Set(EVENT_CATALOG.map((e) => e.services.trim()));

		this.entries = Array.from(serviceMap.entries())
			.map(([name, events]) => {
				const fileData = fileMap.get(name);
				return {
					name,
					description: fileData?.description ?? "",
					events,
					domains: fileData?.domains.length
						? fileData.domains
						: [...new Set(events.map((e) => e.domain))].sort(),
					filePath: fileData?.filePath ?? null,
					configuredCount: events.filter((e) =>
						isConfigured(e.type, state.subscriptions, state.definitions),
					).length,
					visible: (() => {
						const setting = state.catalogServices.find((s) => s.name === name);
						return setting ? setting.visible : true;
					})(),
					isSystem: catalogServiceNames.has(name),
				};
			})
			.sort((a, b) => a.name.localeCompare(b.name));
	}

	private scanServiceFolder(serviceMap: Map<string, EventCatalogEntry[]>): {
		fileMap: Map<string, { filePath: string; description: string; domains: string[] }>;
	} {
		const servicesFolder = this.deps.getEntityFolder("services");
		const folder = this.deps.app.vault.getAbstractFileByPath(servicesFolder);
		const fileMap = new Map<string, { filePath: string; description: string; domains: string[] }>();
		const nonConforming: NonConformingFile[] = [];
		if (folder && folder instanceof TFolder) {
			for (const child of folder.children) {
				if (!(child instanceof TFile) || child.extension !== "md") continue;
				const fm = readFrontmatter(this.deps.vaultQuery, child.path);
				const name = (fm && (fmString(fm, "service") ?? fmString(fm, "name"))) ?? child.basename;
				const description = (fm && fmString(fm, "description")) ?? "";
				const domains = fmStringArray(fm, "domains");
				fileMap.set(name, { filePath: child.path, description, domains });
				if (!serviceMap.has(name)) serviceMap.set(name, []);
				if (!fm || fm.type !== "ServiceDoc") {
					nonConforming.push({ file: child, docType: "ServiceDoc", nameField: "service", name, metadata: { description, domains, services: [] } });
				}
			}
		}
		normalizeNonConformingFiles(this.deps.app, nonConforming);
		return { fileMap };
	}

	// ─────────────────────────────────────────────────────────────
	// Master list
	// ─────────────────────────────────────────────────────────────

	renderMaster(): void {
		this.scan();
		this.masterEl.empty();

		const state = this.deps.getState();
		let services = this.entries;

		if (state.filterText) {
			services = services.filter(
				(s) =>
					s.name.toLowerCase().includes(state.filterText) ||
					s.description.toLowerCase().includes(state.filterText) ||
					s.events.some((e) => e.type.toLowerCase().includes(state.filterText)),
			);
		}

		// Header with add button
		const header = this.masterEl.createDiv({ cls: "ft-master-category-header" });
		header.createSpan({ text: "Services" });
		const addServiceBtn = header.createSpan({ cls: "ft-visibility-toggle ft-ml-auto" });
		setIcon(addServiceBtn, "plus");
		addServiceBtn.setAttribute("aria-label", "Create new service");
		addServiceBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			new InputModal(this.deps.app, {
				title: "Create New Service",
				placeholder: "MyService",
				submitLabel: "Create",
				inputName: "Service name",
				inputDesc: "A short identifier for this service",
				onSubmit: (name) => {
					void this.createDoc(name);
				},
			}).open();
		});

		const visibleServices = services.filter((s) => s.visible);
		const hiddenServices = services.filter((s) => !s.visible);

		const userServices = visibleServices.filter((s) => !s.isSystem);
		const systemServices = visibleServices.filter((s) => s.isSystem);

		for (const s of userServices) {
			this.renderItem(s, this.masterEl);
		}

		if (state.showSystemEvents && systemServices.length > 0) {
			const divider = this.masterEl.createDiv({ cls: "ft-section-divider" });
			divider.createSpan({ text: "System Services", cls: "ft-text-muted ft-text-sm" });
			const systemContainer = this.masterEl.createDiv({ cls: "ft-master-category-system" });
			for (const s of systemServices) {
				this.renderItem(s, systemContainer);
			}
		}

		if (hiddenServices.length > 0) {
			const hiddenHeader = this.masterEl.createDiv({ cls: "ft-master-category-header ft-hidden-header" });
			hiddenHeader.addClass("ft-cursor-pointer");
			hiddenHeader.createSpan({ text: `${hiddenServices.length} hidden` });
			const expandIcon = hiddenHeader.createSpan({ cls: "ft-visibility-toggle ft-ml-auto" });
			setIcon(expandIcon, this.showHidden ? "chevron-up" : "chevron-down");

			const hiddenContainer = this.masterEl.createDiv();
			if (!this.showHidden) hiddenContainer.addClass("ft-hidden");

			hiddenHeader.addEventListener("click", () => {
				this.showHidden = !this.showHidden;
				hiddenContainer.classList.toggle("ft-hidden", !this.showHidden);
				setIcon(expandIcon, this.showHidden ? "chevron-up" : "chevron-down");
			});

			for (const s of hiddenServices) {
				this.renderItem(s, hiddenContainer);
			}
		}
	}

	// ─────────────────────────────────────────────────────────────
	// Master list item
	// ─────────────────────────────────────────────────────────────

	private renderItem(s: ServiceEntry, container: HTMLElement): void {
		const isSelected = this.selectedService === s.name;
		const item = container.createDiv({
			cls: `ft-master-event-item${isSelected ? " ft-master-event-selected" : ""}`,
		});

		if (!s.visible) item.addClass("ft-opacity-60");

		// Eye icon for visibility toggle
		const eyeBtn = item.createSpan({ cls: "ft-visibility-toggle" });
		eyeBtn.addClass("ft-flex-shrink-0");
		eyeBtn.addClass("ft-cursor-pointer");
		setIcon(eyeBtn, s.visible ? "eye" : "eye-off");
		eyeBtn.setAttribute("aria-label", s.visible ? "Hide service" : "Show service");
		eyeBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			this.toggleVisibility(s.name);
		});

		const iconEl = item.createSpan();
		setIcon(iconEl, "server");
		iconEl.addClass("ft-icon-muted");
		iconEl.addClass("ft-flex-shrink-0");

		item.createSpan({ text: s.name, cls: "ft-master-event-name" });

		item.createSpan({
			text: `${s.events.length}`,
			cls: "ft-master-category-count",
		});

		if (s.isSystem) {
			item.createSpan({ text: "system", cls: "ft-badge ft-badge-system" });
		} else if (s.filePath === null) {
			item.createSpan({ text: "undocumented", cls: "ft-badge ft-badge-muted" });
		}

		if (s.configuredCount > 0) {
			const dots = item.createDiv({ cls: "ft-master-status-dots" });
			const dot = dots.createDiv({ cls: "ft-master-status-dot ft-master-dot-configured" });
			dot.title = `${s.configuredCount} configured`;
		}

		item.addEventListener("click", () => {
			this.selectedService = s.name;
			this.renderMaster();
			this.renderDetail();
		});
	}

	// ─────────────────────────────────────────────────────────────
	// Visibility toggle
	// ─────────────────────────────────────────────────────────────

	private toggleVisibility(name: string): void {
		const entry = this.entries.find((s) => s.name === name);
		const currentVisible = entry?.visible ?? true;
		const state = this.deps.getState();
		const updated = state.catalogServices
			.filter((s) => s.name !== name)
			.concat([{ name, visible: !currentVisible }]);
		void this.deps.eventBus.emit("settings.updateCatalogServices", { services: updated });
		this.renderMaster();
		this.renderDetail();
	}

	// ─────────────────────────────────────────────────────────────
	// Detail panel
	// ─────────────────────────────────────────────────────────────

	renderDetail(): void {
		this.detailEl.empty();

		if (!this.selectedService) {
			this.renderDetailEmpty();
			return;
		}

		const serviceData = this.entries.find((s) => s.name === this.selectedService);
		if (!serviceData) {
			this.renderDetailEmpty();
			return;
		}

		// Header
		const header = this.detailEl.createDiv({ cls: "ft-detail-header" });
		const left = header.createDiv();
		left.createDiv({ text: serviceData.name, cls: "ft-detail-event-type" });
		const badges = left.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
		badges.createSpan({ text: `${serviceData.events.length} events`, cls: "ft-badge ft-badge-muted" });
		if (serviceData.isSystem) {
			badges.createSpan({ text: "system", cls: "ft-badge ft-badge-system" });
		} else if (serviceData.filePath === null) {
			badges.createSpan({ text: "undocumented", cls: "ft-badge ft-badge-muted" });
		}

		// Description
		if (serviceData.description) {
			const descCard = this.detailEl.createDiv({ cls: "ft-card ft-mt-2" });
			descCard.createEl("p", {
				text: serviceData.description,
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

		addRow("Total Events", String(serviceData.events.length));
		addRow("Configured", String(serviceData.configuredCount));

		// Domains — each clickable, navigates to Domains tab
		grid.createDiv({ text: "Domains", cls: "ft-detail-info-label" });
		const domVal = grid.createDiv({ cls: "ft-detail-info-value ft-flex ft-gap-1" });
		if (serviceData.domains.length > 0) {
			for (const dom of serviceData.domains) {
				const domLink = domVal.createEl("span", { text: dom, cls: "ft-nav-link" });
				domLink.addEventListener("click", () => this.deps.navigation.navigateToDomain(dom));
			}
		} else {
			domVal.createSpan({ text: "(none)", cls: "ft-text-muted" });
		}

		// Actions
		const actions = this.detailEl.createDiv({ cls: "ft-detail-actions" });

		// Open / create doc
		const docBtn = actions.createEl("span", { cls: "ft-nav-link" });
		const docIcon = docBtn.createSpan();
		setIcon(docIcon, "file-text");
		docBtn.appendText(serviceData.filePath ? " Open Doc" : " Create Doc");
		docBtn.addEventListener("click", () => {
			if (serviceData.filePath) {
				void openFile(this.deps.workspace, serviceData.filePath);
			} else {
				void this.createDoc(serviceData.name);
			}
		});

		// Blueprint button
		const bpBtn = actions.createEl("span", { cls: "ft-nav-link" });
		const bpIcon = bpBtn.createSpan();
		setIcon(bpIcon, "clipboard-list");
		const bpDocPath = getServiceBlueprintPathResolved(
			this.deps.getEntityFolder("services"), serviceData.name,
		);
		const bpExists = !!this.deps.app.vault.getAbstractFileByPath(bpDocPath);
		bpBtn.appendText(bpExists ? " Blueprint" : " Create Blueprint");
		bpBtn.addEventListener("click", () => {
			void this.createBlueprint(serviceData.name);
		});

		// Delete button for documented services (file-based only)
		if (serviceData.filePath) {
			const delBtn = actions.createEl("button", { cls: "ft-btn ft-btn-ghost ft-text-sm ft-text-error" });
			const delIcon = delBtn.createSpan();
			setIcon(delIcon, "trash-2");
			delBtn.appendText(" Delete");
			delBtn.addEventListener("click", () => {
				new ConfirmModal(this.deps.app, {
					message: `Delete service doc "${serviceData.name}"?`,
					confirmLabel: "Delete",
					onConfirm: () => {
						void this.deleteDoc(serviceData.filePath!);
					},
				}).open();
			});
		}

		// Events list
		const section = this.detailEl.createDiv({ cls: "ft-detail-section" });
		const sectionHeader = section.createDiv({ cls: "ft-detail-section-header" });
		sectionHeader.createSpan({
			text: `Events (${serviceData.events.length})`,
			cls: "ft-heading ft-heading-sm",
		});

		for (const entry of serviceData.events) {
			const row = section.createDiv({ cls: "ft-catalog-row" });
			row.addClass("ft-cursor-pointer");

			row.createSpan({ text: entry.type, cls: "ft-event-type" });
			row.createSpan({ text: entry.category, cls: "ft-catalog-meta" });

			row.addEventListener("click", () => {
				this.deps.navigation.navigateToEvent(entry.type);
			});
		}

		// Related entities
		const state = this.deps.getState();
		const criteria = { services: [serviceData.name] };

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
		setIcon(icon, "server");
		icon.addClass("ft-icon-subtle");

		empty.createEl("p", { text: "Select a service to view details" });

		const stats = empty.createDiv({ cls: "ft-catalog-quick-stats" });
		renderStat(stats, `${this.entries.length}`, "services");
		const totalEvents = this.entries.reduce((sum, s) => sum + s.events.length, 0);
		renderStat(stats, `${totalEvents}`, "events");
		const totalConfigured = this.entries.reduce((sum, s) => sum + s.configuredCount, 0);
		renderStat(stats, `${totalConfigured}`, "configured");
	}

	// ─────────────────────────────────────────────────────────────
	// Document CRUD
	// ─────────────────────────────────────────────────────────────

	createDoc(name: string): void {
		const folder = this.deps.getEntityFolder("services");
		const docPath = getServiceDocPathResolved(folder, name);
		const existing = this.deps.app.vault.getAbstractFileByPath(docPath);
		if (existing instanceof TFile) {
			void openFile(this.deps.workspace, docPath);
			return;
		}
		const serviceEvents = this.entries.find((s) => s.name === name)?.events ?? [];
		this.selectedService = name;
		void this.deps.eventBus.emit("doc.create", {
			docType: "ServiceDoc",
			name,
			entityType: "services",
			content: generateServiceDocContent(name, serviceEvents),
			source: "ServicesTab",
		});
	}

	deleteDoc(filePath: string): void {
		this.selectedService = null;
		void this.deps.eventBus.emit("doc.delete", {
			path: filePath,
			source: "ServicesTab",
		});
	}

	createBlueprint(name: string): void {
		const folder = this.deps.getEntityFolder("services");
		const docPath = getServiceBlueprintPathResolved(folder, name);
		const existing = this.deps.app.vault.getAbstractFileByPath(docPath);
		if (existing instanceof TFile) {
			void openFile(this.deps.workspace, docPath);
			return;
		}
		const serviceEvents = this.entries.find((s) => s.name === name)?.events ?? [];
		this.selectedService = name;
		void this.deps.eventBus.emit("doc.create", {
			docType: "ServiceBlueprintDoc",
			name,
			entityType: "services",
			content: generateServiceBlueprintContent(name, serviceEvents),
			source: "ServicesTab",
		});
	}
}
