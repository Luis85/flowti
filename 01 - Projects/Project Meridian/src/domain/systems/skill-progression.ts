export interface SkillProgressionInput {
	points: number;
	useCount: number;
	useBonus: number;
	thresholds: number[];
	maxUseBonus: number;
}

export interface SkillProgressionResult {
	newPoints: number;
	newUseCount: number;
	newUseBonus: number;
	improved: boolean;
}

export function applySkillProgression(input: SkillProgressionInput): SkillProgressionResult {
	const newPoints = input.points + 1;
	const newUseCount = input.useCount + 1;
	let bonus = 0;
	for (const threshold of input.thresholds) {
		if (newUseCount >= threshold) bonus++;
	}
	const newUseBonus = Math.min(bonus, input.maxUseBonus);
	const improved = newUseBonus > input.useBonus;
	return { newPoints, newUseCount, newUseBonus, improved };
}
