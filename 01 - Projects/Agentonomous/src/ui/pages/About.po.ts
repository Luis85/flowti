export class AboutPage {
	constructor(private readonly root: HTMLElement) {}

	get title(): string {
		return this.el('about-title')?.textContent?.trim() ?? '';
	}

	get version(): string {
		return this.el('about-version')?.textContent?.trim() ?? '';
	}

	get homeLink(): HTMLElement | null {
		return this.el('nav-home');
	}

	async navigateToHome(): Promise<void> {
		this.homeLink?.click();
	}

	private el(testId: string): HTMLElement | null {
		return this.root.querySelector(`[data-testid="${testId}"]`);
	}
}
