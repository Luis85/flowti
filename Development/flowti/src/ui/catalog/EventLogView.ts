import { ItemView, WorkspaceLeaf, setIcon, Notice } from "obsidian";
import { getEventCategory, getEventEntry, isSkippedEvent, type EventCatalogEntry } from "../../infrastructure/events/catalog";
import type { FlowtiEvents, IEventBus, WildcardEventHandler } from "../../infrastructure/events/types";
import { type CatalogCategoryConfig, type EntityPaths, DEFAULT_ENTITY_PATHS } from "../../domain/settings/settings";
import type { ViewStateProvider } from "../../infrastructure/views/registry";
import { resolveEntityPath } from "../eventDocTemplate";
import { createVaultQueryService, createWorkspaceService } from "../../infrastructure/services/ObsidianAdapters";
import { openOrCreateEventDoc } from "./helpers";

export const VIEW_TYPE_EVENT_LOG = "flowti-event-log";

/**
 * Returns a CSS class suffix for the status dot based on event type patterns.
 * - "success": completed, created, loaded, matched
 * - "error": failed, error.*
 * - "info": started, queued, processing
 * - "neutral": everything else
 */
export function getStatusClass(type: string): string {
	if (type.endsWith(".completed") || type.endsWith(".created") || type.endsWith(".loaded") || type.endsWith(".matched")) return "success";
	if (type.endsWith(".failed") || type.startsWith("error.")) return "error";
	if (type.endsWith(".started") || type.endsWith(".queued") || type.endsWith(".processing")) return "info";
	return "neutral";
}

/**
 * Extracts a context summary line from enriched event payloads.
 * Returns null for events without enrichment.
 */
export function getContextLine(entry: LoggedEvent): string | null {
	const p = entry.payload as Record<string, unknown> | undefined;
	if (!p) return null;

	switch (entry.type) {
		case "subscription.matched": {
			const label = p.subscriptionLabel ?? p.eventType;
			return label ? `Watcher: ${label}` : null;
		}
		case "ingestion.job.completed": {
			const inner = p.payload as Record<string, unknown> | undefined;
			const path = inner?.path ?? p.path;
			return typeof path === "string" ? `File: ${path}` : null;
		}
		case "ingestion.job.failed": {
			return typeof p.error === "string" ? `Error: ${p.error}` : null;
		}
		case "eventDefinition.matched": {
			return typeof p.domainEventName === "string" ? `Emitted: ${p.domainEventName}` : null;
		}
		default:
			return null;
	}
}

const MAX_ENTRIES = 500;

type LogMode = "subscribed" | "all";

export interface LoggedEvent {
	type: string;
	category: string;
	description: string;
	payload: unknown;
	timestamp: string;
}

/**
 * Activity Log view — a user-friendly event feed.
 *
 * Defaults to "Subscribed" mode: only events the user opted into
 * via bell toggles in the Event Catalog are shown. A toggle switches
 * to "All" mode for debugging (shows all visible-category events).
 *
 * Events from hidden categories (via catalog settings) never enter
 * the buffer regardless of mode.
 */
export class EventLogView extends ItemView {
	private eventBus: IEventBus;
	private unsubscribes: (() => void)[] = [];
	private events: LoggedEvent[] = [];

	// Filters
	private excludedTypes: Set<string> = new Set();
	private notifiedTypes: Set<string> = new Set();
	private hiddenCategories: Set<string> = new Set();
	private mode: LogMode = "subscribed";
	private paused = false;
	private activeFilter = "";
	private e2eMode = false;
	private e2eAssertedTypes: Set<string> = new Set();
	private docsRootPath = "03 - Resources/Documentation/Reference";
	private entityPaths: EntityPaths = DEFAULT_ENTITY_PATHS;

	// DOM refs (initialized in onOpen)
	private listEl!: HTMLElement;
	private countBadge!: HTMLElement;
	private pauseBtn!: HTMLButtonElement;
	private filterInput!: HTMLInputElement;
	private subscribedBtn!: HTMLElement;
	private allBtn!: HTMLElement;

	private state: ViewStateProvider;

	constructor(leaf: WorkspaceLeaf, eventBus: IEventBus, state: ViewStateProvider) {
		super(leaf);
		this.eventBus = eventBus;
		this.state = state;
	}

	getViewType(): string {
		return VIEW_TYPE_EVENT_LOG;
	}

	getDisplayText(): string {
		return "Activity log";
	}

	getIcon(): string {
		return "activity";
	}

	async onOpen(): Promise<void> {
		// Initialize all state from live providers (not just defaults)
		const settings = this.state.getSettings();
		this.docsRootPath = settings.docsRootPath;
		this.entityPaths = settings.entityPaths ?? DEFAULT_ENTITY_PATHS;
		this.updateHiddenCategories(settings.catalogCategories);
		this.excludedTypes = new Set(this.state.getExcludedTypes());
		this.notifiedTypes = new Set(this.state.getNotifiedTypes());

		const container = this.containerEl.children[1];
		container.empty();

		const wrapper = container.createDiv({ cls: "flowti-container ft-p-4 ft-flex ft-flex-col ft-full-height" });

		this.renderHeader(wrapper);
		this.renderToolbar(wrapper);

		this.listEl = wrapper.createDiv({ cls: "ft-event-log-list ft-scrollbar" });

		this.renderList();

		// Subscribe to event filter state
		this.unsubscribes.push(
			this.eventBus.on("eventFilter.loaded", (event) => {
				this.excludedTypes = new Set(event.payload.excludedTypes);
			})
		);
		this.unsubscribes.push(
			this.eventBus.on("eventFilter.changed", (event) => {
				this.excludedTypes = new Set(event.payload.excludedTypes);
			})
		);

		// Subscribe to notification state
		this.unsubscribes.push(
			this.eventBus.on("eventNotify.loaded", (event) => {
				this.notifiedTypes = new Set(event.payload.notifiedTypes);
				this.renderList();
			})
		);
		this.unsubscribes.push(
			this.eventBus.on("eventNotify.changed", (event) => {
				this.notifiedTypes = new Set(event.payload.notifiedTypes);
				this.renderList();
			})
		);

		// Subscribe to settings (category visibility + docs base path)
		this.unsubscribes.push(
			this.eventBus.on("settings.loaded", (event) => {
				this.docsRootPath = event.payload.settings.docsRootPath;
				this.entityPaths = event.payload.settings.entityPaths ?? DEFAULT_ENTITY_PATHS;
				this.updateHiddenCategories(event.payload.settings.catalogCategories);
			})
		);
		this.unsubscribes.push(
			this.eventBus.on("settings.changed", (event) => {
				this.docsRootPath = event.payload.settings.docsRootPath;
				this.entityPaths = event.payload.settings.entityPaths ?? DEFAULT_ENTITY_PATHS;
				this.updateHiddenCategories(event.payload.settings.catalogCategories);
			})
		);

		this.subscribe();
		this.detectE2eMode();
	}

	async onClose(): Promise<void> {
		for (const unsub of this.unsubscribes) {
			unsub();
		}
		this.unsubscribes = [];
		this.events = [];
	}

	private updateHiddenCategories(categories: CatalogCategoryConfig[]): void {
		this.hiddenCategories = new Set(
			categories.filter((c) => !c.visible).map((c) => c.name)
		);
	}

	// ─────────────────────────────────────────────────────────────
	// Header
	// ─────────────────────────────────────────────────────────────

	private renderHeader(container: HTMLElement): void {
		const section = container.createDiv({ cls: "ft-mb-2" });

		const titleRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-1" });
		titleRow.createEl("h1", {
			text: "Activity log",
			cls: "ft-heading ft-heading-lg",
		});
		this.countBadge = titleRow.createSpan({
			text: "0 events",
			cls: "ft-badge ft-badge-muted",
		});
	}

	// ─────────────────────────────────────────────────────────────
	// Toolbar
	// ─────────────────────────────────────────────────────────────

	private renderToolbar(container: HTMLElement): void {
		const toolbar = container.createDiv({ cls: "ft-event-log-toolbar ft-mb-2" });

		this.filterInput = toolbar.createEl("input", { cls: "ft-input" });
		this.filterInput.type = "text";
		this.filterInput.placeholder = "Filter events...";
		this.filterInput.addClass("ft-flex-1");
		this.filterInput.addEventListener("input", () => {
			this.activeFilter = this.filterInput.value.toLowerCase();
			this.renderList();
		});

		// Mode toggle group
		const modeGroup = toolbar.createDiv({ cls: "ft-mode-toggle" });

		this.subscribedBtn = modeGroup.createEl("span", {
			text: "Followed",
			cls: "ft-mode-toggle-item ft-mode-toggle-item-active",
		});
		this.subscribedBtn.addEventListener("click", () => this.setMode("subscribed"));

		this.allBtn = modeGroup.createEl("span", {
			text: "All",
			cls: "ft-mode-toggle-item",
		});
		this.allBtn.addEventListener("click", () => this.setMode("all"));

		// Action buttons
		const btnGroup = toolbar.createDiv({ cls: "ft-flex ft-gap-1" });

		this.pauseBtn = btnGroup.createEl("button", {
			cls: "ft-btn ft-btn-secondary",
		});
		setIcon(this.pauseBtn, "pause");
		this.pauseBtn.setAttribute("aria-label", "Pause");
		this.pauseBtn.addEventListener("click", () => {
			this.paused = !this.paused;
			this.pauseBtn.empty();
			setIcon(this.pauseBtn, this.paused ? "play" : "pause");
			this.pauseBtn.setAttribute("aria-label", this.paused ? "Resume" : "Pause");
		});

		const clearBtn = btnGroup.createEl("button", {
			cls: "ft-btn ft-btn-ghost",
		});
		setIcon(clearBtn, "trash-2");
		clearBtn.setAttribute("aria-label", "Clear");
		clearBtn.addEventListener("click", () => {
			this.events = [];
			this.renderList();
		});
	}

	private setMode(mode: LogMode): void {
		this.mode = mode;

		if (mode === "subscribed") {
			this.subscribedBtn.className = "ft-mode-toggle-item ft-mode-toggle-item-active";
			this.allBtn.className = "ft-mode-toggle-item";
		} else {
			this.subscribedBtn.className = "ft-mode-toggle-item";
			this.allBtn.className = "ft-mode-toggle-item ft-mode-toggle-item-active";
		}

		this.renderList();
	}

	// ─────────────────────────────────────────────────────────────
	// Wildcard subscription
	// ─────────────────────────────────────────────────────────────

	private subscribe(): void {
		const handler: WildcardEventHandler = (event: FlowtiEvents) => {
			if (this.paused) return;

			// In E2E mode, show ALL events except log.* (which would
			// cause infinite recursion from the trace listener itself).
			if (this.e2eMode) {
				if (event.type.startsWith("log.")) return;
			} else {
				if (isSkippedEvent(event.type)) return;
				if (this.excludedTypes.has(event.type)) return;
			}

			const category = getEventCategory(event.type) ?? "Unknown";

			if (!this.e2eMode && this.hiddenCategories.has(category)) return;

			const catalogEntry = getEventEntry(event.type);

			const entry: LoggedEvent = {
				type: event.type,
				category,
				description: catalogEntry?.description ?? "",
				payload: event.payload,
				timestamp: event.timestamp,
			};

			this.events.unshift(entry);
			if (!this.e2eMode && this.events.length > MAX_ENTRIES) {
				this.events.length = MAX_ENTRIES;
			}

			// Incremental: only touch the DOM if the event is visible
			if (this.isEntryVisible(entry)) {
				this.prependRow(entry);
			}
			this.updateBadge();
		};

		this.unsubscribes.push(this.eventBus.on("*", handler));
	}

	/** Check if a log entry passes the current mode + text filter. */
	private isEntryVisible(entry: LoggedEvent): boolean {
		if (!this.e2eMode && this.mode === "subscribed" && !this.notifiedTypes.has(entry.type)) {
			return false;
		}
		if (this.activeFilter) {
			return (
				entry.type.toLowerCase().includes(this.activeFilter) ||
				entry.description.toLowerCase().includes(this.activeFilter)
			);
		}
		return true;
	}

	/** Prepend a single new row to the top of the list (with animation). */
	private prependRow(entry: LoggedEvent): void {
		// Remove the empty state if present
		const emptyState = this.listEl.querySelector(".ft-log-empty-state");
		if (emptyState) emptyState.remove();

		const row = this.renderEventRow(entry);
		row.classList.add("ft-animate-fade-in");

		if (this.listEl.firstChild) {
			this.listEl.insertBefore(row, this.listEl.firstChild);
		} else {
			this.listEl.appendChild(row);
		}

		// Trim excess DOM rows to keep in sync with buffer
		const maxVisible = this.mode === "subscribed"
			? this.events.filter((e) => this.notifiedTypes.has(e.type)).length
			: this.events.length;
		while (this.listEl.children.length > maxVisible) {
			this.listEl.lastChild?.remove();
		}
	}

	// ─────────────────────────────────────────────────────────────
	// Rendering
	// ─────────────────────────────────────────────────────────────

	private renderList(): void {
		this.listEl.empty();

		// Apply mode + text filter
		const visible = this.events.filter((e) => this.isEntryVisible(e));

		this.updateBadge();

		if (visible.length === 0) {
			this.renderEmptyState();
			return;
		}

		for (const entry of visible) {
			const row = this.renderEventRow(entry);
			this.listEl.appendChild(row);
		}
	}

	private updateBadge(): void {
		const total = this.mode === "subscribed"
			? this.events.filter((e) => this.notifiedTypes.has(e.type)).length
			: this.events.length;

		const visibleCount = this.events.filter((e) => this.isEntryVisible(e)).length;

		this.countBadge.textContent = this.activeFilter
			? `${visibleCount} / ${total} events`
			: `${total} events`;
	}

	private renderEmptyState(): void {
		const empty = this.listEl.createDiv({ cls: "ft-log-empty-state ft-flex ft-flex-col ft-items-center ft-justify-center ft-p-4 ft-gap-2" });

		if (this.activeFilter) {
			empty.createSpan({
				text: "No events match the filter.",
				cls: "ft-text-muted ft-text-sm",
			});
		} else if (this.mode === "subscribed" && this.notifiedTypes.size === 0) {
			empty.createSpan({
				text: "No followed events yet.",
				cls: "ft-text-muted ft-text-sm",
			});
			empty.createSpan({
				text: "Use the bell icon in the Event Catalog to follow events.",
				cls: "ft-text-faint ft-text-sm",
			});
		} else if (this.mode === "subscribed") {
			empty.createSpan({
				text: "Waiting for followed events...",
				cls: "ft-text-muted ft-text-sm",
			});
		} else {
			empty.createSpan({
				text: "Waiting for events...",
				cls: "ft-text-muted ft-text-sm",
			});
		}
	}

	private renderEventRow(entry: LoggedEvent): HTMLElement {
		const isSubscribed = this.notifiedTypes.has(entry.type);
		const row = createDiv({ cls: "ft-log-row" });

		if (this.e2eMode && this.e2eAssertedTypes.has(entry.type)) {
			row.classList.add("ft-log-asserted");
		}

		// Status dot
		const statusClass = getStatusClass(entry.type);
		const dot = row.createSpan({ cls: `ft-status-dot ft-status-${statusClass}` });
		dot.setAttribute("aria-label", statusClass);

		// Timestamp + relative time
		row.createSpan({
			text: this.formatTime(entry.timestamp),
			cls: "ft-log-time",
		});
		row.createSpan({
			text: this.formatRelativeTime(entry.timestamp),
			cls: "ft-log-relative",
		});

		// Category badge
		row.createSpan({
			text: entry.category,
			cls: "ft-log-category",
		});

		// Event type (clickable → copy to clipboard)
		const typeSpan = row.createSpan({ text: entry.type, cls: "ft-event-type" });
		typeSpan.setAttribute("aria-label", "Click to copy");
		typeSpan.addEventListener("click", (e) => {
			e.stopPropagation();
			void navigator.clipboard.writeText(entry.type);
			new Notice(`Copied: ${entry.type}`);
		});

		// Description
		if (entry.description) {
			row.createSpan({
				text: entry.description,
				cls: "ft-log-description ft-truncate",
			});
		}

		// Actions
		const actions = row.createDiv({ cls: "ft-log-actions" });

		// Bell indicator in "all" mode
		if (this.mode === "all" && isSubscribed) {
			const bell = actions.createSpan({ cls: "ft-visibility-toggle" });
			bell.setAttribute("aria-label", "Followed");
			setIcon(bell, "bell");
		}

		// Doc link — works for all events (system and custom)
		const catalogEntry = getEventEntry(entry.type);
		const docEntry: EventCatalogEntry = catalogEntry ?? {
			type: entry.type,
			category: entry.category,
			description: entry.description,
			direction: "User → EventBus",
			domain: "custom",
			services: "Discovery",
			stability: "experimental",
			visibility: "user-facing",
			tags: [],
		};
		const docLink = actions.createSpan({ cls: "ft-visibility-toggle" });
		docLink.setAttribute("aria-label", "Open documentation");
		setIcon(docLink, "file-text");
		docLink.addEventListener("click", (e) => {
			e.stopPropagation();
			void this.openEventDoc(docEntry);
		});

		// Expand/collapse toggle
		const expandBtn = actions.createSpan({ cls: "ft-visibility-toggle" });
		expandBtn.setAttribute("aria-label", "Show payload");
		setIcon(expandBtn, "chevron-down");

		let payloadEl: HTMLElement | null = null;

		const togglePayload = (e: MouseEvent) => {
			e.stopPropagation();
			if (payloadEl) {
				payloadEl.remove();
				payloadEl = null;
				row.classList.remove("ft-log-expanded");
				setIcon(expandBtn, "chevron-down");
				expandBtn.setAttribute("aria-label", "Show payload");
			} else {
				payloadEl = row.createDiv({ cls: "ft-log-payload" });
				payloadEl.textContent = JSON.stringify(entry.payload, null, 2);
				row.classList.add("ft-log-expanded");
				setIcon(expandBtn, "chevron-up");
				expandBtn.setAttribute("aria-label", "Hide payload");
			}
		};

		expandBtn.addEventListener("click", togglePayload);

		// Context line for enriched events
		const context = getContextLine(entry);
		if (context) {
			row.createDiv({ text: context, cls: "ft-log-context ft-text-muted ft-text-sm" });
		}

		return row;
	}

	// ─────────────────────────────────────────────────────────────
	// E2E trace backfill
	// ─────────────────────────────────────────────────────────────

	/**
	 * Detects E2E test mode and backfills events from the trace array.
	 * In E2E mode, all filter layers are bypassed and the trace history
	 * is loaded into the event buffer for post-test inspection.
	 */
	private detectE2eMode(): void {
		/* eslint-disable @typescript-eslint/no-explicit-any */
		const plugin = (this.app as any).plugins?.plugins?.["flowti-ibde"];

		// Check trace EXISTENCE (not length) — the Activity Log may open
		// right after startEventTrace() when the array is still empty.
		// It will capture events live via the wildcard subscription.
		const traceExists =
			plugin?._e2eEventTrace !== undefined ||
			(window as any)._e2eEventTraceSnapshot !== undefined;

		if (!traceExists) return;

		this.e2eMode = true;

		// Load asserted event types for highlighting
		const asserted: string[] | undefined =
			plugin?._e2eAssertedEvents ?? (window as any)._e2eAssertedEventsSnapshot;
		if (asserted) {
			this.e2eAssertedTypes = new Set(asserted);
		}

		// Backfill trace entries that fired before the view opened
		const trace: Array<{ type: string; ts: number; payload: string }> =
			plugin?._e2eEventTrace ?? (window as any)._e2eEventTraceSnapshot ?? [];
		/* eslint-enable @typescript-eslint/no-explicit-any */

		// Convert trace entries → LoggedEvent (newest first)
		for (let i = trace.length - 1; i >= 0; i--) {
			const t = trace[i];
			const category = getEventCategory(t.type) ?? "Unknown";
			const catalogEntry = getEventEntry(t.type);
			const entry: LoggedEvent = {
				type: t.type,
				category,
				description: catalogEntry?.description ?? "",
				payload: this.safeParsePayload(t.payload),
				timestamp: new Date(t.ts).toISOString(),
			};
			this.events.push(entry);
		}

		// Add E2E badge to header
		this.countBadge.parentElement?.createSpan({
			text: "E2E Trace",
			cls: "ft-badge ft-badge-accent",
		});

		// Hide mode toggle — E2E always shows all events
		this.subscribedBtn.parentElement?.classList.add("ft-hidden");

		this.setMode("all");
	}

	private safeParsePayload(jsonStr: string): unknown {
		try {
			return JSON.parse(jsonStr);
		} catch {
			return jsonStr;
		}
	}

	// ─────────────────────────────────────────────────────────────
	// Doc link
	// ─────────────────────────────────────────────────────────────

	private async openEventDoc(entry: EventCatalogEntry): Promise<void> {
		const eventsFolder = resolveEntityPath(this.docsRootPath, this.entityPaths.events);
		await openOrCreateEventDoc(createVaultQueryService(this.app), createWorkspaceService(this.app), this.eventBus, eventsFolder, entry);
	}

	// ─────────────────────────────────────────────────────────────
	// Helpers
	// ─────────────────────────────────────────────────────────────

	private formatTime(iso: string): string {
		try {
			const date = new Date(iso);
			return date.toLocaleTimeString(undefined, {
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit",
			});
		} catch {
			return iso;
		}
	}

	private formatRelativeTime(iso: string): string {
		try {
			const now = Date.now();
			const then = new Date(iso).getTime();
			const diffMs = now - then;

			if (diffMs < 1000) return "just now";
			if (diffMs < 60_000) return `${Math.floor(diffMs / 1000)}s ago`;
			if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
			if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
			return `${Math.floor(diffMs / 86_400_000)}d ago`;
		} catch {
			return "";
		}
	}
}
