/**
 * Vitals bars sub-component — renders agent needs (energy, hunger, thirst, focus, social, morale).
 * Used inside panel-info.ts.
 */

import { LitElement, html, css, nothing } from "lit";
import { resetStyles, colorStyles, fontStyles } from "./game-styles.js";
import type { AgentNeeds } from "../systems/needs-system.js";

const VITALS: ReadonlyArray<{ label: string; key: keyof AgentNeeds; color: string; lowThreshold: number }> = [
	{ label: "Energy",  key: "energy",  color: "#22c55e", lowThreshold: 30 },
	{ label: "Hunger",  key: "hunger",  color: "#f97316", lowThreshold: 40 },
	{ label: "Thirst",  key: "thirst",  color: "#06b6d4", lowThreshold: 30 },
	{ label: "Focus",   key: "focus",   color: "#a855f7", lowThreshold: 25 },
	{ label: "Social",  key: "social",  color: "#f59e0b", lowThreshold: 25 },
	{ label: "Morale",  key: "morale",  color: "#ec4899", lowThreshold: 20 },
];

export class PanelVitals extends LitElement {
	static properties = {
		needs: { attribute: false },
	};

	static styles = [
		resetStyles,
		colorStyles,
		fontStyles,
		css`
			:host {
				display: block;
			}

			.section {
				margin-bottom: 10px;
			}

			.section-label {
				font-size: 10px;
				font-weight: 600;
				color: var(--text-dim);
				text-transform: uppercase;
				letter-spacing: 0.5px;
				margin-bottom: 6px;
			}

			.vitals-row {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: 2px 0;
				font-size: 11px;
			}

			.vitals-label {
				color: var(--text-secondary);
				min-width: 44px;
			}

			.vitals-pct {
				color: var(--text-muted);
				font-size: 10px;
				min-width: 30px;
				text-align: right;
			}

			.needs-bar {
				height: 6px;
				border-radius: 3px;
				background: #1e293b;
				overflow: hidden;
				flex: 1;
				margin: 0 6px;
			}

			.needs-bar-fill {
				height: 100%;
				border-radius: 3px;
				transition: width 0.3s ease;
			}

			.needs-low .needs-bar-fill {
				animation: pulse-bar 1s ease-in-out infinite alternate;
			}

			@keyframes pulse-bar {
				from { opacity: 1; }
				to { opacity: 0.5; }
			}
		`,
	];

	needs?: AgentNeeds;

	render() {
		if (!this.needs) return nothing;
		return html`
			<div class="section">
				<div class="section-label">Vitals</div>
				${VITALS.map(({ label, key, color, lowThreshold }) => {
					const value = this.needs![key];
					const pct = Math.round(value);
					const isLow = value < lowThreshold;
					return html`
						<div class="vitals-row${isLow ? " needs-low" : ""}">
							<span class="vitals-label">${label}</span>
							<div class="needs-bar">
								<div class="needs-bar-fill" style="width:${pct}%;background:${color}"></div>
							</div>
							<span class="vitals-pct">${pct}%</span>
						</div>
					`;
				})}
			</div>
		`;
	}
}

if (!customElements.get("ft-game-panel-vitals")) customElements.define("ft-game-panel-vitals", PanelVitals);
