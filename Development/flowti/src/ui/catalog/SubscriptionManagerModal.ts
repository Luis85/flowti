/**
 * Modal for managing event subscriptions.
 * Two pages: list (default) and form (add/edit).
 */

import { App, Modal, Notice } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types";
import type { Subscription } from "../../domain/subscription/types";
import {
	renderSubscriptionForm,
	renderSubscriptionRow,
	type SubscriptionFormData,
} from "./helpers";

type Page = "list" | "form";

export class SubscriptionManagerModal extends Modal {
	private eventBus: IEventBus;
	private unsubscribes: (() => void)[] = [];
	private subscriptions: Subscription[] = [];

	private page: Page = "list";
	private editingId: string | null = null;
	private formData: SubscriptionFormData = this.emptyForm();

	constructor(app: App, eventBus: IEventBus) {
		super(app);
		this.eventBus = eventBus;
	}

	async onOpen(): Promise<void> {
		this.modalEl.addClass("flowti-subscription-modal");
		this.titleEl.setText("Manage watchers");

		// Listen for subscription state changes
		this.unsubscribes.push(
			this.eventBus.on("subscription.loaded", (event) => {
				this.subscriptions = event.payload.subscriptions;
				if (this.page === "list") this.render();
			})
		);
		this.unsubscribes.push(
			this.eventBus.on("subscription.created", (event) => {
				this.subscriptions = [
					...this.subscriptions.filter((s) => s.id !== event.payload.subscription.id),
					event.payload.subscription,
				];
				this.page = "list";
				this.render();
			})
		);
		this.unsubscribes.push(
			this.eventBus.on("subscription.updated", (event) => {
				this.subscriptions = this.subscriptions.map((s) =>
					s.id === event.payload.subscription.id ? event.payload.subscription : s
				);
				this.page = "list";
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

		// Request current state
		await this.eventBus.emit("subscription.refresh", {});

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

		if (this.page === "form") {
			renderSubscriptionForm(contentEl, {
				isEdit: this.editingId !== null,
				eventTypeLocked: false,
				formData: this.formData,
				onSave: () => this.saveSubscription(),
				onCancel: () => { this.page = "list"; this.render(); },
			});
		} else {
			this.renderList(contentEl);
		}
	}

	// ─────────────────────────────────────────────────────────────
	// List page
	// ─────────────────────────────────────────────────────────────

	private renderList(container: HTMLElement): void {
		// Add button
		const header = container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-2" });
		const addBtn = header.createEl("button", {
			text: "Add watcher",
			cls: "ft-btn ft-btn-primary",
		});
		addBtn.addEventListener("click", () => {
			this.editingId = null;
			this.formData = this.emptyForm();
			this.page = "form";
			this.render();
		});

		if (this.subscriptions.length === 0) {
			container.createDiv({
				text: "No watchers yet.",
				cls: "ft-text-muted ft-text-sm ft-p-4",
			});
			return;
		}

		for (const sub of this.subscriptions) {
			renderSubscriptionRow(container, sub, {
				showEventType: true,
				eventBus: this.eventBus,
				onEdit: () => {
					this.editingId = sub.id;
					this.formData = {
						eventType: sub.eventType,
						label: sub.label ?? "",
						pathPattern: sub.filters.pathPattern ?? "",
						extension: sub.filters.extension ?? "",
						namePattern: sub.filters.namePattern ?? "",
					};
					this.page = "form";
					this.render();
				},
				onDelete: () => {
					void this.eventBus.emit("subscription.remove", {
						subscriptionId: sub.id,
					});
				},
			});
		}
	}

	// ─────────────────────────────────────────────────────────────
	// Helpers
	// ─────────────────────────────────────────────────────────────

	private saveSubscription(): void {
		if (!this.formData.eventType.trim()) return;

		const filters = {
			pathPattern: this.formData.pathPattern || undefined,
			extension: this.formData.extension || undefined,
			namePattern: this.formData.namePattern || undefined,
		};

		const promise = this.editingId
			? this.eventBus.emit("subscription.update", {
					subscriptionId: this.editingId,
					label: this.formData.label || undefined,
					filters,
				})
			: this.eventBus.emit("subscription.create", {
					eventType: this.formData.eventType.trim(),
					label: this.formData.label || undefined,
					filters,
				});

		promise.catch((err: unknown) => {
			console.error("[Flowti] Watcher save failed:", err);
			new Notice("Failed to save watcher. Check console for details.", 5000);
		});
	}

	private emptyForm(): SubscriptionFormData {
		return {
			eventType: "",
			label: "",
			pathPattern: "",
			extension: "",
			namePattern: "",
		};
	}
}
