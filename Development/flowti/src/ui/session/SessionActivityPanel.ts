import { setIcon } from "obsidian";
import type { SessionPanelDeps } from "./types";
import type { Session, SessionActivity } from "../../domain/session/types";
import { isExcluded } from "../../domain/session/helpers";
import { attachFolderSuggest } from "../FolderSuggest";

/** A file-level group of activity entries (one row per file). */
export interface GroupedActivity {
	path: string;
	latestAction: string;
	latestTimestamp: string;
	count: number;
}

/**
 * Groups activity entries by file path.
 * Returns one entry per file, sorted newest-first by latest timestamp.
 */
export function groupActivityByFile(entries: readonly SessionActivity[]): GroupedActivity[] {
	const map = new Map<string, GroupedActivity>();
	for (const entry of entries) {
		const existing = map.get(entry.path);
		if (!existing || entry.timestamp > existing.latestTimestamp) {
			map.set(entry.path, {
				path: entry.path,
				latestAction: entry.action,
				latestTimestamp: entry.timestamp,
				count: (existing?.count ?? 0) + 1,
			});
		} else {
			existing.count++;
		}
	}
	return [...map.values()].sort((a, b) => b.latestTimestamp.localeCompare(a.latestTimestamp));
}

export class SessionActivityPanel {
	private activityEl: HTMLElement | null = null;
	private countEl: HTMLElement | null = null;
	private deps: SessionPanelDeps;

	constructor(private container: HTMLElement, deps: SessionPanelDeps) {
		this.deps = deps;
	}

	render(): void {
		const session = this.deps.getSession();
		const section = this.container.createDiv({ cls: "ft-session-workspace-activity ft-section" });

		const headerRow = section.createDiv({ cls: "ft-panel-label-row ft-mb-sm" });
		headerRow.createEl("strong", { text: "Activity" });
		this.countEl = headerRow.createEl("span", {
			text: `(${session.activity.length})`,
			cls: "ft-text-muted ft-panel-count",
		});

		this.renderActivityFilter(section, session);

		this.activityEl = section.createDiv({ cls: "ft-activity-list" });
		this.renderActivityList();
	}

	refreshList(): void {
		this.renderActivityList();
	}

	private renderActivityFilter(parent: HTMLElement, session: Session): void {
		const filterSection = parent.createDiv({ cls: "ft-activity-filter" });

		if (session.activityFilter.length > 0) {
			const tagList = filterSection.createDiv({ cls: "ft-activity-filter-tags" });

			for (const folder of session.activityFilter) {
				const tag = tagList.createDiv({ cls: "ft-activity-filter-tag" });
				tag.createSpan({ text: folder });

				const removeBtn = tag.createEl("button", { cls: "ft-activity-filter-remove" });
				setIcon(removeBtn, "x");
				removeBtn.addEventListener("click", () => {
					const updated = session.activityFilter.filter((f) => f !== folder);
					this.deps.updateActivityFilter(session.id, updated);
				});
			}
		}

		const addRow = filterSection.createDiv({ cls: "ft-activity-filter-add-row" });
		const input = addRow.createEl("input", { type: "text", cls: "ft-activity-filter-input" });
		input.placeholder = "Exclude folder...";
		attachFolderSuggest(input, this.deps.app);
		input.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter" && input.value.trim()) {
				const updated = [...session.activityFilter, input.value.trim()];
				this.deps.updateActivityFilter(session.id, updated);
				input.value = "";
			}
		});
	}

	private getFilteredActivity(session: Session): readonly SessionActivity[] {
		if (session.status === "completed" || session.status === "archived") {
			return session.activity;
		}
		const globalFilter = this.deps.getGlobalActivityFilter();
		if (globalFilter.length === 0 && session.activityFilter.length === 0) {
			return session.activity;
		}
		return session.activity.filter(
			(entry) => !isExcluded(entry.path, globalFilter, session.activityFilter),
		);
	}

	private renderActivityList(): void {
		const session = this.deps.getSession();
		if (!this.activityEl) return;
		this.activityEl.empty();

		const filtered = this.getFilteredActivity(session);

		if (this.countEl) {
			this.countEl.setText(`(${filtered.length})`);
		}

		if (filtered.length === 0) {
			this.activityEl.createDiv({ text: "No activity yet", cls: "ft-text-muted ft-text-sm ft-activity-empty" });
			return;
		}

		const groups = groupActivityByFile(filtered);
		for (const group of groups) {
			const row = this.activityEl.createDiv({ cls: "ft-activity-row" });

			const iconEl = row.createSpan();
			setIcon(iconEl, this.getActivityIcon(group.latestAction));

			const name = group.path.split("/").pop() ?? group.path;
			const link = row.createEl("a", { text: name, cls: "ft-activity-link" });
			link.title = group.path;
			link.addEventListener("click", (e) => {
				e.preventDefault();
				if (group.latestAction !== "deleted") {
					this.deps.openFile(group.path);
				}
			});

			row.createEl("span", {
				text: group.latestAction,
				cls: "ft-badge ft-activity-badge",
			});

			if (group.count > 1) {
				row.createEl("span", {
					text: `×${group.count}`,
					cls: "ft-badge ft-activity-count ft-activity-badge",
				});
			}

			row.createEl("span", {
				text: this.formatActivityTime(group.latestTimestamp),
				cls: "ft-text-muted ft-activity-timestamp",
			});
		}
	}

	private getActivityIcon(action: string): string {
		switch (action) {
			case "created": return "file-plus";
			case "modified": return "file-edit";
			case "deleted": return "file-minus";
			case "renamed": return "file-symlink";
			case "opened": return "file-search";
			default: return "file";
		}
	}

	private formatActivityTime(timestamp: string): string {
		const d = new Date(timestamp);
		return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
	}
}
