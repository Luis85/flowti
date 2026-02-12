import { TFile, TFolder, setIcon } from "obsidian";
import { InputModal, CreateEventModal } from "../modals";
import { getVisibleEntries, discoveredToCatalogEntries, UNCATEGORIZED_CATEGORY } from "./helpers";
import type { CatalogComponentDeps } from "./types";

/**
 * Dashboard homepage for the Event Catalog view.
 * Shows stats grid, documentation coverage, and quick-action buttons.
 */
export class CatalogDashboard {
	constructor(
		private container: HTMLElement,
		private deps: CatalogComponentDeps,
	) {}

	render(): void {
		this.container.empty();

		const state = this.deps.getState();

		// Stats grid
		const grid = this.container.createDiv({ cls: "ft-dashboard-grid" });
		grid.style.display = "grid";
		grid.style.gridTemplateColumns = "repeat(3, 1fr)";
		grid.style.gap = "0.75rem";
		grid.style.marginBottom = "1.5rem";

		const visibleDomains = state.domainEntries.filter((d) =>
			d.visible && (state.showSystemEvents || !d.isSystem));
		const visibleServices = state.serviceEntries.filter((s) =>
			s.visible && (state.showSystemEvents || !s.isSystem));
		const visibleEvents = getVisibleEntries(
			state.catalogCategories, state.showSystemEvents,
			state.discoveredEvents, this.deps.app, this.deps.getEntityFolder("events"),
		);

		const cards: Array<{ icon: string; count: number; label: string; tab: string }> = [
			{ icon: "boxes", count: visibleDomains.length, label: "Domains", tab: "domains" },
			{ icon: "server", count: visibleServices.length, label: "Services", tab: "services" },
			{ icon: "list", count: visibleEvents.length, label: "Events", tab: "events" },
			{ icon: "git-branch", count: state.flowEntries.length, label: "Flows", tab: "flows" },
			{ icon: "layout-grid", count: state.systemEntries.length, label: "Systems", tab: "systems" },
			{ icon: "users", count: state.actorEntries.length, label: "Actors", tab: "actors" },
			{ icon: "package", count: state.productEntries.length, label: "Products", tab: "products" },
		];

		for (const card of cards) {
			const el = grid.createDiv({ cls: "ft-dashboard-card" });
			el.style.border = "1px solid var(--background-modifier-border)";
			el.style.borderRadius = "8px";
			el.style.padding = "1rem";
			el.style.cursor = "pointer";
			el.style.display = "flex";
			el.style.alignItems = "center";
			el.style.gap = "0.75rem";
			el.style.transition = "border-color 0.15s";
			el.addEventListener("mouseenter", () => {
				el.style.borderColor = "var(--interactive-accent)";
			});
			el.addEventListener("mouseleave", () => {
				el.style.borderColor = "var(--background-modifier-border)";
			});
			el.addEventListener("click", () => {
				this.deps.navigation.navigateToTab(card.tab);
			});

			const iconEl = el.createDiv();
			iconEl.style.opacity = "0.6";
			setIcon(iconEl, card.icon);

			const text = el.createDiv();
			text.createDiv({ text: String(card.count), cls: "ft-catalog-stat-value" });
			text.createDiv({ text: card.label, cls: "ft-catalog-stat-label" });
		}

		// Documentation coverage
		this.renderCoverage(state);

		// Quick actions
		this.renderQuickActions();

		// Links
		this.renderLinks();
	}

	private renderCoverage(state: ReturnType<CatalogComponentDeps["getState"]>): void {
		const coverageSection = this.container.createDiv();
		coverageSection.style.marginBottom = "1.5rem";
		coverageSection.createEl("h3", { text: "Documentation Coverage", cls: "ft-heading ft-heading-sm" });
		coverageSection.style.marginBottom = "0.75rem";

		const coverageGrid = coverageSection.createDiv();
		coverageGrid.style.display = "grid";
		coverageGrid.style.gridTemplateColumns = "repeat(2, 1fr)";
		coverageGrid.style.gap = "0.5rem";

		const filteredDomains = state.domainEntries.filter((d) =>
			d.visible && (state.showSystemEvents || !d.isSystem));
		const totalDomains = filteredDomains.length;
		const docDomains = filteredDomains.filter((d) => d.filePath !== null).length;
		const filteredServices = state.serviceEntries.filter((s) =>
			s.visible && (state.showSystemEvents || !s.isSystem));
		const totalServices = filteredServices.length;
		const docServices = filteredServices.filter((s) => s.filePath !== null).length;

		let archDocCount = 0;
		let blueprintCount = 0;
		const domainsFolder = this.deps.app.vault.getAbstractFileByPath(this.deps.getEntityFolder("domains"));
		if (domainsFolder instanceof TFolder) {
			archDocCount = domainsFolder.children.filter(
				(f) => f instanceof TFile && f.extension === "md" && f.name.endsWith(".architecture.md"),
			).length;
		}
		const servicesFolder = this.deps.app.vault.getAbstractFileByPath(this.deps.getEntityFolder("services"));
		if (servicesFolder instanceof TFolder) {
			blueprintCount = servicesFolder.children.filter(
				(f) => f instanceof TFile && f.extension === "md" && f.name.endsWith(".blueprint.md"),
			).length;
		}

		const coverageItems = [
			{ label: "Domain Docs", value: `${docDomains} / ${totalDomains}` },
			{ label: "Service Docs", value: `${docServices} / ${totalServices}` },
			{ label: "Architecture Docs", value: String(archDocCount) },
			{ label: "Service Blueprints", value: String(blueprintCount) },
		];

		for (const item of coverageItems) {
			const row = coverageGrid.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
			row.style.padding = "0.4rem 0.5rem";
			row.style.borderRadius = "4px";
			row.style.border = "1px solid var(--background-modifier-border)";
			row.createSpan({ text: item.value, cls: "ft-badge ft-badge-muted" });
			row.createSpan({ text: item.label, cls: "ft-text-sm" });
		}
	}

	private renderQuickActions(): void {
		const actionsSection = this.container.createDiv();
		actionsSection.createEl("h3", { text: "Quick Actions", cls: "ft-heading ft-heading-sm" });
		actionsSection.style.marginBottom = "0.75rem";

		const actionsGrid = actionsSection.createDiv({ cls: "ft-flex ft-gap-2" });
		actionsGrid.style.flexWrap = "wrap";

		const createActions: Array<{ icon: string; label: string; action: () => void }> = [
			{
				icon: "boxes",
				label: "New Domain",
				action: () => {
					new InputModal(this.deps.app, {
						title: "Create New Domain",
						placeholder: "my-domain",
						submitLabel: "Create",
						inputName: "Domain name",
						inputDesc: "A short identifier for this domain",
						onSubmit: (name) => { this.deps.createEntity("domains", name); },
					}).open();
				},
			},
			{
				icon: "server",
				label: "New Service",
				action: () => {
					new InputModal(this.deps.app, {
						title: "Create New Service",
						placeholder: "MyService",
						submitLabel: "Create",
						inputName: "Service name",
						inputDesc: "A short identifier for this service",
						onSubmit: (name) => { this.deps.createEntity("services", name); },
					}).open();
				},
			},
			{
				icon: "zap",
				label: "New Event",
				action: () => {
					const state = this.deps.getState();
					const entries = discoveredToCatalogEntries(
						state.discoveredEvents, this.deps.app, this.deps.getEntityFolder("events"),
					);
					const existingCategories = [...new Set(entries.map((e) => e.category))]
						.filter((c) => c !== UNCATEGORIZED_CATEGORY)
						.sort();
					new CreateEventModal(this.deps.app, {
						title: "Create Custom Event",
						existingCategories,
						onSubmit: (name, category) => {
							this.deps.createEntity("events", name, category ? { category } : undefined);
						},
					}).open();
				},
			},
			{
				icon: "git-branch",
				label: "New Flow",
				action: () => {
					new InputModal(this.deps.app, {
						title: "Create New Flow",
						placeholder: "My Flow",
						submitLabel: "Create",
						inputName: "Flow name",
						inputDesc: "A name for this flow",
						onSubmit: (name) => { this.deps.createEntity("flows", name); },
					}).open();
				},
			},
			{
				icon: "layout-grid",
				label: "New System",
				action: () => {
					new InputModal(this.deps.app, {
						title: "Create New System",
						placeholder: "My System",
						submitLabel: "Create",
						inputName: "System name",
						inputDesc: "A name for this system",
						onSubmit: (name) => { this.deps.createEntity("systems", name); },
					}).open();
				},
			},
			{
				icon: "users",
				label: "New Actor",
				action: () => {
					new InputModal(this.deps.app, {
						title: "Create New Actor",
						placeholder: "My Actor",
						submitLabel: "Create",
						inputName: "Actor name",
						inputDesc: "A name for this actor",
						onSubmit: (name) => { this.deps.createEntity("actors", name); },
					}).open();
				},
			},
			{
				icon: "package",
				label: "New Product",
				action: () => {
					new InputModal(this.deps.app, {
						title: "Create New Product",
						placeholder: "My Product",
						submitLabel: "Create",
						inputName: "Product name",
						inputDesc: "A name for this product",
						onSubmit: (name) => { this.deps.createEntity("products", name); },
					}).open();
				},
			},
		];

		for (const act of createActions) {
			const btn = actionsGrid.createEl("span", { cls: "ft-nav-link" });
			const icon = btn.createSpan();
			setIcon(icon, act.icon);
			btn.appendText(` ${act.label}`);
			btn.addEventListener("click", act.action);
		}
	}

	private renderLinks(): void {
		const section = this.container.createDiv({ cls: "ft-flex ft-gap-2" });
		section.style.marginTop = "1.5rem";

		const logBtn = section.createEl("span", { cls: "ft-nav-link" });
		const logIcon = logBtn.createSpan();
		setIcon(logIcon, "activity");
		logBtn.appendText(" Activity Log");
		logBtn.addEventListener("click", () => this.deps.navigation.openActivityLog());

		const subBtn = section.createEl("span", { cls: "ft-nav-link" });
		const subIcon = subBtn.createSpan();
		setIcon(subIcon, "bell");
		subBtn.appendText(" Watchers");
		subBtn.addEventListener("click", () => this.deps.navigation.openSubscriptionManager());
	}
}
