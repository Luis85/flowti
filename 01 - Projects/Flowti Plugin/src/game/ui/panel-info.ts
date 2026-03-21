/**
 * Info tab — warm, card-style agent profile.
 * Shows persona, personality, domain, mood, stats, skills, relationships.
 */

import { html, css, nothing } from "lit";
import { FlowtiElement } from "../../components/flowti-element.js";
import { resetStyles, colorStyles, fontStyles } from "./game-styles.js";
import type { DashboardAgent } from "../data/types.js";
import type { AgentNeeds } from "../systems/needs-system.js";

const STAT_LABELS: ReadonlyArray<readonly [string, keyof NonNullable<DashboardAgent["attributes"]>]> = [
	["STR", "str"],
	["INT", "int"],
	["WIS", "wis"],
	["CHA", "cha"],
	["DEX", "dex"],
	["CON", "con"],
];

const MOOD_EMOJI: Record<string, string> = {
	happy: "sunny",
	focused: "laser-focused",
	frustrated: "on edge",
	neutral: "calm",
};

const DOMAIN_COLORS: Record<string, string> = {
	engineering: "#3b82f6",
	design: "#a855f7",
	product: "#f59e0b",
	management: "#10b981",
	quality: "#ef4444",
	operations: "#06b6d4",
	analysis: "#8b5cf6",
	orchestration: "#ec4899",
};

const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2200, 3000] as const;

const TRUST_TIER_COLORS: Record<string, string> = {
	supervised: "#f59e0b",
	trusted: "#22c55e",
	autonomous: "#8b5cf6",
};

const VITALS: ReadonlyArray<{ label: string; key: keyof AgentNeeds; color: string; lowThreshold: number }> = [
	{ label: "Energy",  key: "energy",  color: "#22c55e", lowThreshold: 30 },
	{ label: "Hunger",  key: "hunger",  color: "#f97316", lowThreshold: 40 },
	{ label: "Thirst",  key: "thirst",  color: "#06b6d4", lowThreshold: 30 },
	{ label: "Focus",   key: "focus",   color: "#a855f7", lowThreshold: 25 },
	{ label: "Social",  key: "social",  color: "#f59e0b", lowThreshold: 25 },
	{ label: "Morale",  key: "morale",  color: "#ec4899", lowThreshold: 20 },
];

export class PanelInfo extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		agent: { attribute: false },
		needs: { attribute: false },
	};

	static styles = [
		...FlowtiElement.styles,
		resetStyles,
		colorStyles,
		fontStyles,
		css`
			:host {
				display: block;
			}

			/* -- Hero / greeting area ------------- */
			.hero {
				text-align: center;
				padding: 12px 8px 16px;
				border-bottom: 1px solid rgba(255, 255, 255, 0.06);
				margin-bottom: 12px;
			}

			.persona {
				font-size: 13px;
				color: var(--text-secondary);
				font-style: italic;
				line-height: 1.5;
				max-width: 240px;
				margin: 0 auto;
			}

			/* -- Tags row ------------------------- */
			.tags {
				display: flex;
				flex-wrap: wrap;
				gap: 6px;
				justify-content: center;
				margin-top: 10px;
			}

			.tag {
				font-size: 10px;
				font-weight: 600;
				padding: 2px 8px;
				border-radius: 10px;
				letter-spacing: 0.3px;
			}

			.tag-domain {
				color: #fff;
			}

			.tag-type {
				background: rgba(139, 92, 246, 0.15);
				color: #a78bfa;
			}

			.tag-mood {
				background: rgba(250, 204, 21, 0.12);
				color: #fbbf24;
			}

			.tag-status {
				background: rgba(34, 197, 94, 0.12);
				color: #4ade80;
			}

			.tag-status[data-status="idle"] {
				background: rgba(59, 130, 246, 0.12);
				color: #60a5fa;
			}

			.tag-status[data-status="unassigned"] {
				background: rgba(107, 114, 128, 0.12);
				color: #9ca3af;
			}

			/* -- Personality traits --------------- */
			.personality {
				display: flex;
				flex-wrap: wrap;
				gap: 4px;
				margin-top: 8px;
				justify-content: center;
			}

			.trait {
				font-size: 10px;
				padding: 2px 7px;
				border-radius: 3px;
				background: rgba(148, 163, 184, 0.1);
				color: var(--text-secondary);
			}

			/* -- Stats bar ----------------------- */
			.stats {
				display: grid;
				grid-template-columns: repeat(6, 1fr);
				gap: 4px;
				margin-bottom: 12px;
			}

			.stat {
				text-align: center;
				padding: 6px 2px;
				background: rgba(15, 23, 42, 0.6);
				border-radius: 4px;
			}

			.stat-val {
				font-size: 14px;
				font-weight: 700;
				color: var(--text-primary);
			}

			.stat-label {
				font-size: 9px;
				color: var(--text-dim);
				text-transform: uppercase;
				letter-spacing: 0.5px;
			}

			.stat-bar {
				width: 100%;
				height: 2px;
				background: rgba(255, 255, 255, 0.06);
				border-radius: 1px;
				margin-top: 3px;
				overflow: hidden;
			}

			.stat-fill {
				height: 100%;
				border-radius: 1px;
				background: #3b82f6;
			}

			/* -- Section ------------------------- */
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

			/* -- Skills -------------------------- */
			.skill {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: 3px 0;
				font-size: 12px;
			}

			.skill-name {
				color: var(--text-primary);
			}

			.skill-level {
				color: var(--text-muted);
				font-size: 10px;
			}

			/* -- Relationships ------------------- */
			.rel {
				display: flex;
				align-items: center;
				gap: 6px;
				padding: 3px 0;
				font-size: 12px;
			}

			.rel-name {
				color: var(--text-primary);
			}

			.rel-type {
				color: var(--text-muted);
				font-size: 10px;
			}

			/* -- XP bar -------------------------- */
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

			.empty {
				color: var(--text-muted);
				font-style: italic;
				text-align: center;
				padding: 20px 0;
			}

			/* -- Context rows -------------------- */
			.context-row {
				display: flex;
				justify-content: space-between;
				padding: 2px 0;
				font-size: 11px;
			}

			.context-label {
				color: var(--text-dim);
			}

			.context-value {
				color: var(--text-secondary);
			}

			.context-dim {
				color: var(--text-muted);
				font-size: 10px;
			}

			/* -- Vitals bars --------------------- */
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

			/* -- Economy section ----------------- */
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

			/* -- Capability badges ---------------- */
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
		`,
	];

	agent!: DashboardAgent;
	needs?: AgentNeeds;

	protected renderContent() {
		if (!this.agent) {
			return html`<div class="empty">No agent selected.</div>`;
		}

		const { attributes, experience } = this.agent;

		return html`
			${this.renderHero()}
			${this.renderProjectContext()}
			${this.renderVitals()}
			${this.renderEconomy()}
			${this.renderStats(attributes)}
			${experience !== undefined ? this.renderXp(experience) : nothing}
			${this.renderListSection("Skills", this.agent.skills, (s) => html`
				<div class="skill"><span class="skill-name">${s.name}</span><span class="skill-level">${s.level}</span></div>
			`)}
			${this.renderListSection("Connections", this.agent.relationships, (r) => html`
				<div class="rel"><span class="rel-name">${r.target}</span><span class="rel-type">${r.type}</span></div>
			`)}
			${this.renderListSection("Goals", this.agent.goals, (g) => html`
				<div class="skill"><span class="skill-name">${g.text}</span><span class="skill-level">${g.priority}</span></div>
			`)}
			${this.agent.behaviors && this.agent.behaviors.length > 0 ? html`
				<div class="section">
					<div class="section-label">Behaviors</div>
					<div class="personality">${this.agent.behaviors.map((b) => html`<span class="trait">${b}</span>`)}</div>
				</div>
			` : nothing}
		`;
	}

	private renderHero() {
		const { persona, personality, domain, mood, status, agentType } = this.agent;
		const domainColor = DOMAIN_COLORS[domain ?? ""] ?? "#64748b";

		return html`
			<div class="hero">
				${persona ? html`<div class="persona">"${persona}"</div>` : nothing}
				<div class="tags">
					${domain ? html`<span class="tag tag-domain" style="background:${domainColor}">${domain}</span>` : nothing}
					<span class="tag tag-type">${agentType === "ai" ? "AI Agent" : agentType === "npc" ? "NPC" : "Human"}</span>
					${mood ? html`<span class="tag tag-mood">${MOOD_EMOJI[mood] ?? mood}</span>` : nothing}
					<span class="tag tag-status" data-status="${status}">${status}</span>
				</div>
				${personality && personality.length > 0 ? html`
					<div class="personality">${personality.map((t) => html`<span class="trait">${t}</span>`)}</div>
				` : nothing}
			</div>
		`;
	}

	private renderProjectContext() {
		if (!this.agent.project && !this.agent.iteration) return nothing;
		return html`
			<div class="section">
				${this.agent.project ? html`
					<div class="context-row">
						<span class="context-label">Project</span>
						<span class="context-value">${this.agent.project}</span>
					</div>
				` : nothing}
				${this.agent.iteration ? html`
					<div class="context-row">
						<span class="context-label">Iteration</span>
						<span class="context-value">${this.agent.iteration}${this.agent.phase ? html` <span class="context-dim">(${this.agent.phase})</span>` : nothing}</span>
					</div>
				` : nothing}
			</div>
		`;
	}

	private renderListSection<T>(label: string, items: readonly T[] | undefined, renderItem: (item: T) => unknown) {
		if (!items || items.length === 0) return nothing;
		return html`
			<div class="section">
				<div class="section-label">${label}</div>
				${items.map(renderItem)}
			</div>
		`;
	}

	private renderVitals() {
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

	private renderEconomy() {
		const { level, coin, tokens, trustTier, capabilities } = this.agent;
		if (level === undefined && coin === undefined && tokens === undefined) return nothing;

		const lvl = level ?? 1;
		const xp = this.agent.experience ?? 0;
		const currentThreshold = LEVEL_THRESHOLDS[lvl - 1] ?? 0;
		const nextThreshold = LEVEL_THRESHOLDS[lvl] ?? currentThreshold;
		const xpProgress = nextThreshold > currentThreshold
			? Math.min(1, (xp - currentThreshold) / (nextThreshold - currentThreshold))
			: 1;
		const xpPct = Math.round(xpProgress * 100);

		const tier = trustTier ?? "supervised";
		const tierColor = TRUST_TIER_COLORS[tier] ?? "#6b7280";

		return html`
			<div class="section">
				<div class="section-label">Economy</div>
				<div class="economy-header">
					<span class="level-badge">Level ${lvl}</span>
					<span class="trust-badge" style="background:${tierColor}22;color:${tierColor}">${tier}</span>
				</div>
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

	private renderStats(attrs: DashboardAgent["attributes"]) {
		if (!attrs) return nothing;
		const items = STAT_LABELS.filter(([, key]) => attrs[key] !== undefined);
		if (items.length === 0) return nothing;

		return html`
			<div class="stats">
				${items.map(([label, key]) => {
					const val = attrs[key] ?? 0;
					const pct = Math.min(100, (val / 20) * 100);
					return html`
						<div class="stat">
							<div class="stat-val">${val}</div>
							<div class="stat-label">${label}</div>
							<div class="stat-bar"><div class="stat-fill" style="width:${pct}%"></div></div>
						</div>
					`;
				})}
			</div>
		`;
	}

	private renderXp(xp: number) {
		const level = Math.floor(xp / 100);
		const pct = xp % 100;
		return html`
			<div class="xp-row">
				<span class="xp-label">Lv ${level}</span>
				<div class="xp-bar"><div class="xp-fill" style="width:${pct}%"></div></div>
				<span class="xp-label">${xp} XP</span>
			</div>
		`;
	}
}

if (!customElements.get("ft-game-panel-info")) customElements.define("ft-game-panel-info", PanelInfo);
