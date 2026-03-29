import type { StaminaState } from '../../domain/core/component-data.js';
import { TrackedComponent } from './tracked-component.js';

export class StaminaComponent extends TrackedComponent {
	constructor(public state: StaminaState) { super(); }
}
