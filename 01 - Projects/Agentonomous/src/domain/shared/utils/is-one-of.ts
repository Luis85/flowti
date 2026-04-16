export function isOneOf<T extends string>(
	value: string,
	allowed: readonly T[],
): value is T {
	return (allowed as readonly string[]).includes(value);
}
