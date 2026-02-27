import { FuzzySuggestModal, Notice, setIcon } from "obsidian";
import type { App, TAbstractFile } from "obsidian";
import type { SessionPanelDeps } from "./types";
import type { ContextBindingType } from "../../domain/session/types";
import { BINDING_TYPES, MAX_CONTEXT_BINDINGS } from "../../domain/session/types";

export class SessionContextPanel {
	private contextBindingsEl: HTMLElement | null = null;
	private deps: SessionPanelDeps;

	constructor(private container: HTMLElement, deps: SessionPanelDeps) {
		this.deps = deps;
	}

	render(): void {
		const session = this.deps.getSession();
		const section = this.container.createDiv({ cls: "ft-session-workspace-context ft-section" });

		const headerRow = section.createDiv({ cls: "ft-panel-label-row ft-mb-sm" });
		headerRow.createEl("strong", { text: "Context" });
		headerRow.createEl("span", {
			text: `(${session.contextBindings.length}/${MAX_CONTEXT_BINDINGS})`,
			cls: "ft-text-muted ft-panel-count",
		});

		this.contextBindingsEl = section.createDiv({ cls: "ft-context-bindings-list" });
		this.renderContextBindingsList();

		if (session.contextBindings.length < MAX_CONTEXT_BINDINGS) {
			const addBtn = section.createEl("button", { text: "Add context", cls: "ft-context-add" });
			const iconEl = addBtn.createSpan();
			setIcon(iconEl, "plus");
			addBtn.prepend(iconEl);
			addBtn.addEventListener("click", () => {
				this.openContextBindingPicker(addBtn);
			});
		}
	}

	refresh(): void {
		this.renderContextBindingsList();
	}

	private renderContextBindingsList(): void {
		const session = this.deps.getSession();
		if (!this.contextBindingsEl) return;
		this.contextBindingsEl.empty();

		if (session.contextBindings.length === 0) {
			this.contextBindingsEl.createDiv({ text: "No context bindings", cls: "ft-text-muted ft-text-sm ft-context-empty" });
			return;
		}

		for (const binding of session.contextBindings) {
			const row = this.contextBindingsEl.createDiv({ cls: "ft-context-row" });

			const badge = row.createEl("span", { text: binding.type, cls: "ft-context-badge" });
			badge.title = "Click to change type";
			badge.addEventListener("click", () => {
				const currentIdx = BINDING_TYPES.indexOf(binding.type);
				const nextType = BINDING_TYPES[(currentIdx + 1) % BINDING_TYPES.length];
				void this.deps.eventBus.emit("session.context.changeType", {
					sessionId: session.id,
					bindingId: binding.id,
					type: nextType,
				});
			});

			const anchor = row.createEl("a", { text: binding.label, cls: "ft-context-link" });
			anchor.title = binding.path;
			anchor.addEventListener("click", (e) => {
				e.preventDefault();
				if (binding.type === "folder") {
					this.deps.revealFolder(binding.path);
				} else {
					this.deps.openFile(binding.path);
				}
			});

			const removeBtn = row.createEl("button", { cls: "ft-context-remove clickable-icon ft-item-remove-btn" });
			setIcon(removeBtn, "x");
			removeBtn.addEventListener("click", () => {
				void this.deps.eventBus.emit("session.context.unbind", {
					sessionId: session.id,
					bindingId: binding.id,
				});
			});
		}
	}

	private openContextBindingPicker(triggerBtn?: HTMLButtonElement): void {
		const session = this.deps.getSession();
		const items = this.deps.app.vault.getAllLoadedFiles();
		const choices: Array<{ path: string; type: ContextBindingType }> = [];

		for (const item of items) {
			if ("children" in item && item.path) {
				choices.push({ path: item.path + "/", type: "folder" });
			} else if ("extension" in item) {
				choices.push({ path: (item as TAbstractFile).path, type: "file" });
			}
		}

		choices.sort((a, b) => a.path.localeCompare(b.path));

		new ContextBindingPickerModal(this.deps.app, choices, (choice) => {
			void this.deps.eventBus.emit("session.context.bind", {
				sessionId: session.id,
				path: choice.path,
				type: choice.type,
			});
			const name = choice.path.replace(/\/$/, "").split("/").pop() ?? choice.path;
			if (triggerBtn) {
				triggerBtn.setText(`Added "${name}"`);
				triggerBtn.disabled = true;
			}
			new Notice(`Added "${name}" as ${choice.type} context`);
		}).open();
	}
}

// ── Picker modal ──────────────────────────────────────────

interface ContextPickerChoice {
	path: string;
	type: ContextBindingType;
}

class ContextBindingPickerModal extends FuzzySuggestModal<ContextPickerChoice> {
	private choices: ContextPickerChoice[];
	private onChoose: (choice: ContextPickerChoice) => void;

	constructor(app: App, choices: ContextPickerChoice[], onChoose: (choice: ContextPickerChoice) => void) {
		super(app);
		this.choices = choices;
		this.onChoose = onChoose;
		this.setPlaceholder("Search for a file or folder to bind...");
	}

	getItems(): ContextPickerChoice[] {
		return this.choices;
	}

	getItemText(item: ContextPickerChoice): string {
		return item.path;
	}

	onChooseItem(item: ContextPickerChoice): void {
		this.onChoose(item);
	}
}
