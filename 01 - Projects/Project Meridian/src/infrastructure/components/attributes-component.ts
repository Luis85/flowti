import type { AttributesState } from '../../domain/core/component-data.js';
import { TrackedComponent } from './tracked-component.js';

export class AttributesComponent extends TrackedComponent {
	constructor(public state: AttributesState) { super(); }
}
