export class ConfirmDialogPage {
	constructor(private readonly root: HTMLElement) {}

	get dialog(): HTMLElement | null { return this.root.querySelector('[data-testid="confirm-dialog"]'); }
	get title(): string { return this.el('confirm-dialog-title')?.textContent.trim() ?? ''; }
	get body(): string { return this.el('confirm-dialog-body')?.textContent.trim() ?? ''; }
	get backdrop(): HTMLElement | null { return this.el('confirm-dialog-backdrop'); }
	button(choice: string): HTMLButtonElement | null {
		return this.root.querySelector<HTMLButtonElement>(`[data-testid="confirm-dialog-${choice}"]`);
	}

	private el(testId: string): HTMLElement | null {
		return this.root.querySelector(`[data-testid="${testId}"]`);
	}
}
