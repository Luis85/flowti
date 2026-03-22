/**
 * Economy sub-component — renders level, trust tier, XP progress, coin/tokens, and capability badges.
 * Used inside panel-info.ts.
 */

import { LitElement, html, css, nothing } from "lit";
import { resetStyles, colorStyles, fontStyles } from "./game-styles.js";
import type { DashboardAgent } from "../data/types.js";

import { LEVEL_TABLE } from "../../../../Flowti CLI/src/domain/economy/leveling.js";

const LEVEL_THRESHOLDS = LEVEL_TABLE.map(e => e.xpRequired);
const LEVEL_TITLES = ["", ...LEVEL_TABLE.map(e => e.title)];
const NEXT_UNLOCK = ["", ...LEVEL_TABLE.slice(1).map(e => e.unlocks.join(", ")), ""];

const TRUST_TIER_COLORS: Record<string, string> = {
	supervised: "#f59e0b",
	trusted: "#22c55e",
	autonomous: "#8b5cf6",
};

export class PanelEconomy extends LitElement {
	static properties = {
		agent: { attribute: false },
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

			.tag {
				font-size: 10px;
				font-weight: 600;
				padding: 2px 8px;
				border-radius: 10px;
				letter-spacing: 0.3px;
			}

			.economy-header {
				display: flex;
				align-items: center;
				gap: 6px;
				margin-bottom: 6px;
			}

			.level-badge {
				font-size: 10px;
				font-weight: 700;
				padding: 2px 7px;
				border-radius: 10px;
				background: rgba(139, 92, 246, 0.2);
				color: #c4b5fd;
				white-space: nowrap;
			}

			.trust-badge {
				font-size: 10px;
				font-weight: 600;
				padding: 2px 7px;
				border-radius: 10px;
				color: #fff;
				white-space: nowrap;
			}

			.xp-row {
				display: flex;
				align-items: center;
				gap: 8px;
				margin-bottom: 12px;
			}

			.xp-label {
				font-size: 10px;
				color: var(--text-dim);
				white-space: nowrap;
			}

			.xp-bar {
				flex: 1;
				height: 4px;
				background: rgba(255, 255, 255, 0.06);
				border-radius: 2px;
				overflow: hidden;
			}

			.xp-fill {
				height: 100%;
				border-radius: 2px;
				background: linear-gradient(90deg, #8b5cf6, #a78bfa);
			}

			.economy-stats {
				display: flex;
				gap: 12px;
				margin-bottom: 8px;
			}

			.economy-stat {
				display: flex;
				align-items: center;
				gap: 4px;
				font-size: 11px;
				color: var(--text-secondary);
			}

			.economy-stat-icon {
				font-size: 12px;
			}

			.economy-stat-value {
				font-weight: 600;
				color: var(--text-primary);
			}

			.capability-badges {
				display: flex;
				flex-wrap: wrap;
				gap: 4px;
				margin-top: 6px;
			}

			.tag-capability {
				background: rgba(6, 182, 212, 0.12);
				color: #22d3ee;
			}

			.level-title {
				font-size: 10px;
				color: var(--text-secondary);
				margin-left: 4px;
			}

			.next-unlock {
				font-size: 10px;
				color: var(--text-muted);
				margin-bottom: 6px;
			}

			.hint {
				font-size: 10px;
				color: var(--text-muted);
				font-style: italic;
				line-height: 1.4;
				margin-top: 4px;
			}
		`,
	];

	agent!: DashboardAgent;

	render() {
		const { level, coin, tokens, trustTier, capabilities } = this.agent;
		if (level === undefined && coin === undefined && tokens === undefined) return nothing;

		const lvl = level ?? 1;
		const xp = this.agent.xp ?? this.agent.experience ?? 0;
		const currentThreshold = LEVEL_THRESHOLDS[lvl - 1] ?? 0;
		const nextThreshold = LEVEL_THRESHOLDS[lvl] ?? currentThreshold;
		const xpProgress = nextThreshold > currentThreshold
			? Math.min(1, (xp - currentThreshold) / (nextThreshold - currentThreshold))
			: 1;
		const xpPct = Math.round(xpProgress * 100);

		const tier = trustTier ?? "supervised";
		const tierColor = TRUST_TIER_COLORS[tier] ?? "#6b7280";
		const title = LEVEL_TITLES[lvl] ?? "";
		const nextUnlock = NEXT_UNLOCK[lvl] ?? "";
		const isStarter = lvl === 1 && xp === 0;

		return html`
			<div class="section">
				<div class="section-label">Economy</div>
				<div class="economy-header">
					<span class="level-badge">Level ${lvl}${title ? html` <span class="level-title">— ${title}</span>` : nothing}</span>
					<span class="trust-badge" style="background:${tierColor}22;color:${tierColor}">${tier}</span>
				</div>
				${nextUnlock ? html`<div class="next-unlock">Next: ${nextUnlock}</div>` : nothing}
				${isStarter ? html`<p class="hint">Complete tasks to earn XP and level up. Level 2 unlocks standing orders.</p>` : nothing}
				<div class="xp-row">
					<span class="xp-label">XP</span>
					<div class="xp-bar"><div class="xp-fill" style="width:${xpPct}%"></div></div>
					<span class="xp-label">${xpPct}%</span>
				</div>
				<div class="economy-stats">
					${coin !== undefined ? html`
						<div class="economy-stat">
							<span class="economy-stat-icon">\u{1FA99}</span>
							<span class="economy-stat-value">${coin}</span>
						</div>
					` : nothing}
					${tokens !== undefined ? html`
						<div class="economy-stat">
							<span class="economy-stat-icon">\u26A1</span>
							<span class="economy-stat-value">${tokens}</span>
						</div>
					` : nothing}
				</div>
				${capabilities && capabilities.length > 0 ? html`
					<div class="capability-badges">
						${capabilities.map(c => html`<span class="tag tag-capability">${c}</span>`)}
					</div>
				` : nothing}
			</div>
		`;
	}
}

if (!customElements.get("ft-game-panel-economy")) customElements.define("ft-game-panel-economy", PanelEconomy);
