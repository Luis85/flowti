export class MakeTypePage {
	constructor(private readonly root: HTMLElement) {}

	get title(): string { return this.el('make-type-title')?.textContent.trim() ?? ''; }
	get folder(): string { return this.el('make-type-folder')?.textContent.trim() ?? ''; }
	get fieldsTabButton(): HTMLButtonElement | null { return this.root.querySelector<HTMLButtonElement>('[data-testid="make-type-tab-fields"]'); }
	get instancesTabButton(): HTMLButtonElement | null { return this.root.querySelector<HTMLButtonElement>('[data-testid="make-type-tab-instances"]'); }
	get activeTab(): 'fields' | 'instances' | null {
		const active = this.root.querySelector<HTMLElement>('[data-testid^="make-type-tab-"][aria-selected="true"]');
		const id = active?.dataset['testid']?.replace('make-type-tab-', '');
		return id === 'fields' || id === 'instances' ? id : null;
	}
	get fieldRows(): readonly HTMLElement[] {
		return Array.from(this.root.querySelectorAll<HTMLElement>('div[data-testid^="field-row-"]'));
	}
	get instanceRows(): readonly HTMLElement[] {
		return Array.from(this.root.querySelectorAll<HTMLElement>('[data-testid^="instance-row-"]'));
	}
	get fieldsEmpty(): HTMLElement | null { return this.el('make-type-fields-empty'); }
	get instancesEmpty(): HTMLElement | null { return this.el('make-type-instances-empty'); }
	get instancesLoading(): HTMLElement | null { return this.el('make-type-instances-loading'); }
	get instancesError(): HTMLElement | null { return this.el('make-type-instances-error'); }

	// --- Task 3.17 additions ---
	get unsavedBadge(): HTMLElement | null { return this.el('make-type-unsaved-badge'); }
	get fieldsTabUnsavedIndicator(): HTMLElement | null { return this.root.querySelector('[data-testid="make-type-tab-fields"] [aria-label]'); }
	get deleteButton(): HTMLButtonElement | null { return this.root.querySelector<HTMLButtonElement>('[data-testid="fields-delete"]'); }
	get saveButton(): HTMLButtonElement | null { return this.root.querySelector<HTMLButtonElement>('[data-testid="fields-save"]'); }
	get cancelButton(): HTMLButtonElement | null { return this.root.querySelector<HTMLButtonElement>('[data-testid="fields-cancel"]'); }
	get baseBanner(): HTMLElement | null { return this.el('base-file-banner'); }
	get baseBannerRegenerate(): HTMLButtonElement | null { return this.root.querySelector<HTMLButtonElement>('[data-testid="base-file-banner-regenerate"]'); }
	get deleteDialog(): HTMLElement | null { return this.el('delete-type-dialog'); }
	get confirmDialog(): HTMLElement | null { return this.el('confirm-dialog'); }
	get favoriteButton(): HTMLButtonElement | null { return this.root.querySelector<HTMLButtonElement>('[data-testid^="favorite-star-"]'); }

	private el(testId: string): HTMLElement | null { return this.root.querySelector(`[data-testid="${testId}"]`); }
}
