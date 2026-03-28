// src/domain/core/result.ts (minimal — will be expanded in Chunk B)
export interface GameError {
	code: string;
	message: string;
	system: string;
	recoverable: boolean;
	context?: Record<string, unknown>;
}

export type ResultValue<T> =
	| { ok: true; value: T }
	| { ok: false; error: GameError };
