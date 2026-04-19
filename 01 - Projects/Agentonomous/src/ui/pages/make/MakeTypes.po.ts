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
	get createCta(): HTMLElement | null { return this.el('make-types-create-cta'); }
	favoriteStar(typeId: string): HTMLButtonElement | null {
		return this.root.querySelector<HTMLButtonElement>(`[data-testid="favorite-star-${typeId}"]`);
	}

	get corruptBanner(): HTMLElement | null { return this.el('corrupt-banner'); }
	get corruptBannerToggle(): HTMLButtonElement | null {
		return this.root.querySelector<HTMLButtonElement>('[data-testid="corrupt-banner-toggle"]');
	}
	get corruptBannerRefresh(): HTMLButtonElement | null {
		return this.root.querySelector<HTMLButtonElement>('[data-testid="corrupt-banner-refresh"]');
	}
	get corruptDetails(): HTMLElement | null { return this.el('corrupt-details'); }
	corruptOpen(index: number): HTMLButtonElement | null {
		return this.root.querySelector<HTMLButtonElement>(`[data-testid="corrupt-open-${index}"]`);
	}
	corruptDelete(index: number): HTMLButtonElement | null {
		return this.root.querySelector<HTMLButtonElement>(`[data-testid="corrupt-delete-${index}"]`);
	}
	get confirmDialog(): HTMLElement | null {
		return document.querySelector<HTMLElement>('[data-testid="confirm-dialog"]');
	}
	get confirmDialogConfirm(): HTMLButtonElement | null {
		return document.querySelector<HTMLButtonElement>('[data-testid="confirm-dialog-confirm"]');
	}
	get confirmDialogCancel(): HTMLButtonElement | null {
		return document.querySelector<HTMLButtonElement>('[data-testid="confirm-dialog-cancel"]');
	}

	private el(testId: string): HTMLElement | null {
		return this.root.querySelector(`[data-testid="${testId}"]`);
	}
}
