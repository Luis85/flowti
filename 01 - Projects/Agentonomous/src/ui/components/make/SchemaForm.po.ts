export class SchemaFormPage {
	constructor(private readonly root: HTMLElement) {}

	get form(): HTMLElement | null {
		return this.root.querySelector<HTMLElement>('[data-testid="schema-form"]');
	}

	get titleSection(): HTMLElement | null {
		return this.root.querySelector<HTMLElement>('[data-testid="form-title-section"]');
	}

	get fieldsSection(): HTMLElement | null {
		return this.root.querySelector<HTMLElement>('[data-testid="form-fields"]');
	}

	get titleInput(): HTMLInputElement | null {
		const wrapper = this.root.querySelector<HTMLElement>('[data-testid="form-title-input"]');
		return wrapper?.querySelector<HTMLInputElement>('input') ?? null;
	}

	get titleError(): HTMLElement | null {
		return this.root.querySelector<HTMLElement>('[data-testid="form-title-error"]');
	}

	get filenameInput(): HTMLInputElement | null {
		const wrapper = this.root.querySelector<HTMLElement>('[data-testid="form-filename-input"]');
		return wrapper?.querySelector<HTMLInputElement>('input') ?? null;
	}

	get filenameError(): HTMLElement | null {
		return this.root.querySelector<HTMLElement>('[data-testid="form-filename-error"]');
	}

	get authorInput(): HTMLInputElement | null {
		return this.root.querySelector<HTMLInputElement>('[data-testid="input-text-author"]');
	}

	get submitButton(): HTMLButtonElement | null {
		return this.root.querySelector<HTMLButtonElement>('[data-testid="form-submit"]');
	}

	get cancelButton(): HTMLButtonElement | null {
		return this.root.querySelector<HTMLButtonElement>('[data-testid="form-cancel"]');
	}

	fieldInput(testId: string): HTMLInputElement | null {
		return this.root.querySelector<HTMLInputElement>(`[data-testid="${testId}"]`);
	}

	fieldWrapper(fieldName: string): HTMLElement | null {
		return this.root.querySelector<HTMLElement>(`[data-testid="form-field-${fieldName}"]`);
	}

	fieldError(fieldName: string): HTMLElement | null {
		return this.root.querySelector<HTMLElement>(`[data-testid="form-field-${fieldName}-error"]`);
	}
}
