export interface MovementInput {
	currentPos: { x: number; y: number };
	targetPos: { x: number; y: number };
	speed: number;
	deltaTicks: number;
}

export interface MovementResult {
	newPos: { x: number; y: number };
	arrived: boolean;
}

export function computeMovement(input: MovementInput): MovementResult {
	const dx = input.targetPos.x - input.currentPos.x;
	const dy = input.targetPos.y - input.currentPos.y;
	const dist = Math.sqrt(dx * dx + dy * dy);
	const stepSize = input.speed * input.deltaTicks;

	if (dist <= stepSize) {
		return { newPos: { ...input.targetPos }, arrived: true };
	}

	return {
		newPos: {
			x: input.currentPos.x + (dx / dist) * stepSize,
			y: input.currentPos.y + (dy / dist) * stepSize,
		},
		arrived: false,
	};
}
