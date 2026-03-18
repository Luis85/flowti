/**
 * Server Stats — stat card grid showing Flowti server metrics.
 *
 * Displays: SSE Connections, Agents, Storybook, Uptime.
 *
 * @property stats - The current server stats object (null = loading)
 *
 * Pure presentation component — no events, no side effects.
 */

import { html, css } from 'lit';
import { FlowtiElement } from '../flowti-element.js';
import { statCardGrid } from '../shared-styles.js';
import type { ServerStats } from '../../domain/server/types.js';

export class FlowtiServerStats extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		stats: { type: Object },
	};

	static styles = [
		...FlowtiElement.styles,
		statCardGrid,
		css`
			.stat-grid {
				grid-template-columns: repeat(4, 1fr);
			}
		`,
	];

	stats: ServerStats | null = null;

	protected renderContent() {
		if (!this.stats) {
			return html`<div class="flowti-loading">Loading\u2026</div>`;
		}

		return html`
			<div class="stat-grid">
				<div class="stat-card">
					<div class="stat-card__value">${this.stats.connections}</div>
					<div class="stat-card__label">SSE Connections</div>
				</div>
				<div class="stat-card">
					<div class="stat-card__value">${this.stats.agentCount}</div>
					<div class="stat-card__label">Agents</div>
				</div>
				<div class="stat-card">
					<div class="stat-card__value">${this.stats.storybookProcesses.length}</div>
					<div class="stat-card__label">Storybook</div>
				</div>
				<div class="stat-card">
					<div class="stat-card__value">${this.formatUptime(this.stats.uptime)}</div>
					<div class="stat-card__label">Uptime</div>
				</div>
			</div>
		`;
	}

	private formatUptime(ms: number): string {
		const totalSeconds = Math.floor(ms / 1000);
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;

		if (hours > 0) {
			return `${hours}h ${minutes}m`;
		}
		return `${minutes}:${String(seconds).padStart(2, '0')}`;
	}
}

if (!customElements.get('flowti-server-stats')) customElements.define('flowti-server-stats', FlowtiServerStats);
