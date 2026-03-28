export interface GameEvent {
	type: string;
	tick: number;
	wallClock: number;
	source: string;
	payload: Record<string, unknown>;
}

export type EventHandler = (event: GameEvent) => void;
export type Unsubscribe = () => void;
export type EventFilter = (event: GameEvent) => boolean;

export interface EventBus {
	emit(event: GameEvent): void;
	on(type: string, handler: EventHandler, priority?: number): Unsubscribe;
	off(type: string, handler: EventHandler): void;
	onAny(handler: EventHandler): Unsubscribe;
	filter(predicate: EventFilter, handler: EventHandler): Unsubscribe;
	history(filter?: { type?: string; source?: string; limit?: number }): GameEvent[];
}
