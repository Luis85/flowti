/**
 * Definition form page for the EventConfigModal.
 *
 * Renders the form for creating/editing event definitions (transforms),
 * including the payload mapping repeater.
 */

import { Notice, Setting } from "obsidian";
import type { PayloadMapping, EmissionPolicy } from "../../domain/eventDefinition/types";
import type { EventConfigPageDeps } from "./types";

export function renderDefinitionFormPage(container: HTMLElement, deps: EventConfigPageDeps): void {
	const isEdit = deps.editingDefinitionId !== null;

	container.createEl("h3", {
		text: isEdit ? "Edit transform" : "New transform",
	});

	container.createEl("p", {
		text: "A transform converts a raw file event into a meaningful output event. When the source event fires and the file matches, Flowti emits your output event with extracted data fields.",
		cls: "ft-text-muted ft-text-sm ft-mb-2",
	});

	new Setting(container)
		.setName("Source event type")
		.setDesc("The event that triggers this definition")
		.addText((text) => {
			text.setValue(deps.entry.type);
			text.setDisabled(true);
		});

	new Setting(container)
		.setName("Output event name")
		.setDesc("The name of the output event to emit when matched. Use dot notation to namespace, such as report.daily_received. This becomes a new event type in the system.")
		.addText((text) => {
			text.setPlaceholder("Report.daily_received");
			text.setValue(deps.defFormData.domainEventName);
			text.onChange((value) => {
				deps.defFormData.domainEventName = value;
			});
		});

	new Setting(container)
		.setName("File pattern")
		.setDesc("Glob pattern to filter which files trigger this transform. Only files whose vault path matches will emit the output event. Use ** for any depth. Leave empty to match all files.")
		.addText((text) => {
			text.setPlaceholder("Reports/**/*.csv");
			text.setValue(deps.defFormData.filePattern);
			text.onChange((value) => {
				deps.defFormData.filePattern = value;
			});
		});

	new Setting(container)
		.setName("Trigger mode")
		.setDesc("\"always\" emits every time the source event fires for a matching file. \"once per file\" deduplicates by file path \u2014 each unique file only triggers the output event once (useful for one-time processing).")
		.addDropdown((dd) => {
			dd.addOption("always", "Always");
			dd.addOption("once", "Once per file");
			dd.setValue(deps.defFormData.emissionPolicy);
			dd.onChange((value) => {
				deps.defFormData.emissionPolicy = value as EmissionPolicy;
			});
		});

	// ── Payload mappings ───────────────────────────────────
	container.createEl("h4", {
		text: "Data fields",
		cls: "ft-heading ft-heading-sm ft-mt-4",
	});
	container.createEl("p", {
		text: "Define which data fields to extract and include in the emitted output event.",
		cls: "ft-text-muted ft-text-sm ft-mb-1",
	});
	const sourceRef = container.createDiv({ cls: "ft-text-muted ft-text-sm ft-mb-2" });
	sourceRef.createEl("strong", { text: "Source types: " });
	sourceRef.appendText("Path \u2014 extract from the file path using a regex capture group. ");
	sourceRef.createEl("strong", { text: "Metadata" });
	sourceRef.appendText(" \u2014 read a frontmatter field by key. ");
	sourceRef.createEl("strong", { text: "Derived" });
	sourceRef.appendText(" \u2014 use a built-in value like extension or basename.");

	const mappingsContainer = container.createDiv({ cls: "ft-flex ft-flex-col ft-gap-2" });

	for (let i = 0; i < deps.defFormData.payloadMappings.length; i++) {
		renderMappingRow(mappingsContainer, deps.defFormData.payloadMappings, i, deps.onRender);
	}

	const addMappingBtn = container.createEl("button", {
		text: "Add field",
		cls: "ft-btn ft-btn-secondary ft-mt-1",
	});
	addMappingBtn.addEventListener("click", () => {
		deps.defFormData.payloadMappings.push({
			field: "",
			source: "metadata",
			expression: "",
		});
		deps.onRender();
	});

	// ── Action buttons ─────────────────────────────────────
	const btnRow = container.createDiv({ cls: "ft-flex ft-gap-2 ft-mt-4" });

	const cancelBtn = btnRow.createEl("button", {
		text: "Cancel",
		cls: "ft-btn ft-btn-ghost",
	});
	cancelBtn.addEventListener("click", () => {
		deps.onNavigateToPage("overview");
	});

	const saveBtn = btnRow.createEl("button", {
		text: isEdit ? "Save" : "Create",
		cls: "ft-btn ft-btn-primary",
	});
	saveBtn.addEventListener("click", () => {
		if (!deps.defFormData.domainEventName.trim()) return;

		// Filter out empty mappings
		const mappings = deps.defFormData.payloadMappings.filter(
			(m) => m.field.trim() && m.expression.trim()
		);

		const promise = isEdit && deps.editingDefinitionId
			? deps.eventBus.emit("eventDefinition.update", {
					definitionId: deps.editingDefinitionId,
					domainEventName: deps.defFormData.domainEventName.trim(),
					filePattern: deps.defFormData.filePattern || undefined,
					emissionPolicy: deps.defFormData.emissionPolicy,
					payloadMappings: mappings,
				})
			: deps.eventBus.emit("eventDefinition.create", {
					sourceEventType: deps.entry.type,
					domainEventName: deps.defFormData.domainEventName.trim(),
					filePattern: deps.defFormData.filePattern || undefined,
					emissionPolicy: deps.defFormData.emissionPolicy,
					payloadMappings: mappings,
				});

		promise.catch((err: unknown) => {
			console.error("[Flowti] Transform save failed:", err);
			new Notice("Transform save failed — check console for details");
		});
	});
}

// ─────────────────────────────────────────────────────────────
// Payload mapping row
// ─────────────────────────────────────────────────────────────

function renderMappingRow(
	container: HTMLElement,
	mappings: PayloadMapping[],
	index: number,
	onRender: () => void,
): void {
	const mapping = mappings[index];
	const row = container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });

	// Field name
	const fieldInput = row.createEl("input", { cls: "ft-input" });
	fieldInput.type = "text";
	fieldInput.placeholder = "Output field";
	fieldInput.value = mapping.field;
	fieldInput.addClass("ft-flex-1");
	fieldInput.addEventListener("input", () => {
		mapping.field = fieldInput.value;
	});

	// Source dropdown (native select for simplicity in a row layout)
	const sourceSelect = row.createEl("select", { cls: "dropdown" });
	for (const opt of [
		{ value: "path", label: "Path (regex)" },
		{ value: "metadata", label: "Metadata" },
		{ value: "derived", label: "Derived" },
	]) {
		const option = sourceSelect.createEl("option", { text: opt.label });
		option.value = opt.value;
		if (opt.value === mapping.source) option.selected = true;
	}
	sourceSelect.addEventListener("change", () => {
		mapping.source = sourceSelect.value as PayloadMapping["source"];
	});

	// Expression
	const exprInput = row.createEl("input", { cls: "ft-input" });
	exprInput.type = "text";
	exprInput.placeholder = "Key, regex, or derivation";
	exprInput.value = mapping.expression;
	exprInput.addClass("ft-flex-1");
	exprInput.addEventListener("input", () => {
		mapping.expression = exprInput.value;
	});

	// Remove button
	const removeBtn = row.createEl("button", {
		text: "\u00d7",
		cls: "ft-btn ft-btn-ghost",
	});
	removeBtn.addEventListener("click", () => {
		mappings.splice(index, 1);
		onRender();
	});
}
