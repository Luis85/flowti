/**
 * roster-panel.ts — Vertical roster panel for the slide-panel body.
 *
 * Top: Council zone with 5 horizontal drag-reorderable slots.
 * Middle: Search input for filtering agents.
 * Bottom: Scrollable agent list grouped by domain.
 */

import { html, css, nothing } from "lit";
import { FlowtiElement } from "../../components/flowti-element.js";
import { resetStyles, colorStyles, fontStyles, buttonStyles } from "./game-styles.js";
import { renderPortrait } from "./portrait.js";
import { resolveSettingForDomain } from "../config/domain-map.js";
import { StoreController } from "./store-controller.js";
import type { DashboardStore } from "../store/dashboard-store.js";
import type { DashboardAgent } from "../data/types.js";

const COUNCIL_MAX = 5;

export class RosterPanel extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		store: { attribute: false },
		searchQuery: { state: true },
		dragSourceIndex: { state: true },
	};

	static styles = [
		...FlowtiElement.styles,
		resetStyles,
		colorStyles,
		fontStyles,
		buttonStyles,
		css`
			:host {
				display: flex;
				flex-direction: column;
				height: 100%;
				overflow: hidden;
			}

			/* ── Council zone ─────────────────────────────────── */

			.council-zone {
				padding: 16px;
				display: flex;
				justify-content: center;
				gap: 8px;
				border-bottom: 1px solid var(--border);
				flex-shrink: 0;
			}

			.council-slot {
				width: 72px;
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: 4px;
				padding: 6px 4px;
				border-radius: 4px;
				transition: background 0.15s;
			}

			.council-slot.filled {
				cursor: grab;
			}
			.council-slot.filled:active {
				cursor: grabbing;
			}

			.council-slot.drag-over {
				background: var(--bg-tertiary);
				outline: 1px dashed var(--accent-gold);
			}

			.council-name {
				font-size: 9px;
				font-weight: 600;
				color: var(--text-primary);
				max-width: 68px;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
				text-align: center;
			}

			.remove-btn {
				background: none;
				border: none;
				color: var(--text-dim);
				font-size: 10px;
				cursor: pointer;
				padding: 0 4px;
				line-height: 1;
				transition: color 0.15s;
				font-family: inherit;
			}
			.remove-btn:hover {
				color: #d94e4e;
			}

			.empty-portrait {
				width: 48px;
				height: 48px;
				border-radius: 50%;
				border: 2px dashed var(--border);
				display: flex;
				align-items: center;
				justify-content: center;
				background: var(--bg-tertiary);
			}
			.empty-plus {
				font-size: 20px;
				color: var(--text-dim);
				line-height: 1;
			}

			/* ── Search ───────────────────────────────────────── */

			.search-bar {
				padding: 8px 16px;
				border-bottom: 1px solid var(--border);
				flex-shrink: 0;
			}

			.search-input {
				width: 100%;
				background: var(--bg-secondary);
				border: 1px solid var(--border);
				border-radius: 2px;
				padding: 6px 10px;
				font-family: inherit;
				font-size: 11px;
				color: var(--text-primary);
				outline: none;
				transition: border-color 0.2s;
			}
			.search-input::placeholder {
				color: var(--text-dim);
			}
			.search-input:focus {
				border-color: var(--accent-gold);
			}

			/* ── Agent list ────────────────────────────────────── */

			.agent-list {
				flex: 1;
				overflow-y: auto;
				padding: 8px 16px;
				scrollbar-width: thin;
				scrollbar-color: var(--bg-tertiary) transparent;
			}

			.domain-header {
				font-size: 9px;
				font-weight: 700;
				color: var(--text-muted);
				text-transform: uppercase;
				letter-spacing: 0.06em;
				padding: 8px 0 4px;
			}

			.agent-row {
				display: flex;
				align-items: center;
				gap: 8px;
				padding: 6px 8px;
				border-radius: 4px;
				cursor: pointer;
				transition: background 0.15s;
			}
			.agent-row:hover {
				background: var(--bg-secondary);
			}

			.agent-info {
				flex: 1;
				min-width: 0;
			}

			.agent-row-name {
				font-size: 11px;
				font-weight: 600;
				color: var(--text-primary);
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			.domain-badge {
				font-size: 8px;
				color: var(--text-muted);
				text-transform: uppercase;
				letter-spacing: 0.06em;
			}

			.add-btn {
				background: none;
				border: 1px solid var(--border);
				border-radius: 2px;
				color: var(--text-secondary);
				font-size: 10px;
				cursor: pointer;
				padding: 2px 8px;
				transition: background 0.15s, border-color 0.2s;
				font-family: inherit;
				flex-shrink: 0;
			}
			.add-btn:hover:not(:disabled) {
				background: var(--btn-primary);
				border-color: var(--accent-gold);
				color: var(--text-primary);
			}
			.add-btn:disabled {
				opacity: 0.3;
				cursor: default;
			}
		`,
	];

	store!: DashboardStore;
	private searchQuery = "";
	private dragSourceIndex = -1;

	private storeCtrl = new StoreController(this, () => this.store);

	/* ── Computed helpers ──────────────────────────────────────── */

	private get councilNames(): readonly string[] {
		return this.store?.council ?? [];
	}

	private get councilAgents(): (DashboardAgent | null)[] {
		const names = this.councilNames;
		const agents = this.store?.agents ?? [];
		const slots: (DashboardAgent | null)[] = [];
		for (let i = 0; i < COUNCIL_MAX; i++) {
			const name = names[i];
			if (name) {
				slots.push(agents.find(a => a.name === name) ?? null);
			} else {
				slots.push(null);
			}
		}
		return slots;
	}

	private get isFull(): boolean {
		return this.councilNames.length >= COUNCIL_MAX;
	}

	private get councilSet(): Set<string> {
		return new Set(this.councilNames);
	}

	private get filteredAgentsByDomain(): Map<string, DashboardAgent[]> {
		const agents = this.store?.agents ?? [];
		const query = this.searchQuery.toLowerCase();
		const filtered = agents.filter(a => {
			if (!query) return true;
			return a.name.toLowerCase().includes(query) || (a.domain ?? "").toLowerCase().includes(query);
		});

		const grouped = new Map<string, DashboardAgent[]>();
		for (const agent of filtered) {
			const domain = agent.domain ?? "general";
			const list = grouped.get(domain);
			if (list) {
				list.push(agent);
			} else {
				grouped.set(domain, [agent]);
			}
		}
		return grouped;
	}

	/* ── Drag-reorder ─────────────────────────────────────────── */

	private handleDragStart(index: number, e: DragEvent): void {
		this.dragSourceIndex = index;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = "move";
		}
	}

	private handleDragOver(e: DragEvent): void {
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = "move";
		}
		(e.currentTarget as HTMLElement).classList.add("drag-over");
	}

	private handleDragLeave(e: DragEvent): void {
		(e.currentTarget as HTMLElement).classList.remove("drag-over");
	}

	private handleDrop(targetIndex: number, e: DragEvent): void {
		e.preventDefault();
		(e.currentTarget as HTMLElement).classList.remove("drag-over");
		if (this.dragSourceIndex < 0 || this.dragSourceIndex === targetIndex) return;
		const council = [...(this.store?.council ?? [])];
		const [moved] = council.splice(this.dragSourceIndex, 1);
		council.splice(targetIndex, 0, moved);
		this.store.reorderCouncil(council);
		this.dragSourceIndex = -1;
	}

	private handleDragEnd(): void {
		this.dragSourceIndex = -1;
	}

	/* ── Actions ──────────────────────────────────────────────── */

	private handleRemoveAgent(name: string, e: Event): void {
		e.stopPropagation();
		this.store?.removeFromCouncil(name);
	}

	private handleAddAgent(name: string): void {
		this.store?.addToCouncil(name);
	}

	private handleAgentClick(agent: DashboardAgent): void {
		this.store.changeScene(resolveSettingForDomain(agent.domain));
		this.store.selectAgent(agent.name);
	}

	private handleSearchInput(e: Event): void {
		this.searchQuery = (e.target as HTMLInputElement).value;
	}

	/* ── Render ────────────────────────────────────────────────── */

	private renderFilledSlot(agent: DashboardAgent, index: number) {
		return html`
			<div
				class="council-slot filled"
				draggable="true"
				@dragstart=${(e: DragEvent) => this.handleDragStart(index, e)}
				@dragend=${() => this.handleDragEnd()}
				@dragover=${(e: DragEvent) => this.handleDragOver(e)}
				@dragleave=${(e: DragEvent) => this.handleDragLeave(e)}
				@drop=${(e: DragEvent) => this.handleDrop(index, e)}
			>
				${renderPortrait(agent.name, agent.domain ?? "fallback", 48, agent.trustTier)}
				<span class="council-name">${agent.name}</span>
				<button
					class="remove-btn"
					@click=${(e: Event) => this.handleRemoveAgent(agent.name, e)}
					title="Remove from Council"
				>&times;</button>
			</div>
		`;
	}

	private renderEmptySlot() {
		return html`
			<div class="council-slot empty">
				<div class="empty-portrait">
					<span class="empty-plus">+</span>
				</div>
			</div>
		`;
	}

	private renderAgentRow(agent: DashboardAgent) {
		const inCouncil = this.councilSet.has(agent.name);
		const full = this.isFull;
		const disabled = inCouncil || full;

		return html`
			<div class="agent-row" @click=${() => this.handleAgentClick(agent)}>
				${renderPortrait(agent.name, agent.domain ?? "fallback", 32)}
				<div class="agent-info">
					<div class="agent-row-name">${agent.name}</div>
					<span class="domain-badge">${agent.domain ?? "general"}</span>
				</div>
				<button
					class="add-btn"
					?disabled=${disabled}
					@click=${(e: Event) => { e.stopPropagation(); if (!disabled) this.handleAddAgent(agent.name); }}
					title=${inCouncil ? "Already in Council" : full ? "Council full" : "Add to Council"}
				>+</button>
			</div>
		`;
	}

	protected renderContent() {
		const slots = this.councilAgents;
		const grouped = this.filteredAgentsByDomain;

		return html`
			<div class="council-zone">
				${slots.map((agent, i) =>
					agent ? this.renderFilledSlot(agent, i) : this.renderEmptySlot(),
				)}
			</div>

			<div class="search-bar">
				<input
					class="search-input"
					type="text"
					placeholder="Search agents..."
					.value=${this.searchQuery}
					@input=${(e: Event) => this.handleSearchInput(e)}
				/>
			</div>

			<div class="agent-list">
				${grouped.size === 0
					? html`<div class="domain-header">No agents found</div>`
					: nothing}
				${[...grouped.entries()].map(([domain, agents]) => html`
					<div class="domain-header">${domain}</div>
					${agents.map(agent => this.renderAgentRow(agent))}
				`)}
			</div>
		`;
	}
}

if (!customElements.get("ft-game-roster-panel")) {
	customElements.define("ft-game-roster-panel", RosterPanel);
}
