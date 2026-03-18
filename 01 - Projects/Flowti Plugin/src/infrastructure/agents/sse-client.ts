/**
 * SSE client for streaming events from the Flowti CLI server.
 * Wraps browser EventSource with typed event handling.
 */

type SseCallback = (data: Record<string, unknown>) => void;

export class SseClient {
	private url: string;
	private source: EventSource | null = null;
	private listeners = new Map<string, Set<SseCallback>>();

	constructor(url: string) {
		this.url = url;
	}

	connect(): void {
		this.source = new EventSource(this.url);

		// Re-register any listeners that were added before connect
		for (const [type, callbacks] of this.listeners) {
			for (const cb of callbacks) {
				this.source.addEventListener(type, (event: MessageEvent) => {
					try {
						const data = JSON.parse(event.data) as Record<string, unknown>;
						cb(data);
					} catch { /* invalid JSON */ }
				});
			}
		}
	}

	disconnect(): void {
		if (this.source) {
			this.source.close();
			this.source = null;
		}
	}

	on(eventType: string, callback: SseCallback): () => void {
		let set = this.listeners.get(eventType);
		if (!set) {
			set = new Set();
			this.listeners.set(eventType, set);
		}
		set.add(callback);

		if (this.source) {
			this.source.addEventListener(eventType, (event: MessageEvent) => {
				try {
					const data = JSON.parse(event.data) as Record<string, unknown>;
					callback(data);
				} catch { /* invalid JSON */ }
			});
		}

		return () => { set?.delete(callback); };
	}

	get connected(): boolean {
		return this.source !== null;
	}
}
