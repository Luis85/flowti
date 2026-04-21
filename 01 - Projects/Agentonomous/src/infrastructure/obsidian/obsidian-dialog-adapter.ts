import { type App, Modal, Setting, SuggestModal, TFolder } from 'obsidian';
import type { DialogPort, ConfirmOptions, PromptOptions, PickFolderOptions } from '../../domain/shared/dialog-port.js';

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

	pickFolder(opts?: PickFolderOptions): Promise<string | null> {
		return new FolderSuggestModal(this.app, opts?.title ?? 'Pick a folder').run();
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

class FolderSuggestModal extends SuggestModal<string> {
	private resolver: ((v: string | null) => void) | null = null;
	private resolved = false;

	constructor(app: App, title: string) {
		super(app);
		this.setPlaceholder(title);
	}

	// `run()` is not part of Obsidian's SuggestModal API — it's a local
	// helper that wraps the base-class `open()` call in a Promise the
	// adapter can await.
	run(): Promise<string | null> {
		return new Promise((resolve) => {
			this.resolver = resolve;
			this.open();
		});
	}

	getSuggestions(query: string): string[] {
		const folders = this.app.vault.getAllLoadedFiles()
			.filter((f): f is TFolder => f instanceof TFolder)
			.map((f) => f.path === '' ? '/' : f.path);
		const q = query.toLowerCase();
		return folders.filter((p) => p.toLowerCase().includes(q)).sort();
	}

	renderSuggestion(path: string, el: HTMLElement): void {
		el.setText(path);
	}

	onChooseSuggestion(path: string): void {
		this.resolved = true;
		this.resolver?.(path === '/' ? '' : path);
	}

	// Note: matches the ConfirmModal / PromptModal convention in this file —
	// we do NOT call super.onClose(). Real Obsidian Modal.onClose is a no-op
	// override point; the test stub's Modal likewise defines no onClose, so
	// calling super.onClose() would throw at test runtime.
	onClose(): void {
		if (!this.resolved) this.resolver?.(null);
	}
}
