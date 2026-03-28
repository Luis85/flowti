import type { NeedsState } from '../../domain/core/component-data.js';
import { TrackedComponent } from './tracked-component.js';

export class NeedsComponent extends TrackedComponent {
	constructor(public state: NeedsState) { super(); }
}
