export class HelloCardPO {
	constructor(private readonly root: HTMLElement) {}

	get title(): string {
		return this.el('card-title')?.textContent.trim() ?? '';
	}

	get message(): string {
		return this.el('card-message')?.textContent.trim() ?? '';
	}

	private el(testId: string): HTMLElement | null {
		return this.root.querySelector(`[data-testid="${testId}"]`);
	}
}
