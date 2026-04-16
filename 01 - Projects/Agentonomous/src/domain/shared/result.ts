export type Ok<T> = { readonly kind: 'ok'; readonly value: T };
export type Err<E> = { readonly kind: 'err'; readonly error: E };
export type Result<T, E> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
	return { kind: 'ok', value };
}

export function err<E>(error: E): Err<E> {
	return { kind: 'err', error };
}

export function isOk<T, E>(r: Result<T, E>): r is Ok<T> {
	return r.kind === 'ok';
}

export function isErr<T, E>(r: Result<T, E>): r is Err<E> {
	return r.kind === 'err';
}
