import type { EconomyState } from '../../domain/core/component-data.js';
import { TrackedComponent } from './tracked-component.js';

export class EconomyComponent extends TrackedComponent {
	constructor(public state: EconomyState) { super(); }
}
