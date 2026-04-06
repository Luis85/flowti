export function findNearest<T extends { distance: number }>(items: T[]): T | null {
	if (items.length === 0) return null;
	return items.reduce((min, item) => item.distance < min.distance ? item : min);
}
