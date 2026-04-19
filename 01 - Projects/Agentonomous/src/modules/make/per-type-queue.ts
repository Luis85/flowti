export interface PerTypeQueue {
	enqueue<T>(typeId: string, work: () => Promise<T>): Promise<T>;
}

export function createPerTypeQueue(): PerTypeQueue {
	const chains = new Map<string, Promise<unknown>>();
	return {
		enqueue<T>(typeId: string, work: () => Promise<T>): Promise<T> {
			const previous = chains.get(typeId) ?? Promise.resolve();
			const current  = previous.then(work);
			chains.set(typeId, current.catch(() => undefined));
			return current;
		},
	};
}
