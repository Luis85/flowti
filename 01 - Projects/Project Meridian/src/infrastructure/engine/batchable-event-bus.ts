import type { EventBus } from '../../domain/core/events.js';

export interface BatchableEventBus extends EventBus {
	beginBatch(): void;
	flushBatch(): void;
}
