/**
 * SSE client for streaming events from the Flowti CLI server.
 * Wraps browser EventSource with typed event handling and backoff.
 */

type SseCallback = (data: Record<string, unknown>) => void;

export class SseClient {
	private url: string;
	private source: EventSource | null = null;
	private listeners = new Map<string, Set<SseCallback>>();
	private boundListeners = new Map<SseCallback, EventListener>();
	private retryCount = 0;
	private retryTimer: ReturnType<typeof setTimeout> | null = null;
	private maxRetries = 5;
	/** True once a connection has succeeded at least once. */
	private hasConnectedBefore = false;

	constructor(url: string) {
		this.url = url;
	}

	connect(): void {
		this.disconnect();
		this.source = new EventSource(this.url);

		this.source.onopen = () => {
			this.hasConnectedBefore = true;
			this.retryCount = 0;
		};

		this.source.onerror = () => {
			this.source?.close();
			this.source = null;
			this.boundListeners.clear();
			this.retryCount++;
			// Only retry if the server was reachable before (reconnect scenario).
			// On first connect failure, give up silently — server isn't running.
			if (this.hasConnectedBefore && this.retryCount <= this.maxRetries) {
				const delay = Math.min(1000 * 2 ** (this.retryCount - 1), 30000);
				this.retryTimer = setTimeout(() => this.connect(), delay);
			}
		};

		for (const [type, callbacks] of this.listeners) {
			for (const cb of callbacks) {
				this.attachListener(type, cb);
			}
		}
	}

	disconnect(): void {
		if (this.retryTimer) {
			clearTimeout(this.retryTimer);
			this.retryTimer = null;
		}
		if (this.source) {
			this.source.onerror = null;
			this.source.close();
			this.source = null;
		}
		this.boundListeners.clear();
		this.retryCount = 0;
	}

	on(eventType: string, callback: SseCallback): () => void {
		let set = this.listeners.get(eventType);
		if (!set) {
			set = new Set();
			this.listeners.set(eventType, set);
		}
		set.add(callback);

		if (this.source) {
			this.attachListener(eventType, callback);
		}

		return () => {
			set?.delete(callback);
			const bound = this.boundListeners.get(callback);
			if (bound && this.source) {
				this.source.removeEventListener(eventType, bound);
			}
			this.boundListeners.delete(callback);
		};
	}

	get connected(): boolean {
		return this.source?.readyState === EventSource.OPEN;
	}

	private attachListener(eventType: string, callback: SseCallback): void {
		const handler: EventListener = (event: Event) => {
			try {
				const data = JSON.parse((event as MessageEvent).data) as Record<string, unknown>;
				callback(data);
			} catch { /* invalid JSON */ }
		};
		this.boundListeners.set(callback, handler);
		this.source?.addEventListener(eventType, handler);
	}
}
