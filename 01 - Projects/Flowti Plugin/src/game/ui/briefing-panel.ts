/**
 * briefing-panel.ts — Modal overlay shown on return after extended absence.
 *
 * Displays a merchant NPC briefing summarising offline progress: headlines,
 * stats (time away, tasks, XP/coin), color commentary, and rest status.
 * Auto-dismisses after 30 seconds; any interaction clears the timer.
 */

import { html, css, nothing } from "lit";
import { FlowtiElement } from "../../components/flowti-element.js";
import { resetStyles, colorStyles, fontStyles, buttonStyles } from "./game-styles.js";
import type { OfflineResults, AgentOfflineResult } from "../systems/offline-progress.js";

// ── Constants ────────────────────────────────────────────────────────

const AUTO_DISMISS_MS = 30_000;

// ── Helpers ──────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
	const totalMinutes = Math.floor(ms / 60_000);
	if (totalMinutes < 60) return `${totalMinutes} minute${totalMinutes === 1 ? "" : "s"}`;
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	if (minutes === 0) return `${hours} hour${hours === 1 ? "" : "s"}`;
	return `${hours}h ${minutes}m`;
}

function pickRandom<T>(items: readonly T[]): T {
	return items[Math.floor(Math.random() * items.length)];
}

function buildHeadlines(agentResults: readonly AgentOfflineResult[]): string[] {
	const headlines: string[] = [];
	for (const agent of agentResults) {
		if (agent.leveledUp) {
			headlines.push(`${agent.name} reached level ${agent.currentLevel}!`);
		}
	}
	const topPerformer = [...agentResults].sort((a, b) => b.tasksCompleted - a.tasksCompleted)[0];
	if (topPerformer && topPerformer.tasksCompleted > 0) {
		headlines.push(`${topPerformer.name} completed ${topPerformer.tasksCompleted} task${topPerformer.tasksCompleted === 1 ? "" : "s"}`);
	}
	return headlines.slice(0, 3);
}

const COLOR_COMMENTARY = [
	"The team kept the lights on while you were away.",
	"No incidents to report — just steady progress.",
	"Your agents proved they can handle themselves.",
	"A quiet stretch. Sometimes that's the best kind.",
	"The office hummed along nicely in your absence.",
] as const;

// ── Styles ───────────────────────────────────────────────────────────

const briefingStyles = css`
	:host {
		position: fixed;
		inset: 0;
		z-index: 500;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: auto;
	}

	.overlay {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.7);
	}

	.card {
		position: relative;
		width: min(420px, calc(100vw - 32px));
		max-height: min(560px, calc(100vh - 64px));
		background: var(--bg-panel);
		border: 1px solid var(--border);
		border-top: 2px solid var(--accent-gold);
		border-radius: 8px;
		box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(217, 170, 78, 0.1);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		animation: briefing-enter 0.35s ease-out;
	}

	@keyframes briefing-enter {
		from { opacity: 0; transform: translateY(12px) scale(0.97); }
		to   { opacity: 1; transform: translateY(0) scale(1); }
	}

	/* -- Header -- */
	.header {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 14px 16px 12px;
		border-bottom: 1px solid var(--border);
		background: linear-gradient(180deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
	}
	.npc-icon {
		font-size: 22px;
		line-height: 1;
	}
	.header-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.header-title {
		font-size: 14px;
		font-weight: 700;
		color: var(--accent-gold);
		letter-spacing: 0.02em;
	}
	.header-subtitle {
		font-size: 9px;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	/* -- Body -- */
	.body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 14px 16px;
		display: flex;
		flex-direction: column;
		gap: 14px;
		scrollbar-width: thin;
		scrollbar-color: var(--bg-tertiary) transparent;
	}

	/* -- Headlines -- */
	.headlines {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.headline-item {
		display: flex;
		align-items: baseline;
		gap: 8px;
		font-size: 12px;
		color: var(--text-primary);
	}
	.headline-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--accent-gold);
		flex-shrink: 0;
		position: relative;
		top: -1px;
	}

	/* -- Stats row -- */
	.stats {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
	}
	.stat {
		flex: 1;
		min-width: 80px;
		padding: 8px 10px;
		background: var(--bg-tertiary);
		border-radius: 4px;
		text-align: center;
	}
	.stat-value {
		font-size: 16px;
		font-weight: 700;
		color: var(--accent-gold);
	}
	.stat-label {
		font-size: 9px;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		margin-top: 2px;
	}

	/* -- Commentary -- */
	.commentary {
		font-size: 11px;
		color: var(--text-secondary);
		font-style: italic;
		line-height: 1.5;
	}

	/* -- Rest notice -- */
	.rest-notice {
		font-size: 11px;
		color: var(--accent-green);
		padding: 6px 10px;
		background: rgba(78, 217, 122, 0.08);
		border-radius: 4px;
		border-left: 2px solid var(--accent-green);
	}

	/* -- Narrative -- */
	.narrative-section {
		font-size: 10px;
		color: var(--text-secondary);
		line-height: 1.5;
		white-space: pre-wrap;
		max-height: 120px;
		overflow-y: auto;
		padding: 8px 10px;
		background: var(--bg-primary);
		border-radius: 4px;
		border: 1px solid var(--border);
		scrollbar-width: thin;
		scrollbar-color: var(--bg-tertiary) transparent;
	}

	/* -- Footer -- */
	.footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 16px;
		border-top: 1px solid var(--border);
		background: var(--bg-primary);
	}
	.report-link {
		font-size: 10px;
		color: var(--accent-blue);
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.report-link:hover {
		color: var(--text-primary);
	}
	.dismiss-btn {
		font-size: 11px;
		padding: 6px 16px;
	}
`;

// ── Component ────────────────────────────────────────────────────────

export class BriefingPanel extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		results: { attribute: false },
		narrativeText: { attribute: false },
		visible: { type: Boolean, reflect: true },
	};

	static styles = [
		...FlowtiElement.styles,
		resetStyles,
		colorStyles,
		fontStyles,
		buttonStyles,
		briefingStyles,
	];

	results: OfflineResults | null = null;
	narrativeText = "";
	visible = false;

	private dismissTimer: ReturnType<typeof setTimeout> | null = null;

	connectedCallback(): void {
		super.connectedCallback();
		this.startAutoDismiss();
	}

	disconnectedCallback(): void {
		super.disconnectedCallback();
		this.clearAutoDismiss();
	}

	render() {
		if (!this.visible || !this.results) return html``;

		const { results, narrativeText } = this;
		const headlines = buildHeadlines(results.agentResults);
		const totalTasks = results.agentResults.reduce((s, a) => s + a.tasksCompleted, 0);
		const totalXp = results.agentResults.reduce((s, a) => s + a.xpEarned, 0);
		const totalCoin = results.agentResults.reduce((s, a) => s + a.coinEarned, 0);
		const commentary = pickRandom(COLOR_COMMENTARY);

		return html`
			<div class="overlay" @click=${this.dismiss}></div>
			<div class="card" @click=${this.onInteraction}>
				<div class="header">
					<span class="npc-icon">${"\u{1F3EA}"}</span>
					<div class="header-text">
						<span class="header-title">Welcome back, Director</span>
						<span class="header-subtitle">Merchant Briefing</span>
					</div>
				</div>

				<div class="body">
					${headlines.length > 0 ? html`
						<div class="headlines">
							${headlines.map((h) => html`
								<div class="headline-item">
									<span class="headline-dot"></span>
									<span>${h}</span>
								</div>
							`)}
						</div>
					` : nothing}

					<div class="stats">
						<div class="stat">
							<div class="stat-value">${formatDuration(results.elapsedMs)}</div>
							<div class="stat-label">Time Away</div>
						</div>
						<div class="stat">
							<div class="stat-value">${totalTasks}</div>
							<div class="stat-label">Tasks</div>
						</div>
						<div class="stat">
							<div class="stat-value">${totalXp}</div>
							<div class="stat-label">XP</div>
						</div>
						<div class="stat">
							<div class="stat-value">${totalCoin}</div>
							<div class="stat-label">Coin</div>
						</div>
					</div>

					<div class="commentary">${commentary}</div>

					${results.rested ? html`
						<div class="rest-notice">
							The team took some downtime — everyone's refreshed.
						</div>
					` : nothing}

					${narrativeText ? html`
						<div class="narrative-section">${narrativeText}</div>
					` : nothing}
				</div>

				<div class="footer">
					<span class="report-link">View Full Report</span>
					<button class="dismiss-btn primary" @click=${this.dismiss}>Dismiss</button>
				</div>
			</div>
		`;
	}

	private dismiss = (): void => {
		this.clearAutoDismiss();
		this.visible = false;
		this.dispatchEvent(new CustomEvent("briefing-dismissed", { bubbles: true, composed: true }));
	};

	private onInteraction = (): void => {
		this.clearAutoDismiss();
	};

	private startAutoDismiss(): void {
		this.clearAutoDismiss();
		this.dismissTimer = setTimeout(() => this.dismiss(), AUTO_DISMISS_MS);
	}

	private clearAutoDismiss(): void {
		if (this.dismissTimer !== null) {
			clearTimeout(this.dismissTimer);
			this.dismissTimer = null;
		}
	}
}

if (!customElements.get("ft-game-briefing")) customElements.define("ft-game-briefing", BriefingPanel);
