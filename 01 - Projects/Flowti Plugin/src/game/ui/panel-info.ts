/**
 * Info tab — warm, card-style agent profile.
 * Shows persona, personality, domain, mood, stats, skills, relationships.
 */

import { html, css, nothing } from "lit";
import { FlowtiElement } from "../../components/flowti-element.js";
import { resetStyles, colorStyles, fontStyles } from "./game-styles.js";
import type { DashboardAgent } from "../data/types.js";
import type { AgentNeeds } from "../systems/needs-system.js";
import "./panel-vitals.js";
import "./panel-economy.js";

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
		`,
	];

	agent!: DashboardAgent;
	needs?: AgentNeeds;

	protected renderContent() {
		if (!this.agent) {
			return html`<div class="empty">No agent selected.</div>`;
		}

		const { attributes, xp } = this.agent;

		return html`
			${this.renderHero()}
			${this.renderProjectContext()}
			<ft-game-panel-vitals .needs="${this.needs}"></ft-game-panel-vitals>
			<ft-game-panel-economy .agent="${this.agent}"></ft-game-panel-economy>
			${this.renderStats(attributes)}
			${xp !== undefined ? this.renderXp(xp) : nothing}
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
