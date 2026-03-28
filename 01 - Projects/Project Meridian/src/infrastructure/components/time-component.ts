import type { TimeState } from '../../domain/core/component-data.js';
import { TrackedComponent } from './tracked-component.js';

export class TimeComponent extends TrackedComponent {
	constructor(public state: TimeState) { super(); }
}
