export class MakeTypesPage {
	constructor(private readonly root: HTMLElement) {}

	get title(): string { return this.el('make-types-title')?.textContent.trim() ?? ''; }
	get typeRows(): readonly HTMLElement[] {
		return Array.from(this.root.querySelectorAll<HTMLElement>('[data-testid^="type-row-"]'));
	}
	get empty(): HTMLElement | null { return this.el('make-types-empty'); }
	get errorBanner(): HTMLElement | null { return this.el('make-types-error'); }
	get refreshButton(): HTMLButtonElement | null {
		return this.root.querySelector<HTMLButtonElement>('[data-testid="make-types-refresh"]');
	}

	private el(testId: string): HTMLElement | null {
		return this.root.querySelector(`[data-testid="${testId}"]`);
	}
}
