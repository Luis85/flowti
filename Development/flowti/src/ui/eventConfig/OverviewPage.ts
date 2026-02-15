/**
 * Overview page for the EventConfigModal.
 *
 * Renders: event info card, subscriptions list, definitions list.
 */

import { Setting, setIcon } from "obsidian";
import { renderSubscriptionRow } from "../catalog/helpers";
import type { EventConfigPageDeps } from "./types";

export function renderOverviewPage(container: HTMLElement, deps: EventConfigPageDeps): void {
	// ── Event info card ──────────────────────────────────
	const info = container.createDiv({ cls: "ft-card ft-p-3 ft-mb-2" });

	const topRow = info.createDiv({ cls: "ft-flex ft-items-center ft-justify-between" });
	topRow.createDiv({ text: deps.entry.category, cls: "ft-text-muted ft-text-sm" });
	topRow.createDiv({ text: deps.entry.direction, cls: "ft-text-muted ft-text-sm" });

	info.createDiv({ text: deps.entry.description, cls: "ft-text-sm ft-mt-1" });

	const meta = info.createDiv({ cls: "ft-flex ft-gap-2 ft-mt-1 ft-flex-wrap" });
	if (deps.entry.stability) {
		meta.createSpan({ text: deps.entry.stability, cls: "ft-badge ft-badge-muted" });
	}
	meta.createSpan({ text: deps.entry.domain, cls: "ft-badge ft-badge-muted" });
	meta.createSpan({ text: deps.entry.visibility, cls: "ft-badge ft-badge-muted" });
	meta.createSpan({ text: deps.entry.services, cls: "ft-badge ft-badge-muted" });

	// "Open Event Doc" button
	const docRow = info.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mt-2" });
	const docBtn = docRow.createEl("button", {
		cls: "ft-btn ft-btn-secondary",
	});
	const docIcon = docBtn.createSpan();
	setIcon(docIcon, "file-text");
	docBtn.appendText(" Open Event Doc");
	docBtn.addEventListener("click", () => {
		deps.onOpenEventDoc();
	});
	docRow.createSpan({
		text: "View or create the documentation note for this event",
		cls: "ft-text-muted ft-text-sm",
	});

	// ── Subscriptions section ──────────────────────────────
	const subHeader = container.createDiv({
		cls: "ft-flex ft-items-center ft-justify-between ft-mt-4 ft-mb-1",
	});
	const subTitle = subHeader.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
	subTitle.createEl("h4", { text: "Watchers", cls: "ft-heading ft-heading-sm" });
	subTitle.createSpan({
		text: String(deps.subscriptions.length),
		cls: "ft-badge ft-badge-muted",
	});

	const addSubBtn = subHeader.createEl("button", {
		text: "Add watcher",
		cls: "ft-btn ft-btn-primary",
	});
	addSubBtn.addEventListener("click", () => {
		deps.onNavigateToPage("subscription-form");
	});

	container.createEl("p", {
		text: "Watchers monitor this event and filter matching files for processing. Each filter narrows the match \u2014 all specified filters must match (AND logic).",
		cls: "ft-text-muted ft-text-sm ft-mb-1",
	});

	if (deps.subscriptions.length === 0) {
		container.createDiv({
			text: "No watchers for this event.",
			cls: "ft-text-muted ft-text-sm ft-p-2",
		});
	} else {
		for (const sub of deps.subscriptions) {
			renderSubscriptionRow(container, sub, {
				showEventType: false,
				eventBus: deps.eventBus,
				onEdit: () => {
					deps.onEditSubscription(sub.id, {
						eventType: deps.entry.type,
						label: sub.label ?? "",
						pathPattern: sub.filters.pathPattern ?? "",
						extension: sub.filters.extension ?? "",
						namePattern: sub.filters.namePattern ?? "",
					});
				},
				onDelete: () => {
					deps.onDeleteSubscription(sub.id, sub.label || sub.eventType);
				},
			});
		}
	}

	// ── Event Definitions section ──────────────────────────
	const defHeader = container.createDiv({
		cls: "ft-flex ft-items-center ft-justify-between ft-mt-4 ft-mb-1",
	});
	const defTitle = defHeader.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
	defTitle.createEl("h4", { text: "Transforms", cls: "ft-heading ft-heading-sm" });
	defTitle.createSpan({
		text: String(deps.definitions.length),
		cls: "ft-badge ft-badge-muted",
	});

	const addDefBtn = defHeader.createEl("button", {
		text: "Add transform",
		cls: "ft-btn ft-btn-primary",
	});
	addDefBtn.addEventListener("click", () => {
		deps.onNavigateToPage("definition-form");
	});

	container.createEl("p", {
		text: "Transforms convert this event into new output events. When the event fires and the file matches, a new output event is emitted with extracted data fields.",
		cls: "ft-text-muted ft-text-sm ft-mb-1",
	});

	if (deps.definitions.length === 0) {
		container.createDiv({
			text: "No transforms for this event.",
			cls: "ft-text-muted ft-text-sm ft-p-2",
		});
	} else {
		for (const def of deps.definitions) {
			renderDefinitionRow(container, def, deps);
		}
	}
}

// ─────────────────────────────────────────────────────────────
// Definition row (used only by overview)
// ─────────────────────────────────────────────────────────────

function renderDefinitionRow(
	container: HTMLElement,
	def: import("../../domain/eventDefinition/types").EventDefinition,
	deps: EventConfigPageDeps,
): void {
	const setting = new Setting(container);

	const desc = [
		def.filePattern ? `pattern: ${def.filePattern}` : "all files",
		`policy: ${def.emissionPolicy}`,
	].join(", ");

	setting.setName(def.domainEventName);
	setting.setDesc(desc);

	setting.addToggle((toggle) => {
		toggle.setValue(def.enabled);
		toggle.onChange((value) => {
			void deps.eventBus.emit("eventDefinition.update", {
				definitionId: def.id,
				enabled: value,
			});
		});
	});

	setting.addExtraButton((btn) => {
		btn.setIcon("pencil");
		btn.setTooltip("Edit");
		btn.onClick(() => {
			deps.onEditDefinition(def.id, {
				domainEventName: def.domainEventName,
				filePattern: def.filePattern ?? "",
				emissionPolicy: def.emissionPolicy,
				payloadMappings: def.payloadMappings.map((m) => ({ ...m })),
			});
		});
	});

	setting.addExtraButton((btn) => {
		btn.setIcon("trash-2");
		btn.setTooltip("Delete");
		btn.onClick(() => {
			deps.onDeleteDefinition(def.id, def.domainEventName);
		});
	});
}
