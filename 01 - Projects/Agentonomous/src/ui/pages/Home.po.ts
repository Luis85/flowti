export class HomePage {
	constructor(private readonly root: HTMLElement) {}

	get greeting(): string {
		return this.el('greeting')?.textContent.trim() ?? '';
	}

	get version(): string {
		return this.el('version')?.textContent.trim() ?? '';
	}

	get aboutLink(): HTMLElement | null {
		return this.el('nav-about');
	}

	navigateToAbout(): void {
		this.aboutLink?.click();
	}

	private el(testId: string): HTMLElement | null {
		return this.root.querySelector(`[data-testid="${testId}"]`);
	}
}
