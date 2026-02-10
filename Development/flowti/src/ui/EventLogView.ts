import { ItemView, WorkspaceLeaf, setIcon, TFile, Notice } from "obsidian";
import { getEventCategory, getEventEntry, type EventCatalogEntry } from "../infrastructure/events/catalog";
import type { FlowtiEvents, IEventBus, WildcardEventHandler } from "../infrastructure/events/types";
import type { CatalogCategoryConfig } from "../domain/settings/settings";
import type { ViewStateProvider } from "../infrastructure/views/registry";
import { FileSystemClient } from "../infrastructure/filesystem/FileSystemClient";
import { getEventDocPath, generateEventDocContent } from "./eventDocTemplate";

export const VIEW_TYPE_EVENT_LOG = "flowti-event-log";

const MAX_ENTRIES = 500;
const SKIPPED_PREFIXES = ["log."];

type LogMode = "subscribed" | "all";

interface LoggedEvent {
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
	private fileSystemClient: FileSystemClient;
	private unsubscribes: (() => void)[] = [];
	private events: LoggedEvent[] = [];

	// Filters
	private excludedTypes: Set<string> = new Set();
	private notifiedTypes: Set<string> = new Set();
	private hiddenCategories: Set<string> = new Set();
	private mode: LogMode = "subscribed";
	private paused = false;
	private activeFilter = "";
	private eventDocsBasePath = "03 - Resources/Documentation/Reference/Events";

	// DOM refs
	private listEl: HTMLElement;
	private countBadge: HTMLElement;
	private pauseBtn: HTMLButtonElement;
	private filterInput: HTMLInputElement;
	private subscribedBtn: HTMLButtonElement;
	private allBtn: HTMLButtonElement;

	private state: ViewStateProvider;

	constructor(leaf: WorkspaceLeaf, eventBus: IEventBus, state: ViewStateProvider) {
		super(leaf);
		this.eventBus = eventBus;
		this.state = state;
		this.fileSystemClient = new FileSystemClient({ eventBus });
	}

	getViewType(): string {
		return VIEW_TYPE_EVENT_LOG;
	}

	getDisplayText(): string {
		return "Activity Log";
	}

	getIcon(): string {
		return "activity";
	}

	async onOpen(): Promise<void> {
		// Initialize all state from live providers (not just defaults)
		const settings = this.state.getSettings();
		this.eventDocsBasePath = settings.eventDocsBasePath;
		this.updateHiddenCategories(settings.catalogCategories);
		this.excludedTypes = new Set(this.state.getExcludedTypes());
		this.notifiedTypes = new Set(this.state.getNotifiedTypes());

		const container = this.containerEl.children[1];
		container.empty();

		const wrapper = container.createDiv({ cls: "flowti-container ft-p-4 ft-flex ft-flex-col" });
		wrapper.style.height = "100%";

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
				this.eventDocsBasePath = event.payload.settings.eventDocsBasePath;
				this.updateHiddenCategories(event.payload.settings.catalogCategories);
			})
		);
		this.unsubscribes.push(
			this.eventBus.on("settings.changed", (event) => {
				this.eventDocsBasePath = event.payload.settings.eventDocsBasePath;
				this.updateHiddenCategories(event.payload.settings.catalogCategories);
			})
		);

		this.subscribe();
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
			text: "Activity Log",
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
		this.filterInput.style.flex = "1";
		this.filterInput.addEventListener("input", () => {
			this.activeFilter = this.filterInput.value.toLowerCase();
			this.renderList();
		});

		// Mode toggle group
		const modeGroup = toolbar.createDiv({ cls: "ft-mode-toggle" });

		this.subscribedBtn = modeGroup.createEl("button", {
			text: "Subscribed",
			cls: "ft-btn ft-btn-primary",
		});
		this.subscribedBtn.addEventListener("click", () => this.setMode("subscribed"));

		this.allBtn = modeGroup.createEl("button", {
			text: "All",
			cls: "ft-btn ft-btn-ghost",
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
			this.subscribedBtn.className = "ft-btn ft-btn-primary";
			this.allBtn.className = "ft-btn ft-btn-ghost";
		} else {
			this.subscribedBtn.className = "ft-btn ft-btn-ghost";
			this.allBtn.className = "ft-btn ft-btn-primary";
		}

		this.renderList();
	}

	// ─────────────────────────────────────────────────────────────
	// Wildcard subscription
	// ─────────────────────────────────────────────────────────────

	private subscribe(): void {
		const handler: WildcardEventHandler = (event: FlowtiEvents) => {
			if (this.paused) return;
			if (SKIPPED_PREFIXES.some((prefix) => event.type.startsWith(prefix))) return;
			if (this.excludedTypes.has(event.type)) return;

			// Never capture events from hidden categories
			const category = getEventCategory(event.type) ?? "Unknown";
			if (this.hiddenCategories.has(category)) return;

			const catalogEntry = getEventEntry(event.type);

			const entry: LoggedEvent = {
				type: event.type,
				category,
				description: catalogEntry?.description ?? "",
				payload: event.payload,
				timestamp: event.timestamp,
			};

			this.events.unshift(entry);
			if (this.events.length > MAX_ENTRIES) {
				this.events.length = MAX_ENTRIES;
			}

			this.renderList();
		};

		this.unsubscribes.push(this.eventBus.on("*", handler));
	}

	// ─────────────────────────────────────────────────────────────
	// Rendering
	// ─────────────────────────────────────────────────────────────

	private renderList(): void {
		this.listEl.empty();

		// Apply mode filter
		let visible = this.mode === "subscribed"
			? this.events.filter((e) => this.notifiedTypes.has(e.type))
			: this.events;

		// Apply text filter
		if (this.activeFilter) {
			visible = visible.filter(
				(e) =>
					e.type.toLowerCase().includes(this.activeFilter) ||
					e.description.toLowerCase().includes(this.activeFilter)
			);
		}

		// Update badge
		const total = this.mode === "subscribed"
			? this.events.filter((e) => this.notifiedTypes.has(e.type)).length
			: this.events.length;

		this.countBadge.textContent = this.activeFilter
			? `${visible.length} / ${total} events`
			: `${total} events`;

		if (visible.length === 0) {
			this.renderEmptyState();
			return;
		}

		for (const entry of visible) {
			this.renderEventRow(entry);
		}
	}

	private renderEmptyState(): void {
		const empty = this.listEl.createDiv({ cls: "ft-flex ft-flex-col ft-items-center ft-justify-center ft-p-4 ft-gap-2" });

		if (this.activeFilter) {
			empty.createSpan({
				text: "No events match the filter.",
				cls: "ft-text-muted ft-text-sm",
			});
		} else if (this.mode === "subscribed" && this.notifiedTypes.size === 0) {
			empty.createSpan({
				text: "No subscribed events yet.",
				cls: "ft-text-muted ft-text-sm",
			});
			empty.createSpan({
				text: "Use the bell icon in the Event Catalog to subscribe.",
				cls: "ft-text-faint ft-text-sm",
			});
		} else if (this.mode === "subscribed") {
			empty.createSpan({
				text: "Waiting for subscribed events...",
				cls: "ft-text-muted ft-text-sm",
			});
		} else {
			empty.createSpan({
				text: "Waiting for events...",
				cls: "ft-text-muted ft-text-sm",
			});
		}
	}

	private renderEventRow(entry: LoggedEvent): void {
		const isSubscribed = this.notifiedTypes.has(entry.type);
		const row = this.listEl.createDiv({ cls: "ft-log-row ft-animate-fade-in" });

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
			bell.setAttribute("aria-label", "Subscribed");
			setIcon(bell, "bell");
		}

		// Doc link — works for all events (system and custom)
		const catalogEntry = getEventEntry(entry.type);
		const docEntry: EventCatalogEntry = catalogEntry ?? {
			type: entry.type,
			category: entry.category,
			description: entry.description,
			direction: "User \u2192 EventBus",
			domain: "custom",
			services: "Discovery",
		};
		const docLink = actions.createSpan({ cls: "ft-visibility-toggle" });
		docLink.setAttribute("aria-label", "Open documentation");
		setIcon(docLink, "file-text");
		docLink.addEventListener("click", (e) => {
			e.stopPropagation();
			void this.openOrCreateEventDoc(docEntry);
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
	}

	// ─────────────────────────────────────────────────────────────
	// Doc link
	// ─────────────────────────────────────────────────────────────

	private async openOrCreateEventDoc(entry: EventCatalogEntry): Promise<void> {
		const docPath = getEventDocPath(this.eventDocsBasePath, entry.type);

		let file = this.app.vault.getAbstractFileByPath(docPath);

		if (!file) {
			const content = generateEventDocContent(entry);
			try {
				await this.fileSystemClient.createFile(docPath, content, {
					createFolders: true,
				});
			} catch (err) {
				console.error(`[Flowti] Failed to create event doc: ${docPath}`, err);
				return;
			}
			file = this.app.vault.getAbstractFileByPath(docPath);
		}

		if (file && file instanceof TFile) {
			const leaf = this.app.workspace.getLeaf(false);
			await leaf.openFile(file);
		}
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
