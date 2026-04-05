import type { AttributesState } from '../../domain/core/component-data.js';
import { TrackedComponent } from './tracked-component.js';

export class AttributesComponent extends TrackedComponent {
	constructor(public state: AttributesState) { super(); }

	getByName(name: string): number {
		return (this.state as unknown as Record<string, number>)[name] ?? 0;
	}
}
