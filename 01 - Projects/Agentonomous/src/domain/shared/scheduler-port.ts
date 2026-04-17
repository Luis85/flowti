/**
 * Scheduler for deferred/repeating work.  Wraps setInterval/setTimeout so
 * module code stays testable (fakes replace real timers) and so pause /
 * resume / cancel are uniformly available.
 *
 * Every scheduled task is keyed by `id` — reusing an id cancels the
 * previous registration.  Ids are module-scoped by convention (prefix
 * with the module name: `"event-inspector:flush"`).
 */
export interface SchedulerPort {
	/** Run `fn` every `intervalMs`.  First run is after `intervalMs`, not immediately. */
	every(id: string, intervalMs: number, fn: () => void | Promise<void>): void;

	/** Run `fn` once after `delayMs`. */
	once(id: string, delayMs: number, fn: () => void | Promise<void>): void;

	/** Cancel a scheduled task by id.  No-op if the id is unknown. */
	cancel(id: string): void;

	/** Cancel every task this scheduler has registered. */
	cancelAll(): void;
}
