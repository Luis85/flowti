import type { BlackboardState } from '../../domain/core/component-data.js';
import { TrackedComponent } from './tracked-component.js';

export class BlackboardComponent extends TrackedComponent {
	constructor(public state: BlackboardState) { super(); }
}
