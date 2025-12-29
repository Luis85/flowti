import { GameViewModel } from "src/models/GameViewModel";

export class FeedPanel {
  private root?: HTMLElement;
  private listEl?: HTMLElement;
  private lastFeedLength = 0;
  private maxItems = 12;

  mount(parent: HTMLElement) {
    this.root = parent.createDiv({ cls: "mm-panel mm-feed" });

    // Header
    const header = this.root.createDiv({ text: "ACTIVITY FEED" });
    header.style.cssText = `font-size: 9px; font-weight: 600; opacity: 0.5; letter-spacing: 0.5px;`;

    // List
    this.listEl = this.root.createDiv({ cls: "mm-feed-list" });
  }

  render(m: GameViewModel) {
    if (!this.listEl) return;

    // Only update if feed changed
    if (m.feed.length === this.lastFeedLength) return;

    const newItems = m.feed.length - this.lastFeedLength;
    this.lastFeedLength = m.feed.length;

    // Add new items at the top
    if (newItems > 0) {
      const itemsToAdd = m.feed.slice(0, newItems);
      
      for (let i = itemsToAdd.length - 1; i >= 0; i--) {
        const line = itemsToAdd[i];
        const row = this.createFeedRow(line, i === 0);
        
        if (this.listEl.firstChild) {
          this.listEl.insertBefore(row, this.listEl.firstChild);
        } else {
          this.listEl.appendChild(row);
        }
      }

      // Remove excess items
      while (this.listEl.children.length > this.maxItems) {
        this.listEl.lastChild?.remove();
      }

      // Update opacity of existing items
      this.updateOpacity();
    }
  }

  private createFeedRow(line: string, isNew: boolean): HTMLElement {
    const row = document.createElement("div");
    row.style.cssText = `
      font-size: 10px;
      padding: 4px 6px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      gap: 6px;
      background: ${isNew ? "var(--background-secondary)" : "transparent"};
    `;

    // Parse "[Day X] Phase: from → to"
    const match = line.match(/\[Day (\d+)\] Phase: (\w+) → (\w+)/);
    
    if (match) {
      const [, day, , to] = match;
      
      const dayBadge = document.createElement("span");
      dayBadge.textContent = `D${day}`;
      dayBadge.style.cssText = `font-size: 9px; font-weight: 600; opacity: 0.6; min-width: 28px;`;
      
      const icon = document.createElement("span");
      icon.textContent = this.getPhaseIcon(to);
      icon.style.fontSize = "11px";
      
      const text = document.createElement("span");
      text.textContent = line.replace(/\[Day \d+\] Phase: /, "").replace("→", "→");
      text.style.flex = "1";
      
      row.appendChild(dayBadge);
      row.appendChild(icon);
      row.appendChild(text);

    } else {
      row.textContent = line;
    }

    return row;
  }

  private updateOpacity() {
    if (!this.listEl) return;
    const children = this.listEl.children;
    for (let i = 0; i < children.length; i++) {
      const el = children[i] as HTMLElement;
      el.style.opacity = `${Math.max(0.4, 1 - i * 0.05)}`;
    }
  }

  private getPhaseIcon(phase: string): string {
    const icons: Record<string, string> = {
      night: "🌙", morning: "☀️", work: "💼", session: "🏎️", wrapup: "📋"
    };
    return icons[phase] || "•";
  }

  destroy() {
    this.root?.remove();
    this.root = undefined;
    this.listEl = undefined;
    this.lastFeedLength = 0;
  }
}
