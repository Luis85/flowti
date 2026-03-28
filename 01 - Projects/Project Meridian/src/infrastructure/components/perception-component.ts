import type { PerceptionState } from '../../domain/core/component-data.js';
import { TrackedComponent } from './tracked-component.js';

export class PerceptionComponent extends TrackedComponent {
	constructor(public state: PerceptionState) { super(); }
}
