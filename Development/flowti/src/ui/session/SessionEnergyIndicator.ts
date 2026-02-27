import type { SessionPanelDeps } from "./types";
import type { EnergyLevel } from "../../domain/session/types";

const ENERGY_LABELS: Record<EnergyLevel, string> = {
	1: "Drained",
	2: "Low",
	3: "Moderate",
	4: "Good",
	5: "Energized",
};

/**
 * Clickable 1–5 energy level indicator for the session workspace.
 *
 * - Running/paused: clickable to change energy level
 * - Other states: read-only display
 * - Emits `session.energy.set` on click
 */
export class SessionEnergyIndicator {
	private indicatorEl: HTMLElement | null = null;
	private deps: SessionPanelDeps;

	constructor(private container: HTMLElement, deps: SessionPanelDeps) {
		this.deps = deps;
	}

	render(): void {
		const session = this.deps.getSession();
		const section = this.container.createDiv({ cls: "ft-session-energy ft-section" });

		section.createEl("strong", { text: "Energy" });

		this.indicatorEl = section.createDiv({ cls: "ft-energy-indicator" });

		this.renderIndicator();

		// Label
		const labelEl = section.createEl("span", { cls: "ft-energy-label" });
		this.updateLabel(labelEl, session.energy);
	}

	refreshEnergy(): void {
		if (!this.indicatorEl) return;
		this.renderIndicator();

		const labelEl = this.indicatorEl.parentElement?.querySelector(".ft-energy-label") as HTMLElement | null;
		if (labelEl) {
			this.updateLabel(labelEl, this.deps.getSession().energy);
		}
	}

	private renderIndicator(): void {
		if (!this.indicatorEl) return;
		this.indicatorEl.empty();

		const session = this.deps.getSession();
		const isEditable = session.status === "running" || session.status === "paused"
			|| session.status === "active"; // legacy compat

		for (let level = 1; level <= 5; level++) {
			const isActive = level <= (session.energy ?? 0);
			const dotCls = ["ft-energy-dot"];
			if (isActive) dotCls.push("ft-energy-active");
			if (isEditable) dotCls.push("ft-energy-dot-editable");
			const dot = this.indicatorEl.createEl("span", {
				cls: dotCls.join(" "),
				text: "\u26A1",
			});
			dot.title = `${ENERGY_LABELS[level as EnergyLevel]} (${level}/5)`;

			if (isEditable) {
				dot.addEventListener("click", () => {
					void this.deps.eventBus.emit("session.energy.set", {
						sessionId: session.id,
						level: level as EnergyLevel,
					});
				});
			}
		}
	}

	private updateLabel(el: HTMLElement, energy: EnergyLevel | null): void {
		el.textContent = energy ? `${ENERGY_LABELS[energy]} (${energy}/5)` : "Not set";
	}
}
