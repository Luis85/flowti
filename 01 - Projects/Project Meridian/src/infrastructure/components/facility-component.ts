import type { FacilityState } from '../../domain/core/component-data.js';
import { TrackedComponent } from './tracked-component.js';

export class FacilityComponent extends TrackedComponent {
	constructor(public state: FacilityState) { super(); }
}
