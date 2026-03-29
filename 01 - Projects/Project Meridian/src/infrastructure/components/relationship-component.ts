import type { RelationshipState } from '../../domain/core/component-data.js';
import { TrackedComponent } from './tracked-component.js';

export class RelationshipComponent extends TrackedComponent {
	constructor(public state: RelationshipState) { super(); }
}
