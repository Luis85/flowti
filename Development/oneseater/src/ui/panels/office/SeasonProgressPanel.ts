import { GameViewModel } from "src/models/GameViewModel";

interface RaceEvent {
  round: number;
  name: string;
  country: string;
  status: "completed" | "current" | "upcoming";
  result?: number;
  date: string;
}

interface StandingEntry {
  position: number;
  name: string;
  points: number;
  isPlayer?: boolean;
}

const EVENTS: RaceEvent[] = [
  { round: 6, name: "Miami GP", country: "🇺🇸", status: "completed", result: 3, date: "May 4" },
  { round: 7, name: "Emilia Romagna GP", country: "🇮🇹", status: "completed", result: 1, date: "May 18" },
  { round: 8, name: "Monaco GP", country: "🇲🇨", status: "current", date: "May 25" },
  { round: 9, name: "Spanish GP", country: "🇪🇸", status: "upcoming", date: "Jun 1" },
];

const DRIVER_STANDINGS: StandingEntry[] = [
  { position: 1, name: "M. Verstappen", points: 186, isPlayer: true },
  { position: 2, name: "L. Hamilton", points: 142 },
  { position: 3, name: "C. Leclerc", points: 128 },
];

const CONSTRUCTOR_STANDINGS: StandingEntry[] = [
  { position: 1, name: "Velocity Racing", points: 298, isPlayer: true },
  { position: 2, name: "Scuderia Ferrari", points: 226 },
];

export class SeasonProgressPanel {
  private root?: HTMLElement;
  private calendarContent?: HTMLElement;
  private standingsContent?: HTMLElement;
  private built = false;

  mount(parent: HTMLElement) {
    this.root = parent.createDiv({ cls: "mm-panel mm-season" });
    this.root.style.cssText = `
      border: 1px solid var(--background-modifier-border);
      border-radius: 10px;
      padding: 10px;
      background: var(--background-primary-alt);
      display: grid;
      grid-template-rows: auto 1fr;
      gap: 8px;
      min-height: 140px;
      overflow: hidden;
    `;
  }

  render(_m: GameViewModel) {
    if (!this.root || this.built) return;
    this.built = true;

    // Header with tabs
    const header = this.root.createDiv();
    header.style.cssText = `display: flex; justify-content: space-between; align-items: center;`;

    header.createDiv({ text: "SEASON 2025" }).style.cssText = `font-size: 10px; font-weight: 600; opacity: 0.5; letter-spacing: 0.5px;`;

    const tabs = header.createDiv();
    tabs.style.cssText = `display: flex; gap: 4px;`;

    const calBtn = this.createTabBtn(tabs, "Calendar", true);
    const stdBtn = this.createTabBtn(tabs, "Standings", false);

    // Content wrapper
    const contentWrap = this.root.createDiv();
    contentWrap.style.cssText = `min-height: 0; overflow: auto;`;

    this.calendarContent = contentWrap.createDiv();
    this.standingsContent = contentWrap.createDiv();
    this.standingsContent.style.display = "none";

    this.buildCalendar();
    this.buildStandings();

    // Tab switching - capture references
    const calContent = this.calendarContent;
    const stdContent = this.standingsContent;

    calBtn.addEventListener("click", () => {
      calBtn.style.background = "var(--interactive-accent)";
      calBtn.style.color = "var(--text-on-accent)";
      stdBtn.style.background = "var(--background-secondary)";
      stdBtn.style.color = "var(--text-normal)";
      if (calContent) calContent.style.display = "block";
      if (stdContent) stdContent.style.display = "none";
    });

    stdBtn.addEventListener("click", () => {
      stdBtn.style.background = "var(--interactive-accent)";
      stdBtn.style.color = "var(--text-on-accent)";
      calBtn.style.background = "var(--background-secondary)";
      calBtn.style.color = "var(--text-normal)";
      if (stdContent) stdContent.style.display = "block";
      if (calContent) calContent.style.display = "none";
    });
  }

  private createTabBtn(parent: HTMLElement, label: string, active: boolean): HTMLButtonElement {
    const btn = parent.createEl("button", { text: label });
    btn.style.cssText = `
      font-size: 10px;
      padding: 4px 8px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      background: ${active ? "var(--interactive-accent)" : "var(--background-secondary)"};
      color: ${active ? "var(--text-on-accent)" : "var(--text-normal)"};
    `;
    return btn;
  }

  private buildCalendar() {
    if (!this.calendarContent) return;

    // Progress
    const prog = this.calendarContent.createDiv({ text: "Round 8 of 24" });
    prog.style.cssText = `font-size: 10px; opacity: 0.7; margin-bottom: 6px;`;

    const bar = this.calendarContent.createDiv();
    bar.style.cssText = `height: 3px; background: var(--background-modifier-border); border-radius: 2px; margin-bottom: 8px; overflow: hidden;`;
    const fill = bar.createDiv();
    fill.style.cssText = `height: 100%; width: 33%; background: var(--interactive-accent);`;

    // Events
    for (const ev of EVENTS) {
      const row = this.calendarContent.createDiv();
      const isCurrent = ev.status === "current";
      row.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        background: ${isCurrent ? "var(--interactive-accent)" : "var(--background-secondary)"};
        color: ${isCurrent ? "var(--text-on-accent)" : "var(--text-normal)"};
        border-radius: 6px;
        font-size: 11px;
        margin-bottom: 4px;
      `;

      row.createDiv({ text: `R${ev.round}` }).style.cssText = `font-size: 9px; opacity: 0.7; width: 24px;`;
      row.createDiv({ text: `${ev.country} ${ev.name}` }).style.cssText = `flex: 1; font-weight: ${isCurrent ? "600" : "400"};`;

      if (ev.status === "completed" && ev.result) {
        const badge = row.createDiv({ text: `P${ev.result}` });
        badge.style.cssText = `font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: ${ev.result <= 3 ? "var(--color-green, #4ade80)" : "var(--background-modifier-border)"}; color: ${ev.result <= 3 ? "#000" : "var(--text-normal)"};`;
      }
    }
  }

  private buildStandings() {
    if (!this.standingsContent) return;

    // Drivers
    this.standingsContent.createDiv({ text: "Drivers" }).style.cssText = `font-size: 10px; opacity: 0.6; margin-bottom: 4px;`;
    for (const e of DRIVER_STANDINGS) this.buildStandingRow(this.standingsContent, e);

    // Constructors
    this.standingsContent.createDiv({ text: "Constructors" }).style.cssText = `font-size: 10px; opacity: 0.6; margin: 8px 0 4px;`;
    for (const e of CONSTRUCTOR_STANDINGS) this.buildStandingRow(this.standingsContent, e);
  }

  private buildStandingRow(parent: HTMLElement, e: StandingEntry) {
    const row = parent.createDiv();
    row.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 5px 8px;
      background: ${e.isPlayer ? "var(--interactive-accent)" : "var(--background-secondary)"};
      color: ${e.isPlayer ? "var(--text-on-accent)" : "var(--text-normal)"};
      border-radius: 6px;
      font-size: 11px;
      margin-bottom: 3px;
    `;

    row.createDiv({ text: `${e.position}.` }).style.cssText = `width: 20px; font-weight: 600; opacity: 0.7;`;
    row.createDiv({ text: e.name }).style.cssText = `flex: 1;`;
    row.createDiv({ text: `${e.points} pts` }).style.cssText = `font-weight: 600;`;
  }

  destroy() {
    this.root?.remove();
    this.root = undefined;
    this.calendarContent = undefined;
    this.standingsContent = undefined;
    this.built = false;
  }
}
