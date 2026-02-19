/**
 * Nudge preferences detail panel for the User Hub.
 *
 * Renders:
 * 1. List of existing nudge configs (with enable toggle + delete)
 * 2. Add new nudge form (time, session type, title, duration, enabled)
 *
 * All mutations flow through EventBus commands → NudgeService.
 */

import { setIcon } from "obsidian";
import type { UserHubComponentDeps } from "./types";
import { SESSION_TYPE_LABELS } from "./types";
import { SESSION_TYPES } from "../../domain/session/types";
import type { NudgeConfig } from "../../domain/nudge/types";

export class UserHubNudgePreferences {
	constructor(
		private container: HTMLElement,
		private deps: UserHubComponentDeps,
	) {}

	render(): void {
		this.container.empty();

		const section = this.container.createDiv({ cls: "ft-detail-section" });
		const header = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const icon = header.createSpan();
		setIcon(icon, "bell");
		icon.addClass("ft-icon-muted");
		header.createEl("h3", { text: "Session Nudges", cls: "ft-heading ft-heading-sm" }).style.margin = "0";

		section.createEl("p", {
			text: "Time-based reminders to start a session. Nudges fire once per day at the configured time.",
			cls: "ft-text-sm ft-text-muted",
		});

		const configs = this.deps.nudgeService?.getConfigs() ?? [];
		this.renderNudgeList(section, configs);
		this.renderAddForm(section);
	}

	private renderNudgeList(parent: HTMLElement, configs: NudgeConfig[]): void {
		if (configs.length === 0) {
			parent.createEl("p", {
				text: "No nudges configured yet.",
				cls: "ft-text-sm ft-text-muted",
			}).style.marginTop = "0.5rem";
			return;
		}

		for (const config of configs) {
			const row = parent.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
			row.style.padding = "0.35rem 0";
			row.style.borderBottom = "1px solid var(--background-modifier-border)";

			// Enable toggle
			const toggle = row.createEl("input");
			toggle.type = "checkbox";
			toggle.checked = config.enabled;
			toggle.title = config.enabled ? "Disable" : "Enable";
			toggle.addEventListener("change", () => {
				void this.deps.eventBus.emit("nudge.configure", {
					config: { ...config, enabled: toggle.checked },
				});
				setTimeout(() => this.deps.scheduleRender(), 50);
			});

			// Info
			const info = row.createDiv();
			info.style.flex = "1";
			const titleRow = info.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
			titleRow.createSpan({ text: config.title, cls: "ft-text-sm" });
			titleRow.createSpan({
				text: config.time,
				cls: "ft-badge ft-badge-muted ft-text-sm",
			});

			const meta = info.createDiv({ cls: "ft-text-sm ft-text-muted" });
			const typeLabel = SESSION_TYPE_LABELS[config.sessionType] ?? config.sessionType;
			const durLabel = config.durationMinutes > 0 ? ` · ${config.durationMinutes} min` : "";
			meta.setText(`${typeLabel}${durLabel}`);

			// Delete button
			const delBtn = row.createEl("button", { cls: "ft-btn-icon" });
			setIcon(delBtn, "x");
			delBtn.title = "Remove nudge";
			delBtn.addEventListener("click", () => {
				void this.deps.eventBus.emit("nudge.remove", { id: config.id });
				setTimeout(() => this.deps.scheduleRender(), 50);
			});
		}
	}

	private renderAddForm(parent: HTMLElement): void {
		const form = parent.createDiv();
		form.style.marginTop = "0.75rem";
		form.style.borderTop = "1px solid var(--background-modifier-border)";
		form.style.paddingTop = "0.75rem";

		let title = "";
		let time = "09:00";
		let sessionType = "documentation";
		let durationMinutes = "25";

		const makeRow = (label: string): HTMLElement => {
			const row = form.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
			row.style.marginTop = "0.5rem";
			const lbl = row.createSpan({ text: label, cls: "ft-text-sm" });
			lbl.style.minWidth = "120px";
			return row;
		};

		// Title
		const titleRow = makeRow("Title");
		const titleInput = titleRow.createEl("input", { cls: "ft-input" });
		titleInput.type = "text";
		titleInput.placeholder = "e.g. Morning Review";
		titleInput.style.flex = "1";
		titleInput.addEventListener("input", () => { title = titleInput.value; });

		// Time
		const timeRow = makeRow("Time (HH:MM)");
		const timeInput = timeRow.createEl("input", { cls: "ft-input" });
		timeInput.type = "text";
		timeInput.value = "09:00";
		timeInput.placeholder = "09:00";
		timeInput.style.width = "80px";
		timeInput.addEventListener("input", () => { time = timeInput.value; });

		// Session type
		const typeRow = makeRow("Session type");
		const typeSelect = typeRow.createEl("select", { cls: "ft-input dropdown" });
		for (const st of SESSION_TYPES) {
			const opt = typeSelect.createEl("option", { text: st.label });
			opt.value = st.type;
			if (st.type === "documentation") opt.selected = true;
		}
		typeSelect.addEventListener("change", () => { sessionType = typeSelect.value; });

		// Duration
		const durRow = makeRow("Duration (min)");
		const durInput = durRow.createEl("input", { cls: "ft-input" });
		durInput.type = "text";
		durInput.value = "25";
		durInput.style.width = "60px";
		durInput.addEventListener("input", () => { durationMinutes = durInput.value; });

		// Add button
		const btnRow = form.createDiv();
		btnRow.style.marginTop = "0.5rem";
		const addBtn = btnRow.createEl("button", { text: "Add Nudge", cls: "mod-cta" });
		addBtn.addEventListener("click", () => {
			const t = title.trim();
			if (!t) return;
			if (!/^\d{2}:\d{2}$/.test(time)) return;
			const dur = parseInt(durationMinutes, 10) || 0;
			const id = `custom-${Date.now()}`;
			void this.deps.eventBus.emit("nudge.configure", {
				config: {
					id,
					time,
					sessionType: sessionType as NudgeConfig["sessionType"],
					title: t,
					durationMinutes: dur,
					enabled: true,
				},
			});
			setTimeout(() => this.deps.scheduleRender(), 50);
		});
	}
}
