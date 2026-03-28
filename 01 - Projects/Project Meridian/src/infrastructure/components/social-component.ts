import type { SocialState } from '../../domain/core/component-data.js';
import { TrackedComponent } from './tracked-component.js';

export class SocialComponent extends TrackedComponent {
	constructor(public state: SocialState) { super(); }
}
