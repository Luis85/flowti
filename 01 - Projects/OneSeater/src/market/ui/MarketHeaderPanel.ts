/**
 * MarketHeaderPanel
 * 
 * Top bar for the marketplace showing:
 * - Title
 * - Player balance (with earnings/spent breakdown)
 * - Search/filter
 */

export interface BalanceInfo {
  balance: number;
  totalEarnings: number;
  totalSpent: number;
}

export class MarketHeaderPanel {
  private rootEl?: HTMLElement;
  private balanceEl?: HTMLElement;
  private earningsEl?: HTMLElement;
  private spentEl?: HTMLElement;
  private searchEl?: HTMLInputElement;
  private lastBalance = -1;
  private lastEarnings = -1;
  private lastSpent = -1;
  private onSearch?: (query: string) => void;

  setOnSearch(callback: (query: string) => void): void {
    this.onSearch = callback;
  }

  mount(parent: HTMLElement): void {
    this.rootEl = parent.createDiv({ cls: "mm-market-header" });

    // Left: Title
    const titleSection = this.rootEl.createDiv({ cls: "mm-market-header__title-section" });
    titleSection.innerHTML = `
      <span class="mm-market-header__icon">🏪</span>
      <h2 class="mm-market-header__title">Marketplace</h2>
    `;

    // Center: Search
    const searchSection = this.rootEl.createDiv({ cls: "mm-market-header__search-section" });
    this.searchEl = searchSection.createEl("input", {
      cls: "mm-market-header__search",
      attr: {
        type: "text",
        placeholder: "Search items..."
      }
    });
    this.searchEl.addEventListener("input", (e) => {
      const target = e.target as HTMLInputElement;
      this.onSearch?.(target.value);
    });

    // Right: Balance with breakdown
    const balanceSection = this.rootEl.createDiv({ cls: "mm-market-header__balance-section" });
    balanceSection.innerHTML = `
      <div class="mm-market-header__balance-main">
        <span class="mm-market-header__balance-label">Your Balance</span>
        <span class="mm-market-header__balance-value">💰 <span class="mm-market-header__balance-amount">0</span></span>
      </div>
      <div class="mm-market-header__balance-breakdown">
        <span class="mm-market-header__earnings">📈 <span class="mm-market-header__earnings-amount">0</span></span>
        <span class="mm-market-header__spent">📉 <span class="mm-market-header__spent-amount">0</span></span>
      </div>
    `;
    this.balanceEl = balanceSection.querySelector(".mm-market-header__balance-amount") as HTMLElement;
    this.earningsEl = balanceSection.querySelector(".mm-market-header__earnings-amount") as HTMLElement;
    this.spentEl = balanceSection.querySelector(".mm-market-header__spent-amount") as HTMLElement;
  }

  render(info: BalanceInfo): void {
    const { balance, totalEarnings, totalSpent } = info;
    
    // Update balance
    if (this.balanceEl && balance !== this.lastBalance) {
      this.lastBalance = balance;
      this.balanceEl.textContent = balance.toLocaleString();
      
      // Animate on change
      this.balanceEl.classList.add("mm-market-header__balance-amount--updated");
      setTimeout(() => {
        this.balanceEl?.classList.remove("mm-market-header__balance-amount--updated");
      }, 300);
    }

    // Update earnings
    if (this.earningsEl && totalEarnings !== this.lastEarnings) {
      this.lastEarnings = totalEarnings;
      this.earningsEl.textContent = totalEarnings.toLocaleString();
    }

    // Update spent
    if (this.spentEl && totalSpent !== this.lastSpent) {
      this.lastSpent = totalSpent;
      this.spentEl.textContent = totalSpent.toLocaleString();
    }
  }

  getSearchQuery(): string {
    return this.searchEl?.value ?? "";
  }

  clearSearch(): void {
    if (this.searchEl) {
      this.searchEl.value = "";
    }
  }

  destroy(): void {
    this.rootEl?.remove();
    this.rootEl = undefined;
    this.balanceEl = undefined;
    this.earningsEl = undefined;
    this.spentEl = undefined;
    this.searchEl = undefined;
  }
}
