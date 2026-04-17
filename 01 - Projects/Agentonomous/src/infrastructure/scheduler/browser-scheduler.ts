import type { SchedulerPort } from '../../domain/shared/scheduler-port.js';

type Handle =
	| { kind: 'interval'; handle: ReturnType<typeof setInterval> }
	| { kind: 'timeout'; handle: ReturnType<typeof setTimeout> };

/**
 * Browser/Node scheduler backed by global setInterval/setTimeout.
 * Both are available in Obsidian's renderer and in the test environment.
 */
export class BrowserScheduler implements SchedulerPort {
	private readonly handles = new Map<string, Handle>();

	every(id: string, intervalMs: number, fn: () => void | Promise<void>): void {
		this.cancel(id);
		const handle = setInterval(() => { void fn(); }, intervalMs);
		this.handles.set(id, { kind: 'interval', handle });
	}

	once(id: string, delayMs: number, fn: () => void | Promise<void>): void {
		this.cancel(id);
		const handle = setTimeout(() => {
			this.handles.delete(id);
			void fn();
		}, delayMs);
		this.handles.set(id, { kind: 'timeout', handle });
	}

	cancel(id: string): void {
		const entry = this.handles.get(id);
		if (entry === undefined) return;
		if (entry.kind === 'interval') clearInterval(entry.handle);
		else clearTimeout(entry.handle);
		this.handles.delete(id);
	}

	cancelAll(): void {
		for (const [id] of this.handles) this.cancel(id);
	}
}
