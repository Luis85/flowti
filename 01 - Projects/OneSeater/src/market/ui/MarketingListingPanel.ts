/* eslint-disable @typescript-eslint/no-non-null-assertion */
/**
 * MarketListingsPanel
 * 
 * Displays a grid of marketplace items with basic info.
 * Supports filtering by category and selecting items for detail view.
 */

import { 
  MarketItem, 
  RARITY_CONFIG,
} from "../models/MarketTypes";

export class MarketListingsPanel {
  private rootEl?: HTMLElement;
  private gridEl?: HTMLElement;
  private emptyEl?: HTMLElement;
  private selectedItemId: string | null = null;
  private onItemSelect?: (item: MarketItem | null) => void;
  private currentItems: MarketItem[] = [];

  setOnItemSelect(callback: (item: MarketItem | null) => void): void {
    this.onItemSelect = callback;
  }

  mount(parent: HTMLElement): void {
    this.rootEl = parent.createDiv({ cls: "mm-market-listings" });
    
    // Header with item count
    const header = this.rootEl.createDiv({ cls: "mm-market-listings__header" });
    header.innerHTML = `<span class="mm-market-listings__title">Available Items</span><span class="mm-market-listings__count"></span>`;

    // Grid container
    this.gridEl = this.rootEl.createDiv({ cls: "mm-market-listings__grid" });
    
    // Empty state
    this.emptyEl = this.rootEl.createDiv({ cls: "mm-market-listings__empty" });
    this.emptyEl.innerHTML = `<span>🔍</span><p>No items available in this category</p>`;
    this.emptyEl.style.display = "none";
  }

  render(items: MarketItem[], selectedItemId: string | null, playerBalance: number): void {
    if (!this.gridEl || !this.rootEl) return;

    // Update count
    const countEl = this.rootEl.querySelector(".mm-market-listings__count");
    if (countEl) countEl.textContent = `(${items.length})`;

    // Check if items changed
    const itemsChanged = !this.arraysEqual(items, this.currentItems);
    const selectionChanged = selectedItemId !== this.selectedItemId;

    if (!itemsChanged && !selectionChanged) return;

    this.currentItems = items;
    this.selectedItemId = selectedItemId;

    // Show/hide empty state
    if (items.length === 0) {
      this.gridEl.style.display = "none";
      this.emptyEl!.style.display = "flex";
      return;
    }

    this.gridEl.style.display = "grid";
    this.emptyEl!.style.display = "none";

    // Rebuild grid (could optimize with DOM diffing later)
    this.gridEl.innerHTML = "";
    
    for (const item of items) {
      const card = this.createItemCard(item, playerBalance);
      if (item.id === selectedItemId) {
        card.classList.add("mm-market-listings__card--selected");
      }
      this.gridEl.appendChild(card);
    }
  }

  private createItemCard(item: MarketItem, playerBalance: number): HTMLElement {
    const card = document.createElement("div");
    card.className = "mm-market-listings__card";
    card.dataset.itemId = item.id;
    
    const canAfford = playerBalance >= item.currentPrice;
    const rarityColor = RARITY_CONFIG[item.rarity].color;
    
    card.innerHTML = `
      <div class="mm-market-listings__card-header" style="border-color: ${rarityColor}">
        <span class="mm-market-listings__card-icon">${item.icon}</span>
        <span class="mm-market-listings__card-rarity" style="color: ${rarityColor}">${this.capitalizeFirst(item.rarity)}</span>
      </div>
      <div class="mm-market-listings__card-body">
        <div class="mm-market-listings__card-name">${item.name}</div>
        <div class="mm-market-listings__card-category">${item.category}</div>
      </div>
      <div class="mm-market-listings__card-footer">
        <span class="mm-market-listings__card-price ${canAfford ? '' : 'mm-market-listings__card-price--unaffordable'}">
          💰 ${this.formatPrice(item.currentPrice)}
        </span>
        ${item.stock !== undefined ? `<span class="mm-market-listings__card-stock">📦 ${item.stock}</span>` : ''}
      </div>
    `;

    if (!item.isAvailable) {
      card.classList.add("mm-market-listings__card--unavailable");
    }

    card.addEventListener("click", () => {
      this.onItemSelect?.(item);
    });

    return card;
  }

  private formatPrice(price: number): string {
    if (price >= 1000) {
      return `${(price / 1000).toFixed(price % 1000 === 0 ? 0 : 1)}k`;
    }
    return price.toString();
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private arraysEqual(a: MarketItem[], b: MarketItem[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i].id !== b[i].id || 
          a[i].currentPrice !== b[i].currentPrice ||
          a[i].stock !== b[i].stock ||
          a[i].isAvailable !== b[i].isAvailable) {
        return false;
      }
    }
    return true;
  }

  destroy(): void {
    this.gridEl?.remove();
    this.emptyEl?.remove();
    this.rootEl?.remove();
    this.rootEl = undefined;
    this.gridEl = undefined;
    this.emptyEl = undefined;
    this.currentItems = [];
  }
}
