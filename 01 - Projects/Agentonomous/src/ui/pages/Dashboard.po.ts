export class DashboardPage {
	constructor(private readonly root: HTMLElement) {}

	get moduleCards(): { name: string; status: string }[] {
		const cards = this.root.querySelectorAll('[data-testid^="module-card-"]');
		return Array.from(cards).map((card) => ({
			name: card.querySelector('[data-testid="module-name"]')?.textContent.trim() ?? '',
			status: card.querySelector('[data-testid="module-status"]')?.textContent.trim() ?? '',
		}));
	}

	private el(testId: string): HTMLElement | null {
		return this.root.querySelector(`[data-testid="${testId}"]`);
	}
}
