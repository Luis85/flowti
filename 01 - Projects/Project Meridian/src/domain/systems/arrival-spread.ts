/** Compute an offset position for an agent arriving at a shared location. */
export function resolveArrivalOffset(
	slotIndex: number,
	totalAgents: number,
	spreadRadius: number,
): { dx: number; dy: number } {
	if (totalAgents <= 1) return { dx: 0, dy: 0 };
	const angle = (2 * Math.PI / totalAgents) * slotIndex;
	return {
		dx: Math.cos(angle) * spreadRadius,
		dy: Math.sin(angle) * spreadRadius,
	};
}
