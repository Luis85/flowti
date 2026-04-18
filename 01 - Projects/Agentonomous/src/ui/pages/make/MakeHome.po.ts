export class MakeHomePage {
	constructor(private readonly root: HTMLElement) {}

	get title(): string { return this.el('make-home-title')?.textContent.trim() ?? ''; }
	get blurb(): string { return this.el('make-home-blurb')?.textContent.trim() ?? ''; }
	get browseCta(): HTMLElement | null { return this.el('browse-types-cta'); }
	get empty(): HTMLElement | null { return this.el('make-home-empty'); }
	get spinner(): HTMLElement | null { return this.el('make-home-spinner'); }
	get favoritesHeading(): HTMLElement | null { return this.el('make-home-favorites-heading'); }
	get favoriteChips(): readonly HTMLElement[] {
		return Array.from(this.root.querySelectorAll<HTMLElement>('[data-testid^="favorite-chip-"]'));
	}

	private el(testId: string): HTMLElement | null {
		return this.root.querySelector(`[data-testid="${testId}"]`);
	}
}
