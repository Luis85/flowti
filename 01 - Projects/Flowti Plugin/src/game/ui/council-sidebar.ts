/**
 * council-sidebar.ts — Persistent left-edge vertical bar with 5 Council portrait slots.
 *
 * Shows the player's chosen "party" of up to 5 agents. Each filled slot displays
 * a portrait circle, status dot, name label, and a lowest-need bar. Empty slots
 * show a dashed "+" placeholder. A "Manage" button at the bottom opens the picker.
 */

import { html, css } from "lit";
import { FlowtiElement } from "../../components/flowti-element.js";
import { resetStyles, colorStyles, fontStyles } from "./game-styles.js";
import { resolveCharacter } from "../sprites/character-pool.js";
import { StoreController } from "./store-controller.js";
import type { DashboardStore } from "../store/dashboard-store.js";
import type { DashboardAgent } from "../data/types.js";
import type { AgentNeeds } from "../systems/needs-system.js";

const COUNCIL_SLOTS = 5;

import { TRUST_TIER_COLORS, STATUS_DOT_COLORS } from "./game-ui-constants.js";

function trustBorderColor(tier: DashboardAgent["trustTier"]): string {
	return TRUST_TIER_COLORS[tier ?? "supervised"] ?? "#6b7280";
}

function statusDotColor(status: DashboardAgent["status"]): string {
	return STATUS_DOT_COLORS[status] ?? "#6b7280";
}

function lowestNeed(needs: AgentNeeds | undefined): number {
	if (!needs) return 1;
	return Math.min(needs.energy, needs.hunger, needs.thirst, needs.focus, needs.social, needs.morale);
}

function needBarColor(value: number): string {
	if (value < 0.25) return "#d94e4e";
	if (value < 0.5) return "#f59e0b";
	return "#4ed97a";
}

export class CouncilSidebar extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		store: { attribute: false },
	};

	static styles = [
		...FlowtiElement.styles,
		resetStyles,
		colorStyles,
		fontStyles,
		css`
			:host {
				position: fixed;
				left: 0;
				top: 0;
				bottom: 52px;
				width: 80px;
				z-index: 90;
				background: var(--bg-primary);
				border-right: 1px solid var(--border);
				display: flex;
				flex-direction: column;
				align-items: center;
				padding: 12px 0 8px;
				gap: 8px;
			}

			.slot {
				display: flex;
				flex-direction: column;
				align-items: center;
				cursor: pointer;
				width: 64px;
				padding: 4px 0;
				border-radius: 4px;
				transition: background 0.15s;
			}
			.slot:hover {
				background: var(--bg-secondary);
			}

			.portrait {
				position: relative;
				width: 40px;
				height: 40px;
				border-radius: 50%;
				background: var(--bg-tertiary);
				display: flex;
				align-items: center;
				justify-content: center;
				border: 2px solid var(--border);
				overflow: hidden;
				font-size: 16px;
				color: var(--text-secondary);
				transition: border-color 0.2s;
			}

			.portrait-char {
				font-size: 10px;
				color: var(--text-primary);
				text-align: center;
				line-height: 1.1;
				word-break: break-all;
			}

			.status-dot {
				position: absolute;
				bottom: 0;
				right: 0;
				width: 8px;
				height: 8px;
				border-radius: 50%;
				border: 1px solid var(--bg-primary);
			}

			.slot-name {
				font-size: 8px;
				font-weight: 600;
				color: var(--text-primary);
				margin-top: 3px;
				max-width: 60px;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
				text-align: center;
			}

			.need-bar-track {
				width: 36px;
				height: 3px;
				background: var(--bg-tertiary);
				border-radius: 2px;
				margin-top: 2px;
				overflow: hidden;
			}
			.need-bar-fill {
				height: 100%;
				border-radius: 2px;
				transition: width 0.3s, background 0.3s;
			}

			.empty-slot .portrait {
				border-style: dashed;
				border-color: var(--border);
			}
			.empty-slot .plus {
				font-size: 18px;
				color: var(--text-dim);
				line-height: 1;
			}

			.manage-btn {
				margin-top: auto;
				font-family: inherit;
				cursor: pointer;
				border: 1px solid var(--border);
				border-radius: 2px;
				font-size: 9px;
				padding: 4px 10px;
				background: var(--bg-tertiary);
				color: var(--text-secondary);
				text-transform: uppercase;
				letter-spacing: 0.04em;
				transition: background 0.15s, border-color 0.2s, box-shadow 0.2s;
			}
			.manage-btn:hover {
				background: var(--btn-primary);
				border-color: var(--accent-gold);
				color: var(--text-primary);
				box-shadow: var(--glow-warm);
			}
		`,
	];

	store!: DashboardStore;

	private storeCtrl = new StoreController(this, () => this.store);

	private get councilAgents(): (DashboardAgent | null)[] {
		const names = this.store?.council ?? [];
		const agents = this.store?.agents ?? [];
		const slots: (DashboardAgent | null)[] = [];
		for (let i = 0; i < COUNCIL_SLOTS; i++) {
			const name = names[i];
			if (name) {
				const agent = agents.find(a => a.name === name) ?? null;
				slots.push(agent);
			} else {
				slots.push(null);
			}
		}
		return slots;
	}

	private handleSlotClick(agent: DashboardAgent): void {
		this.store.selectAgent(agent.name);
	}

	private handleManageClick(): void {
		this.dispatchEvent(new CustomEvent("open-picker", { bubbles: true, composed: true }));
	}

	private renderFilledSlot(agent: DashboardAgent) {
		const character = resolveCharacter(agent.name, agent.domain ?? "fallback");
		const borderColor = trustBorderColor(agent.trustTier);
		const dotColor = statusDotColor(agent.status);
		const needs = this.store?.getAgentNeeds(agent.name);
		const lowest = lowestNeed(needs);
		const barColor = needBarColor(lowest);
		const barWidth = `${Math.round(Math.max(0, Math.min(1, lowest)) * 100)}%`;

		return html`
			<div class="slot filled-slot" @click=${() => this.handleSlotClick(agent)}>
				<div class="portrait" style="border-color:${borderColor}">
					<span class="portrait-char">${character}</span>
					<span class="status-dot" style="background:${dotColor}"></span>
				</div>
				<span class="slot-name">${agent.name}</span>
				<div class="need-bar-track">
					<div class="need-bar-fill" style="width:${barWidth};background:${barColor}"></div>
				</div>
			</div>
		`;
	}

	private renderEmptySlot() {
		return html`
			<div class="slot empty-slot" @click=${this.handleManageClick}>
				<div class="portrait">
					<span class="plus">+</span>
				</div>
			</div>
		`;
	}

	protected renderContent() {
		const slots = this.councilAgents;
		return html`
			${slots.map(agent =>
				agent ? this.renderFilledSlot(agent) : this.renderEmptySlot(),
			)}
			<button class="manage-btn" @click=${() => this.handleManageClick()}>Manage</button>
		`;
	}
}

if (!customElements.get("ft-game-council-sidebar")) customElements.define("ft-game-council-sidebar", CouncilSidebar);
