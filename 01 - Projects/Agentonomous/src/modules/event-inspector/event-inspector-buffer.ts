import type { EventEnvelope } from '../../domain/shared/event-bus.js';

export class EventBuffer {
	private readonly buffer: EventEnvelope[] = [];
	private max: number;
	private readonly listeners = new Set<() => void>();

	constructor(maxEvents: number) {
		this.max = maxEvents;
	}

	add(envelope: EventEnvelope): void {
		this.buffer.push(envelope);
		if (this.buffer.length > this.max) {
			this.buffer.splice(0, this.buffer.length - this.max);
		}
		for (const l of this.listeners) l();
	}

	getAll(): readonly EventEnvelope[] {
		return this.buffer;
	}

	clear(): void {
		this.buffer.length = 0;
		for (const l of this.listeners) l();
	}

	setMaxEvents(max: number): void {
		this.max = max;
		if (this.buffer.length > max) {
			this.buffer.splice(0, this.buffer.length - max);
		}
	}

	onChange(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => { this.listeners.delete(listener); };
	}
}
