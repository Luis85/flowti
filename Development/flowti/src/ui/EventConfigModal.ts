/**
 * Per-event configuration modal — the central hub for managing
 * subscriptions and event definitions for a specific event type.
 * Opened from the Event Catalog by clicking an event type name
 * or the configure icon.
 *
 * Three pages: overview (default), subscription-form, definition-form.
 */

import { App, Modal, Notice, Setting, setIcon } from "obsidian";
import type { IEventBus } from "../infrastructure/events/types";
import type { EventCatalogEntry } from "../infrastructure/events/catalog";
import type { Subscription } from "../domain/subscription/types";
import type {
	EventDefinition,
	PayloadMapping,
	EmissionPolicy,
} from "../domain/eventDefinition/types";
import { ConfirmModal } from "./modals";
import {
	openOrCreateEventDoc,
	renderSubscriptionForm,
	renderSubscriptionRow,
	type SubscriptionFormData,
} from "./catalog/helpers";

type Page = "overview" | "subscription-form" | "definition-form";

interface DefinitionFormData {
	domainEventName: string;
	filePattern: string;
	emissionPolicy: EmissionPolicy;
	payloadMappings: PayloadMapping[];
}

export class EventConfigModal extends Modal {
	private eventBus: IEventBus;
	private entry: EventCatalogEntry;
	private eventsFolder: string;
	private unsubscribes: (() => void)[] = [];

	private subscriptions: Subscription[] = [];
	private definitions: EventDefinition[] = [];

	private page: Page = "overview";
	private editingSubscriptionId: string | null = null;
	private editingDefinitionId: string | null = null;
	private subFormData: SubscriptionFormData = this.emptySubForm();
	private defFormData: DefinitionFormData = this.emptyDefForm();

	constructor(app: App, eventBus: IEventBus, entry: EventCatalogEntry, eventsFolder: string) {
		super(app);
		this.eventBus = eventBus;
		this.entry = entry;
		this.eventsFolder = eventsFolder;
	}

	async onOpen(): Promise<void> {
		this.modalEl.addClass("flowti-event-config-modal");
		this.titleEl.setText(this.entry.type);

		// ── Subscription state sync ────────────────────────────
		this.unsubscribes.push(
			this.eventBus.on("subscription.loaded", (event) => {
				this.subscriptions = event.payload.subscriptions.filter(
					(s) => s.eventType === this.entry.type
				);
				if (this.page === "overview") this.render();
			})
		);
		this.unsubscribes.push(
			this.eventBus.on("subscription.created", (event) => {
				if (event.payload.subscription.eventType === this.entry.type) {
					this.subscriptions = [
						...this.subscriptions.filter(
							(s) => s.id !== event.payload.subscription.id
						),
						event.payload.subscription,
					];
				}
				this.page = "overview";
				this.render();
			})
		);
		this.unsubscribes.push(
			this.eventBus.on("subscription.updated", (event) => {
				if (event.payload.subscription.eventType === this.entry.type) {
					this.subscriptions = this.subscriptions.map((s) =>
						s.id === event.payload.subscription.id
							? event.payload.subscription
							: s
					);
				}
				this.page = "overview";
				this.render();
			})
		);
		this.unsubscribes.push(
			this.eventBus.on("subscription.deleted", (event) => {
				this.subscriptions = this.subscriptions.filter(
					(s) => s.id !== event.payload.subscriptionId
				);
				this.render();
			})
		);

		// ── Event definition state sync ────────────────────────
		this.unsubscribes.push(
			this.eventBus.on("eventDefinition.loaded", (event) => {
				this.definitions = event.payload.definitions.filter(
					(d) => d.sourceEventType === this.entry.type
				);
				if (this.page === "overview") this.render();
			})
		);
		this.unsubscribes.push(
			this.eventBus.on("eventDefinition.created", (event) => {
				if (event.payload.definition.sourceEventType === this.entry.type) {
					this.definitions = [
						...this.definitions.filter(
							(d) => d.id !== event.payload.definition.id
						),
						event.payload.definition,
					];
				}
				this.page = "overview";
				this.render();
			})
		);
		this.unsubscribes.push(
			this.eventBus.on("eventDefinition.updated", (event) => {
				if (event.payload.definition.sourceEventType === this.entry.type) {
					this.definitions = this.definitions.map((d) =>
						d.id === event.payload.definition.id
							? event.payload.definition
							: d
					);
				}
				this.page = "overview";
				this.render();
			})
		);
		this.unsubscribes.push(
			this.eventBus.on("eventDefinition.deleted", (event) => {
				this.definitions = this.definitions.filter(
					(d) => d.id !== event.payload.definitionId
				);
				this.render();
			})
		);

		// Request current state
		await this.eventBus.emit("subscription.refresh", {});
		await this.eventBus.emit("eventDefinition.refresh", {});

		this.render();
	}

	onClose(): void {
		for (const unsub of this.unsubscribes) {
			unsub();
		}
		this.unsubscribes = [];
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();

		switch (this.page) {
			case "subscription-form":
				renderSubscriptionForm(contentEl, {
					isEdit: this.editingSubscriptionId !== null,
					eventTypeLocked: true,
					formData: this.subFormData,
					onSave: () => this.saveSubscription(),
					onCancel: () => { this.page = "overview"; this.render(); },
				});
				break;
			case "definition-form":
				this.renderDefinitionForm(contentEl);
				break;
			default:
				this.renderOverview(contentEl);
				break;
		}
	}

	// ─────────────────────────────────────────────────────────────
	// Overview page
	// ─────────────────────────────────────────────────────────────

	private renderOverview(container: HTMLElement): void {
		// ── Event info card ──────────────────────────────────
		const info = container.createDiv({ cls: "ft-card ft-p-3 ft-mb-2" });

		const topRow = info.createDiv({ cls: "ft-flex ft-items-center ft-justify-between" });
		topRow.createDiv({ text: this.entry.category, cls: "ft-text-muted ft-text-sm" });
		topRow.createDiv({ text: this.entry.direction, cls: "ft-text-muted ft-text-sm" });

		info.createDiv({ text: this.entry.description, cls: "ft-text-sm ft-mt-1" });

		const meta = info.createDiv({ cls: "ft-flex ft-gap-2 ft-mt-1 ft-flex-wrap" });
		if (this.entry.stability) {
			meta.createSpan({ text: this.entry.stability, cls: "ft-badge ft-badge-muted" });
		}
		meta.createSpan({ text: this.entry.domain, cls: "ft-badge ft-badge-muted" });
		meta.createSpan({ text: this.entry.visibility, cls: "ft-badge ft-badge-muted" });
		meta.createSpan({ text: this.entry.services, cls: "ft-badge ft-badge-muted" });

		// "Open Event Doc" button
		const docRow = info.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mt-2" });
		const docBtn = docRow.createEl("button", {
			cls: "ft-btn ft-btn-secondary",
		});
		const docIcon = docBtn.createSpan();
		setIcon(docIcon, "file-text");
		docBtn.appendText(" Open Event Doc");
		docBtn.addEventListener("click", () => {
			void this.openEventDoc();
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
			text: String(this.subscriptions.length),
			cls: "ft-badge ft-badge-muted",
		});

		const addSubBtn = subHeader.createEl("button", {
			text: "Add watcher",
			cls: "ft-btn ft-btn-primary",
		});
		addSubBtn.addEventListener("click", () => {
			this.editingSubscriptionId = null;
			this.subFormData = this.emptySubForm();
			this.subFormData.eventType = this.entry.type;
			this.page = "subscription-form";
			this.render();
		});

		container.createEl("p", {
			text: "Watchers monitor this event and filter matching files for processing. Each filter narrows the match \u2014 all specified filters must match (AND logic).",
			cls: "ft-text-muted ft-text-sm ft-mb-1",
		});

		if (this.subscriptions.length === 0) {
			container.createDiv({
				text: "No watchers for this event.",
				cls: "ft-text-muted ft-text-sm ft-p-2",
			});
		} else {
			for (const sub of this.subscriptions) {
				renderSubscriptionRow(container, sub, {
					showEventType: false,
					eventBus: this.eventBus,
					onEdit: () => {
						this.editingSubscriptionId = sub.id;
						this.subFormData = {
							eventType: this.entry.type,
							label: sub.label ?? "",
							pathPattern: sub.filters.pathPattern ?? "",
							extension: sub.filters.extension ?? "",
							namePattern: sub.filters.namePattern ?? "",
						};
						this.page = "subscription-form";
						this.render();
					},
					onDelete: () => {
						new ConfirmModal(this.app, {
							message: `Delete watcher "${sub.label || sub.eventType}"?`,
							confirmLabel: "Delete",
							onConfirm: () => {
								void this.eventBus.emit("subscription.remove", {
									subscriptionId: sub.id,
								});
							},
						}).open();
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
			text: String(this.definitions.length),
			cls: "ft-badge ft-badge-muted",
		});

		const addDefBtn = defHeader.createEl("button", {
			text: "Add transform",
			cls: "ft-btn ft-btn-primary",
		});
		addDefBtn.addEventListener("click", () => {
			this.editingDefinitionId = null;
			this.defFormData = this.emptyDefForm();
			this.page = "definition-form";
			this.render();
		});

		container.createEl("p", {
			text: "Transforms convert this event into new output events. When the event fires and the file matches, a new output event is emitted with extracted data fields.",
			cls: "ft-text-muted ft-text-sm ft-mb-1",
		});

		if (this.definitions.length === 0) {
			container.createDiv({
				text: "No transforms for this event.",
				cls: "ft-text-muted ft-text-sm ft-p-2",
			});
		} else {
			for (const def of this.definitions) {
				this.renderDefinitionRow(container, def);
			}
		}
	}

	private renderDefinitionRow(container: HTMLElement, def: EventDefinition): void {
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
				void this.eventBus.emit("eventDefinition.update", {
					definitionId: def.id,
					enabled: value,
				});
			});
		});

		setting.addExtraButton((btn) => {
			btn.setIcon("pencil");
			btn.setTooltip("Edit");
			btn.onClick(() => {
				this.editingDefinitionId = def.id;
				this.defFormData = {
					domainEventName: def.domainEventName,
					filePattern: def.filePattern ?? "",
					emissionPolicy: def.emissionPolicy,
					payloadMappings: def.payloadMappings.map((m) => ({ ...m })),
				};
				this.page = "definition-form";
				this.render();
			});
		});

		setting.addExtraButton((btn) => {
			btn.setIcon("trash-2");
			btn.setTooltip("Delete");
			btn.onClick(() => {
				new ConfirmModal(this.app, {
					message: `Delete transform "${def.domainEventName}"?`,
					confirmLabel: "Delete",
					onConfirm: () => {
						void this.eventBus.emit("eventDefinition.remove", {
							definitionId: def.id,
						});
					},
				}).open();
			});
		});
	}

	// ─────────────────────────────────────────────────────────────
	// Definition form
	// ─────────────────────────────────────────────────────────────

	private renderDefinitionForm(container: HTMLElement): void {
		const isEdit = this.editingDefinitionId !== null;

		container.createEl("h3", {
			text: isEdit ? "Edit Transform" : "New Transform",
		});

		container.createEl("p", {
			text: "A transform converts a raw file event into a meaningful output event. When the source event fires and the file matches, Flowti emits your output event with extracted data fields.",
			cls: "ft-text-muted ft-text-sm ft-mb-2",
		});

		new Setting(container)
			.setName("Source event type")
			.setDesc("The event that triggers this definition")
			.addText((text) => {
				text.setValue(this.entry.type);
				text.setDisabled(true);
			});

		new Setting(container)
			.setName("Output event name")
			.setDesc("The name of the output event to emit when matched. Use dot notation to namespace (e.g. report.daily_received). This becomes a new event type in the system.")
			.addText((text) => {
				text.setPlaceholder("report.daily_received");
				text.setValue(this.defFormData.domainEventName);
				text.onChange((value) => {
					this.defFormData.domainEventName = value;
				});
			});

		new Setting(container)
			.setName("File pattern")
			.setDesc("Glob pattern to filter which files trigger this transform. Only files whose vault path matches will emit the output event. Use ** for any depth. Leave empty to match all files.")
			.addText((text) => {
				text.setPlaceholder("Reports/**/*.csv");
				text.setValue(this.defFormData.filePattern);
				text.onChange((value) => {
					this.defFormData.filePattern = value;
				});
			});

		new Setting(container)
			.setName("Trigger mode")
			.setDesc("\"Always\" emits every time the source event fires for a matching file. \"Once per file\" deduplicates by file path \u2014 each unique file only triggers the output event once (useful for one-time processing).")
			.addDropdown((dd) => {
				dd.addOption("always", "Always");
				dd.addOption("once", "Once per file");
				dd.setValue(this.defFormData.emissionPolicy);
				dd.onChange((value) => {
					this.defFormData.emissionPolicy = value as EmissionPolicy;
				});
			});

		// ── Payload mappings ───────────────────────────────────
		container.createEl("h4", {
			text: "Data Fields",
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

		for (let i = 0; i < this.defFormData.payloadMappings.length; i++) {
			this.renderMappingRow(mappingsContainer, i);
		}

		const addMappingBtn = container.createEl("button", {
			text: "Add field",
			cls: "ft-btn ft-btn-secondary ft-mt-1",
		});
		addMappingBtn.addEventListener("click", () => {
			this.defFormData.payloadMappings.push({
				field: "",
				source: "metadata",
				expression: "",
			});
			this.render();
		});

		// ── Action buttons ─────────────────────────────────────
		const btnRow = container.createDiv({ cls: "ft-flex ft-gap-2 ft-mt-4" });

		const cancelBtn = btnRow.createEl("button", {
			text: "Cancel",
			cls: "ft-btn ft-btn-ghost",
		});
		cancelBtn.addEventListener("click", () => {
			this.page = "overview";
			this.render();
		});

		const saveBtn = btnRow.createEl("button", {
			text: isEdit ? "Save" : "Create",
			cls: "ft-btn ft-btn-primary",
		});
		saveBtn.addEventListener("click", () => {
			if (!this.defFormData.domainEventName.trim()) return;

			// Filter out empty mappings
			const mappings = this.defFormData.payloadMappings.filter(
				(m) => m.field.trim() && m.expression.trim()
			);

			const promise = isEdit && this.editingDefinitionId
				? this.eventBus.emit("eventDefinition.update", {
						definitionId: this.editingDefinitionId,
						domainEventName: this.defFormData.domainEventName.trim(),
						filePattern: this.defFormData.filePattern || undefined,
						emissionPolicy: this.defFormData.emissionPolicy,
						payloadMappings: mappings,
					})
				: this.eventBus.emit("eventDefinition.create", {
						sourceEventType: this.entry.type,
						domainEventName: this.defFormData.domainEventName.trim(),
						filePattern: this.defFormData.filePattern || undefined,
						emissionPolicy: this.defFormData.emissionPolicy,
						payloadMappings: mappings,
					});

			promise.catch((err: unknown) => {
				console.error("[Flowti] Transform save failed:", err);
				new Notice("Failed to save transform. Check console for details.", 5000);
			});
		});
	}

	private renderMappingRow(container: HTMLElement, index: number): void {
		const mapping = this.defFormData.payloadMappings[index];
		const row = container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });

		// Field name
		const fieldInput = row.createEl("input", { cls: "ft-input" });
		fieldInput.type = "text";
		fieldInput.placeholder = "output field";
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
		exprInput.placeholder = "key, regex, or derivation";
		exprInput.value = mapping.expression;
		exprInput.addClass("ft-flex-1");
		exprInput.addEventListener("input", () => {
			mapping.expression = exprInput.value;
		});

		// Remove button
		const removeBtn = row.createEl("button", {
			text: "×",
			cls: "ft-btn ft-btn-ghost",
		});
		removeBtn.addEventListener("click", () => {
			this.defFormData.payloadMappings.splice(index, 1);
			this.render();
		});
	}

	// ─────────────────────────────────────────────────────────────
	// Helpers
	// ─────────────────────────────────────────────────────────────

	private async openEventDoc(): Promise<void> {
		await openOrCreateEventDoc(this.app, this.eventBus, this.eventsFolder, this.entry);
	}

	private saveSubscription(): void {
		const isEdit = this.editingSubscriptionId !== null;
		const filters = {
			pathPattern: this.subFormData.pathPattern || undefined,
			extension: this.subFormData.extension || undefined,
			namePattern: this.subFormData.namePattern || undefined,
		};

		const promise = isEdit && this.editingSubscriptionId
			? this.eventBus.emit("subscription.update", {
					subscriptionId: this.editingSubscriptionId,
					label: this.subFormData.label || undefined,
					filters,
				})
			: this.eventBus.emit("subscription.create", {
					eventType: this.subFormData.eventType,
					label: this.subFormData.label || undefined,
					filters,
				});

		promise.catch((err: unknown) => {
			console.error("[Flowti] Watcher save failed:", err);
			new Notice("Failed to save watcher. Check console for details.", 5000);
		});
	}

	private emptySubForm(): SubscriptionFormData {
		return {
			eventType: "",
			label: "",
			pathPattern: "",
			extension: "",
			namePattern: "",
		};
	}

	private emptyDefForm(): DefinitionFormData {
		return {
			domainEventName: "",
			filePattern: "",
			emissionPolicy: "always",
			payloadMappings: [],
		};
	}
}
