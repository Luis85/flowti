/**
 * MarketCategoryPanel
 * 
 * Sidebar navigation for marketplace categories.
 * Displays category icons and names, highlights active selection.
 */

import { MarketCategoryId, MARKET_CATEGORIES } from "../models/MarketTypes";

export class MarketCategoryPanel {
  private rootEl?: HTMLElement;
  private categoryEls: Map<MarketCategoryId, HTMLElement> = new Map();
  private selectedCategory: MarketCategoryId | null = null;
  private onCategorySelect?: (category: MarketCategoryId | null) => void;

  setOnCategorySelect(callback: (category: MarketCategoryId | null) => void): void {
    this.onCategorySelect = callback;
  }

  mount(parent: HTMLElement): void {
    this.rootEl = parent.createDiv({ cls: "mm-market-categories" });
    
    // Header
    const header = this.rootEl.createDiv({ cls: "mm-market-categories__header" });
    header.textContent = "Categories";

    // Category list
    const list = this.rootEl.createDiv({ cls: "mm-market-categories__list" });
    
    // "All" option
    const allBtn = list.createDiv({ cls: "mm-market-categories__item mm-market-categories__item--active" });
    allBtn.innerHTML = `<span class="mm-market-categories__icon">🛒</span><span class="mm-market-categories__name">All Items</span>`;
    allBtn.addEventListener("click", () => this.handleCategoryClick(null));
    this.categoryEls.set("all" as MarketCategoryId, allBtn);

    // Category buttons
    for (const category of MARKET_CATEGORIES) {
      const btn = list.createDiv({ cls: "mm-market-categories__item" });
      btn.innerHTML = `
        <span class="mm-market-categories__icon">${category.icon}</span>
        <span class="mm-market-categories__name">${category.name}</span>
      `;
      btn.addEventListener("click", () => this.handleCategoryClick(category.id));
      this.categoryEls.set(category.id, btn);
    }
  }

  private handleCategoryClick(categoryId: MarketCategoryId | null): void {
    if (this.selectedCategory === categoryId) return;
    
    // Update visual state
    this.categoryEls.forEach((el, id) => {
      const isActive = id === (categoryId ?? "all");
      el.classList.toggle("mm-market-categories__item--active", isActive);
    });
    
    this.selectedCategory = categoryId;
    this.onCategorySelect?.(categoryId);
  }

  render(selectedCategory: MarketCategoryId | null): void {
    if (this.selectedCategory === selectedCategory) return;
    
    this.categoryEls.forEach((el, id) => {
      const isActive = id === (selectedCategory ?? "all");
      el.classList.toggle("mm-market-categories__item--active", isActive);
    });
    
    this.selectedCategory = selectedCategory;
  }

  destroy(): void {
    this.categoryEls.clear();
    this.rootEl?.remove();
    this.rootEl = undefined;
  }
}
