/**
 * merchant-panel.ts — Merchant shop panel Lit component.
 *
 * Displays the shop catalog filtered by category, lets the Director
 * select an agent, inspect item availability, and purchase items.
 * Emits `merchant-purchase` and `merchant-close` custom events.
 */

import { html, nothing, css } from "lit";
import type { PropertyValues } from "lit";
import { FlowtiElement } from "../../components/flowti-element.js";
import { resetStyles, colorStyles, fontStyles, buttonStyles } from "./game-styles.js";
import type { CatalogItem } from "../systems/merchant-system.js";

// ── Types ─────────────────────────────────────────────────────────────

export interface MerchantAgent {
	readonly name: string;
	readonly coin: number;
	readonly level: number;
	/** Economy / leveling unlocks — used to mark one-time catalog items as owned. */
	readonly capabilities?: readonly string[];
}

type CategoryFilter = "capability" | "resource" | "cosmetic" | "pet-cosmetic" | "room";

const CATEGORY_LABELS: Record<CategoryFilter, string> = {
	capability: "Capability",
	resource: "Resource",
	cosmetic: "Cosmetic",
	"pet-cosmetic": "Pet Items",
	room: "Room",
};

const CATEGORIES: readonly CategoryFilter[] = [
	"capability", "resource", "cosmetic", "pet-cosmetic", "room",
];

const FEEDBACK_TIMEOUT_MS = 2_500;

// ── Styles ────────────────────────────────────────────────────────────

const merchantPanelStyles = css`
	/* When visible is false the shadow tree is empty but :host still fills the viewport.
	   Without pointer-events: none, the invisible host steals all clicks (canvas + UI). */
	:host {
		position: fixed;
		inset: 0;
		z-index: 299;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}

	:host([visible]) {
		pointer-events: auto;
	}

	.overlay {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 299;
	}

	.merchant-panel {
		position: relative;
		z-index: 300;
		width: min(440px, calc(100vw - 32px));
		max-height: min(560px, calc(100vh - 48px));
		background: var(--bg-panel);
		border: 1px solid var(--border);
		border-radius: 8px;
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55), inset 0 1px 0 var(--border-glow);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	/* -- Header ---------------------------------- */
	.merchant-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 14px;
		border-bottom: 1px solid var(--border);
		background: linear-gradient(180deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
	}
	.merchant-title {
		font-size: 15px;
		font-weight: 700;
		color: var(--accent-gold);
		text-shadow: 0 0 8px rgba(217, 170, 78, 0.15);
		letter-spacing: 0.02em;
	}
	.close-btn {
		flex-shrink: 0;
		background: transparent;
		border: none;
		color: var(--text-muted);
		font-size: 20px;
		line-height: 1;
		cursor: pointer;
		padding: 4px 8px;
		margin: -4px -6px 0 0;
		border-radius: 4px;
		transition: color 0.15s, background 0.15s;
	}
	.close-btn:hover {
		color: var(--accent-gold);
		background: var(--bg-tertiary);
	}
	.close-btn:focus-visible {
		outline: 2px solid var(--accent-gold);
		outline-offset: 1px;
	}

	/* -- Agent selector -------------------------- */
	.agent-selector {
		padding: 8px 14px;
		border-bottom: 1px solid var(--border);
		background: var(--bg-primary);
	}
	.agent-selector label {
		font-size: 9px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
		margin-bottom: 4px;
		display: block;
	}
	.agent-select {
		width: 100%;
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		border-radius: 4px;
		color: var(--text-primary);
		font-family: inherit;
		font-size: 11px;
		padding: 6px 8px;
		cursor: pointer;
	}
	.agent-select:focus-visible {
		outline: 2px solid var(--accent-gold);
		outline-offset: 1px;
	}

	/* -- Category tabs --------------------------- */
	.category-tabs {
		display: flex;
		gap: 0;
		border-bottom: 1px solid var(--border);
		background: var(--bg-primary);
		padding: 0 4px;
		overflow-x: auto;
		scrollbar-width: none;
	}
	.category-tabs::-webkit-scrollbar {
		display: none;
	}
	.cat-btn {
		flex: 1;
		flex-shrink: 0;
		min-width: 60px;
		background: transparent;
		border: none;
		border-bottom: 2px solid transparent;
		color: var(--text-muted);
		font-family: inherit;
		font-size: 9px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 8px 4px;
		cursor: pointer;
		white-space: nowrap;
		transition: color 0.15s, border-color 0.15s;
	}
	.cat-btn:hover { color: var(--text-primary); }
	.cat-btn:focus-visible {
		color: var(--text-primary);
		outline: 2px solid var(--accent-gold);
		outline-offset: -2px;
	}
	.cat-btn[data-active] {
		color: var(--accent-gold);
		border-bottom-color: var(--accent-gold);
	}

	/* -- Item list ------------------------------- */
	.item-list {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 8px 14px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		scrollbar-width: thin;
		scrollbar-color: var(--bg-tertiary) transparent;
	}
	.item-card {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 10px;
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		border-radius: 6px;
		transition: border-color 0.15s;
	}
	.item-card:hover {
		border-color: var(--border-glow);
	}
	.item-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.item-name {
		font-size: 11px;
		font-weight: 600;
		color: var(--text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.item-desc {
		font-size: 9px;
		color: var(--text-muted);
		line-height: 1.35;
	}
	.item-meta {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 9px;
	}
	.item-cost {
		display: flex;
		align-items: center;
		gap: 3px;
		color: var(--accent-gold);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.coin-icon {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--accent-gold);
	}
	.item-level {
		color: var(--text-muted);
		font-size: 9px;
	}
	.item-level[data-unmet] {
		color: var(--accent-red);
	}
	.owned-badge {
		font-size: 8px;
		font-weight: 600;
		text-transform: uppercase;
		padding: 2px 6px;
		border-radius: 3px;
		background: rgba(78, 217, 122, 0.15);
		color: var(--accent-green);
		letter-spacing: 0.04em;
	}

	/* -- Buy button (merchant-specific gold accent) -- */
	.buy-btn {
		flex-shrink: 0;
		background: var(--btn-primary);
		border: 1px solid var(--accent-gold);
		border-radius: 4px;
		color: var(--accent-gold);
		font-family: inherit;
		font-size: 9px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 5px 12px;
		cursor: pointer;
		transition: background 0.15s, box-shadow 0.15s;
	}
	.buy-btn:hover {
		background: var(--btn-primary-hover);
		box-shadow: 0 0 12px rgba(217, 170, 78, 0.15);
	}
	.buy-btn:focus-visible {
		outline: 2px solid var(--accent-gold);
		outline-offset: 1px;
	}
	.buy-btn[disabled] {
		opacity: 0.4;
		cursor: not-allowed;
		box-shadow: none;
	}
	.buy-btn[disabled]:hover {
		background: var(--btn-primary);
		box-shadow: none;
	}

	/* -- Confirmation row ----------------------- */
	.confirm-row {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 10px;
		color: var(--text-secondary);
		flex-shrink: 0;
	}
	.confirm-btn {
		background: var(--btn-primary);
		border: 1px solid var(--accent-gold);
		border-radius: 4px;
		color: var(--accent-gold);
		font-family: inherit;
		font-size: 9px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 4px 10px;
		cursor: pointer;
		transition: background 0.15s, box-shadow 0.15s;
	}
	.confirm-btn:hover {
		background: var(--btn-primary-hover);
		box-shadow: 0 0 12px rgba(217, 170, 78, 0.15);
	}
	.cancel-btn {
		background: var(--bg-tertiary);
		border: 1px solid var(--border);
		border-radius: 4px;
		color: var(--text-muted);
		font-family: inherit;
		font-size: 9px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 4px 10px;
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
	}
	.cancel-btn:hover {
		background: var(--btn-primary);
		color: var(--text-primary);
	}

	/* -- Purchase feedback ---------------------- */
	.purchase-feedback {
		font-size: 9px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		padding: 2px 8px;
		border-radius: 3px;
		flex-shrink: 0;
	}
	.purchase-feedback[data-success] {
		color: var(--accent-green);
		background: rgba(78, 217, 122, 0.12);
	}
	.purchase-feedback[data-fail] {
		color: var(--accent-red);
		background: rgba(217, 78, 78, 0.12);
	}

	.empty-catalog {
		color: var(--text-muted);
		text-align: center;
		padding: 28px 16px;
		font-size: 12px;
		line-height: 1.5;
	}

	/* -- Footer balance -------------------------- */
	.merchant-footer {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		padding: 8px 14px;
		border-top: 1px solid var(--border);
		background: var(--bg-primary);
		font-size: 11px;
	}
	.balance-display {
		display: flex;
		align-items: center;
		gap: 4px;
		color: var(--accent-gold);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
`;

// ── Component ─────────────────────────────────────────────────────────

export class MerchantPanel extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		catalog: { attribute: false },
		agents: { attribute: false },
		selectedAgent: { attribute: false },
		selectedCategory: { state: true },
		ownedItems: { attribute: false },
		visible: { type: Boolean, reflect: true },
		pendingPurchase: { state: true },
		lastPurchaseResult: { state: true },
	};

	static styles = [
		...FlowtiElement.styles,
		resetStyles,
		colorStyles,
		fontStyles,
		buttonStyles,
		merchantPanelStyles,
	];

	catalog: CatalogItem[] = [];
	agents: MerchantAgent[] = [];
	selectedAgent = "";
	selectedCategory: CategoryFilter = "capability";
	ownedItems: Set<string> = new Set();
	visible = false;
	pendingPurchase: CatalogItem | null = null;
	lastPurchaseResult: { item: string; success: boolean } | null = null;

	private feedbackTimer: ReturnType<typeof setTimeout> | null = null;

	disconnectedCallback(): void {
		super.disconnectedCallback();
		this.clearFeedbackTimer();
	}

	updated(changed: PropertyValues<this>): void {
		super.updated(changed);
		if (
			changed.has("visible")
			|| changed.has("selectedAgent")
			|| changed.has("agents")
			|| changed.has("catalog")
		) {
			this.recomputeOwnedItems();
		}
	}

	/** One-time items already granted via agent capabilities (from dashboard / economy sync). */
	private recomputeOwnedItems(): void {
		const agent = this.agents.find((a) => a.name === this.selectedAgent);
		const caps = new Set(agent?.capabilities ?? []);
		this.ownedItems = new Set(
			this.catalog.filter((item) => item.oneTime && caps.has(item.id)).map((item) => item.id),
		);
	}

	protected renderContent() {
		if (!this.visible) return html``;

		const agent = this.agents.find((a) => a.name === this.selectedAgent);
		const selectedLevel = agent?.level ?? 0;
		const filtered = this.catalog.filter(
			(item) => item.category === this.selectedCategory
				&& (item.requiresLevel === undefined || item.requiresLevel <= selectedLevel),
		);

		return html`
			<div class="overlay" @click=${this.handleClose}></div>
			<div class="merchant-panel">
				${this.renderHeader()}
				${this.renderAgentSelector()}
				${this.renderCategoryTabs()}
				${this.renderItemList(filtered, agent)}
				${this.renderFooter(agent)}
			</div>
		`;
	}

	private renderHeader() {
		return html`
			<div class="merchant-header">
				<span class="merchant-title">Merchant Shop</span>
				<button class="close-btn" @click=${this.handleClose} title="Close shop">&times;</button>
			</div>
		`;
	}

	private renderAgentSelector() {
		if (this.agents.length === 0) return nothing;
		return html`
			<div class="agent-selector">
				<label>Select Agent</label>
				<select class="agent-select" @change=${this.handleAgentChange}>
					${this.agents.map(
						(a) => html`
							<option value=${a.name} ?selected=${a.name === this.selectedAgent}>
								${a.name} — ${a.coin} Coin (Lv ${a.level})
							</option>
						`,
					)}
				</select>
			</div>
		`;
	}

	private renderCategoryTabs() {
		return html`
			<div class="category-tabs">
				${CATEGORIES.map(
					(cat) => html`
						<button
							class="cat-btn"
							?data-active=${cat === this.selectedCategory}
							@click=${() => { this.selectedCategory = cat; }}
						>${CATEGORY_LABELS[cat]}</button>
					`,
				)}
			</div>
		`;
	}

	private renderItemList(items: CatalogItem[], agent: MerchantAgent | undefined) {
		if (items.length === 0) {
			return html`<div class="item-list"><div class="empty-catalog">No items in this category.</div></div>`;
		}
		return html`
			<div class="item-list">
				${items.map((item) => this.renderItemCard(item, agent))}
			</div>
		`;
	}

	private renderItemCard(item: CatalogItem, agent: MerchantAgent | undefined) {
		const owned = item.oneTime === true && this.ownedItems.has(item.id);
		const levelMet = agent ? (item.requiresLevel === undefined || agent.level >= item.requiresLevel) : true;
		const canAfford = agent ? agent.coin >= item.cost : false;
		const canBuy = !owned && levelMet && canAfford;
		const isPending = this.pendingPurchase?.id === item.id;
		const hasFeedback = this.lastPurchaseResult?.item === item.id;

		let disabledReason = "";
		if (owned) disabledReason = "Already owned";
		else if (!levelMet) disabledReason = `Requires level ${item.requiresLevel}`;
		else if (!canAfford) disabledReason = "Not enough coin";

		return html`
			<div class="item-card">
				<div class="item-info">
					<span class="item-name">${item.name}</span>
					${item.description ? html`<span class="item-desc">${item.description}</span>` : nothing}
					<div class="item-meta">
						<span class="item-cost"><span class="coin-icon"></span>${item.cost}</span>
						${item.requiresLevel !== undefined
							? html`<span class="item-level" ?data-unmet=${!levelMet}>Lv ${item.requiresLevel}</span>`
							: nothing}
						${owned ? html`<span class="owned-badge">Owned</span>` : nothing}
					</div>
				</div>
				${isPending
					? html`
						<div class="confirm-row">
							<span>${item.cost} Coin?</span>
							<button class="confirm-btn" @click=${() => { this.confirmPurchase(item); }}>Confirm</button>
							<button class="cancel-btn" @click=${() => { this.cancelPurchase(); }}>Cancel</button>
						</div>
					`
					: hasFeedback
						? html`
							<span
								class="purchase-feedback"
								?data-success=${this.lastPurchaseResult!.success}
								?data-fail=${!this.lastPurchaseResult!.success}
							>${this.lastPurchaseResult!.success ? "Purchased!" : "Failed"}</span>
						`
						: html`
							<button
								class="buy-btn"
								?disabled=${!canBuy}
								title=${disabledReason || "Purchase this item"}
								@click=${() => { if (canBuy) this.requestPurchase(item); }}
							>Buy</button>
						`}
			</div>
		`;
	}

	private renderFooter(agent: MerchantAgent | undefined) {
		return html`
			<div class="merchant-footer">
				<span class="balance-display">
					<span class="coin-icon"></span>
					Balance: ${agent?.coin ?? 0} Coin
				</span>
			</div>
		`;
	}

	// ── Event handlers ────────────────────────────────────────────────

	private handleClose(): void {
		this.visible = false;
		this.dispatchEvent(new CustomEvent("merchant-close", { bubbles: true, composed: true }));
	}

	private handleAgentChange(e: Event): void {
		const select = e.target as HTMLSelectElement;
		this.selectedAgent = select.value;
		this.recomputeOwnedItems();
	}

	private requestPurchase(item: CatalogItem): void {
		this.pendingPurchase = item;
	}

	private confirmPurchase(item: CatalogItem): void {
		this.pendingPurchase = null;
		this.dispatchEvent(
			new CustomEvent("merchant-purchase", {
				bubbles: true,
				composed: true,
				detail: { agent: this.selectedAgent, itemId: item.id },
			}),
		);
		this.showPurchaseFeedback(item.id, true);
	}

	private cancelPurchase(): void {
		this.pendingPurchase = null;
	}

	private showPurchaseFeedback(itemId: string, success: boolean): void {
		this.clearFeedbackTimer();
		this.lastPurchaseResult = { item: itemId, success };
		this.feedbackTimer = setTimeout(() => {
			this.lastPurchaseResult = null;
			this.feedbackTimer = null;
		}, FEEDBACK_TIMEOUT_MS);
	}

	private clearFeedbackTimer(): void {
		if (this.feedbackTimer !== null) {
			clearTimeout(this.feedbackTimer);
			this.feedbackTimer = null;
		}
	}
}

if (!customElements.get("ft-game-merchant-panel")) {
	customElements.define("ft-game-merchant-panel", MerchantPanel);
}

declare global {
	interface HTMLElementTagNameMap {
		"ft-game-merchant-panel": MerchantPanel;
	}
}
