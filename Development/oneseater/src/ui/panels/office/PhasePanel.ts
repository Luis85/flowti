import { GameViewModel } from "src/models/GameViewModel";
import { DayPhase } from "src/simulation/types";

interface PhaseAction {
  id: string;
  label: string;
  icon: string;
  description?: string;
  disabled?: boolean;
}

interface PhaseConfig {
  title: string;
  icon: string;
  description: string;
  actions: PhaseAction[];
}

const PHASE_CONFIGS: Record<DayPhase, PhaseConfig> = {
  night: {
    title: "Night Shift",
    icon: "🌙",
    description: "Overnight operations running. Staff resting, automated systems active.",
    actions: [
      { id: "night-report", label: "Night Report", icon: "📊", description: "Review overnight events", disabled: true },
      { id: "automation", label: "Automation", icon: "⚙️", description: "Adjust automated tasks", disabled: true },
    ],
  },
  morning: {
    title: "Morning Briefing",
    icon: "☀️",
    description: "Review daily priorities, assess risks, and coordinate with your team.",
    actions: [
      { id: "daily-brief", label: "Daily Brief", icon: "📋", description: "KPIs, risks, priorities", disabled: true },
      { id: "set-priorities", label: "Set Priorities", icon: "🎯", description: "Define today's focus", disabled: true },
      { id: "team-meeting", label: "Team Meeting", icon: "👥", description: "Sync with department heads", disabled: true },
      { id: "calendar", label: "Calendar", icon: "📅", description: "View scheduled events", disabled: true },
    ],
  },
  work: {
    title: "Operations",
    icon: "💼",
    description: "Core work hours. Manage R&D, manufacturing, logistics, staff, and finances.",
    actions: [
      { id: "rnd", label: "R&D Lab", icon: "🔬", description: "Research & Development", disabled: true },
      { id: "factory", label: "Factory", icon: "🏭", description: "Manufacturing queue", disabled: true },
      { id: "staff", label: "Staff", icon: "👥", description: "Hire, train, manage", disabled: true },
      { id: "suppliers", label: "Suppliers", icon: "📦", description: "Orders & contracts", disabled: true },
      { id: "facilities", label: "Facilities", icon: "🏢", description: "Upgrades & maintenance", disabled: true },
      { id: "sponsors", label: "Sponsors", icon: "💰", description: "Partnerships & deals", disabled: true },
    ],
  },
  session: {
    title: "Track Session",
    icon: "🏎️",
    description: "Active track time. Make real-time strategy decisions and monitor performance.",
    actions: [
      { id: "strategy", label: "Strategy", icon: "🧠", description: "Tire, fuel, pit strategy", disabled: true },
      { id: "pit-wall", label: "Pit Wall", icon: "🏁", description: "Live race control", disabled: true },
      { id: "telemetry", label: "Telemetry", icon: "📈", description: "Car performance data", disabled: true },
      { id: "radio", label: "Team Radio", icon: "📻", description: "Driver communication", disabled: true },
      { id: "weather", label: "Weather", icon: "🌤️", description: "Forecast & conditions", disabled: true },
    ],
  },
  wrapup: {
    title: "Day Review",
    icon: "📋",
    description: "Review the day's outcomes, analyze results, and prepare for tomorrow.",
    actions: [
      { id: "summary", label: "Day Summary", icon: "📊", description: "Results & outcomes", disabled: true },
      { id: "debrief", label: "Debrief", icon: "🗣️", description: "Team feedback session", disabled: true },
      { id: "plan-tomorrow", label: "Plan Tomorrow", icon: "📝", description: "Set next day's agenda", disabled: true },
      { id: "save", label: "Save Game", icon: "💾", description: "Save your progress", disabled: true },
    ],
  },
};

export class PhasePanel {
  private root?: HTMLElement;
  private headerEl?: HTMLElement;
  private actionsEl?: HTMLElement;
  private lastPhase?: DayPhase;
  private lastPaused?: boolean;

  mount(parent: HTMLElement) {
    this.root = parent.createDiv({ cls: "mm-panel mm-control-center" });
    this.headerEl = this.root.createDiv({ cls: "mm-cc-header" });
    this.actionsEl = this.root.createDiv({ cls: "mm-cc-actions" });
  }

  render(m: GameViewModel) {
    if (this.lastPhase === m.phase && this.lastPaused === m.paused) return;
    this.lastPhase = m.phase;
    this.lastPaused = m.paused;

    if (!this.headerEl || !this.actionsEl) return;

    const config = PHASE_CONFIGS[m.phase as DayPhase];

    // Header
    this.headerEl.empty();
    
    const titleRow = this.headerEl.createDiv();
    titleRow.style.cssText = `display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;`;

    const left = titleRow.createDiv();
    left.style.cssText = `display: flex; align-items: center; gap: 10px;`;
    left.createDiv({ text: config.icon }).style.fontSize = "22px";
    left.createDiv({ text: config.title }).style.cssText = `font-size: 16px; font-weight: 700;`;

    const status = titleRow.createDiv({ text: m.paused ? "⏸ Paused" : "● Running" });
    status.style.cssText = `
      font-size: 11px;
      font-weight: 500;
      padding: 5px 10px;
      border-radius: 14px;
      background: ${m.paused ? "var(--background-modifier-border)" : "var(--color-green, #4ade80)"};
      color: ${m.paused ? "var(--text-normal)" : "#000"};
    `;

    const desc = this.headerEl.createDiv({ text: config.description });
    desc.style.cssText = `font-size: 12px; opacity: 0.7; line-height: 1.4;`;

    // Actions
    this.actionsEl.empty();
    
    const actionsHeader = this.actionsEl.createDiv({ text: "ACTIONS" });
    actionsHeader.style.cssText = `font-size: 10px; font-weight: 600; opacity: 0.5; letter-spacing: 0.5px; margin-bottom: 10px;`;

    const grid = this.actionsEl.createDiv();
    grid.style.cssText = `display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px;`;

    for (const action of config.actions) {
      const btn = grid.createDiv();
      btn.style.cssText = `
        padding: 12px;
        background: var(--background-secondary);
        border: 1px solid var(--background-modifier-border);
        border-radius: 8px;
        cursor: ${action.disabled ? "not-allowed" : "pointer"};
        opacity: ${action.disabled ? "0.5" : "1"};
      `;

      if (!action.disabled) {
        btn.addEventListener("mouseenter", () => {
          btn.style.borderColor = "var(--interactive-accent)";
          btn.style.background = "var(--background-primary-alt)";
        });
        btn.addEventListener("mouseleave", () => {
          btn.style.borderColor = "var(--background-modifier-border)";
          btn.style.background = "var(--background-secondary)";
        });
        btn.addEventListener("click", () => {
          console.log(`Action clicked: ${action.id}`);
        });
      }

      const header = btn.createDiv();
      header.style.cssText = `display: flex; align-items: center; gap: 8px; margin-bottom: 4px;`;
      header.createDiv({ text: action.icon }).style.fontSize = "14px";
      header.createDiv({ text: action.label }).style.cssText = `font-size: 12px; font-weight: 600;`;

      if (action.description) {
        const descEl = btn.createDiv({ text: action.description });
        descEl.style.cssText = `font-size: 10px; opacity: 0.6; line-height: 1.3;`;
      }
    }
  }

  destroy() {
    this.root?.remove();
    this.root = undefined;
    this.headerEl = undefined;
    this.actionsEl = undefined;
    this.lastPhase = undefined;
    this.lastPaused = undefined;
  }
}
