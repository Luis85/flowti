/**
 * Agent Detail Modal — split-screen right 60% character sheet with 6 tabs.
 * Slides in from the right when store.selectedAgent is non-null.
 * Left 40% is a translucent backdrop; clicking it closes the modal.
 */

import { html, css, nothing } from "lit";
import { FlowtiElement } from "../../components/flowti-element.js";
import { resetStyles, colorStyles, fontStyles, buttonStyles, scrollStyles } from "./game-styles.js";
import { StoreController } from "./store-controller.js";
import type { DashboardStore, TabName } from "../store/dashboard-store.js";
import type { DashboardAgent } from "../data/types.js";

// Side-effect imports to register sub-components
import "./panel-vitals.js";
import "./panel-economy.js";
import "./panel-talk.js";
import "./panel-tasks.js";
import "./panel-permissions.js";
import "./panel-brain.js";
import "./panel-debug.js";

const TAB_LABELS: ReadonlyArray<{ name: TabName; label: string }> = [
	{ name: "profile", label: "Profile" },
	{ name: "talk", label: "Talk" },
	{ name: "brain", label: "Brain" },
	{ name: "tasks", label: "Tasks" },
	{ name: "permissions", label: "Permissions" },
	{ name: "debug", label: "Debug" },
];

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

import { TRUST_TIER_COLORS } from "./game-ui-constants.js";

export class AgentDetailModal extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		store: { attribute: false },
	};

	static styles = [
		...FlowtiElement.styles,
		resetStyles,
		colorStyles,
		fontStyles,
		buttonStyles,
		scrollStyles,
		css`
			:host {
				display: block;
			}

			/* ── Backdrop (left 40%) ─────────────────────────── */
			.backdrop {
				position: fixed;
				top: 0;
				left: 0;
				right: 60%;
				bottom: 0;
				background: rgba(0, 0, 0, 0.3);
				z-index: 150;
				cursor: pointer;
			}

			/* ── Modal panel (right 60%) ─────────────────────── */
			.modal {
				position: fixed;
				top: 0;
				left: 40%;
				right: 0;
				bottom: 0;
				background: var(--bg-panel);
				border-left: 1px solid var(--border-glow);
				box-shadow: var(--panel-shadow);
				display: flex;
				flex-direction: column;
				overflow: hidden;
				z-index: 150;
				animation: slide-in 200ms ease-out;
			}

			@keyframes slide-in {
				from { transform: translateX(100%); }
				to { transform: translateX(0); }
			}

			/* ── Header bar ──────────────────────────────────── */
			.modal-header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: 12px 16px;
				border-bottom: 1px solid var(--border);
				background: var(--bg-primary);
				flex-shrink: 0;
				gap: 10px;
			}

			.header-left {
				display: flex;
				align-items: center;
				gap: 10px;
				min-width: 0;
				flex: 1;
			}

			.portrait {
				width: 64px;
				height: 64px;
				border-radius: 50%;
				background: var(--bg-tertiary);
				border: 2px solid var(--border);
				display: flex;
				align-items: center;
				justify-content: center;
				font-size: 24px;
				color: var(--accent-gold);
				flex-shrink: 0;
			}

			.name-block {
				display: flex;
				flex-direction: column;
				min-width: 0;
				gap: 2px;
			}

			.agent-name {
				font-size: 16px;
				font-weight: 700;
				color: var(--text-primary);
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			}

			.agent-persona {
				font-size: 11px;
				color: var(--text-secondary);
				font-style: italic;
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			}

			.badges {
				display: flex;
				align-items: center;
				gap: 6px;
				flex-shrink: 0;
				flex-wrap: wrap;
			}

			.badge {
				font-size: 9px;
				font-weight: 600;
				text-transform: uppercase;
				letter-spacing: 0.06em;
				padding: 2px 6px;
				border-radius: 2px;
				flex-shrink: 0;
			}

			.badge-type {
				background: rgba(78, 139, 217, 0.1);
				color: var(--accent-blue);
				border: 1px solid rgba(78, 139, 217, 0.2);
			}

			.badge-trust {
				border: 1px solid;
			}

			.badge-level {
				background: rgba(217, 170, 78, 0.1);
				color: var(--accent-gold);
				border: 1px solid rgba(217, 170, 78, 0.2);
			}

			.brain-state {
				font-size: 9px;
				font-weight: 600;
				padding: 2px 6px;
				border-radius: 2px;
				background: rgba(59, 130, 246, 0.1);
				color: var(--accent-blue);
				text-transform: uppercase;
				letter-spacing: 0.04em;
			}

			.llm-badge {
				font-size: 9px;
				font-weight: 600;
				padding: 2px 6px;
				border-radius: 3px;
				flex-shrink: 0;
				display: flex;
				align-items: center;
				gap: 4px;
			}

			.llm-badge .dot {
				width: 6px;
				height: 6px;
				border-radius: 50%;
			}

			.llm-idle .dot { background: #22c55e; }
			.llm-idle { background: rgba(34, 197, 94, 0.12); color: #4ade80; }

			.llm-thinking .dot { background: #f59e0b; animation: pulse 1s infinite; }
			.llm-thinking { background: rgba(245, 158, 11, 0.12); color: #fbbf24; }

			.llm-queued .dot { background: #f59e0b; animation: pulse 2s infinite; }
			.llm-queued { background: rgba(245, 158, 11, 0.12); color: #fbbf24; }

			.llm-error .dot { background: #ef4444; }
			.llm-error { background: rgba(239, 68, 68, 0.12); color: #f87171; }

			.llm-offline .dot { background: #64748b; }
			.llm-offline { background: rgba(100, 116, 139, 0.2); color: #94a3b8; }

			@keyframes pulse {
				0%, 100% { opacity: 1; }
				50% { opacity: 0.3; }
			}

			.close-btn {
				background: transparent;
				border: none;
				color: var(--text-secondary);
				font-size: 20px;
				line-height: 1;
				cursor: pointer;
				padding: 4px 8px;
				border-radius: 4px;
				transition: color 0.15s, background 0.15s;
				flex-shrink: 0;
			}

			.close-btn:hover {
				color: var(--text-primary);
				background: var(--bg-tertiary);
			}

			/* ── Tab bar ─────────────────────────────────────── */
			.tab-bar {
				display: flex;
				border-bottom: 1px solid var(--border);
				background: var(--bg-primary);
				flex-shrink: 0;
				overflow-x: auto;
				scrollbar-width: none;
			}

			.tab-bar::-webkit-scrollbar {
				display: none;
			}

			.tab-btn {
				background: transparent;
				border: none;
				border-bottom: 2px solid transparent;
				color: var(--text-muted);
				font-size: 10px;
				font-family: inherit;
				letter-spacing: 0.08em;
				text-transform: uppercase;
				padding: 8px 14px;
				cursor: pointer;
				white-space: nowrap;
				transition: color 0.2s, border-color 0.2s, text-shadow 0.2s;
				flex-shrink: 0;
				border-radius: 0;
			}

			.tab-btn:hover {
				color: var(--text-primary);
			}

			.tab-btn[data-active="true"] {
				color: var(--accent-gold);
				border-bottom-color: var(--accent-gold);
				text-shadow: 0 0 8px rgba(217, 170, 78, 0.3);
			}

			/* ── Tab content ─────────────────────────────────── */
			.tab-content {
				flex: 1;
				overflow: hidden;
				display: flex;
				flex-direction: column;
			}

			.tab-content ft-game-panel-talk,
			.tab-content ft-game-panel-tasks,
			.tab-content ft-game-panel-permissions,
			.tab-content ft-game-panel-brain,
			.tab-content ft-game-panel-debug {
				display: flex;
				flex-direction: column;
				flex: 1;
				min-height: 0;
				overflow: hidden;
			}

			.tab-content ft-game-panel-tasks,
			.tab-content ft-game-panel-permissions,
			.tab-content ft-game-panel-brain,
			.tab-content ft-game-panel-debug {
				overflow-y: auto;
				padding: 10px 12px;
				scrollbar-width: thin;
				scrollbar-color: var(--bg-tertiary) transparent;
			}

			/* ── Inline profile tab ──────────────────────────── */
			.profile-scroll {
				flex: 1;
				overflow-y: auto;
				padding: 12px 16px;
				scrollbar-width: thin;
				scrollbar-color: var(--bg-tertiary) transparent;
			}

			.tags {
				display: flex;
				flex-wrap: wrap;
				gap: 6px;
				margin-bottom: 12px;
			}

			.tag {
				font-size: 10px;
				font-weight: 600;
				padding: 2px 8px;
				border-radius: 10px;
				letter-spacing: 0.3px;
			}

			.tag-domain { color: #fff; }
			.tag-type { background: rgba(139, 92, 246, 0.15); color: #a78bfa; }
			.tag-mood { background: rgba(250, 204, 21, 0.12); color: #fbbf24; }
			.tag-status { background: rgba(34, 197, 94, 0.12); color: #4ade80; }
			.tag-status[data-status="idle"] { background: rgba(59, 130, 246, 0.12); color: #60a5fa; }
			.tag-status[data-status="unassigned"] { background: rgba(107, 114, 128, 0.12); color: #9ca3af; }

			.personality {
				display: flex;
				flex-wrap: wrap;
				gap: 4px;
				margin-bottom: 12px;
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
				background: var(--accent-blue);
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

			.skill-name { color: var(--text-primary); }
			.skill-level { color: var(--text-muted); font-size: 10px; }

			.rel {
				display: flex;
				align-items: center;
				gap: 6px;
				padding: 3px 0;
				font-size: 12px;
			}

			.rel-name { color: var(--text-primary); }
			.rel-type { color: var(--text-muted); font-size: 10px; }
		`,
	];

	store!: DashboardStore;

	private storeCtrl = new StoreController(this, () => this.store);
	private keyHandler = (e: KeyboardEvent) => { if (e.key === "Escape") this.handleClose(); };

	connectedCallback(): void {
		super.connectedCallback();
		document.addEventListener("keydown", this.keyHandler);
	}

	disconnectedCallback(): void {
		super.disconnectedCallback();
		document.removeEventListener("keydown", this.keyHandler);
	}

	private getAgent(): DashboardAgent | undefined {
		const name = this.store?.selectedAgent;
		if (!name) return undefined;
		return this.store.agents.find((a) => a.name === name);
	}

	private handleClose(): void {
		if (!this.store?.selectedAgent) return;
		this.store.stopFollow();
		this.store.selectAgent(null);
	}

	private handleTabClick(tab: TabName): void {
		this.store.selectTab(tab);
	}

	// ── LLM status badge ──────────────────────────────────────────

	private renderLlmBadge(agentName: string) {
		if (!this.store.cliSessionAvailable) {
			return html`
				<span class="llm-badge llm-offline" title="${this.store.cliSessionBlockedReason}">
					<span class="dot"></span>
					CLI host off
				</span>
			`;
		}
		const status = this.store.llmStatus.get(agentName);
		const state = status?.state ?? "idle";
		const labels: Record<string, string> = {
			idle: "LLM idle",
			queued: "Queued...",
			thinking: "Thinking...",
			error: "LLM error",
		};
		return html`
			<span class="llm-badge llm-${state}">
				<span class="dot"></span>
				${labels[state] ?? state}
			</span>
		`;
	}

	// ── Profile tab (inline) ──────────────────────────────────────

	private renderProfileTab(agent: DashboardAgent) {
		const { attributes, domain, mood, status, agentType, personality } = agent;
		const domainColor = DOMAIN_COLORS[domain ?? ""] ?? "#64748b";
		const needs = this.store.getAgentNeeds(agent.name);

		return html`
			<div class="profile-scroll">
				<div class="tags">
					${domain ? html`<span class="tag tag-domain" style="background:${domainColor}">${domain}</span>` : nothing}
					<span class="tag tag-type">${agentType === "ai" ? "AI Agent" : agentType === "npc" ? "NPC" : "Human"}</span>
					${mood ? html`<span class="tag tag-mood">${MOOD_EMOJI[mood] ?? mood}</span>` : nothing}
					<span class="tag tag-status" data-status="${status}">${status}</span>
				</div>

				${personality && personality.length > 0 ? html`
					<div class="personality">${personality.map((t) => html`<span class="trait">${t}</span>`)}</div>
				` : nothing}

				${this.renderStats(attributes)}

				<ft-game-panel-vitals .needs="${needs}"></ft-game-panel-vitals>
				<ft-game-panel-economy .agent="${agent}"></ft-game-panel-economy>

				${this.renderListSection("Skills", agent.skills, (s) => html`
					<div class="skill"><span class="skill-name">${s.name}</span><span class="skill-level">${s.level}</span></div>
				`)}
				${this.renderListSection("Goals", agent.goals, (g) => html`
					<div class="skill"><span class="skill-name">${g.text}</span><span class="skill-level">${g.priority}</span></div>
				`)}
				${this.renderListSection("Connections", agent.relationships, (r) => html`
					<div class="rel"><span class="rel-name">${r.target}</span><span class="rel-type">${r.type}</span></div>
				`)}
				${agent.behaviors && agent.behaviors.length > 0 ? html`
					<div class="section">
						<div class="section-label">Behaviors</div>
						<div class="personality">${agent.behaviors.map((b) => html`<span class="trait">${b}</span>`)}</div>
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

	private renderListSection<T>(label: string, items: readonly T[] | undefined, renderItem: (item: T) => unknown) {
		if (!items || items.length === 0) return nothing;
		return html`
			<div class="section">
				<div class="section-label">${label}</div>
				${items.map(renderItem)}
			</div>
		`;
	}

	// ── Tab content switch ────────────────────────────────────────

	private renderTabContent(agent: DashboardAgent) {
		const tab = this.store.selectedTab;

		switch (tab) {
			case "profile":
				return this.renderProfileTab(agent);
			case "talk":
				return html`<ft-game-panel-talk .store="${this.store}" agentName="${agent.name}"></ft-game-panel-talk>`;
			case "brain":
				return html`<ft-game-panel-brain .store="${this.store}" .agent="${agent}"></ft-game-panel-brain>`;
			case "tasks":
				return html`<ft-game-panel-tasks .store="${this.store}" .agent="${agent}"></ft-game-panel-tasks>`;
			case "permissions":
				return html`<ft-game-panel-permissions .store="${this.store}" agentName="${agent.name}"></ft-game-panel-permissions>`;
			case "debug":
				return html`<ft-game-panel-debug .store="${this.store}" .agent="${agent}"></ft-game-panel-debug>`;
			default:
				return nothing;
		}
	}

	// ── Main render ───────────────────────────────────────────────

	protected renderContent() {
		if (!this.store || !this.store.selectedAgent) return html``;

		const agent = this.getAgent();
		if (!agent) return html``;

		const selectedTab = this.store.selectedTab;
		const brainState = this.store.agentStates.get(agent.name);
		const trustTier = agent.trustTier ?? "supervised";
		const trustColor = TRUST_TIER_COLORS[trustTier] ?? "#f59e0b";

		return html`
			<div class="backdrop" @click="${this.handleClose}"></div>
			<div class="modal" data-testid="agent-detail-modal">
				<div class="modal-header">
					<div class="header-left">
						<div class="portrait">${(agent.persona ?? agent.name).charAt(0).toUpperCase()}</div>
						<div class="name-block">
							<span class="agent-name">${agent.name}</span>
							${agent.persona ? html`<span class="agent-persona">${agent.persona}</span>` : nothing}
						</div>
						<div class="badges">
							<span class="badge badge-type">${agent.agentType}</span>
							<span class="badge badge-trust" style="color:${trustColor}; border-color:${trustColor}; background:${trustColor}1a">${trustTier}</span>
							<span class="badge badge-level">Lv ${agent.level ?? 1}</span>
							${brainState ? html`<span class="brain-state">${brainState}</span>` : nothing}
							${this.renderLlmBadge(agent.name)}
						</div>
					</div>
					<button
						class="close-btn"
						data-testid="modal-close"
						@click="${this.handleClose}"
					>&#xD7;</button>
				</div>

				<div class="tab-bar" role="tablist">
					${TAB_LABELS.map(({ name, label }) => html`
						<button
							class="tab-btn"
							role="tab"
							data-tab="${name}"
							data-active="${selectedTab === name}"
							@click="${() => { this.handleTabClick(name); }}"
						>${label}</button>
					`)}
				</div>

				<div class="tab-content">
					${this.renderTabContent(agent)}
				</div>
			</div>
		`;
	}
}

if (!customElements.get("ft-game-agent-detail-modal")) customElements.define("ft-game-agent-detail-modal", AgentDetailModal);
