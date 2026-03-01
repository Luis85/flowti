/**
 * Per-event configuration modal — the central hub for managing
 * subscriptions and event definitions for a specific event type.
 * Opened from the Event Catalog by clicking an event type name
 * or the configure icon.
 *
 * Three pages: overview (default), subscription-form, definition-form.
 * Page rendering is delegated to extracted components in eventConfig/.
 */

import { App, Modal, Notice } from "obsidian";
import { createVaultQueryService, createWorkspaceService } from "../../infrastructure/services/ObsidianAdapters";
import type { IEventBus } from "../../infrastructure/events/types";
import type { EventCatalogEntry } from "../../infrastructure/events/catalog";
import type { Subscription } from "../../domain/subscription/types";
import type { EventDefinition } from "../../domain/eventDefinition/types";
import { ConfirmModal } from "../modals";
import {
	openOrCreateEventDoc,
	renderSubscriptionForm,
	type SubscriptionFormData,
} from "../catalog/helpers";
import type { DefinitionFormData, EventConfigPageDeps } from "./types";
import { renderOverviewPage } from "./OverviewPage";
import { renderDefinitionFormPage } from "./DefinitionFormPage";

type Page = "overview" | "subscription-form" | "definition-form";

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
				renderDefinitionFormPage(contentEl, this.buildPageDeps());
				break;
			default:
				renderOverviewPage(contentEl, this.buildPageDeps());
				break;
		}
	}

	private buildPageDeps(): EventConfigPageDeps {
		return {
			app: this.app,
			eventBus: this.eventBus,
			entry: this.entry,
			eventsFolder: this.eventsFolder,
			subscriptions: this.subscriptions,
			definitions: this.definitions,
			subFormData: this.subFormData,
			defFormData: this.defFormData,
			editingSubscriptionId: this.editingSubscriptionId,
			editingDefinitionId: this.editingDefinitionId,
			onEditSubscription: (id, formData) => {
				this.editingSubscriptionId = id;
				this.subFormData = formData;
				this.page = "subscription-form";
				this.render();
			},
			onDeleteSubscription: (id, label) => {
				new ConfirmModal(this.app, {
					message: `Delete watcher "${label}"?`,
					confirmLabel: "Delete",
					onConfirm: () => {
						void this.eventBus.emit("subscription.remove", {
							subscriptionId: id,
						});
					},
				}).open();
			},
			onEditDefinition: (id, formData) => {
				this.editingDefinitionId = id;
				this.defFormData = formData;
				this.page = "definition-form";
				this.render();
			},
			onDeleteDefinition: (id, name) => {
				new ConfirmModal(this.app, {
					message: `Delete transform "${name}"?`,
					confirmLabel: "Delete",
					onConfirm: () => {
						void this.eventBus.emit("eventDefinition.remove", {
							definitionId: id,
						});
					},
				}).open();
			},
			onNavigateToPage: (page) => {
				if (page === "subscription-form") {
					this.editingSubscriptionId = null;
					this.subFormData = this.emptySubForm();
					this.subFormData.eventType = this.entry.type;
				} else if (page === "definition-form") {
					this.editingDefinitionId = null;
					this.defFormData = this.emptyDefForm();
				}
				this.page = page as Page;
				this.render();
			},
			onOpenEventDoc: () => {
				void this.openEventDoc();
			},
			onRender: () => this.render(),
		};
	}

	// ─────────────────────────────────────────────────────────────
	// Helpers
	// ─────────────────────────────────────────────────────────────

	private async openEventDoc(): Promise<void> {
		await openOrCreateEventDoc(createVaultQueryService(this.app), createWorkspaceService(this.app), this.eventBus, this.eventsFolder, this.entry);
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
