/**
 * Train preferences detail panel for the User Hub.
 *
 * Renders settings for Train of Thought:
 * - Train folder path
 * - Default duration (minutes, 0 = unlimited)
 * - Max thoughts per train
 * - Auto-open timeline sidebar
 */

import { setIcon } from "obsidian";
import type { UserHubComponentDeps } from "./types";
import { attachFolderSuggest } from "../FolderSuggest";

export class UserHubTrainPreferences {
	constructor(
		private container: HTMLElement,
		private deps: UserHubComponentDeps,
	) {}

	render(): void {
		this.container.empty();

		const section = this.container.createDiv({ cls: "ft-detail-section" });
		const header = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const icon = header.createSpan();
		setIcon(icon, "train-front");
		icon.addClass("ft-icon-muted");
		header.createEl("h3", { text: "Train of thought", cls: "ft-heading ft-heading-sm ft-m-0" });

		section.createEl("p", {
			text: "Configure defaults for train of thought capture sessions.",
			cls: "ft-text-sm ft-text-muted",
		});

		const settings = this.deps.getSettings();

		// ── Train folder ──
		const folderRow = this.makeRow(section, "Folder");
		const folderInput = folderRow.createEl("input", { cls: "ft-input ft-flex-1" });
		folderInput.type = "text";
		folderInput.value = settings.trainFolder;
		// eslint-disable-next-line obsidianmd/ui/sentence-case
	folderInput.placeholder = "00 - Connectivity/trains";
		attachFolderSuggest(folderInput, this.deps.app, (selected) => {
			const path = selected.replace(/\/$/, "");
			folderInput.value = path;
			void this.deps.eventBus.emit("settings.updateTrainFolder", { folder: path });
		});
		folderInput.addEventListener("change", () => {
			void this.deps.eventBus.emit("settings.updateTrainFolder", { folder: folderInput.value.trim() });
		});

		// ── Default duration ──
		const durRow = this.makeRow(section, "Duration (min)");
		const durInput = durRow.createEl("input", { cls: "ft-input" });
		durInput.type = "number";
		durInput.min = "0";
		durInput.max = "120";
		durInput.value = String(settings.defaultTrainDuration);
		durInput.addClass("ft-input-width-80");
		durRow.createSpan({ text: "0 = unlimited", cls: "ft-text-sm ft-text-muted" });
		durInput.addEventListener("change", () => {
			const value = parseInt(durInput.value, 10) || 0;
			void this.deps.eventBus.emit("settings.updateDefaultTrainDuration", { value });
		});

		// ── Max thoughts ──
		const maxRow = this.makeRow(section, "Max thoughts");
		const maxInput = maxRow.createEl("input", { cls: "ft-input" });
		maxInput.type = "number";
		maxInput.min = "1";
		maxInput.max = "1000";
		maxInput.value = String(settings.trainMaxThoughts);
		maxInput.addClass("ft-input-width-80");
		maxInput.addEventListener("change", () => {
			const num = parseInt(maxInput.value, 10);
			if (num >= 1 && num <= 1000) {
				void this.deps.eventBus.emit("settings.updateTrainMaxThoughts", { max: num });
			}
		});

		// ── Auto-open timeline ──
		const timelineRow = this.makeRow(section, "Auto-open timeline");
		const timelineToggle = timelineRow.createEl("input");
		timelineToggle.type = "checkbox";
		timelineToggle.checked = settings.trainAutoOpenTimeline;
		timelineRow.createSpan({ text: "Open sidebar when a train starts", cls: "ft-text-sm ft-text-muted" });
		timelineToggle.addEventListener("change", () => {
			void this.deps.eventBus.emit("settings.updateTrainAutoOpenTimeline", { enabled: timelineToggle.checked });
		});
	}

	private makeRow(parent: HTMLElement, label: string): HTMLElement {
		const row = parent.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-pref-form-row" });
		row.createSpan({ text: label, cls: "ft-text-sm ft-pref-label" });
		return row;
	}
}
