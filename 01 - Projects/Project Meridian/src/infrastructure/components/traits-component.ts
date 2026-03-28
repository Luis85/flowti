import { TrackedComponent } from './tracked-component.js';

export class TraitsComponent extends TrackedComponent {
	constructor(public traitIds: string[]) { super(); }
}
