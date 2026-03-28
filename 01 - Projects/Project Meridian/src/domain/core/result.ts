export interface GameError {
	code: string;
	message: string;
	system: string;
	recoverable: boolean;
	context?: Record<string, unknown>;
}

export type ResultValue<T> =
	| { ok: true; value: T; map: <U>(fn: (v: T) => U) => ResultValue<U>; flatMap: <U>(fn: (v: T) => ResultValue<U>) => ResultValue<U> }
	| { ok: false; error: GameError; map: <U>(fn: (v: T) => U) => ResultValue<U>; flatMap: <U>(fn: (v: T) => ResultValue<U>) => ResultValue<U> };

function createOk<T>(value: T): ResultValue<T> {
	return {
		ok: true,
		value,
		map<U>(fn: (v: T) => U): ResultValue<U> {
			return createOk(fn(value));
		},
		flatMap<U>(fn: (v: T) => ResultValue<U>): ResultValue<U> {
			return fn(value);
		},
	};
}

function createErr<T>(error: GameError): ResultValue<T> {
	return {
		ok: false,
		error,
		map<U>(_fn: (v: T) => U): ResultValue<U> {
			return createErr<U>(error);
		},
		flatMap<U>(_fn: (v: T) => ResultValue<U>): ResultValue<U> {
			return createErr<U>(error);
		},
	};
}

export const Result = {
	ok: <T>(value: T): ResultValue<T> => createOk(value),
	err: <T = never>(error: GameError): ResultValue<T> => createErr(error),
};
