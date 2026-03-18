import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';

interface ActivityEntry {
	path: string;
	action: string;
	timestamp: string;
}

interface GroupedActivity {
	path: string;
	latestAction: string;
	latestTimestamp: string;
	count: number;
}

/**
 * Activity log panel showing grouped file activity.
 *
 * @property activities - Array of activity entries
 * @property activityFilter - Array of excluded folder paths
 *
 * @fires activity-open - detail: { path: string }
 * @fires filter-add - detail: { folder: string }
 * @fires filter-remove - detail: { folder: string }
 */
export class FlowtiSessionActivity extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		activities: { type: Array },
		activityFilter: { type: Array, attribute: 'activity-filter' },
	};

	static styles = [
		...FlowtiElement.styles,
		css`
			.section {
				padding: var(--flowti-space-sm) var(--flowti-space-md);
			}

			.header-row {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
				margin-bottom: var(--flowti-space-sm);
			}

			.count {
				color: var(--flowti-color-muted);
				font-size: var(--flowti-font-sm);
			}

			.filter-tags {
				display: flex;
				flex-wrap: wrap;
				gap: var(--flowti-space-xs);
				margin-bottom: var(--flowti-space-sm);
			}

			.filter-tag {
				display: inline-flex;
				align-items: center;
				gap: 4px;
				padding: 2px var(--flowti-space-sm);
				border-radius: var(--flowti-radius);
				background: var(--background-secondary);
				font-size: var(--flowti-font-sm);
			}

			.filter-remove {
				border: none;
				background: none;
				color: var(--flowti-color-muted);
				cursor: pointer;
				padding: 0;
				font-size: 1em;
			}

			.filter-remove:hover {
				color: var(--flowti-color-error);
			}

			.filter-input {
				width: 100%;
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border: 1px solid var(--flowti-border);
				border-radius: var(--flowti-radius);
				background: var(--background-primary);
				color: var(--text-normal);
				margin-bottom: var(--flowti-space-sm);
			}

			.activity-row {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
				padding: var(--flowti-space-xs) 0;
				font-size: var(--flowti-font-sm);
			}

			.activity-icon {
				flex-shrink: 0;
				width: 16px;
				text-align: center;
			}

			.activity-link {
				color: var(--text-accent);
				cursor: pointer;
				text-decoration: none;
				flex: 1;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			.activity-link:hover {
				text-decoration: underline;
			}

			.badge {
				padding: 1px 6px;
				border-radius: var(--flowti-radius);
				background: var(--background-secondary);
				font-size: var(--flowti-font-sm);
			}

			.timestamp {
				color: var(--flowti-color-muted);
				white-space: nowrap;
			}

			.empty-text {
				color: var(--flowti-color-muted);
				font-size: var(--flowti-font-sm);
			}
		`,
	];

	activities: ActivityEntry[] = [];
	activityFilter: string[] = [];

	private get groupedActivities(): GroupedActivity[] {
		const map = new Map<string, GroupedActivity>();
		for (const entry of this.activities) {
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

	private onOpenFile(path: string, action: string): void {
		if (action === 'deleted') return;
		this.dispatchEvent(new CustomEvent('activity-open', {
			detail: { path },
			bubbles: true,
			composed: true,
		}));
	}

	private onFilterRemove(folder: string): void {
		this.dispatchEvent(new CustomEvent('filter-remove', {
			detail: { folder },
			bubbles: true,
			composed: true,
		}));
	}

	private onFilterKeydown(e: KeyboardEvent): void {
		if (e.key !== 'Enter') return;
		const input = e.target as HTMLInputElement;
		const folder = input.value.trim();
		if (!folder) return;
		this.dispatchEvent(new CustomEvent('filter-add', {
			detail: { folder },
			bubbles: true,
			composed: true,
		}));
		input.value = '';
	}

	private getActivityIcon(action: string): string {
		switch (action) {
			case 'created': return '+';
			case 'modified': return '\u270E';
			case 'deleted': return '-';
			case 'renamed': return '\u2192';
			case 'opened': return '\uD83D\uDD0D';
			default: return '\u25CF';
		}
	}

	private formatTime(timestamp: string): string {
		const d = new Date(timestamp);
		return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
	}

	protected renderContent() {
		const groups = this.groupedActivities;

		return html`
			<div class="section">
				<div class="header-row">
					<strong>Activity</strong>
					<span class="count">(${this.activities.length})</span>
				</div>
				${this.activityFilter.length > 0 ? html`
					<div class="filter-tags">
						${this.activityFilter.map((folder) => html`
							<span class="filter-tag">
								<span>${folder}</span>
								<button class="filter-remove" @click=${() => this.onFilterRemove(folder)}>\u00D7</button>
							</span>
						`)}
					</div>
				` : nothing}
				<input
					class="filter-input"
					type="text"
					placeholder="Exclude folder..."
					@keydown=${this.onFilterKeydown}
				/>
				${groups.length === 0
					? html`<div class="empty-text">No activity yet</div>`
					: groups.map((group) => html`
						<div class="activity-row">
							<span class="activity-icon">${this.getActivityIcon(group.latestAction)}</span>
							<a
								class="activity-link"
								title=${group.path}
								@click=${() => this.onOpenFile(group.path, group.latestAction)}
							>${group.path.split('/').pop() ?? group.path}</a>
							<span class="badge">${group.latestAction}</span>
							${group.count > 1 ? html`<span class="badge">\u00D7${group.count}</span>` : nothing}
							<span class="timestamp">${this.formatTime(group.latestTimestamp)}</span>
						</div>
					`)
				}
			</div>
		`;
	}
}

if (!customElements.get('flowti-session-activity')) customElements.define('flowti-session-activity', FlowtiSessionActivity);
