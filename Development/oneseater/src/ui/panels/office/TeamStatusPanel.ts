import { GameViewModel } from "src/models/GameViewModel";

interface DriverStatus {
  name: string;
  number: number;
  morale: number;
  fitness: number;
}

interface TeamStatusData {
  teamName: string;
  drivers: DriverStatus[];
  staffMorale: number;
  facilityLevel: number;
}

const PLACEHOLDER_DATA: TeamStatusData = {
  teamName: "Velocity Racing",
  drivers: [
    { name: "M. Verstappen", number: 1, morale: 92, fitness: 95 },
    { name: "S. Pérez", number: 11, morale: 78, fitness: 88 },
  ],
  staffMorale: 85,
  facilityLevel: 4,
};

export class TeamStatusPanel {
  private root?: HTMLElement;
  private built = false;

  mount(parent: HTMLElement) {
    this.root = parent.createDiv({ cls: "mm-panel mm-team-status" });
    this.root.style.cssText = `
      border: 1px solid var(--background-modifier-border);
      border-radius: 10px;
      padding: 10px;
      background: var(--background-primary-alt);
    `;
  }

  render(_m: GameViewModel) {
    // Only build once - static placeholder data
    if (!this.root || this.built) return;
    this.built = true;
    
    const data = PLACEHOLDER_DATA;

    // Header
    const header = this.root.createDiv();
    header.style.cssText = `display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;`;

    header.createDiv({ text: "TEAM STATUS" }).style.cssText = `font-size: 10px; font-weight: 600; opacity: 0.5; letter-spacing: 0.5px;`;
    header.createDiv({ text: data.teamName }).style.cssText = `font-size: 12px; font-weight: 700;`;

    // Drivers - compact
    for (const driver of data.drivers) {
      const row = this.root.createDiv();
      row.style.cssText = `display: flex; align-items: center; gap: 8px; padding: 6px 8px; background: var(--background-secondary); border-radius: 6px; font-size: 11px; margin-bottom: 4px;`;

      row.createDiv({ text: `#${driver.number}` }).style.cssText = `font-size: 10px; font-weight: 700; padding: 2px 5px; background: var(--interactive-accent); color: var(--text-on-accent); border-radius: 4px;`;
      row.createDiv({ text: driver.name }).style.cssText = `font-weight: 600; flex: 1;`;
      row.createDiv({ text: `😊${driver.morale}% 💪${driver.fitness}%` }).style.cssText = `font-size: 10px; opacity: 0.8;`;
    }

    // Stats row
    const statsRow = this.root.createDiv();
    statsRow.style.cssText = `display: flex; gap: 6px; margin-top: 4px;`;

    for (const [label, value] of [["Staff", `${data.staffMorale}%`], ["Facility", `Lvl ${data.facilityLevel}`]]) {
      const box = statsRow.createDiv();
      box.style.cssText = `flex: 1; padding: 6px; background: var(--background-secondary); border-radius: 6px; text-align: center;`;
      box.createDiv({ text: label }).style.cssText = `font-size: 9px; opacity: 0.6;`;
      box.createDiv({ text: value }).style.cssText = `font-size: 12px; font-weight: 700;`;
    }
  }

  destroy() {
    this.root?.remove();
    this.root = undefined;
    this.built = false;
  }
}
