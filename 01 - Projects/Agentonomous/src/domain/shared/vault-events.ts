import type { VaultChange } from './vault-port.js';

declare module './event-bus.js' {
	interface EventMap {
		vault: VaultChange;
	}
}
