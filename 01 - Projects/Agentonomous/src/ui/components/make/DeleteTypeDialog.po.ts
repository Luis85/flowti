export class DeleteTypeDialogPage {
	constructor(private readonly root: HTMLElement) {}

	get dialog(): HTMLElement | null { return this.el('delete-type-dialog'); }
	get backdrop(): HTMLElement | null { return this.el('delete-type-dialog-backdrop'); }
	get title(): string { return this.el('delete-type-dialog-title')?.textContent?.trim() ?? ''; }
	get typeFilePath(): string { return this.el('delete-type-file-path')?.textContent?.trim() ?? ''; }
	get instanceLine(): string { return this.el('delete-type-instance-line')?.textContent?.trim() ?? ''; }
	get baseCheckbox(): HTMLInputElement | null { return this.root.querySelector<HTMLInputElement>('[data-testid="delete-type-base-checkbox"]'); }
	get baseCheckboxLabel(): HTMLElement | null { return this.el('delete-type-base-checkbox-label'); }
	get baseFilePath(): string { return this.el('delete-type-base-file-path')?.textContent?.trim() ?? ''; }
	get confirmButton(): HTMLButtonElement | null { return this.root.querySelector<HTMLButtonElement>('[data-testid="delete-type-confirm"]'); }
	get cancelButton(): HTMLButtonElement | null { return this.root.querySelector<HTMLButtonElement>('[data-testid="delete-type-cancel"]'); }

	private el(testId: string): HTMLElement | null {
		return this.root.querySelector(`[data-testid="${testId}"]`);
	}
}
