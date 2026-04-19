export class OverwriteDialogPage {
	constructor(private readonly root: HTMLElement | Document) {}

	get dialog(): HTMLElement | null { return this.el('overwrite-dialog'); }
	get backdrop(): HTMLElement | null { return this.el('overwrite-dialog-backdrop'); }
	get title(): HTMLElement | null { return this.el('overwrite-dialog-title'); }
	get body(): HTMLElement | null { return this.el('overwrite-dialog-body'); }

	get overwriteButton(): HTMLButtonElement | null {
		return this.btn('overwrite-dialog-overwrite');
	}
	get renameButton(): HTMLButtonElement | null {
		return this.btn('overwrite-dialog-rename');
	}
	get cancelButton(): HTMLButtonElement | null {
		return this.btn('overwrite-dialog-cancel');
	}

	private el(testId: string): HTMLElement | null {
		return this.root.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
	}
	private btn(testId: string): HTMLButtonElement | null {
		return this.root.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`);
	}
}
