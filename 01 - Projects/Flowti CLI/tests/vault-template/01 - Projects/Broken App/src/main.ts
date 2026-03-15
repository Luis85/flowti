export function broken(input: string): number {
	// Type error: string is not assignable to number
	// @ts-expect-error intentional type error for testing
	return input;
}
