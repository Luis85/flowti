/**
 * History tab — Lit component rendering the activity log filtered by agent.
 * Read-only; subscribes to DashboardStore for reactive updates.
 */

import { html, css } from "lit";
import { FlowtiElement } from "../../components/flowti-element.js";
import { resetStyles, colorStyles, fontStyles, scrollStyles } from "./game-styles.js";
import type { DashboardStore } from "../store/dashboard-store.js";
import type { ActivityEntry, AgentActionType } from "../data/types.js";

// -- Friendly labels and icons per action type ----------------

const ACTION_LABELS: Record<AgentActionType, string> = {
	"thinking": "Thinking",
	"speaking": "Spoke",
	"asking": "Asked",
	"using-tool": "Used tool",
	"tool-complete": "Tool finished",
	"requesting-permission": "Requested permission",
	"permission-granted": "Permission granted",
	"permission-denied": "Permission denied",
	"task-started": "Started task",
	"task-completed": "Completed task",
	"idle": "Went idle",
	"error": "Error",
	"queued": "Queued",
};

const ACTION_COLORS: Partial<Record<AgentActionType, string>> = {
	"speaking": "#3b82f6",
	"asking": "#f59e0b",
	"thinking": "#8b5cf6",
	"using-tool": "#10b981",
	"error": "#ef4444",
	"task-started": "#22c55e",
	"task-completed": "#22c55e",
	"requesting-permission": "#f59e0b",
};

function formatTime(iso: string): string {
	try {
		const d = new Date(iso);
		const now = new Date();
		const sameDay = d.toDateString() === now.toDateString();
		const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
		if (sameDay) return time;
		return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
	} catch {
		return iso;
	}
}

/** Strip leading action-type echo from summary text (e.g., "speaking Hello" -> "Hello"). */
function cleanSummary(type: AgentActionType, summary: string): string {
	// Remove leading action type word if the summary starts with it
	const stripped = summary.replace(new RegExp(`^${type}\\s+`, "i"), "");
	return stripped || summary;
}

export class PanelHistory extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		store: { attribute: false },
		agentName: { type: String },
		entries: { state: true },
	};

	static styles = [
		...FlowtiElement.styles,
		resetStyles,
		colorStyles,
		fontStyles,
		scrollStyles,
		css`
			:host {
				display: block;
			}

			.history-item {
				padding: 8px 0;
				border-bottom: 1px solid var(--bg-secondary);
				font-size: 12px;
			}

			.history-header {
				display: flex;
				align-items: center;
				gap: 6px;
			}

			.history-badge {
				font-size: 10px;
				font-weight: 600;
				padding: 1px 6px;
				border-radius: 3px;
				white-space: nowrap;
			}

			.history-time {
				color: var(--text-muted);
				font-size: 10px;
				margin-left: auto;
			}

			.history-summary {
				margin-top: 4px;
				color: var(--text-primary);
				line-height: 1.4;
			}

			.empty {
				color: var(--text-muted);
				font-style: italic;
				text-align: center;
				padding: 20px 0;
			}
		`,
	];

	store!: DashboardStore;
	agentName = "";

	private entries: readonly ActivityEntry[] = [];

	private storeHandler = () => { this.syncFromStore(); };

	connectedCallback(): void {
		super.connectedCallback();
		if (this.store) {
			this.store.addEventListener("state-changed", this.storeHandler);
			this.syncFromStore();
		}
	}

	disconnectedCallback(): void {
		super.disconnectedCallback();
		if (this.store) {
			this.store.removeEventListener("state-changed", this.storeHandler);
		}
	}

	private syncFromStore(): void {
		this.entries = this.store.activityLog.filter(
			(entry) => entry.agentName === this.agentName,
		);
	}

	protected renderContent() {
		if (this.entries.length === 0) {
			return html`<div class="empty">No activity recorded yet.</div>`;
		}

		// Show newest first
		const sorted = [...this.entries].reverse();

		return html`
			${sorted.map((entry) => {
				const label = ACTION_LABELS[entry.type] ?? entry.type;
				const color = ACTION_COLORS[entry.type] ?? "#64748b";
				const summary = cleanSummary(entry.type, entry.summary);
				return html`
					<div class="history-item">
						<div class="history-header">
							<span class="history-badge" style="background:${color}22;color:${color}">${label}</span>
							<span class="history-time">${formatTime(entry.timestamp)}</span>
						</div>
						${summary ? html`<div class="history-summary">${summary}</div>` : ""}
					</div>
				`;
			})}
		`;
	}
}

if (!customElements.get("ft-game-panel-history")) customElements.define("ft-game-panel-history", PanelHistory);
