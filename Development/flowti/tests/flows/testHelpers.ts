/**
 * Shared mock factories for flow integration tests.
 *
 * Re-exports from centralized mocks plus flow-specific helpers.
 */

export { createMockStorage } from "../mocks/storage";
export { createMockFileSystem } from "../mocks/filesystem";

/**
 * Collects event types emitted on the bus in order.
 */
export function collectEvents(eventBus: { on: (type: string, handler: (e: { type: string }) => void) => void }, pattern: string): string[] {
	const events: string[] = [];
	eventBus.on(pattern, (e: { type: string }) => {
		events.push(e.type);
	});
	return events;
}

/**
 * Wait for async handlers to complete.
 */
export function waitForAsync(ms = 50): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
