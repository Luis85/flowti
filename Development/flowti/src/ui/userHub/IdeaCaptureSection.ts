/**
 * Idea Capture section for the User Hub dashboard.
 *
 * Renders a text input for quick idea capture and a list of
 * the most recent ideas from the inbox. Submitting creates
 * an inbox note with type: Idea, origin: user-hub.
 */

import { setIcon } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types";
import type { InboxService } from "../../domain/inbox/InboxService";

export interface IdeaCaptureDeps {
	eventBus: IEventBus;
	inboxService: InboxService;
	onCapture: (title: string) => void;
}

export class IdeaCaptureSection {
	constructor(
		private container: HTMLElement,
		private deps: IdeaCaptureDeps,
	) {}

	render(): void {
		const section = this.container.createDiv({ cls: "ft-idea-capture-section ft-dashboard-idea-capture" });

		// Header
		const header = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-2" });
		const icon = header.createSpan();
		setIcon(icon, "lightbulb");
		icon.addClass("ft-icon-muted");
		header.createEl("h3", { text: "Capture an idea", cls: "ft-heading ft-heading-sm ft-m-0" });

		// Input row
		const inputRow = section.createDiv({ cls: "ft-flex ft-gap-2 ft-items-center" });
		const input = inputRow.createEl("input", {
			type: "text",
			cls: "ft-idea-capture-input",
		});
		input.placeholder = "What's on your mind?";

		const submitBtn = inputRow.createEl("button", { cls: "ft-btn ft-btn-sm" });
		setIcon(submitBtn, "plus");
		submitBtn.appendText(" Add");

		const submit = (): void => {
			const title = input.value.trim();
			if (!title) return;
			this.deps.onCapture(title);
			input.value = "";
		};

		submitBtn.addEventListener("click", submit);
		input.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				submit();
			}
		});

		// Recent ideas
		this.renderRecentIdeas(section);
	}

	/** Compact inline variant for embedding in the KPI row (input + button only). */
	renderCompact(): void {
		const section = this.container.createDiv({ cls: "ft-idea-capture-compact" });

		const input = section.createEl("input", {
			type: "text",
			cls: "ft-idea-capture-input",
		});
		input.placeholder = "Capture idea\u2026";

		const submitBtn = section.createEl("button", { cls: "ft-btn ft-btn-sm" });
		setIcon(submitBtn, "plus");

		const submit = (): void => {
			const title = input.value.trim();
			if (!title) return;
			this.deps.onCapture(title);
			input.value = "";
		};

		submitBtn.addEventListener("click", submit);
		input.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				submit();
			}
		});
	}

	private renderRecentIdeas(container: HTMLElement): void {
		const items = this.deps.inboxService.getItems()
			.filter((i) => i.sourceEvent === "capture.idea.created")
			.slice(0, 5);

		if (items.length === 0) return;

		const list = container.createDiv({ cls: "ft-idea-capture-recent" });
		list.createDiv({ text: "Recent ideas", cls: "ft-text-sm ft-text-muted ft-mb-1" });

		for (const item of items) {
			const row = list.createDiv({ cls: "ft-flex ft-items-center ft-gap-1 ft-text-sm ft-idea-capture-item" });
			const rowIcon = row.createSpan({ cls: "ft-opacity-50" });
			setIcon(rowIcon, "lightbulb");
			row.createSpan({ text: item.title });
		}
	}
}
