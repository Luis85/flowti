import { SchemaFormPage } from '../../components/make/SchemaForm.po.js';
import { OverwriteDialogPage } from '../../components/make/OverwriteDialog.po.js';

export class MakeTypeInstancesPage {
	constructor(private readonly root: HTMLElement) {}

	get heading(): HTMLElement | null { return this.el('make-type-instances-heading'); }
	get newInstanceButton(): HTMLButtonElement | null {
		return this.root.querySelector<HTMLButtonElement>('[data-testid="new-instance-button"]');
	}
	get createPanel(): HTMLElement | null { return this.el('create-panel'); }

	get loading(): HTMLElement | null { return this.el('make-type-instances-loading'); }
	get error():   HTMLElement | null { return this.el('make-type-instances-error'); }
	get empty():   HTMLElement | null { return this.el('make-type-instances-empty'); }

	instanceRow(path: string): HTMLElement | null {
		return this.root.querySelector<HTMLElement>(`[data-testid="instance-row-${path}"]`);
	}

	get form(): SchemaFormPage { return new SchemaFormPage(this.root); }
	get overwriteDialog(): OverwriteDialogPage { return new OverwriteDialogPage(document.body); }

	private el(testId: string): HTMLElement | null {
		return this.root.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
	}
}
