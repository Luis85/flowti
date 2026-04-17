import { type App, Modal, Setting } from 'obsidian';
import type { DialogPort, ConfirmOptions, PromptOptions } from '../../domain/shared/dialog-port.js';

export class ObsidianDialogAdapter implements DialogPort {
	constructor(private readonly app: App) {}

	confirm(opts: ConfirmOptions): Promise<boolean> {
		return new Promise((resolve) => {
			const modal = new ConfirmModal(this.app, opts, resolve);
			modal.open();
		});
	}

	prompt(opts: PromptOptions): Promise<string | null> {
		return new Promise((resolve) => {
			const modal = new PromptModal(this.app, opts, resolve);
			modal.open();
		});
	}
}

class ConfirmModal extends Modal {
	private resolved = false;

	constructor(
		app: App,
		private readonly opts: ConfirmOptions,
		private readonly onResolve: (value: boolean) => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.titleEl.setText(this.opts.title);
		this.contentEl.createEl('p', { text: this.opts.message });

		new Setting(this.contentEl)
			.addButton((btn) => {
				btn
					.setButtonText(this.opts.cancelLabel ?? 'Cancel')
					.onClick(() => { this.settle(false); });
			})
			.addButton((btn) => {
				btn
					.setButtonText(this.opts.confirmLabel ?? 'Confirm')
					.setCta();
				if (this.opts.destructive === true) btn.setWarning();
				btn.onClick(() => { this.settle(true); });
			});
	}

	onClose(): void {
		this.contentEl.empty();
		if (!this.resolved) this.onResolve(false);
	}

	private settle(value: boolean): void {
		this.resolved = true;
		this.onResolve(value);
		this.close();
	}
}

class PromptModal extends Modal {
	private resolved = false;
	private value: string;

	constructor(
		app: App,
		private readonly opts: PromptOptions,
		private readonly onResolve: (value: string | null) => void,
	) {
		super(app);
		this.value = opts.defaultValue ?? '';
	}

	onOpen(): void {
		this.titleEl.setText(this.opts.title);
		this.contentEl.createEl('p', { text: this.opts.message });

		new Setting(this.contentEl)
			.addText((txt) => {
				txt
					.setValue(this.value)
					.onChange((v) => { this.value = v; });
				if (this.opts.placeholder !== undefined) txt.setPlaceholder(this.opts.placeholder);
				txt.inputEl.addEventListener('keydown', (ev: KeyboardEvent) => {
					if (ev.key === 'Enter') this.settle(this.value);
				});
			});

		new Setting(this.contentEl)
			.addButton((btn) => {
				btn
					.setButtonText(this.opts.cancelLabel ?? 'Cancel')
					.onClick(() => { this.settle(null); });
			})
			.addButton((btn) => {
				btn
					.setButtonText(this.opts.confirmLabel ?? 'OK')
					.setCta()
					.onClick(() => { this.settle(this.value); });
			});
	}

	onClose(): void {
		this.contentEl.empty();
		if (!this.resolved) this.onResolve(null);
	}

	private settle(value: string | null): void {
		this.resolved = true;
		this.onResolve(value);
		this.close();
	}
}
