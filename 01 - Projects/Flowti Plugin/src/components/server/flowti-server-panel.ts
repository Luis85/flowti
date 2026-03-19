/**
 * Root Lit component for the Server Panel.
 * Composes child components in collapsible detail sections:
 * Status, Activity, Stats, Configuration.
 */

import { html, css } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import { tokens } from "../tokens.js";
import type { ActivityEntry, ServerStats, ServerConfig } from "../../domain/server/types.js";

// Side-effect imports to register child custom elements
import "./flowti-server-status.js";
import "./flowti-activity-feed.js";
import "./flowti-server-stats.js";
import "./flowti-server-config.js";
import "../shared/ft-process-log.js";

export class FlowtiServerPanel extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		running: { type: Boolean },
		pid: { type: Number },
		port: { type: Number },
		uptime: { type: Number },
		url: { type: String },
		entries: { type: Array },
		paused: { type: Boolean },
		stats: { type: Object },
		config: { type: Object },
		outputLines: { type: Array },
		outputBusy: { type: Boolean },
		outputBusyLabel: { type: String },
		outputError: { type: String },
	};

	static styles = [
		...FlowtiElement.styles,
		tokens,
		css`
			:host {
				display: flex;
				flex-direction: column;
				height: 100%;
				overflow-y: auto;
				padding: var(--flowti-space-sm, 8px);
			}

			details {
				border: 1px solid var(--flowti-border, var(--background-modifier-border));
				border-radius: var(--flowti-radius, 4px);
				margin-bottom: var(--flowti-space-sm, 8px);
				overflow: hidden;
			}

			summary {
				padding: var(--flowti-space-sm, 8px) var(--flowti-space-md, 16px);
				font-weight: 600;
				font-size: var(--flowti-font-sm, 0.85em);
				cursor: pointer;
				user-select: none;
				background: color-mix(in srgb, var(--background-modifier-border) 30%, transparent);
				border-bottom: 1px solid transparent;
			}

			details[open] > summary {
				border-bottom-color: var(--flowti-border, var(--background-modifier-border));
			}

			summary:hover {
				background: color-mix(in srgb, var(--background-modifier-border) 50%, transparent);
			}

			.section-content {
				padding: var(--flowti-space-sm, 8px);
			}
		`,
	];

	running = false;
	pid = 0;
	port = 3000;
	uptime = 0;
	url = "";
	entries: ActivityEntry[] = [];
	paused = false;
	stats: ServerStats | null = null;
	config: ServerConfig | null = null;
	outputLines: string[] = [];
	outputBusy = false;
	outputBusyLabel = "Starting server...";
	outputError = "";

	protected renderContent() {
		return html`
			<details open>
				<summary>Status</summary>
				<div class="section-content">
					<flowti-server-status
						.running="${this.running}"
						.pid="${this.pid}"
						.port="${this.port}"
						.uptime="${this.uptime}"
						.url="${this.url}"
					></flowti-server-status>
				</div>
			</details>
			<ft-process-log
				.lines="${this.outputLines}"
				.busy="${this.outputBusy}"
				.busyLabel="${this.outputBusyLabel}"
				.errorNote="${this.outputError}"
				@dismiss="${() => { this.outputLines = []; this.outputError = ""; }}"
			></ft-process-log>
			<details>
				<summary>Activity</summary>
				<div class="section-content">
					<flowti-activity-feed
						.entries="${this.entries}"
						.paused="${this.paused}"
					></flowti-activity-feed>
				</div>
			</details>
			<details>
				<summary>Stats</summary>
				<div class="section-content">
					<flowti-server-stats
						.stats="${this.stats}"
					></flowti-server-stats>
				</div>
			</details>
			<details>
				<summary>Configuration</summary>
				<div class="section-content">
					<flowti-server-config
						.config="${this.config ?? { port: 3000, logLevel: "info", autoConnect: false }}"
					></flowti-server-config>
				</div>
			</details>
		`;
	}
}

if (!customElements.get("flowti-server-panel")) customElements.define("flowti-server-panel", FlowtiServerPanel);
