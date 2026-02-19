import { setIcon } from "obsidian";
import type { SessionPanelDeps } from "./types";
import type { Session, SessionActivity } from "../../domain/session/types";
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
	private deps: SessionPanelDeps;

	constructor(private container: HTMLElement, deps: SessionPanelDeps) {
		this.deps = deps;
	}

	render(): void {
		const session = this.deps.getSession();
		const section = this.container.createDiv({ cls: "ft-session-workspace-activity ft-section" });

		const headerRow = section.createDiv();
		headerRow.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:8px;";
		headerRow.createEl("strong", { text: "Activity" });
		headerRow.createEl("span", {
			text: `(${session.activity.length})`,
			cls: "ft-text-muted",
		}).style.cssText = "color:var(--text-muted);font-size:12px;";

		this.renderActivityFilter(section, session);

		this.activityEl = section.createDiv({ cls: "ft-activity-list" });
		this.renderActivityList();
	}

	refreshList(): void {
		this.renderActivityList();
	}

	private renderActivityFilter(parent: HTMLElement, session: Session): void {
		const filterSection = parent.createDiv({ cls: "ft-activity-filter" });
		filterSection.style.cssText = "margin-bottom:8px;";

		if (session.activityFilter.length > 0) {
			const tagList = filterSection.createDiv({ cls: "ft-activity-filter-tags" });
			tagList.style.cssText = "display:flex;flex-wrap:wrap;gap:4px;margin-bottom:4px;";

			for (const folder of session.activityFilter) {
				const tag = tagList.createDiv({ cls: "ft-activity-filter-tag" });
				tag.style.cssText = "display:flex;align-items:center;gap:2px;padding:2px 6px;border-radius:3px;font-size:11px;background:var(--background-modifier-hover);color:var(--text-muted);";
				tag.createSpan({ text: folder });

				const removeBtn = tag.createEl("button", { cls: "ft-activity-filter-remove" });
				removeBtn.style.cssText = "background:none;border:none;cursor:pointer;padding:0 2px;opacity:0.6;color:var(--text-muted);font-size:11px;";
				setIcon(removeBtn, "x");
				removeBtn.addEventListener("click", () => {
					const updated = session.activityFilter.filter((f) => f !== folder);
					this.deps.updateActivityFilter(session.id, updated);
				});
			}
		}

		const addRow = filterSection.createDiv();
		addRow.style.cssText = "display:flex;gap:4px;";
		const input = addRow.createEl("input", { type: "text", cls: "ft-activity-filter-input" });
		input.placeholder = "Exclude folder...";
		input.style.cssText = "flex:1;padding:2px 6px;border:1px solid var(--background-modifier-border);border-radius:4px;background:var(--background-primary);color:var(--text-normal);font-size:12px;";
		attachFolderSuggest(input, this.deps.app);
		input.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter" && input.value.trim()) {
				const updated = [...session.activityFilter, input.value.trim()];
				this.deps.updateActivityFilter(session.id, updated);
				input.value = "";
			}
		});
	}

	private renderActivityList(): void {
		const session = this.deps.getSession();
		if (!this.activityEl) return;
		this.activityEl.empty();

		if (session.activity.length === 0) {
			this.activityEl.createDiv({ text: "No activity yet", cls: "ft-text-muted ft-text-sm" }).style.cssText = "color:var(--text-muted);font-size:12px;padding:4px 0;";
			return;
		}

		const groups = groupActivityByFile(session.activity);
		for (const group of groups) {
			const row = this.activityEl.createDiv({ cls: "ft-activity-row" });
			row.style.cssText = "display:flex;align-items:center;gap:8px;padding:3px 0;";

			const iconEl = row.createSpan();
			setIcon(iconEl, this.getActivityIcon(group.latestAction));

			const name = group.path.split("/").pop() ?? group.path;
			const link = row.createEl("a", { text: name, cls: "ft-activity-link" });
			link.title = group.path;
			link.style.cssText = "cursor:pointer;text-decoration:underline;color:var(--text-accent);flex:1;";
			link.addEventListener("click", (e) => {
				e.preventDefault();
				if (group.latestAction !== "deleted") {
					this.deps.openFile(group.path);
				}
			});

			row.createEl("span", {
				text: group.latestAction,
				cls: "ft-badge",
			}).style.cssText = "background:var(--background-modifier-hover);padding:1px 6px;border-radius:3px;font-size:11px;color:var(--text-muted);";

			if (group.count > 1) {
				row.createEl("span", {
					text: `×${group.count}`,
					cls: "ft-badge ft-activity-count",
				}).style.cssText = "background:var(--background-modifier-hover);padding:1px 6px;border-radius:3px;font-size:11px;color:var(--text-muted);";
			}

			row.createEl("span", {
				text: this.formatActivityTime(group.latestTimestamp),
				cls: "ft-text-muted",
			}).style.cssText = "color:var(--text-muted);font-size:11px;font-family:var(--font-monospace);";
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
