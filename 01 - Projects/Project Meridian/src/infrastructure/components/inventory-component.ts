import type { InventoryState } from '../../domain/core/component-data.js';
import { TrackedComponent } from './tracked-component.js';

export class InventoryComponent extends TrackedComponent {
	constructor(public state: InventoryState) { super(); }
}
