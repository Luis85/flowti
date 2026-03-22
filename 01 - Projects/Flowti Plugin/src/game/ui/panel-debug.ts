/**
 * Debug tab — admin controls for overriding agent stats, needs, trust, and economy.
 * Emits custom events that the parent agent-panel catches and relays to the store/CLI.
 */

import { html, css } from "lit";
import { FlowtiElement } from "../../components/flowti-element.js";
import { resetStyles, colorStyles, fontStyles, buttonStyles } from "./game-styles.js";
import type { DashboardAgent } from "../data/types.js";

const NEEDS_KEYS = ["energy", "hunger", "thirst", "focus", "social", "morale"] as const;
type NeedKey = typeof NEEDS_KEYS[number];

const TRUST_MODES = ["AUTO", "REVIEW", "MANUAL"] as const;
type TrustMode = typeof TRUST_MODES[number];

const VAULT_OPS = [
	"vault-read",
	"vault-search",
	"vault-tag",
	"vault-create",
	"vault-edit",
	"vault-move",
	"vault-link",
] as const;

export class PanelDebug extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		agent: { attribute: false },
	};

	static styles = [
		...FlowtiElement.styles,
		resetStyles,
		colorStyles,
		fontStyles,
		buttonStyles,
		css`
			:host {
				display: block;
			}

			.section {
				margin-bottom: 14px;
			}

			.section-label {
				font-size: 10px;
				font-weight: 600;
				color: var(--text-dim);
				text-transform: uppercase;
				letter-spacing: 0.5px;
				margin-bottom: 8px;
				padding-bottom: 4px;
				border-bottom: 1px solid var(--border);
			}

			/* Stat override rows */
			.stat-row {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: 3px 0;
				font-size: 11px;
				gap: 6px;
			}

			.stat-label {
				color: var(--text-secondary);
				min-width: 52px;
			}

			.stat-controls {
				display: flex;
				align-items: center;
				gap: 4px;
			}

			.adj-btn {
				background: var(--bg-tertiary);
				border: 1px solid var(--border);
				color: var(--text-primary);
				font-size: 12px;
				line-height: 1;
				width: 20px;
				height: 20px;
				display: flex;
				align-items: center;
				justify-content: center;
				cursor: pointer;
				border-radius: 3px;
				padding: 0;
				font-family: inherit;
				transition: background 0.1s;
			}

			.adj-btn:hover {
				background: var(--bg-secondary);
			}

			.stat-value {
				min-width: 28px;
				text-align: center;
				color: var(--text-primary);
				font-size: 12px;
				font-weight: 600;
			}

			.set-input {
				width: 42px;
				background: var(--bg-tertiary);
				border: 1px solid var(--border);
				color: var(--text-primary);
				font-size: 11px;
				padding: 2px 4px;
				border-radius: 3px;
				font-family: inherit;
			}

			.set-btn {
				background: rgba(59, 130, 246, 0.15);
				border: 1px solid rgba(59, 130, 246, 0.25);
				color: #60a5fa;
				font-size: 10px;
				padding: 2px 6px;
				border-radius: 3px;
				cursor: pointer;
				font-family: inherit;
				transition: background 0.1s;
			}

			.set-btn:hover {
				background: rgba(59, 130, 246, 0.25);
			}

			/* Needs override rows */
			.need-row {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: 3px 0;
				font-size: 11px;
				gap: 6px;
			}

			.need-label {
				color: var(--text-secondary);
				min-width: 48px;
			}

			.need-controls {
				display: flex;
				gap: 4px;
			}

			.fill-btn {
				background: rgba(34, 197, 94, 0.12);
				border: 1px solid rgba(34, 197, 94, 0.2);
				color: #4ade80;
				font-size: 10px;
				padding: 2px 6px;
				border-radius: 3px;
				cursor: pointer;
				font-family: inherit;
				transition: background 0.1s;
			}

			.fill-btn:hover {
				background: rgba(34, 197, 94, 0.22);
			}

			.drain-btn {
				background: rgba(239, 68, 68, 0.12);
				border: 1px solid rgba(239, 68, 68, 0.2);
				color: #f87171;
				font-size: 10px;
				padding: 2px 6px;
				border-radius: 3px;
				cursor: pointer;
				font-family: inherit;
				transition: background 0.1s;
			}

			.drain-btn:hover {
				background: rgba(239, 68, 68, 0.22);
			}

			/* Trust rows */
			.trust-row {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: 3px 0;
				font-size: 11px;
				gap: 6px;
			}

			.trust-label {
				color: var(--text-secondary);
				min-width: 96px;
				font-size: 10px;
			}

			.trust-modes {
				display: flex;
				gap: 3px;
			}

			.mode-btn {
				font-size: 9px;
				padding: 2px 5px;
				border-radius: 3px;
				cursor: pointer;
				font-family: inherit;
				font-weight: 600;
				letter-spacing: 0.04em;
				transition: background 0.1s;
				background: var(--bg-tertiary);
				border: 1px solid var(--border);
				color: var(--text-muted);
			}

			.mode-btn:hover {
				color: var(--text-primary);
				background: var(--bg-secondary);
			}

			.mode-btn[data-active="true"] {
				background: rgba(217, 170, 78, 0.15);
				border-color: rgba(217, 170, 78, 0.3);
				color: var(--accent-gold);
			}

			/* Economy cheat buttons */
			.cheat-grid {
				display: grid;
				grid-template-columns: 1fr 1fr;
				gap: 6px;
			}

			.cheat-btn {
				background: var(--bg-tertiary);
				border: 1px solid var(--border);
				color: var(--text-secondary);
				font-size: 10px;
				padding: 5px 4px;
				border-radius: 4px;
				cursor: pointer;
				font-family: inherit;
				text-align: center;
				transition: background 0.1s, color 0.1s;
			}

			.cheat-btn:hover {
				background: var(--bg-secondary);
				color: var(--text-primary);
			}

			.empty {
				color: var(--text-muted);
				font-style: italic;
				text-align: center;
				padding: 20px 0;
			}
		`,
	];

	agent?: DashboardAgent;
	private trustOverrides: Map<string, string> = new Map();

	private dispatch(type: string, detail: Record<string, unknown>): void {
		this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
	}

	private handleStatAdj(stat: string, delta: number): void {
		this.dispatch("debug-stat-adjust", { stat, delta });
	}

	private handleStatSet(stat: string, input: EventTarget | null): void {
		const value = parseInt((input as HTMLInputElement)?.value ?? "0", 10);
		if (!Number.isNaN(value)) {
			this.dispatch("debug-stat-set", { stat, value });
		}
	}

	private handleNeedFill(need: NeedKey): void {
		this.dispatch("debug-need-set", { need, value: 100 });
	}

	private handleNeedDrain(need: NeedKey): void {
		this.dispatch("debug-need-set", { need, value: 0 });
	}

	private handleNeedSet(need: NeedKey, input: EventTarget | null): void {
		const value = parseInt((input as HTMLInputElement)?.value ?? "0", 10);
		if (!Number.isNaN(value)) {
			this.dispatch("debug-need-set", { need, value });
		}
	}

	private handleTrustMode(op: string, mode: TrustMode): void {
		this.trustOverrides.set(op, mode);
		this.requestUpdate();
		this.dispatch("debug-trust-mode", { op, mode });
	}

	private handleCheat(action: string): void {
		this.dispatch("debug-economy-cheat", { action });
	}

	protected renderContent() {
		if (!this.agent) {
			return html`<div class="empty">No agent selected.</div>`;
		}

		return html`
			${this.renderStatsOverride()}
			${this.renderNeedsOverride()}
			${this.renderTrustQuickToggle()}
			${this.renderEconomyCheats()}
		`;
	}

	private renderStatsOverride() {
		const stats = [
			{ key: "level", label: "Level", current: this.agent!.level ?? 1 },
			{ key: "xp", label: "XP", current: this.agent!.experience ?? 0 },
			{ key: "coin", label: "Coin", current: this.agent!.coin ?? 0 },
			{ key: "tokens", label: "Tokens", current: this.agent!.tokens ?? 0 },
		];

		return html`
			<div class="section">
				<div class="section-label">Stats Override</div>
				${stats.map(({ key, label, current }) => html`
					<div class="stat-row">
						<span class="stat-label">${label}</span>
						<div class="stat-controls">
							<button class="adj-btn" data-stat="${key}" data-delta="-1" @click="${() => { this.handleStatAdj(key, -1); }}">−</button>
							<span class="stat-value">${current}</span>
							<button class="adj-btn" data-stat="${key}" data-delta="1" @click="${() => { this.handleStatAdj(key, 1); }}">+</button>
							<input
								class="set-input"
								type="number"
								placeholder="${current}"
								data-stat="${key}"
								@keydown="${(e: KeyboardEvent) => { if (e.key === "Enter") this.handleStatSet(key, (e.target as HTMLInputElement)); }}"
							/>
							<button class="set-btn" data-stat="${key}" @click="${(e: Event) => { this.handleStatSet(key, (e.currentTarget as HTMLElement).previousElementSibling); }}">SET</button>
						</div>
					</div>
				`)}
			</div>
		`;
	}

	private renderNeedsOverride() {
		return html`
			<div class="section">
				<div class="section-label">Needs Override</div>
				${NEEDS_KEYS.map((need) => html`
					<div class="need-row">
						<span class="need-label">${need.charAt(0).toUpperCase() + need.slice(1)}</span>
						<div class="need-controls">
							<button class="fill-btn" data-need="${need}" @click="${() => { this.handleNeedFill(need); }}">FILL</button>
							<button class="drain-btn" data-need="${need}" @click="${() => { this.handleNeedDrain(need); }}">DRAIN</button>
							<input
								class="set-input"
								type="number"
								placeholder="0-100"
								data-need="${need}"
								@keydown="${(e: KeyboardEvent) => { if (e.key === "Enter") this.handleNeedSet(need, e.target); }}"
							/>
							<button class="set-btn" data-need="${need}" @click="${(e: Event) => { this.handleNeedSet(need, (e.currentTarget as HTMLElement).previousElementSibling); }}">SET</button>
						</div>
					</div>
				`)}
			</div>
		`;
	}

	private renderTrustQuickToggle() {
		return html`
			<div class="section">
				<div class="section-label">Trust Quick-Toggle</div>
				${VAULT_OPS.map((op) => html`
					<div class="trust-row">
						<span class="trust-label">${op}</span>
						<div class="trust-modes">
							${TRUST_MODES.map((mode) => html`
								<button
									class="mode-btn"
									data-op="${op}"
									data-mode="${mode}"
									data-active="${this.trustOverrides.get(op) === mode}"
									@click="${() => { this.handleTrustMode(op, mode); }}"
								>${mode}</button>
							`)}
						</div>
					</div>
				`)}
			</div>
		`;
	}

	private renderEconomyCheats() {
		const cheats = [
			{ action: "add-coin-500", label: "+500 Coin" },
			{ action: "add-tokens-10000", label: "+10000 Tokens" },
			{ action: "add-xp-500", label: "+500 XP" },
			{ action: "level-up", label: "Level Up" },
		];

		return html`
			<div class="section">
				<div class="section-label">Economy Cheats</div>
				<div class="cheat-grid">
					${cheats.map(({ action, label }) => html`
						<button class="cheat-btn" data-action="${action}" @click="${() => { this.handleCheat(action); }}">${label}</button>
					`)}
				</div>
			</div>
		`;
	}
}

if (!customElements.get("ft-game-panel-debug")) customElements.define("ft-game-panel-debug", PanelDebug);
