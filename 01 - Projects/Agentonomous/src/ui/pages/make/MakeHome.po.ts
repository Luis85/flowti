export class MakeHomePage {
	constructor(private readonly root: HTMLElement) {}

	get title(): string { return this.el('make-home-title')?.textContent.trim() ?? ''; }
	get blurb(): string { return this.el('make-home-blurb')?.textContent.trim() ?? ''; }
	get browseCta(): HTMLElement | null { return this.el('make-home-browse-cta') ?? this.el('browse-types-cta'); }
	get empty(): HTMLElement | null { return this.el('make-home-empty'); }
	get spinner(): HTMLElement | null { return this.el('make-home-spinner'); }
	get favoritesHeading(): HTMLElement | null { return this.el('make-home-favorites-heading'); }
	get favoriteChips(): readonly HTMLElement[] {
		return Array.from(this.root.querySelectorAll<HTMLElement>('[data-testid^="favorite-chip-"]'));
	}
	get createCtaEmpty(): HTMLElement | null { return this.el('make-home-create-cta-empty'); }
	get createCtaPopulated(): HTMLElement | null { return this.el('make-home-create-cta-populated'); }

	get kpiTypes():     HTMLElement | null { return this.el('kpi-types'); }
	get kpiInstances(): HTMLElement | null { return this.el('kpi-instances'); }
	get kpiWeek():      HTMLElement | null { return this.el('kpi-week'); }
	get recentHeading():  HTMLElement | null { return this.el('make-home-recent-heading'); }
	get recentEmpty():    HTMLElement | null { return this.el('recent-instances-empty'); }
	get recentRows(): readonly HTMLElement[] {
		return Array.from(this.root.querySelectorAll<HTMLElement>('[data-testid^="recent-instance-row-"]'));
	}

	private el(testId: string): HTMLElement | null {
		return this.root.querySelector(`[data-testid="${testId}"]`);
	}
}
