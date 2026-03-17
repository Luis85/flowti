import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';
import { emptyState } from '../shared-styles.js';

interface DashboardData {
	id: string;
	name: string;
	description?: string;
	tiles: TileSlot[];
	isFavorite?: boolean;
	createdAt: number;
	updatedAt: number;
}

interface TileSlot {
	id: string;
	queryId: string;
	title?: string;
	displayMode: string;
	row: number;
	col: number;
	width: number;
	height: number;
}

interface BreadcrumbEntry {
	level: string;
	label: string;
	dashboardId?: string;
}

/**
 * Analytics dashboard component — renders a tile grid with header controls.
 *
 * Displays the dashboard name (editable), tile grid, breadcrumbs,
 * and action buttons for add/remove tiles.
 *
 * @property dashboard - Dashboard data object
 * @property tiles - Array of tile slot objects
 * @property breadcrumbs - Navigation breadcrumb trail
 *
 * @fires add-tile - When the add tile button is clicked
 * @fires remove-tile - detail: { tileId } when a tile remove button is clicked
 * @fires rename-dashboard - detail: { name } when the dashboard name is changed
 * @fires navigate-breadcrumb - detail: { index } when a breadcrumb is clicked
 */
export class FlowtiAnalyticsDashboard extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		dashboard: { type: Object },
		tiles: { type: Array },
		breadcrumbs: { type: Array },
	};

	static styles = [
		...FlowtiElement.styles,
		emptyState,
		css`
			.dashboard-layout {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-md);
			}

			.dashboard-header {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-md);
			}

			.dashboard-name-input {
				font-size: 1.1em;
				font-weight: 600;
				border: none;
				background: transparent;
				color: var(--text-normal, inherit);
				padding: var(--flowti-space-xs) 0;
				flex: 1;
				min-width: 0;
			}

			.dashboard-name-input:focus {
				outline: none;
				border-bottom: 2px solid var(--interactive-accent, #5a7);
			}

			.tile-count {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
			}

			.header-actions {
				display: flex;
				gap: var(--flowti-space-sm);
			}

			.tile-grid {
				display: grid;
				grid-template-columns: repeat(6, 1fr);
				gap: var(--flowti-space-md);
			}

			.tile-slot {
				background: var(--background-secondary);
				border-radius: var(--flowti-radius);
				padding: var(--flowti-space-md);
				position: relative;
				min-height: 100px;
			}

			.tile-slot-header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				margin-bottom: var(--flowti-space-sm);
			}

			.tile-slot-title {
				font-size: var(--flowti-font-sm);
				font-weight: 500;
				flex: 1;
			}

			.tile-slot-mode {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
			}

			.breadcrumbs {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-xs);
				font-size: var(--flowti-font-sm);
			}

			.breadcrumb-item {
				cursor: pointer;
				color: var(--flowti-color-muted);
			}

			.breadcrumb-item:hover {
				text-decoration: underline;
			}

			.breadcrumb-sep {
				color: var(--flowti-color-muted);
			}

			button {
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-radius: var(--flowti-radius);
				border: 1px solid var(--flowti-border);
				background: var(--background-secondary);
				color: var(--flowti-text, inherit);
				font-size: var(--flowti-font-sm);
				cursor: pointer;
			}

			button:hover {
				background: var(--background-modifier-hover);
			}

			.remove-btn {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
				cursor: pointer;
				padding: 2px;
				border: none;
				background: none;
			}

			.remove-btn:hover {
				color: var(--flowti-color-error);
			}
		`,
	];

	dashboard: DashboardData | null = null;
	tiles: TileSlot[] = [];
	breadcrumbs: BreadcrumbEntry[] = [];

	private dispatchAddTile(): void {
		this.dispatchEvent(
			new CustomEvent("add-tile", { bubbles: true, composed: true }),
		);
	}

	private dispatchRemoveTile(tileId: string): void {
		this.dispatchEvent(
			new CustomEvent("remove-tile", {
				detail: { tileId },
				bubbles: true,
				composed: true,
			}),
		);
	}

	private dispatchRenameDashboard(name: string): void {
		this.dispatchEvent(
			new CustomEvent("rename-dashboard", {
				detail: { name },
				bubbles: true,
				composed: true,
			}),
		);
	}

	private dispatchNavigateBreadcrumb(index: number): void {
		this.dispatchEvent(
			new CustomEvent("navigate-breadcrumb", {
				detail: { index },
				bubbles: true,
				composed: true,
			}),
		);
	}

	private onNameChange(e: Event): void {
		const input = e.target as HTMLInputElement;
		this.dispatchRenameDashboard(input.value);
	}

	protected renderContent() {
		if (!this.dashboard) {
			return html`<div class="empty-state"><div class="empty-state__message">No dashboard selected</div></div>`;
		}

		return html`
			<div class="dashboard-layout">
				${this.renderBreadcrumbs()}
				${this.renderHeader()}
				${this.tiles.length > 0 ? this.renderTileGrid() : this.renderEmptyState()}
			</div>
		`;
	}

	private renderBreadcrumbs() {
		if (!this.breadcrumbs || this.breadcrumbs.length === 0) return nothing;

		return html`
			<div class="breadcrumbs">
				${this.breadcrumbs.map((crumb, i) => html`
					${i > 0 ? html`<span class="breadcrumb-sep">/</span>` : nothing}
					<span
						class="breadcrumb-item"
						@click=${() => this.dispatchNavigateBreadcrumb(i)}
					>${crumb.label}</span>
				`)}
			</div>
		`;
	}

	private renderHeader() {
		const d = this.dashboard!;
		return html`
			<div class="dashboard-header">
				<input
					class="dashboard-name-input"
					type="text"
					.value=${d.name}
					@change=${this.onNameChange}
				/>
				<span class="tile-count">${this.tiles.length} tiles</span>
				<div class="header-actions">
					<button data-action="add-tile" @click=${this.dispatchAddTile}>Add Tile</button>
				</div>
			</div>
		`;
	}

	private renderTileGrid() {
		return html`
			<div class="tile-grid">
				${this.tiles.map((tile) => this.renderTileSlot(tile))}
			</div>
		`;
	}

	private renderTileSlot(tile: TileSlot) {
		return html`
			<div
				class="tile-slot"
				style="grid-column: span ${Math.min(tile.width, 6)}"
			>
				<div class="tile-slot-header">
					<span class="tile-slot-title">${tile.title ?? "Untitled"}</span>
					<span class="tile-slot-mode">${tile.displayMode}</span>
					<button
						class="remove-btn"
						data-action="remove-tile"
						@click=${() => this.dispatchRemoveTile(tile.id)}
					>x</button>
				</div>
			</div>
		`;
	}

	private renderEmptyState() {
		return html`
			<div class="empty-state">
				<div class="empty-state__message">No tiles yet. Click "Add Tile" to get started.</div>
				<button data-action="add-tile" @click=${this.dispatchAddTile}>Add Tile</button>
			</div>
		`;
	}
}

customElements.define('flowti-analytics-dashboard', FlowtiAnalyticsDashboard);
