/**
 * Activity component for the User Hub.
 *
 * EventLogView-lite: captures all non-internal events via a wildcard
 * listener and displays them in a master/detail layout. Capped at 200
 * entries, newest first.
 */

import { setIcon } from "obsidian";
import { getEventCategory, getEventEntry, isSkippedEvent } from "../../infrastructure/events/catalog";
import type { FlowtiEvents, WildcardEventHandler } from "../../infrastructure/events/types";
import { getStatusClass } from "../EventLogView";
import type { ActivityLogEntry, UserHubComponentDeps } from "./types";

const MAX_ACTIVITY_ENTRIES = 200;

export class UserHubActivity {
	constructor(
		private masterEl: HTMLElement,
		private detailEl: HTMLElement,
		private deps: UserHubComponentDeps,
	) {}

	/** Start capturing events. Returns an unsubscribe function for cleanup. */
	startCapture(): () => void {
		const handler: WildcardEventHandler = (event: FlowtiEvents) => {
			if (isSkippedEvent(event.type)) return;

			const category = getEventCategory(event.type) ?? "Unknown";
			const catalogEntry = getEventEntry(event.type);

			const entry: ActivityLogEntry = {
				type: event.type,
				category,
				description: catalogEntry?.description ?? "",
				payload: event.payload,
				timestamp: event.timestamp,
			};

			const state = this.deps.getState();
			const log = [entry, ...state.activityLog];
			if (log.length > MAX_ACTIVITY_ENTRIES) {
				log.length = MAX_ACTIVITY_ENTRIES;
			}
			this.deps.setState({ activityLog: log });
			this.deps.scheduleRender();
		};

		return this.deps.eventBus.on("*", handler);
	}

	renderMaster(filterText: string): void {
		this.masterEl.empty();

		const state = this.deps.getState();
		const entries = state.activityLog.filter((e) =>
			!filterText ||
			e.type.toLowerCase().includes(filterText) ||
			e.category.toLowerCase().includes(filterText),
		);

		if (entries.length === 0) {
			this.renderEmptyState();
			return;
		}

		for (const entry of entries) {
			const row = this.masterEl.createDiv({ cls: "ft-catalog-row ft-cursor-pointer" });
			const isSelected = state.selectedActivity === entry;
			if (isSelected) {
				row.addClass("ft-catalog-row-active");
			}

			// Status dot
			const dot = row.createSpan({ cls: "ft-status-dot" });
			dot.addClass(`ft-status-dot-${getStatusClass(entry.type)}`);
			dot.style.marginRight = "0.5rem";

			// Event type
			row.createSpan({ text: entry.type, cls: "ft-event-type" });

			// Category badge
			const badge = row.createSpan({ text: entry.category, cls: "ft-badge ft-badge-muted" });
			badge.style.marginLeft = "0.5rem";
			badge.style.fontSize = "0.7rem";

			// Timestamp
			const time = row.createSpan({
				text: formatTimestamp(entry.timestamp),
				cls: "ft-text-muted ft-text-sm",
			});
			time.style.marginLeft = "auto";

			row.addEventListener("click", () => {
				this.deps.setState({ selectedActivity: entry });
				this.deps.scheduleRender();
			});
		}
	}

	renderDetail(): void {
		this.detailEl.empty();

		const state = this.deps.getState();
		const entry = state.selectedActivity;

		if (!entry) {
			const empty = this.detailEl.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
			empty.style.justifyContent = "center";
			empty.style.padding = "3rem";
			empty.style.color = "var(--text-muted)";
			const icon = empty.createSpan();
			setIcon(icon, "activity");
			empty.createSpan({ text: "Select an event to view details" });
			return;
		}

		// Header
		const header = this.detailEl.createDiv({ cls: "ft-detail-section" });
		header.createEl("h3", { text: entry.type, cls: "ft-heading" });

		const meta = header.createDiv({ cls: "ft-flex ft-gap-2 ft-text-sm ft-text-muted" });
		meta.createSpan({ text: entry.category, cls: "ft-badge ft-badge-muted" });
		meta.createSpan({ text: formatTimestamp(entry.timestamp) });

		if (entry.description) {
			header.createEl("p", { text: entry.description, cls: "ft-text-sm ft-text-muted" });
		}

		// Payload
		if (entry.payload != null) {
			const payloadSection = this.detailEl.createDiv({ cls: "ft-detail-section" });
			payloadSection.createEl("h4", { text: "Payload", cls: "ft-heading ft-heading-sm" });

			const pre = payloadSection.createEl("pre", { cls: "ft-code-block" });
			pre.style.fontSize = "0.8rem";
			pre.style.maxHeight = "300px";
			pre.style.overflow = "auto";
			pre.style.padding = "0.75rem";
			pre.style.borderRadius = "4px";
			pre.style.border = "1px solid var(--background-modifier-border)";
			pre.style.backgroundColor = "var(--background-secondary)";

			try {
				pre.textContent = JSON.stringify(entry.payload, null, 2);
			} catch {
				pre.textContent = String(entry.payload);
			}
		}
	}

	private renderEmptyState(): void {
		const empty = this.masterEl.createDiv({ cls: "ft-flex ft-flex-col ft-items-center" });
		empty.style.justifyContent = "center";
		empty.style.padding = "3rem";
		empty.style.color = "var(--text-muted)";

		const icon = empty.createDiv();
		setIcon(icon, "activity");
		icon.style.opacity = "0.4";
		icon.style.marginBottom = "0.75rem";
		icon.querySelector("svg")?.setAttribute("width", "48");
		icon.querySelector("svg")?.setAttribute("height", "48");

		empty.createDiv({ text: "No activity yet", cls: "ft-heading ft-heading-sm" });
		empty.createDiv({
			text: "Events will appear here as they flow through the system.",
			cls: "ft-text-muted ft-text-sm",
		}).style.marginTop = "0.25rem";
	}
}

function formatTimestamp(timestamp: string): string {
	const date = new Date(timestamp);
	return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
