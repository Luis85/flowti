/**
 * SetupForm — metadata collection form for the Journey Builder sidebar.
 *
 * Renders journey name, description, and start event inputs.
 * Manages event suggest lifecycle via destroy().
 */
import { toEventName, isEventNameConverted } from "../../domain/journeyBuilder/eventNameUtils";
import type { EventSuggestItem } from "./EventSuggestTypes";
import { attachEventSuggest } from "./EventSuggest";
import { renderActionButton } from "./sidebarHelpers";
import type { JourneyMetadata } from "./JourneyBuilderSidebar";

export interface SetupFormDeps {
	metadata: JourneyMetadata;
	onFieldChanged: (field: string, value: string) => void;
	onContinue: () => void;
	getEventCatalog?: () => EventSuggestItem[];
}

export class SetupForm {
	private suggestCleanups: (() => void)[] = [];

	constructor(
		private readonly container: HTMLElement,
		private readonly deps: SetupFormDeps,
	) {}

	render(): void {
		const { metadata, onFieldChanged, onContinue, getEventCatalog } = this.deps;

		// Form container
		const form = this.container.createDiv({ cls: "ft-jb-setup-form" });
		form.dataset.testId = "jb-setup-form";

		// Journey name
		const nameGroup = form.createDiv({ cls: "ft-jb-form-group" });
		nameGroup.createEl("label", { cls: "ft-jb-form-label", text: "Journey name" });
		const nameInput = nameGroup.createEl("input", { cls: "ft-jb-form-input", type: "text" });
		nameInput.dataset.testId = "jb-name-input";
		nameInput.placeholder = "e.g. Getting started"; // eslint-disable-line obsidianmd/ui/sentence-case
		nameInput.value = metadata.name;
		nameInput.addEventListener("input", () => {
			metadata.name = nameInput.value;
			onFieldChanged("name", nameInput.value);
		});

		// Description
		const descGroup = form.createDiv({ cls: "ft-jb-form-group" });
		descGroup.createEl("label", { cls: "ft-jb-form-label", text: "Description" });
		const descInput = descGroup.createEl("textarea", { cls: "ft-jb-form-textarea" });
		descInput.dataset.testId = "jb-description-input";
		descInput.placeholder = "What does this journey test?";
		descInput.value = metadata.description;
		descInput.rows = 5;
		descInput.addEventListener("input", () => {
			metadata.description = descInput.value;
			onFieldChanged("description", descInput.value);
		});

		// Start event
		const startGroup = form.createDiv({ cls: "ft-jb-form-group" });
		startGroup.createEl("label", { cls: "ft-jb-form-label", text: "Start event" });
		const startInput = startGroup.createEl("input", { cls: "ft-jb-form-input", type: "text" });
		startInput.dataset.testId = "jb-start-event-input";
		startInput.placeholder = "e.g. Session started or session.started"; // eslint-disable-line obsidianmd/ui/sentence-case
		startInput.value = metadata.startEvent;
		const startPreview = startGroup.createSpan({ cls: "ft-jb-event-preview" });
		startPreview.dataset.testId = "jb-start-event-preview";
		startInput.addEventListener("input", () => {
			const converted = toEventName(startInput.value);
			metadata.startEvent = converted;
			startPreview.textContent = isEventNameConverted(startInput.value, converted)
				? `\u2192 ${converted}`
				: "";
			onFieldChanged("startEvent", converted);
		});

		// Event autocomplete on start event
		if (getEventCatalog) {
			const unsub = attachEventSuggest(startInput, getEventCatalog, (value) => {
				metadata.startEvent = value;
				onFieldChanged("startEvent", value);
			});
			this.suggestCleanups.push(unsub);
		}

		// End event
		const endGroup = form.createDiv({ cls: "ft-jb-form-group" });
		endGroup.createEl("label", { cls: "ft-jb-form-label", text: "End event" });
		const endInput = endGroup.createEl("input", { cls: "ft-jb-form-input", type: "text" });
		endInput.dataset.testId = "jb-end-event-input";
		endInput.placeholder = "e.g. Hub tab changed or hub.tab.changed"; // eslint-disable-line obsidianmd/ui/sentence-case
		endInput.value = metadata.endEvent;
		const endPreview = endGroup.createSpan({ cls: "ft-jb-event-preview" });
		endPreview.dataset.testId = "jb-end-event-preview";
		endInput.addEventListener("input", () => {
			const converted = toEventName(endInput.value);
			metadata.endEvent = converted;
			endPreview.textContent = isEventNameConverted(endInput.value, converted)
				? `\u2192 ${converted}`
				: "";
			onFieldChanged("endEvent", converted);
		});

		// Event autocomplete on end event
		if (getEventCatalog) {
			const unsub = attachEventSuggest(endInput, getEventCatalog, (value) => {
				metadata.endEvent = value;
				onFieldChanged("endEvent", value);
			});
			this.suggestCleanups.push(unsub);
		}

		// Continue button
		renderActionButton(this.container, {
			testId: "jb-continue-btn",
			cls: "ft-jb-continue-btn",
			icon: "arrow-right",
			text: "Continue",
			onClick: onContinue,
		});
	}

	destroy(): void {
		for (const cleanup of this.suggestCleanups) cleanup();
		this.suggestCleanups = [];
	}
}
