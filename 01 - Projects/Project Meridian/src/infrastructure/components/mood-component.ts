import type { MoodState } from '../../domain/core/component-data.js';
import { TrackedComponent } from './tracked-component.js';

export class MoodComponent extends TrackedComponent {
	constructor(public state: MoodState) { super(); }
}
