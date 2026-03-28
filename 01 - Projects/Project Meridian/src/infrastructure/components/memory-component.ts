import type { MemoryState } from '../../domain/core/component-data.js';
import { TrackedComponent } from './tracked-component.js';

export class MemoryComponent extends TrackedComponent {
	constructor(public state: MemoryState) { super(); }
}
