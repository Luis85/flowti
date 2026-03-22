/**
 * council-picker.ts — Full-screen overlay for composing the Council of 5.
 *
 * Top zone: 5 horizontal Council slots with drag-reorder.
 * Bottom zone: scrollable grid of available agents (not in Council).
 * Close via backdrop click, close button, or Escape key.
 */

import { html, css, nothing } from "lit";
import { FlowtiElement } from "../../components/flowti-element.js";
import { resetStyles, colorStyles, fontStyles, buttonStyles } from "./game-styles.js";
import { resolveCharacter } from "../sprites/character-pool.js";
import type { DashboardStore } from "../store/dashboard-store.js";
import type { DashboardAgent } from "../data/types.js";

const COUNCIL_MAX = 5;

export class CouncilPicker extends FlowtiElement {
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
		css`
			:host {
				position: fixed;
				inset: 0;
				z-index: 400;
				display: flex;
				align-items: center;
				justify-content: center;
			}

			.backdrop {
				position: absolute;
				inset: 0;
				background: rgba(0, 0, 0, 0.6);
			}

			.card {
				position: relative;
				background: var(--bg-primary);
				border: 1px solid var(--border);
				border-radius: 6px;
				max-width: 600px;
				max-height: 500px;
				width: 90%;
				display: flex;
				flex-direction: column;
				overflow: hidden;
				box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
			}

			/* ── Header ───────────────────────────────────────── */

			.header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: 12px 16px;
				border-bottom: 1px solid var(--border);
			}

			.header-title {
				font-size: 14px;
				font-weight: 700;
				color: var(--text-primary);
				letter-spacing: 0.04em;
				text-transform: uppercase;
			}

			.close-btn {
				background: none;
				border: 1px solid var(--border);
				border-radius: 2px;
				color: var(--text-secondary);
				font-size: 14px;
				cursor: pointer;
				width: 28px;
				height: 28px;
				display: flex;
				align-items: center;
				justify-content: center;
				transition: background 0.15s, border-color 0.2s;
				font-family: inherit;
			}
			.close-btn:hover {
				background: var(--bg-tertiary);
				border-color: var(--accent-gold);
				color: var(--text-primary);
			}

			/* ── Council slots (top zone) ─────────────────────── */

			.council-zone {
				padding: 16px;
				display: flex;
				justify-content: center;
				gap: 10px;
				border-bottom: 1px solid var(--border);
			}

			.council-slot {
				width: 90px;
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: 4px;
				padding: 8px 4px;
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

			.council-portrait {
				width: 44px;
				height: 44px;
				border-radius: 50%;
				background: var(--bg-tertiary);
				display: flex;
				align-items: center;
				justify-content: center;
				border: 2px solid var(--border);
				overflow: hidden;
				font-size: 10px;
				color: var(--text-primary);
				text-align: center;
				line-height: 1.1;
				word-break: break-all;
				position: relative;
			}

			.council-name {
				font-size: 9px;
				font-weight: 600;
				color: var(--text-primary);
				max-width: 80px;
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
				border-style: dashed;
				border-color: var(--border);
			}
			.empty-plus {
				font-size: 20px;
				color: var(--text-dim);
				line-height: 1;
			}

			/* ── Available agents (bottom zone) ───────────────── */

			.available-zone {
				flex: 1;
				overflow-y: auto;
				padding: 12px 16px;
			}

			.full-notice {
				font-size: 11px;
				color: var(--text-muted);
				text-align: center;
				padding: 4px 0 8px;
				text-transform: uppercase;
				letter-spacing: 0.04em;
			}

			.available-grid {
				display: grid;
				grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
				gap: 8px;
			}

			.agent-card {
				background: var(--bg-secondary);
				border: 1px solid var(--border);
				border-radius: 4px;
				padding: 8px 10px;
				cursor: pointer;
				transition: background 0.15s, border-color 0.2s, box-shadow 0.2s;
				display: flex;
				flex-direction: column;
				gap: 2px;
			}
			.agent-card:hover {
				background: var(--bg-tertiary);
				border-color: var(--accent-gold);
				box-shadow: 0 0 8px rgba(217, 170, 78, 0.08);
			}
			.agent-card.disabled {
				opacity: 0.4;
				cursor: default;
				pointer-events: none;
			}

			.agent-card-name {
				font-size: 11px;
				font-weight: 600;
				color: var(--text-primary);
			}

			.domain-badge {
				font-size: 8px;
				color: var(--text-muted);
				text-transform: uppercase;
				letter-spacing: 0.06em;
			}
		`,
	];

	store!: DashboardStore;

	private unsubscribe: (() => void) | null = null;
	private dragSourceIndex = -1;

	connectedCallback(): void {
		super.connectedCallback();
		const handler = () => this.requestUpdate();
		this.store?.addEventListener("state-changed", handler);
		this.unsubscribe = () => this.store?.removeEventListener("state-changed", handler);
		document.addEventListener("keydown", this.handleKeydown);
	}

	disconnectedCallback(): void {
		super.disconnectedCallback();
		this.unsubscribe?.();
		document.removeEventListener("keydown", this.handleKeydown);
	}

	/* ── Event handlers ────────────────────────────────────────── */

	private handleKeydown = (e: KeyboardEvent): void => {
		if (e.key === "Escape") this.closePicker();
	};

	private closePicker(): void {
		this.dispatchEvent(new CustomEvent("close-picker", { bubbles: true, composed: true }));
	}

	private handleBackdropClick(e: Event): void {
		if ((e.target as HTMLElement).classList.contains("backdrop")) {
			this.closePicker();
		}
	}

	/* ── Drag-reorder ──────────────────────────────────────────── */

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

	/* ── Add / remove ──────────────────────────────────────────── */

	private handleAddAgent(name: string): void {
		this.store?.addToCouncil(name);
	}

	private handleRemoveAgent(name: string, e: Event): void {
		e.stopPropagation();
		this.store?.removeFromCouncil(name);
	}

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

	private get availableAgents(): readonly DashboardAgent[] {
		const councilSet = new Set(this.councilNames);
		return (this.store?.agents ?? []).filter(a => !councilSet.has(a.name));
	}

	private get isFull(): boolean {
		return this.councilNames.length >= COUNCIL_MAX;
	}

	/* ── Render ────────────────────────────────────────────────── */

	private renderFilledSlot(agent: DashboardAgent, index: number) {
		const character = resolveCharacter(agent.name, agent.domain ?? "fallback");

		return html`
			<div
				class="council-slot filled"
				draggable="true"
				@dragstart=${(e: DragEvent) => this.handleDragStart(index, e)}
				@dragover=${(e: DragEvent) => this.handleDragOver(e)}
				@dragleave=${(e: DragEvent) => this.handleDragLeave(e)}
				@drop=${(e: DragEvent) => this.handleDrop(index, e)}
			>
				<div class="council-portrait">
					<span>${character}</span>
				</div>
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
				<div class="council-portrait empty-portrait">
					<span class="empty-plus">+</span>
				</div>
			</div>
		`;
	}

	protected renderContent() {
		const slots = this.councilAgents;
		const available = this.availableAgents;
		const full = this.isFull;

		return html`
			<div class="backdrop" @click=${(e: Event) => this.handleBackdropClick(e)}>
				<div class="card">
					<div class="header">
						<span class="header-title">Assemble Your Council</span>
						<button class="close-btn" @click=${() => this.closePicker()}>&times;</button>
					</div>

					<div class="council-zone">
						${slots.map((agent, i) =>
							agent ? this.renderFilledSlot(agent, i) : this.renderEmptySlot(),
						)}
					</div>

					<div class="available-zone">
						${full ? html`<div class="full-notice">Council full</div>` : nothing}
						<div class="available-grid">
							${available.map(agent => html`
								<div
									class="agent-card ${full ? "disabled" : ""}"
									@click=${() => { if (!full) this.handleAddAgent(agent.name); }}
								>
									<span class="agent-card-name">${agent.name}</span>
									<span class="domain-badge">${agent.domain ?? "general"}</span>
								</div>
							`)}
						</div>
					</div>
				</div>
			</div>
		`;
	}
}

if (!customElements.get("ft-game-council-picker")) customElements.define("ft-game-council-picker", CouncilPicker);
