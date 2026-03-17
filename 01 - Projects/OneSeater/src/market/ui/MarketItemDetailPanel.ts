/**
 * MarketItemDetailPanel
 * 
 * Displays detailed information about a selected marketplace item.
 * Includes description, effects, requirements, and purchase button.
 */

import { 
  MarketItem, 
  InventoryItem,
  RARITY_CONFIG,
  PurchaseRequirements 
} from "../models/MarketTypes";

export interface PurchaseValidation {
  canPurchase: boolean;
  reasons: string[];
}

export class MarketItemDetailPanel {
  private rootEl?: HTMLElement;
  private contentEl?: HTMLElement;
  private emptyEl?: HTMLElement;
  private currentItem: MarketItem | null = null;
  private onPurchase?: (item: MarketItem, quantity: number) => void;

  setOnPurchase(callback: (item: MarketItem, quantity: number) => void): void {
    this.onPurchase = callback;
  }

  mount(parent: HTMLElement): void {
    this.rootEl = parent.createDiv({ cls: "mm-market-detail" });
    
    // Empty state (shown when no item selected)
    this.emptyEl = this.rootEl.createDiv({ cls: "mm-market-detail__empty" });
    this.emptyEl.innerHTML = `
      <span class="mm-market-detail__empty-icon">🏪</span>
      <p>Select an item to view details</p>
    `;

    // Content container (hidden when no item selected)
    this.contentEl = this.rootEl.createDiv({ cls: "mm-market-detail__content" });
    this.contentEl.style.display = "none";
  }

  render(
    item: MarketItem | null, 
    playerBalance: number,
    playerLevel: number,
    playerXp: number,
    inventory: InventoryItem[]
  ): void {
    if (!this.contentEl || !this.emptyEl) return;

    // Show empty state if no item
    if (!item) {
      this.emptyEl.style.display = "flex";
      this.contentEl.style.display = "none";
      this.currentItem = null;
      return;
    }

    this.emptyEl.style.display = "none";
    this.contentEl.style.display = "flex";
    this.currentItem = item;

    const validation = this.validatePurchase(item, playerBalance, playerLevel, playerXp, inventory);
    const rarityColor = RARITY_CONFIG[item.rarity].color;
    const ownedCount = this.getOwnedCount(item.id, inventory);

    this.contentEl.innerHTML = `
      <!-- Header -->
      <div class="mm-market-detail__header" style="border-left: 4px solid ${rarityColor}">
        <div class="mm-market-detail__icon">${item.icon}</div>
        <div class="mm-market-detail__title-group">
          <h3 class="mm-market-detail__name">${item.name}</h3>
          <span class="mm-market-detail__rarity" style="color: ${rarityColor}">${this.capitalizeFirst(item.rarity)}</span>
        </div>
      </div>

      <!-- Description -->
      <p class="mm-market-detail__description">${item.description}</p>

      <!-- Effects -->
      <div class="mm-market-detail__section">
        <h4 class="mm-market-detail__section-title">Effects</h4>
        <ul class="mm-market-detail__effects">
          ${item.effects.map(e => `
            <li class="mm-market-detail__effect">
              <span class="mm-market-detail__effect-icon">${this.getEffectIcon(e.type)}</span>
              <span>${e.description}</span>
              ${e.duration ? `<span class="mm-market-detail__effect-duration">(${this.formatDuration(e.duration)})</span>` : ''}
            </li>
          `).join('')}
        </ul>
      </div>

      <!-- Requirements -->
      ${this.renderRequirements(item.requirements, playerLevel, playerXp, inventory)}

      <!-- Item Properties -->
      <div class="mm-market-detail__section">
        <h4 class="mm-market-detail__section-title">Properties</h4>
        <div class="mm-market-detail__properties">
          <div class="mm-market-detail__property">
            <span class="mm-market-detail__property-label">Type</span>
            <span class="mm-market-detail__property-value">${item.isConsumable ? 'Consumable' : 'Permanent'}</span>
          </div>
          ${item.isStackable ? `
            <div class="mm-market-detail__property">
              <span class="mm-market-detail__property-label">Max Stack</span>
              <span class="mm-market-detail__property-value">${item.maxStack ?? '∞'}</span>
            </div>
          ` : ''}
          ${item.stock !== undefined ? `
            <div class="mm-market-detail__property">
              <span class="mm-market-detail__property-label">In Stock</span>
              <span class="mm-market-detail__property-value">${item.stock}</span>
            </div>
          ` : ''}
          ${ownedCount > 0 ? `
            <div class="mm-market-detail__property">
              <span class="mm-market-detail__property-label">Owned</span>
              <span class="mm-market-detail__property-value">${ownedCount}</span>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Purchase Section -->
      <div class="mm-market-detail__purchase">
        <div class="mm-market-detail__price-row">
          <span class="mm-market-detail__price-label">Price</span>
          <span class="mm-market-detail__price-value ${validation.canPurchase ? '' : 'mm-market-detail__price-value--unaffordable'}">
            💰 ${item.currentPrice.toLocaleString()}
          </span>
        </div>
        
        ${!validation.canPurchase ? `
          <div class="mm-market-detail__validation-errors">
            ${validation.reasons.map(r => `<div class="mm-market-detail__validation-error">⚠️ ${r}</div>`).join('')}
          </div>
        ` : ''}

        <button 
          class="mm-market-detail__buy-btn ${validation.canPurchase ? '' : 'mm-market-detail__buy-btn--disabled'}"
          ${validation.canPurchase ? '' : 'disabled'}
        >
          ${validation.canPurchase ? '🛒 Purchase' : '🚫 Cannot Purchase'}
        </button>
      </div>
    `;

    // Attach buy button handler
    const buyBtn = this.contentEl.querySelector('.mm-market-detail__buy-btn');
    if (buyBtn && validation.canPurchase) {
      buyBtn.addEventListener('click', () => {
        this.onPurchase?.(item, 1);
      });
    }
  }

  private validatePurchase(
    item: MarketItem,
    playerBalance: number,
    playerLevel: number,
    playerXp: number,
    inventory: InventoryItem[]
  ): PurchaseValidation {
    const reasons: string[] = [];

    // Check balance
    if (playerBalance < item.currentPrice) {
      reasons.push(`Insufficient funds (need ${item.currentPrice - playerBalance} more)`);
    }

    // Check availability
    if (!item.isAvailable) {
      reasons.push("Item is not available");
    }

    // Check stock
    if (item.stock !== undefined && item.stock <= 0) {
      reasons.push("Out of stock");
    }

    // Check level requirement
    if (item.requirements.minLevel && playerLevel < item.requirements.minLevel) {
      reasons.push(`Requires level ${item.requirements.minLevel}`);
    }

    // Check XP requirement
    if (item.requirements.minXp && playerXp < item.requirements.minXp) {
      reasons.push(`Requires ${item.requirements.minXp} XP`);
    }

    // Check required items
    if (item.requirements.requiredItems) {
      for (const reqItemId of item.requirements.requiredItems) {
        const owned = inventory.some(inv => inv.itemId === reqItemId && inv.quantity > 0);
        if (!owned) {
          reasons.push(`Requires: ${reqItemId}`); // TODO: Look up item name
        }
      }
    }

    // Check stack limit
    if (!item.isStackable) {
      const owned = inventory.some(inv => inv.itemId === item.id && inv.quantity > 0);
      if (owned) {
        reasons.push("Already owned (not stackable)");
      }
    } else if (item.maxStack) {
      const ownedCount = this.getOwnedCount(item.id, inventory);
      if (ownedCount >= item.maxStack) {
        reasons.push(`Maximum stack reached (${item.maxStack})`);
      }
    }

    return {
      canPurchase: reasons.length === 0,
      reasons
    };
  }

  private renderRequirements(
    req: PurchaseRequirements,
    playerLevel: number,
    playerXp: number,
    inventory: InventoryItem[]
  ): string {
    const hasRequirements = req.minLevel || req.minXp || req.requiredItems?.length;
    if (!hasRequirements) return '';

    return `
      <div class="mm-market-detail__section">
        <h4 class="mm-market-detail__section-title">Requirements</h4>
        <ul class="mm-market-detail__requirements">
          ${req.minLevel ? `
            <li class="${playerLevel >= req.minLevel ? 'mm-market-detail__req--met' : 'mm-market-detail__req--unmet'}">
              ${playerLevel >= req.minLevel ? '✅' : '❌'} Level ${req.minLevel}
            </li>
          ` : ''}
          ${req.minXp ? `
            <li class="${playerXp >= req.minXp ? 'mm-market-detail__req--met' : 'mm-market-detail__req--unmet'}">
              ${playerXp >= req.minXp ? '✅' : '❌'} ${req.minXp.toLocaleString()} XP
            </li>
          ` : ''}
          ${(req.requiredItems || []).map(itemId => {
            const owned = inventory.some(inv => inv.itemId === itemId && inv.quantity > 0);
            return `
              <li class="${owned ? 'mm-market-detail__req--met' : 'mm-market-detail__req--unmet'}">
                ${owned ? '✅' : '❌'} Owns: ${itemId}
              </li>
            `;
          }).join('')}
        </ul>
      </div>
    `;
  }

  private getOwnedCount(itemId: string, inventory: InventoryItem[]): number {
    const inv = inventory.find(i => i.itemId === itemId);
    return inv?.quantity ?? 0;
  }

  private getEffectIcon(type: string): string {
    const icons: Record<string, string> = {
      xp_boost: '⭐',
      energy_efficiency: '⚡',
      task_speed: '🚀',
      income_boost: '💰',
      unlock_feature: '🔓',
      capacity_increase: '📈',
      data_access: '📊',
      skill_training: '🎓'
    };
    return icons[type] || '✨';
  }

  private formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes}m`;
    if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
    return `${Math.round(minutes / 1440)}d`;
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  destroy(): void {
    this.contentEl?.remove();
    this.emptyEl?.remove();
    this.rootEl?.remove();
    this.rootEl = undefined;
    this.contentEl = undefined;
    this.emptyEl = undefined;
    this.currentItem = null;
  }
}
