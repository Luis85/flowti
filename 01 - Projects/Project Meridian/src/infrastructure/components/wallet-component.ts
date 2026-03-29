import type { WalletState } from '../../domain/core/component-data.js';
import { TrackedComponent } from './tracked-component.js';

export class WalletComponent extends TrackedComponent {
	constructor(public state: WalletState) { super(); }
}
