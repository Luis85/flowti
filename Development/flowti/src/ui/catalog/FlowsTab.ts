import { TFile, TFolder, setIcon } from "obsidian";
import { EVENT_CATALOG, type EventCatalogEntry } from "../../infrastructure/events/catalog";
import {
	readFrontmatter, fmString, fmStringArray, normalizeDocFrontmatter,
	discoveredToCatalogEntries,
	renderStat, renderRelatedSection,
	findRelatedSystems, findRelatedActors,
	openFile,
} from "./helpers";
import {
	getFlowDocPathResolved, generateFlowDocContent,
} from "../eventDocTemplate";
import { InputModal, ConfirmModal } from "../modals";
import type { CatalogComponentDeps, FlowEntry } from "./types";

/**
 * Flows tab component for the Event Catalog view.
 * Renders the master list of flows and the detail panel for a selected flow.
 */
export class FlowsTab {
	private entries: FlowEntry[] = [];
	private selectedFlow: string | null = null;

	constructor(
		private masterEl: HTMLElement,
		private detailEl: HTMLElement,
		private deps: CatalogComponentDeps,
	) {}

	getEntries(): FlowEntry[] { return this.entries; }
	getSelectedFlow(): string | null { return this.selectedFlow; }
	setSelectedFlow(name: string | null): void { this.selectedFlow = name; }

	render(): void {
		this.scan();
		this.renderMaster();
		this.renderDetail();
	}

	// ─────────────────────────────────────────────────────────────
	// Scanning
	// ─────────────────────────────────────────────────────────────

	scan(): void {
		const flowsFolder = this.deps.getEntityFolder("flows");
		const folder = this.deps.app.vault.getAbstractFileByPath(flowsFolder);

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
		const entryMap = new Map(allEntries.map((e) => [e.type, e]));
		const entries: FlowEntry[] = [];

		for (const child of folder.children) {
			if (!(child instanceof TFile) || child.extension !== "md") continue;

			const fm = readFrontmatter(this.deps.app, child.path);

			const name = (fm && (fmString(fm, "flow")
				?? fmString(fm, "trigger")
				?? fmString(fm, "name"))) ?? child.basename;
			const description = (fm && fmString(fm, "description")) ?? "";
			const events = fmStringArray(fm, "events");
			const domains = fmStringArray(fm, "domains");
			const services = [
				...fmStringArray(fm, "services"),
				...fmStringArray(fm, "Systems"),
			];

			const resolvedEvents = events
				.map((t) => entryMap.get(t))
				.filter((e): e is EventCatalogEntry => e !== undefined);

			entries.push({ name, description, events, domains, services, filePath: child.path, resolvedEvents });

			if (!fm || fm.type !== "FlowDoc") {
				normalizeDocFrontmatter(
					this.deps.app, child, "FlowDoc", "flow", name,
					{ description, events, domains, services },
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
		let flows = this.entries;

		if (state.filterText) {
			flows = flows.filter(
				(f) =>
					f.name.toLowerCase().includes(state.filterText) ||
					f.description.toLowerCase().includes(state.filterText) ||
					f.events.some((e) => e.toLowerCase().includes(state.filterText)) ||
					f.domains.some((d) => d.toLowerCase().includes(state.filterText)) ||
					f.services.some((svc) => svc.toLowerCase().includes(state.filterText)),
			);
		}

		// Header with add button
		const header = this.masterEl.createDiv({ cls: "ft-master-category-header" });
		header.createSpan({ text: "Flows" });
		const addBtn = header.createSpan({ cls: "ft-visibility-toggle" });
		addBtn.style.marginLeft = "auto";
		setIcon(addBtn, "plus");
		addBtn.setAttribute("aria-label", "Create new flow");
		addBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			new InputModal(this.deps.app, {
				title: "Create New Flow",
				placeholder: "My Flow",
				submitLabel: "Create",
				inputName: "Flow name",
				inputDesc: "A name for this flow",
				onSubmit: (name) => {
					void this.createDoc(name);
				},
			}).open();
		});

		for (const f of flows) {
			const isSelected = this.selectedFlow === f.name;
			const item = this.masterEl.createDiv({
				cls: `ft-master-event-item${isSelected ? " ft-master-event-selected" : ""}`,
			});

			const iconEl = item.createSpan();
			setIcon(iconEl, "git-branch");
			iconEl.style.opacity = "0.5";
			iconEl.style.flexShrink = "0";

			item.createSpan({ text: f.name, cls: "ft-master-event-name" });

			item.createSpan({
				text: `${f.resolvedEvents.length}`,
				cls: "ft-master-category-count",
			});

			item.addEventListener("click", () => {
				this.selectedFlow = f.name;
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

		if (!this.selectedFlow) {
			this.renderDetailEmpty();
			return;
		}

		const flowData = this.entries.find((f) => f.name === this.selectedFlow);
		if (!flowData) {
			this.renderDetailEmpty();
			return;
		}

		// Header
		const header = this.detailEl.createDiv({ cls: "ft-detail-header" });
		const left = header.createDiv();
		left.createDiv({ text: flowData.name, cls: "ft-detail-event-type" });
		const badges = left.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
		badges.createSpan({ text: `${flowData.events.length} events`, cls: "ft-badge ft-badge-muted" });
		badges.createSpan({ text: `${flowData.domains.length} domains`, cls: "ft-badge ft-badge-muted" });
		badges.createSpan({ text: `${flowData.services.length} services`, cls: "ft-badge ft-badge-muted" });

		// Description
		if (flowData.description) {
			const descCard = this.detailEl.createDiv({ cls: "ft-card ft-mt-2" });
			descCard.createEl("p", {
				text: flowData.description,
				cls: "ft-text-muted ft-text-sm",
			});
		}

		// Info card
		const card = this.detailEl.createDiv({ cls: "ft-card ft-mt-2" });
		const grid = card.createDiv({ cls: "ft-detail-info-grid" });

		// Domains — clickable
		grid.createDiv({ text: "Domains", cls: "ft-detail-info-label" });
		const domVal = grid.createDiv({ cls: "ft-detail-info-value ft-flex ft-gap-1" });
		if (flowData.domains.length > 0) {
			for (const dom of flowData.domains) {
				const domLink = domVal.createEl("span", { text: dom, cls: "ft-nav-link" });
				domLink.addEventListener("click", () => this.deps.navigation.navigateToDomain(dom));
			}
		} else {
			domVal.createSpan({ text: "(none)", cls: "ft-text-muted" });
		}

		// Services — clickable
		grid.createDiv({ text: "Services", cls: "ft-detail-info-label" });
		const svcVal = grid.createDiv({ cls: "ft-detail-info-value ft-flex ft-gap-1" });
		if (flowData.services.length > 0) {
			for (const svc of flowData.services) {
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
			void openFile(this.deps.app, flowData.filePath);
		});

		// Delete flow
		const delBtn = actions.createEl("button", { cls: "ft-btn ft-btn-ghost ft-text-sm" });
		delBtn.style.color = "var(--text-error)";
		const delIcon = delBtn.createSpan();
		setIcon(delIcon, "trash-2");
		delBtn.appendText(" Delete");
		delBtn.addEventListener("click", () => {
			new ConfirmModal(this.deps.app, {
				message: `Delete flow "${flowData.name}" and its doc file?`,
				confirmLabel: "Delete",
				onConfirm: () => {
					void this.deleteDoc(flowData.filePath);
				},
			}).open();
		});

		// Events list
		const section = this.detailEl.createDiv({ cls: "ft-detail-section" });
		const sectionHeader = section.createDiv({ cls: "ft-detail-section-header" });
		sectionHeader.createSpan({
			text: `Events (${flowData.events.length})`,
			cls: "ft-heading ft-heading-sm",
		});

		for (const eventType of flowData.events) {
			const resolved = flowData.resolvedEvents.find((e) => e.type === eventType);
			const row = section.createDiv({ cls: "ft-catalog-row" });
			row.createSpan({ text: eventType, cls: "ft-event-type" });
			if (resolved) {
				row.style.cursor = "pointer";
				row.createSpan({ text: resolved.category, cls: "ft-catalog-meta" });
				row.addEventListener("click", () => {
					this.deps.navigation.navigateToEvent(eventType);
				});
			} else {
				row.createSpan({ text: "unresolved", cls: "ft-catalog-meta ft-text-muted" });
			}
		}

		// Related entities (NOT findRelatedFlows since we ARE a flow)
		const state = this.deps.getState();
		const flowCriteria = { events: flowData.events, domains: flowData.domains, services: flowData.services };

		renderRelatedSection(
			this.detailEl, "Related Systems",
			findRelatedSystems(state.systemEntries, flowCriteria).map((s) => ({
				name: s.name,
				onClick: () => this.deps.navigation.navigateToSystem(s.name),
			})),
		);
		renderRelatedSection(
			this.detailEl, "Related Actors",
			findRelatedActors(state.actorEntries, flowCriteria).map((a) => ({
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
		setIcon(icon, "git-branch");
		icon.style.opacity = "0.3";

		empty.createEl("p", { text: "Select a flow to view details" });

		const stats = empty.createDiv({ cls: "ft-catalog-quick-stats" });
		renderStat(stats, `${this.entries.length}`, "flows");
		const totalEvents = this.entries.reduce((sum, f) => sum + f.events.length, 0);
		renderStat(stats, `${totalEvents}`, "events");
		const totalDomains = new Set(this.entries.flatMap((f) => f.domains)).size;
		renderStat(stats, `${totalDomains}`, "domains");
	}

	// ─────────────────────────────────────────────────────────────
	// Document CRUD
	// ─────────────────────────────────────────────────────────────

	async createDoc(name: string): Promise<void> {
		const docPath = getFlowDocPathResolved(this.deps.getEntityFolder("flows"), name);

		const existing = this.deps.app.vault.getAbstractFileByPath(docPath);
		if (existing) {
			if (existing instanceof TFile) {
				const leaf = this.deps.app.workspace.getLeaf(false);
				await leaf.openFile(existing);
			}
			return;
		}

		const content = generateFlowDocContent(name);
		try {
			await this.deps.fileSystemClient.createFile(docPath, content, { createFolders: true });
		} catch (err) {
			console.error(`[Flowti] Failed to create flow doc: ${docPath}`, err);
			return;
		}

		this.selectedFlow = name;
		setTimeout(() => this.deps.scheduleRender(), 500);
	}

	async deleteDoc(filePath: string): Promise<void> {
		try {
			await this.deps.fileSystemClient.deleteFile(filePath);
		} catch (err) {
			console.error(`[Flowti] Failed to delete flow doc: ${filePath}`, err);
			return;
		}

		this.selectedFlow = null;
		this.deps.scheduleRender();
	}
}
