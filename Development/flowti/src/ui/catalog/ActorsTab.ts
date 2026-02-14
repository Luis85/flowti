import { TFile, setIcon } from "obsidian";
import type { EventCatalogEntry } from "../../infrastructure/events/catalog";
import {
	renderStat, renderRelatedSection,
	findRelatedFlows, findRelatedSystems,
	openFile,
} from "./helpers";
import {
	getActorDocPathResolved,
} from "../eventDocTemplate";
import { InputModal, ConfirmModal } from "../modals";
import type { CatalogComponentDeps, ActorEntry } from "./types";
import { scanEntityFolder } from "./entityScanner";

/**
 * Actors tab component for the Event Catalog view.
 * Renders the master list of actors and the detail panel for a selected actor.
 */
export class ActorsTab {
	private entries: ActorEntry[] = [];
	private selectedActor: string | null = null;

	constructor(
		private masterEl: HTMLElement,
		private detailEl: HTMLElement,
		private deps: CatalogComponentDeps,
	) {}

	getEntries(): ActorEntry[] { return this.entries; }
	getSelectedActor(): string | null { return this.selectedActor; }
	setSelectedActor(name: string | null): void { this.selectedActor = name; }

	render(): void {
		this.scan();
		this.renderMaster();
		this.renderDetail();
	}

	// -----------------------------------------------------------------
	// Scanning
	// -----------------------------------------------------------------

	scan(): void {
		this.entries = scanEntityFolder<ActorEntry>({
			entityType: "actors",
			nameFields: ["actor", "name"],
			docType: "ActorDoc",
			normalizeNameKey: "actor",
			extraServiceFields: ["Systems"],
			mapEntry: (raw, ctx) => ({
				...raw,
				resolvedEvents: raw.events
					.map((t) => ctx.entryMap.get(t))
					.filter((e): e is EventCatalogEntry => e !== undefined),
			}),
		}, this.deps);
	}

	// -----------------------------------------------------------------
	// Master list
	// -----------------------------------------------------------------

	renderMaster(): void {
		this.scan();
		this.masterEl.empty();

		const state = this.deps.getState();
		let actors = this.entries;

		if (state.filterText) {
			actors = actors.filter(
				(p) =>
					p.name.toLowerCase().includes(state.filterText) ||
					p.description.toLowerCase().includes(state.filterText) ||
					p.events.some((e) => e.toLowerCase().includes(state.filterText)) ||
					p.domains.some((d) => d.toLowerCase().includes(state.filterText)) ||
					p.services.some((svc) => svc.toLowerCase().includes(state.filterText)),
			);
		}

		// Header with add button
		const header = this.masterEl.createDiv({ cls: "ft-master-category-header" });
		header.createSpan({ text: "Actors" });
		const addBtn = header.createSpan({ cls: "ft-visibility-toggle" });
		addBtn.style.marginLeft = "auto";
		setIcon(addBtn, "plus");
		addBtn.setAttribute("aria-label", "Create new actor");
		addBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			new InputModal(this.deps.app, {
				title: "Create New Actor",
				placeholder: "My Actor",
				submitLabel: "Create",
				inputName: "Actor name",
				inputDesc: "A name for this actor",
				onSubmit: (name) => {
					void this.createDoc(name);
				},
			}).open();
		});

		for (const p of actors) {
			const isSelected = this.selectedActor === p.name;
			const item = this.masterEl.createDiv({
				cls: `ft-master-event-item${isSelected ? " ft-master-event-selected" : ""}`,
			});

			const iconEl = item.createSpan();
			setIcon(iconEl, "users");
			iconEl.addClass("ft-icon-muted");
			iconEl.addClass("ft-flex-shrink-0");

			item.createSpan({ text: p.name, cls: "ft-master-event-name" });

			item.createSpan({
				text: `${p.resolvedEvents.length}`,
				cls: "ft-master-category-count",
			});

			item.addEventListener("click", () => {
				this.selectedActor = p.name;
				this.renderMaster();
				this.renderDetail();
			});
		}
	}

	// -----------------------------------------------------------------
	// Detail panel
	// -----------------------------------------------------------------

	renderDetail(): void {
		this.detailEl.empty();

		if (!this.selectedActor) {
			this.renderDetailEmpty();
			return;
		}

		const actorData = this.entries.find((p) => p.name === this.selectedActor);
		if (!actorData) {
			this.renderDetailEmpty();
			return;
		}

		// Header
		const header = this.detailEl.createDiv({ cls: "ft-detail-header" });
		const left = header.createDiv();
		left.createDiv({ text: actorData.name, cls: "ft-detail-event-type" });
		const badges = left.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
		badges.createSpan({ text: `${actorData.events.length} events`, cls: "ft-badge ft-badge-muted" });
		badges.createSpan({ text: `${actorData.domains.length} domains`, cls: "ft-badge ft-badge-muted" });
		badges.createSpan({ text: `${actorData.services.length} services`, cls: "ft-badge ft-badge-muted" });

		// Description
		if (actorData.description) {
			const descCard = this.detailEl.createDiv({ cls: "ft-card ft-mt-2" });
			descCard.createEl("p", {
				text: actorData.description,
				cls: "ft-text-muted ft-text-sm",
			});
		}

		// Info card
		const card = this.detailEl.createDiv({ cls: "ft-card ft-mt-2" });
		const grid = card.createDiv({ cls: "ft-detail-info-grid" });

		// Domains -- clickable
		grid.createDiv({ text: "Domains", cls: "ft-detail-info-label" });
		const domVal = grid.createDiv({ cls: "ft-detail-info-value ft-flex ft-gap-1" });
		if (actorData.domains.length > 0) {
			for (const dom of actorData.domains) {
				const domLink = domVal.createEl("span", { text: dom, cls: "ft-nav-link" });
				domLink.addEventListener("click", () => this.deps.navigation.navigateToDomain(dom));
			}
		} else {
			domVal.createSpan({ text: "(none)", cls: "ft-text-muted" });
		}

		// Services -- clickable
		grid.createDiv({ text: "Services", cls: "ft-detail-info-label" });
		const svcVal = grid.createDiv({ cls: "ft-detail-info-value ft-flex ft-gap-1" });
		if (actorData.services.length > 0) {
			for (const svc of actorData.services) {
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
			void openFile(this.deps.app, actorData.filePath);
		});

		// Delete actor
		const delBtn = actions.createEl("button", { cls: "ft-btn ft-btn-ghost ft-text-sm" });
		delBtn.style.color = "var(--text-error)";
		const delIcon = delBtn.createSpan();
		setIcon(delIcon, "trash-2");
		delBtn.appendText(" Delete");
		delBtn.addEventListener("click", () => {
			new ConfirmModal(this.deps.app, {
				message: `Delete actor "${actorData.name}" and its doc file?`,
				confirmLabel: "Delete",
				onConfirm: () => {
					void this.deleteDoc(actorData.filePath);
				},
			}).open();
		});

		// Events list
		const section = this.detailEl.createDiv({ cls: "ft-detail-section" });
		const sectionHeader = section.createDiv({ cls: "ft-detail-section-header" });
		sectionHeader.createSpan({
			text: `Events (${actorData.events.length})`,
			cls: "ft-heading ft-heading-sm",
		});

		for (const eventType of actorData.events) {
			const resolved = actorData.resolvedEvents.find((e) => e.type === eventType);
			const row = section.createDiv({ cls: "ft-catalog-row" });
			row.createSpan({ text: eventType, cls: "ft-event-type" });
			if (resolved) {
				row.addClass("ft-cursor-pointer");
				row.createSpan({ text: resolved.category, cls: "ft-catalog-meta" });
				row.addEventListener("click", () => {
					this.deps.navigation.navigateToEvent(eventType);
				});
			} else {
				row.createSpan({ text: "unresolved", cls: "ft-catalog-meta ft-text-muted" });
			}
		}

		// Related entities (NOT findRelatedActors since we ARE actors)
		const state = this.deps.getState();
		const actorCriteria = { events: actorData.events, domains: actorData.domains, services: actorData.services };

		renderRelatedSection(
			this.detailEl, "Related Flows",
			findRelatedFlows(state.flowEntries, actorCriteria).map((f) => ({
				name: f.name,
				onClick: () => this.deps.navigation.navigateToFlow(f.name),
			})),
		);
		renderRelatedSection(
			this.detailEl, "Related Systems",
			findRelatedSystems(state.systemEntries, actorCriteria).map((s) => ({
				name: s.name,
				onClick: () => this.deps.navigation.navigateToSystem(s.name),
			})),
		);
	}

	// -----------------------------------------------------------------
	// Detail empty state
	// -----------------------------------------------------------------

	private renderDetailEmpty(): void {
		const empty = this.detailEl.createDiv({ cls: "ft-catalog-detail-empty" });

		const icon = empty.createDiv();
		setIcon(icon, "users");
		icon.addClass("ft-icon-subtle");

		empty.createEl("p", { text: "Select an actor to view details" });

		const stats = empty.createDiv({ cls: "ft-catalog-quick-stats" });
		renderStat(stats, `${this.entries.length}`, "actors");
		const totalEvents = this.entries.reduce((sum, p) => sum + p.events.length, 0);
		renderStat(stats, `${totalEvents}`, "events");
		const totalDomains = new Set(this.entries.flatMap((p) => p.domains)).size;
		renderStat(stats, `${totalDomains}`, "domains");
	}

	// -----------------------------------------------------------------
	// Document CRUD
	// -----------------------------------------------------------------

	createDoc(name: string): void {
		const folder = this.deps.getEntityFolder("actors");
		const docPath = getActorDocPathResolved(folder, name);
		const existing = this.deps.app.vault.getAbstractFileByPath(docPath);
		if (existing instanceof TFile) {
			void openFile(this.deps.app, docPath);
			return;
		}
		this.selectedActor = name;
		void this.deps.eventBus.emit("doc.create", {
			docType: "ActorDoc",
			name,
			entityType: "actors",
			source: "ActorsTab",
		});
	}

	deleteDoc(filePath: string): void {
		this.selectedActor = null;
		void this.deps.eventBus.emit("doc.delete", {
			path: filePath,
			source: "ActorsTab",
		});
	}
}
