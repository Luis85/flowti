/**
 * Event detail panel — header, info card, actions, watchers, transforms, related entities.
 * Extracted from EventsTab to reduce its LOC.
 */

import { setIcon } from "obsidian";
import {
	EVENT_CATALOG,
	type EventCatalogEntry,
} from "../../infrastructure/events/catalog";
import { ConfirmModal } from "../modals";
import { EventConfigModal } from "../EventConfigModal";
import type { Subscription } from "../../domain/subscription/types";
import type { EventDefinition } from "../../domain/eventDefinition/types";
import type { CatalogComponentDeps } from "./types";
import {
	isDiscoveredEvent,
	renderStat,
	renderRelatedSection,
	discoveredToCatalogEntries,
	resolveEntry,
	getConfiguredCount,
	getFollowedCount,
	findRelatedFlows,
	findRelatedSystems,
	findRelatedActors,
	getSourcePath,
	openFile,
	openOrCreateEventDoc,
} from "./helpers";

export class EventDetailPanel {
	constructor(
		private container: HTMLElement,
		private deps: CatalogComponentDeps,
		private onEventDeleted: () => void,
	) {}

	render(eventType: string | null): void {
		this.container.empty();

		if (!eventType) {
			this.renderEmpty();
			return;
		}

		const entry = resolveEntry(eventType, this.deps.getState().discoveredEvents, this.deps.app, this.deps.getEntityFolder("events"));
		if (!entry) {
			this.renderEmpty();
			return;
		}

		this.renderContent(entry);
	}

	private renderEmpty(): void {
		const state = this.deps.getState();
		const eventsFolder = this.deps.getEntityFolder("events");
		const empty = this.container.createDiv({ cls: "ft-catalog-detail-empty" });

		const icon = empty.createDiv();
		setIcon(icon, "list");
		icon.addClass("ft-icon-subtle");

		empty.createEl("p", { text: "Select an event to view details" });

		// Quick stats
		const allEntries = [...EVENT_CATALOG, ...discoveredToCatalogEntries(state.discoveredEvents, this.deps.app, eventsFolder)];
		const configuredCount = getConfiguredCount(state.catalogCategories, state.showSystemEvents, state.discoveredEvents, this.deps.app, eventsFolder, state.subscriptions, state.definitions);
		const followedCount = getFollowedCount(state.catalogCategories, state.showSystemEvents, state.discoveredEvents, this.deps.app, eventsFolder, state.notifiedTypes);

		const stats = empty.createDiv({ cls: "ft-catalog-quick-stats" });
		renderStat(stats, `${allEntries.length}`, "events");
		renderStat(stats, `${configuredCount}`, "configured");
		renderStat(stats, `${followedCount}`, "followed");
	}

	private renderContent(entry: EventCatalogEntry): void {
		const state = this.deps.getState();
		const isCustom = isDiscoveredEvent(entry.type, state.discoveredEvents);

		this.renderHeader(entry);
		this.renderInfoCard(entry);
		this.renderActions(entry, isCustom);
		this.renderWatchers(entry);
		this.renderTransforms(entry);

		// Related entities
		const criteria = { events: [entry.type] };
		renderRelatedSection(this.container, "Related Flows",
			findRelatedFlows(state.flowEntries, criteria).map((f) => ({ name: f.name, onClick: () => this.deps.navigation.navigateToFlow(f.name) })));
		renderRelatedSection(this.container, "Related Systems",
			findRelatedSystems(state.systemEntries, criteria).map((s) => ({ name: s.name, onClick: () => this.deps.navigation.navigateToSystem(s.name) })));
		renderRelatedSection(this.container, "Related Actors",
			findRelatedActors(state.actorEntries, criteria).map((a) => ({ name: a.name, onClick: () => this.deps.navigation.navigateToActor(a.name) })));
	}

	private renderHeader(entry: EventCatalogEntry): void {
		const header = this.container.createDiv({ cls: "ft-detail-header" });

		const left = header.createDiv();
		left.createDiv({ text: entry.type, cls: "ft-detail-event-type" });

		const badges = left.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
		badges.createSpan({ text: entry.category, cls: "ft-badge ft-badge-muted" });
		if (entry.stability) {
			badges.createSpan({ text: entry.stability, cls: "ft-badge ft-badge-muted" });
		}
		for (const tag of entry.tags) {
			badges.createSpan({ text: tag, cls: "ft-badge ft-badge-tag" });
		}
	}

	private renderInfoCard(entry: EventCatalogEntry): void {
		const card = this.container.createDiv({ cls: "ft-card ft-mt-2" });

		if (entry.description) {
			card.createEl("p", {
				text: entry.description,
				cls: "ft-text-muted ft-text-sm ft-mb-2",
			});
		}

		const grid = card.createDiv({ cls: "ft-detail-info-grid" });

		const addRow = (label: string, value: string) => {
			grid.createDiv({ text: label, cls: "ft-detail-info-label" });
			grid.createDiv({ text: value, cls: "ft-detail-info-value" });
		};

		addRow("Direction", entry.direction);

		// Domain — clickable
		grid.createDiv({ text: "Domain", cls: "ft-detail-info-label" });
		const domainVal = grid.createDiv({ cls: "ft-detail-info-value" });
		const domainLink = domainVal.createEl("span", { text: entry.domain, cls: "ft-nav-link" });
		domainLink.addEventListener("click", () => this.deps.navigation.navigateToDomain(entry.domain));

		// Services — clickable
		grid.createDiv({ text: "Services", cls: "ft-detail-info-label" });
		const serviceVal = grid.createDiv({ cls: "ft-detail-info-value" });
		const serviceLink = serviceVal.createEl("span", { text: entry.services, cls: "ft-nav-link" });
		serviceLink.addEventListener("click", () => this.deps.navigation.navigateToService(entry.services));

		if (entry.stability) addRow("Stability", entry.stability);
		if (entry.visibility) addRow("Visibility", entry.visibility);
	}

	private renderActions(entry: EventCatalogEntry, isCustom: boolean): void {
		const state = this.deps.getState();
		const actions = this.container.createDiv({ cls: "ft-detail-actions" });

		// Event Doc
		const docBtn = actions.createEl("span", { cls: "ft-nav-link" });
		const docIcon = docBtn.createSpan();
		setIcon(docIcon, "file-text");
		docBtn.appendText(" Event Doc");
		docBtn.addEventListener("click", () => {
			void openOrCreateEventDoc(this.deps.app, this.deps.eventBus, this.deps.getEntityFolder("events"), entry);
		});

		// Follow toggle
		const isFollowed = state.notifiedTypes.has(entry.type);
		const followBtn = actions.createEl("button", {
			cls: `ft-btn ft-text-sm ${isFollowed ? "ft-btn-primary" : "ft-btn-secondary"}`,
		});
		followBtn.title = isFollowed
			? "Currently following \u2014 a Notice popup will appear when this event fires"
			: "Follow this event to get a Notice popup when it fires";
		const followIcon = followBtn.createSpan();
		setIcon(followIcon, isFollowed ? "bell" : "bell-off");
		followBtn.appendText(isFollowed ? " Following" : " Follow");
		followBtn.addEventListener("click", () => {
			void this.deps.eventBus.emit("eventNotify.toggle", { eventType: entry.type });
		});

		// Activity Log visibility
		const isExcluded = state.excludedTypes.has(entry.type);
		const visBtn = actions.createEl("button", {
			cls: `ft-btn ft-text-sm ${isExcluded ? "ft-btn-ghost" : "ft-btn-secondary"}`,
		});
		visBtn.title = isExcluded
			? "Hidden from the Activity Log \u2014 click to show"
			: "Visible in the Activity Log \u2014 click to hide";
		const visIcon = visBtn.createSpan();
		setIcon(visIcon, isExcluded ? "eye-off" : "eye");
		visBtn.appendText(isExcluded ? " Hidden from Log" : " In Activity Log");
		visBtn.addEventListener("click", () => {
			void this.deps.eventBus.emit("eventFilter.toggle", { eventType: entry.type });
		});

		// Source file (custom events)
		if (isCustom) {
			const sourcePath = getSourcePath(state.discoveredEvents, entry.type);
			if (sourcePath) {
				const srcBtn = actions.createEl("span", { cls: "ft-nav-link" });
				const srcIcon = srcBtn.createSpan();
				setIcon(srcIcon, "file-input");
				srcBtn.appendText(" Source");
				srcBtn.addEventListener("click", () => {
					void openFile(this.deps.app, sourcePath);
				});
			}
		}

		// Delete (custom events)
		if (isCustom) {
			const delBtn = actions.createEl("button", { cls: "ft-btn ft-btn-ghost ft-text-sm" });
			delBtn.style.color = "var(--text-error)";
			const delIcon = delBtn.createSpan();
			setIcon(delIcon, "trash-2");
			delBtn.appendText(" Delete");
			delBtn.addEventListener("click", () => {
				new ConfirmModal(this.deps.app, {
					message: `Remove "${entry.type}" from the catalog?`,
					confirmLabel: "Remove",
					onConfirm: () => {
						void this.deps.eventBus.emit("discovery.remove", { eventName: entry.type });
						this.onEventDeleted();
					},
				}).open();
			});
		}
	}

	private renderWatchers(entry: EventCatalogEntry): void {
		const state = this.deps.getState();
		const subs = state.subscriptions.filter((s: Subscription) => s.eventType === entry.type);
		const eventsFolder = this.deps.getEntityFolder("events");

		const section = this.container.createDiv({ cls: "ft-detail-section" });
		const header = section.createDiv({ cls: "ft-detail-section-header" });

		header.createSpan({
			text: `Watchers (${subs.length})`,
			cls: "ft-heading ft-heading-sm",
		});

		const addBtn = header.createEl("button", {
			text: "Add watcher",
			cls: "ft-btn ft-btn-secondary ft-text-sm",
		});
		addBtn.addEventListener("click", () => {
			const tempEntry = resolveEntry(entry.type, state.discoveredEvents, this.deps.app, eventsFolder);
			if (tempEntry) {
				new EventConfigModal(this.deps.app, this.deps.eventBus, tempEntry, eventsFolder).open();
			}
		});

		if (subs.length === 0) {
			section.createDiv({
				text: "No watchers configured for this event.",
				cls: "ft-text-muted ft-text-sm ft-p-2",
			});
			return;
		}

		for (const sub of subs) {
			this.renderSubscriptionRow(section, sub);
		}
	}

	private renderSubscriptionRow(container: HTMLElement, sub: Subscription): void {
		const state = this.deps.getState();
		const eventsFolder = this.deps.getEntityFolder("events");
		const row = container.createDiv({ cls: "ft-catalog-row" });

		// Label
		row.createSpan({
			text: sub.label || sub.eventType,
			cls: "ft-font-medium ft-text-sm",
		});

		// Filters
		const filterParts: string[] = [];
		if (sub.filters.pathPattern) filterParts.push(`path: ${sub.filters.pathPattern}`);
		if (sub.filters.extension) filterParts.push(`ext: ${sub.filters.extension}`);
		if (sub.filters.namePattern) filterParts.push(`name: ${sub.filters.namePattern}`);

		if (filterParts.length > 0) {
			row.createSpan({ text: filterParts.join(", "), cls: "ft-text-muted ft-text-sm ft-truncate" });
		}

		const spacer = row.createDiv();
		spacer.addClass("ft-flex-1");

		const actions = row.createDiv({ cls: "ft-flex ft-items-center ft-gap-1" });

		// Enable toggle
		const toggleBtn = actions.createSpan({
			cls: `ft-visibility-toggle${sub.enabled ? "" : " ft-visibility-off"}`,
		});
		setIcon(toggleBtn, sub.enabled ? "check-circle" : "circle");
		toggleBtn.setAttribute("aria-label", sub.enabled ? "Disable" : "Enable");
		toggleBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			void this.deps.eventBus.emit("subscription.update", {
				subscriptionId: sub.id,
				enabled: !sub.enabled,
			});
		});

		// Edit
		const editBtn = actions.createSpan({ cls: "ft-visibility-toggle" });
		setIcon(editBtn, "pencil");
		editBtn.setAttribute("aria-label", "Edit watcher");
		editBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			const entry = resolveEntry(sub.eventType, state.discoveredEvents, this.deps.app, eventsFolder);
			if (entry) {
				new EventConfigModal(this.deps.app, this.deps.eventBus, entry, eventsFolder).open();
			}
		});

		// Delete
		const deleteBtn = actions.createSpan({ cls: "ft-visibility-toggle" });
		setIcon(deleteBtn, "trash-2");
		deleteBtn.setAttribute("aria-label", "Delete watcher");
		deleteBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			void this.deps.eventBus.emit("subscription.remove", { subscriptionId: sub.id });
		});
	}

	private renderTransforms(entry: EventCatalogEntry): void {
		const state = this.deps.getState();
		const defs = state.definitions.filter((d: EventDefinition) => d.sourceEventType === entry.type);
		const eventsFolder = this.deps.getEntityFolder("events");

		const section = this.container.createDiv({ cls: "ft-detail-section" });
		const header = section.createDiv({ cls: "ft-detail-section-header" });

		header.createSpan({
			text: `Transforms (${defs.length})`,
			cls: "ft-heading ft-heading-sm",
		});

		const addBtn = header.createEl("button", {
			text: "Add transform",
			cls: "ft-btn ft-btn-secondary ft-text-sm",
		});
		addBtn.addEventListener("click", () => {
			const tempEntry = resolveEntry(entry.type, state.discoveredEvents, this.deps.app, eventsFolder);
			if (tempEntry) {
				new EventConfigModal(this.deps.app, this.deps.eventBus, tempEntry, eventsFolder).open();
			}
		});

		if (defs.length === 0) {
			section.createDiv({
				text: "No transforms configured for this event.",
				cls: "ft-text-muted ft-text-sm ft-p-2",
			});
			return;
		}

		for (const def of defs) {
			this.renderDefinitionRow(section, def);
		}
	}

	private renderDefinitionRow(container: HTMLElement, def: EventDefinition): void {
		const state = this.deps.getState();
		const eventsFolder = this.deps.getEntityFolder("events");
		const row = container.createDiv({ cls: "ft-catalog-row" });

		// Arrow + output event name
		const nameEl = row.createSpan({ cls: "ft-flex ft-items-center ft-gap-1" });
		nameEl.createSpan({ text: "\u2192" });
		nameEl.createSpan({ text: def.domainEventName, cls: "ft-event-type" });

		// Pattern + policy
		const meta: string[] = [];
		if (def.filePattern) meta.push(def.filePattern);
		meta.push(def.emissionPolicy === "once" ? "once" : "always");

		row.createSpan({ text: meta.join(" \u00B7 "), cls: "ft-text-muted ft-text-sm" });

		const spacer = row.createDiv();
		spacer.addClass("ft-flex-1");

		const actions = row.createDiv({ cls: "ft-flex ft-items-center ft-gap-1" });

		// Enable toggle
		const toggleBtn = actions.createSpan({
			cls: `ft-visibility-toggle${def.enabled ? "" : " ft-visibility-off"}`,
		});
		setIcon(toggleBtn, def.enabled ? "check-circle" : "circle");
		toggleBtn.setAttribute("aria-label", def.enabled ? "Disable" : "Enable");
		toggleBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			void this.deps.eventBus.emit("eventDefinition.update", {
				definitionId: def.id,
				enabled: !def.enabled,
			});
		});

		// Edit
		const editBtn = actions.createSpan({ cls: "ft-visibility-toggle" });
		setIcon(editBtn, "pencil");
		editBtn.setAttribute("aria-label", "Edit transform");
		editBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			const entry = resolveEntry(def.sourceEventType, state.discoveredEvents, this.deps.app, eventsFolder);
			if (entry) {
				new EventConfigModal(this.deps.app, this.deps.eventBus, entry, eventsFolder).open();
			}
		});

		// Delete
		const deleteBtn = actions.createSpan({ cls: "ft-visibility-toggle" });
		setIcon(deleteBtn, "trash-2");
		deleteBtn.setAttribute("aria-label", "Delete transform");
		deleteBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			void this.deps.eventBus.emit("eventDefinition.remove", { definitionId: def.id });
		});
	}
}
