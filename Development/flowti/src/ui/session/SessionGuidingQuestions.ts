import { setIcon } from "obsidian";
import type { SessionPanelDeps } from "./types";
import type { SessionTypeConfig } from "../../domain/session/types";
import { resolveTypeConfig } from "../../domain/session/helpers";

/**
 * Renders guiding questions for the current session type.
 * Shown during active/paused sessions to keep the user focused.
 */
export class SessionGuidingQuestions {
	private container: HTMLElement;
	private deps: SessionPanelDeps;
	private customConfigs?: Record<string, SessionTypeConfig>;

	constructor(container: HTMLElement, deps: SessionPanelDeps, customConfigs?: Record<string, SessionTypeConfig>) {
		this.container = container;
		this.deps = deps;
		this.customConfigs = customConfigs;
	}

	render(): void {
		const session = this.deps.getSession();
		const config = resolveTypeConfig(session.type, this.customConfigs);
		const questions = config.guidingQuestions;
		if (questions.length === 0) return;

		const section = this.container.createDiv({ cls: "ft-session-workspace-guiding ft-section" });

		const headerRow = section.createDiv({ cls: "ft-panel-label-row ft-mb-sm" });

		const iconEl = headerRow.createSpan();
		setIcon(iconEl, "help-circle");

		headerRow.createEl("strong", { text: "Guiding questions" });

		const list = section.createEl("ul", { cls: "ft-guiding-list" });

		for (const q of questions) {
			list.createEl("li", { text: q, cls: "ft-guiding-item" });
		}
	}
}
