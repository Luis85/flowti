export function generateId(): string {
	return crypto.randomUUID();
}

export function timestamp(): number {
	return Date.now();
}
