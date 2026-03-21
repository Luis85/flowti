export interface LevelVisual {
	readonly levelRange: [number, number];
	readonly glowColor?: string;  // "domain" means use domain color
	readonly glowOpacity?: number;
	readonly auraParticles?: boolean;
	readonly walkSpeedBoost?: number;
}

export const LEVEL_VISUALS: readonly LevelVisual[] = [
	{ levelRange: [1, 2] },
	{ levelRange: [3, 4], glowColor: "domain", glowOpacity: 0.15 },
	{ levelRange: [5, 6], glowColor: "domain", glowOpacity: 0.3, walkSpeedBoost: 0.05 },
	{ levelRange: [7, 8], glowColor: "domain", glowOpacity: 0.4, auraParticles: true, walkSpeedBoost: 0.1 },
];

export function getVisualForLevel(level: number): LevelVisual {
	return LEVEL_VISUALS.find(v => level >= v.levelRange[0] && level <= v.levelRange[1]) ?? LEVEL_VISUALS[0];
}
