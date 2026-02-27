import { TFile, TFolder, setIcon } from "obsidian";
import { InputModal, CreateEventModal } from "../modals";
import { getVisibleEntries, discoveredToCatalogEntries, UNCATEGORIZED_CATEGORY } from "./helpers";
import { renderStatGrid } from "../shared/StatCard";
import type { StatCardItem } from "../shared/StatCard";
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
		const visibleDomains = state.domainEntries.filter((d) =>
			d.visible && (state.showSystemEvents || !d.isSystem));
		const visibleServices = state.serviceEntries.filter((s) =>
			s.visible && (state.showSystemEvents || !s.isSystem));
		const visibleEvents = getVisibleEntries(
			state.catalogCategories, state.showSystemEvents,
			state.discoveredEvents, this.deps.vaultQuery, this.deps.getEntityFolder("events"),
		);

		const totalEntities = visibleDomains.length + visibleServices.length + visibleEvents.length
			+ state.flowEntries.length + state.systemEntries.length
			+ state.actorEntries.length + state.productEntries.length;

		if (totalEntities === 0) {
			this.renderEmptyState();
			return;
		}

		// ── Title bar ──
		const titleBar = this.container.createDiv({ cls: "ft-flex ft-items-center ft-gap-3 ft-mb-3" });
		titleBar.style.borderBottom = "1px solid var(--background-modifier-border)";
		titleBar.style.paddingBottom = "0.75rem";
		const titleIcon = titleBar.createSpan();
		setIcon(titleIcon, "network");
		titleIcon.addClass("ft-icon-muted");
		titleBar.createEl("h2", {
			text: "Event catalog",
			cls: "ft-heading",
		}).style.margin = "0";

		const cards: StatCardItem[] = [
			{ icon: "boxes", value: String(visibleDomains.length), label: "Domains", onClick: () => this.deps.navigation.navigateToTab("domains") },
			{ icon: "server", value: String(visibleServices.length), label: "Services", onClick: () => this.deps.navigation.navigateToTab("services") },
			{ icon: "list", value: String(visibleEvents.length), label: "Events", onClick: () => this.deps.navigation.navigateToTab("events") },
			{ icon: "git-branch", value: String(state.flowEntries.length), label: "Flows", onClick: () => this.deps.navigation.navigateToTab("flows") },
			{ icon: "layout-grid", value: String(state.systemEntries.length), label: "Systems", onClick: () => this.deps.navigation.navigateToTab("systems") },
			{ icon: "users", value: String(state.actorEntries.length), label: "Actors", onClick: () => this.deps.navigation.navigateToTab("actors") },
			{ icon: "package", value: String(state.productEntries.length), label: "Products", onClick: () => this.deps.navigation.navigateToTab("products") },
		];

		renderStatGrid(this.container, cards, 3);

		// Documentation coverage
		this.renderCoverage(state);

		// Quick actions
		this.renderQuickActions();

		// Links
		this.renderLinks();
	}

	private renderEmptyState(): void {
		const wrapper = this.container.createDiv({ cls: "ft-empty-state" });
		wrapper.style.cssText = "text-align:center;padding:2.5rem 1.5rem 1.5rem";

		// Hero icon
		const iconEl = wrapper.createDiv();
		setIcon(iconEl, "activity");
		iconEl.style.cssText = "opacity:0.35;margin-bottom:0.75rem";
		const svg = iconEl.querySelector("svg");
		if (svg) { svg.style.width = "2.5rem"; svg.style.height = "2.5rem"; }

		// Heading
		const heading = wrapper.createDiv({ text: "Welcome to the Event Catalog" });
		heading.style.cssText = "font-weight:600;font-size:var(--font-ui-medium);margin-bottom:0.35rem";

		// Subtitle
		wrapper.createDiv({
			text: "Events appear as you use Flowti \u2014 file changes, imports, sessions, and more.",
			cls: "ft-text-sm ft-text-muted",
		}).style.marginBottom = "1.5rem";

		// Info card
		const card = wrapper.createDiv({ cls: "ft-stat-card" });
		card.style.cssText = "padding:1rem;max-width:360px;margin:0 auto;text-align:left";

		const titleRow = card.createDiv();
		titleRow.style.cssText = "display:flex;align-items:center;gap:0.4rem;font-weight:600;font-size:var(--font-ui-small);margin-bottom:0.35rem";
		const cardIcon = titleRow.createSpan();
		setIcon(cardIcon, "info");
		cardIcon.style.cssText = "display:inline-flex;align-items:center";
		const cardSvg = cardIcon.querySelector("svg");
		if (cardSvg) { cardSvg.style.width = "14px"; cardSvg.style.height = "14px"; }
		titleRow.createSpan({ text: "How events populate" });

		card.createDiv({
			text: "Events will appear automatically as you use Flowti. Try importing a CSV or starting a session to see your first events.",
			cls: "ft-text-xs ft-text-muted",
		});
	}

	private renderCoverage(state: ReturnType<CatalogComponentDeps["getState"]>): void {
		const coverageSection = this.container.createDiv();
		coverageSection.style.marginBottom = "1.5rem";
		coverageSection.createEl("h3", { text: "Documentation coverage", cls: "ft-heading ft-heading-sm" });
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
		actionsSection.createEl("h3", { text: "Quick actions", cls: "ft-heading ft-heading-sm" });
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
						state.discoveredEvents, this.deps.vaultQuery, this.deps.getEntityFolder("events"),
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
