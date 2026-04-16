import type { Unsubscribe } from '../shared/unsubscribe.js';
import type { CommandEntry } from './command-types.js';

export interface CommandPort {
	register(entry: CommandEntry): Unsubscribe;
	unregisterAll(): void;
	setRibbonVisibility?(visible: boolean): void;
}
