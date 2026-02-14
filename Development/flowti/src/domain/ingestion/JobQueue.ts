/**
 * Generic concurrent job queue.
 *
 * Processes items with a configurable concurrency limit.
 * No EventBus dependency — pure data structure with async processing.
 */
export class JobQueue<T> {
	private queue: T[] = [];
	private active = 0;
	private readonly concurrency: number;
	private readonly processor: (item: T) => Promise<void>;
	private readonly onError?: (item: T, error: unknown) => void;
	private drainResolvers: (() => void)[] = [];

	constructor(
		concurrency: number,
		processor: (item: T) => Promise<void>,
		onError?: (item: T, error: unknown) => void,
	) {
		this.concurrency = concurrency;
		this.processor = processor;
		this.onError = onError;
	}

	/**
	 * Adds an item to the queue and starts processing if capacity allows.
	 */
	enqueue(item: T): void {
		this.queue.push(item);
		this.processNext();
	}

	/**
	 * Returns a promise that resolves when the queue is empty
	 * and all active jobs have completed.
	 */
	async drain(): Promise<void> {
		if (this.isIdle) return;
		return new Promise<void>((resolve) => {
			this.drainResolvers.push(resolve);
		});
	}

	/**
	 * Number of items waiting in the queue.
	 */
	get size(): number {
		return this.queue.length;
	}

	/**
	 * Number of items currently being processed.
	 */
	get activeCount(): number {
		return this.active;
	}

	/**
	 * True when no items are queued or processing.
	 */
	get isIdle(): boolean {
		return this.queue.length === 0 && this.active === 0;
	}

	private processNext(): void {
		while (this.active < this.concurrency && this.queue.length > 0) {
			const item = this.queue.shift()!;
			this.active++;
			void this.process(item);
		}
	}

	private async process(item: T): Promise<void> {
		try {
			await this.processor(item);
		} catch (error: unknown) {
			this.onError?.(item, error);
		} finally {
			this.active--;
			this.processNext();
			if (this.isIdle) {
				for (const resolve of this.drainResolvers) {
					resolve();
				}
				this.drainResolvers = [];
			}
		}
	}
}
