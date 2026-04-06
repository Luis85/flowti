export interface LeisureTickInput {
	currentSocial: number;
	currentEnergy: number;
	effects: { social: number; mood: number; energy: number; skill_xp: number };
	ticksPerVisit: number;
}

export interface LeisureTickResult {
	newSocial: number;
	newEnergy: number;
}

export function applyLeisureTick(input: LeisureTickInput): LeisureTickResult {
	const { currentSocial, currentEnergy, effects, ticksPerVisit } = input;
	return {
		newSocial: Math.min(100, currentSocial + (effects.social > 0 ? effects.social / ticksPerVisit : 0)),
		newEnergy: Math.min(100, currentEnergy + (effects.energy > 0 ? effects.energy / ticksPerVisit : 0)),
	};
}
