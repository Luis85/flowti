export class SchemaFormPage {
	constructor(private readonly root: HTMLElement) {}

	get titleInput(): HTMLInputElement | null {
		return this.root.querySelector<HTMLInputElement>('[data-testid="schema-form-title"]');
	}

	get filenameInput(): HTMLInputElement | null {
		return this.root.querySelector<HTMLInputElement>('[data-testid="schema-form-filename"]');
	}

	get filenameError(): HTMLElement | null {
		return this.root.querySelector<HTMLElement>('[data-testid="schema-form-error-__filename__"]');
	}

	get authorInput(): HTMLInputElement | null {
		return this.root.querySelector<HTMLInputElement>('[data-testid="input-text-author"]');
	}

	get submitButton(): HTMLButtonElement | null {
		return this.root.querySelector<HTMLButtonElement>('[data-testid="schema-form-submit"]');
	}

	get cancelButton(): HTMLButtonElement | null {
		return this.root.querySelector<HTMLButtonElement>('[data-testid="schema-form-cancel"]');
	}

	fieldInput(testId: string): HTMLInputElement | null {
		return this.root.querySelector<HTMLInputElement>(`[data-testid="${testId}"]`);
	}

	fieldError(fieldName: string): HTMLElement | null {
		return this.root.querySelector<HTMLElement>(`[data-testid="schema-form-error-${fieldName}"]`);
	}
}
