import { ItemView, WorkspaceLeaf } from "obsidian";
import { IEventBus } from "src/eventsystem";
import { SimulationTickEvent } from "src/eventsystem/engine/SimulationTickEvent";
import { PurchaseFailedEvent, PurchaseCompletedEvent } from "src/eventsystem/MarketEvents";
import { INITIAL_MARKET_ITEMS } from "src/market/models/MarketData";
import { MarketCategoryId, MarketItem, InventoryItem, Purchase } from "src/market/models/MarketTypes";
import { MarketCategoryPanel } from "src/market/ui/MarketCategoryPanel";
import { MarketHeaderPanel } from "src/market/ui/MarketHeaderPanel";
import { MarketListingsPanel } from "src/market/ui/MarketingListingPanel";
import { MarketItemDetailPanel } from "src/market/ui/MarketItemDetailPanel";
import { Payment } from "src/models/Payment";
import { SimulationStore } from "src/simulation/stores/SimulationStore";
import { getLevelFromXP } from "src/simulation/systems/player/LevelSystem";

export const GAME_MARKET_VIEW = "gameloop-market-view";

export class GameMarketView extends ItemView {
  private events: IEventBus;

  // State
  private tick?: SimulationStore;
  private selectedCategory: MarketCategoryId | null = null;
  private selectedItem: MarketItem | null = null;
  private searchQuery = "";
  private marketItems: MarketItem[] = [...INITIAL_MARKET_ITEMS];
  
  // Player Economy - calculated from payments and purchases
  private playerInventory: InventoryItem[] = [];
  private purchases: Purchase[] = [];  // Track all purchases
  private totalEarnings = 0;           // Sum of collected payments
  private totalSpent = 0;              // Sum of purchases
  private playerBalance = 0;           // earnings - spent
  private playerLevel = 1;
  private playerXp = 0;

  // Render scheduling
  private rafPending = false;

  // Root
  private rootEl?: HTMLElement;

  // Panels
  private headerPanel = new MarketHeaderPanel();
  private categoryPanel = new MarketCategoryPanel();
  private listingsPanel = new MarketListingsPanel();
  private detailPanel = new MarketItemDetailPanel();

  constructor(leaf: WorkspaceLeaf, events: IEventBus) {
    super(leaf);
    this.events = events;
  }

  getViewType() {
    return GAME_MARKET_VIEW;
  }

  getDisplayText() {
    return "OneSeater - Market";
  }

  async onOpen() {
    // Subscribe to events
    this.events.subscribe(SimulationTickEvent, this.onTick);

    // Setup container
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.style.cssText = `padding: 0; overflow: hidden;`;

    // Root
    this.rootEl = container.createDiv({ cls: "mm-market-root" });

    // Header
    this.headerPanel.mount(this.rootEl);
    this.headerPanel.setOnSearch(this.handleSearch);

    // Main content area
    const main = this.rootEl.createDiv({ cls: "mm-market-main" });

    // Left: Categories
    this.categoryPanel.mount(main);
    this.categoryPanel.setOnCategorySelect(this.handleCategorySelect);

    // Center: Listings
    this.listingsPanel.mount(main);
    this.listingsPanel.setOnItemSelect(this.handleItemSelect);

    // Right: Detail
    this.detailPanel.mount(main);
    this.detailPanel.setOnPurchase(this.handlePurchase);

    // Initial render
    this.requestRender();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Event Handlers
  // ═══════════════════════════════════════════════════════════════════════════

  private onTick = (e: SimulationTickEvent) => {
    const state = e.state;
    if (!state) return;

    this.tick = state;

    // Calculate earnings from collected payments
    const payments: Payment[] = state.payments ?? [];
    const newTotalEarnings = payments
      .filter((p: Payment) => p.status === "collected")
      .reduce((sum: number, p: Payment) => sum + p.amount, 0);

    // Calculate balance (earnings - spent)
    const newBalance = newTotalEarnings - this.totalSpent;

    // Get XP and calculate level
    const newXp = state.player.stats.xp ?? 0;
    const newLevel = getLevelFromXP(newXp);

    // Check what changed
    const earningsChanged = this.totalEarnings !== newTotalEarnings;
    const balanceChanged = this.playerBalance !== newBalance;
    const levelChanged = this.playerLevel !== newLevel.level;
    const xpChanged = this.playerXp !== newXp;

    // Update state
    this.totalEarnings = newTotalEarnings;
    this.playerBalance = newBalance;
    this.playerXp = newXp;
    this.playerLevel = newLevel.level;

    if (earningsChanged || balanceChanged || levelChanged || xpChanged) {
      this.requestRender();
    }
  };

  private handleSearch = (query: string) => {
    this.searchQuery = query.toLowerCase().trim();
    this.requestRender();
  };

  private handleCategorySelect = (categoryId: MarketCategoryId | null) => {
    this.selectedCategory = categoryId;
    this.selectedItem = null; // Clear selection when changing categories
    this.requestRender();
  };

  private handleItemSelect = (item: MarketItem | null) => {
    this.selectedItem = item;
    this.requestRender();
  };

  private handlePurchase = (item: MarketItem, quantity: number) => {
    const totalCost = item.currentPrice * quantity;

    // Validate balance
    if (this.playerBalance < totalCost) {
      this.events.publish(new PurchaseFailedEvent(item, "Insufficient funds"));
      return;
    }

    // Create purchase record
    const purchase: Purchase = {
      id: `pur_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`,
      itemId: item.id,
      quantity,
      unitPrice: item.currentPrice,
      totalPrice: totalCost,
      status: "completed",
      purchasedAt: this.getCurrentGameTime(),
      completedAt: this.getCurrentGameTime(),
    };

    // Update local state
    this.purchases.push(purchase);
    this.totalSpent += totalCost;
    this.playerBalance = this.totalEarnings - this.totalSpent;

    // Update stock if applicable
    if (item.stock !== undefined) {
      item.stock -= quantity;
      if (item.stock <= 0) {
        item.isAvailable = false;
      }
    }

    // Add to local inventory
    const existingInv = this.playerInventory.find(i => i.itemId === item.id);
    if (existingInv) {
      existingInv.quantity += quantity;
    } else {
      this.playerInventory.push({
        itemId: item.id,
        quantity: quantity,
        acquiredAt: this.getCurrentGameTime(),
        isActive: false,
      });
    }

    // Publish success event (other systems can react)
    this.events.publish(new PurchaseCompletedEvent(purchase, item));

    this.requestRender();
  };

  private getCurrentGameTime(): number {
    const dayIndex = this.tick?.dayIndex ?? 1;
    const minuteOfDay = this.tick?.minuteOfDay ?? 0;
    return dayIndex * 1440 + minuteOfDay;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Filtering & Rendering
  // ═══════════════════════════════════════════════════════════════════════════

  private getFilteredItems(): MarketItem[] {
    let items = this.marketItems;

    // Filter by category
    if (this.selectedCategory) {
      items = items.filter(item => item.category === this.selectedCategory);
    }

    // Filter by search query
    if (this.searchQuery) {
      items = items.filter(item =>
        item.name.toLowerCase().includes(this.searchQuery) ||
        item.description.toLowerCase().includes(this.searchQuery) ||
        item.category.toLowerCase().includes(this.searchQuery)
      );
    }

    // Sort: available first, then by rarity, then by price
    const rarityOrder = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4 };
    items.sort((a, b) => {
      // Available items first
      if (a.isAvailable !== b.isAvailable) {
        return a.isAvailable ? -1 : 1;
      }
      // Then by rarity
      if (rarityOrder[a.rarity] !== rarityOrder[b.rarity]) {
        return rarityOrder[a.rarity] - rarityOrder[b.rarity];
      }
      // Then by price
      return a.currentPrice - b.currentPrice;
    });

    return items;
  }

  private requestRender(): void {
    if (this.rafPending) return;
    this.rafPending = true;

    requestAnimationFrame(() => {
      this.rafPending = false;
      this.render();
    });
  }

  private render(): void {
    if (!this.rootEl) return;

    const filteredItems = this.getFilteredItems();

    // Render each panel
    this.headerPanel.render({
      balance: this.playerBalance,
      totalEarnings: this.totalEarnings,
      totalSpent: this.totalSpent,
    });
    this.categoryPanel.render(this.selectedCategory);
    this.listingsPanel.render(
      filteredItems,
      this.selectedItem?.id ?? null,
      this.playerBalance
    );
    this.detailPanel.render(
      this.selectedItem,
      this.playerBalance,
      this.playerLevel,
      this.playerXp,
      this.playerInventory
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Lifecycle
  // ═══════════════════════════════════════════════════════════════════════════

  async onClose() {
    this.events.unsubscribe(SimulationTickEvent, this.onTick);

    this.headerPanel.destroy();
    this.categoryPanel.destroy();
    this.listingsPanel.destroy();
    this.detailPanel.destroy();

    this.rootEl = undefined;
  }
}
