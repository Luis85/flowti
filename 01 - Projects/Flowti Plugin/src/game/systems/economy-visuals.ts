// Economy visual cue definitions — used by engine-events.ts to trigger particles/bubbles

export interface EconomyVisualCue {
	readonly trigger: string;
	readonly particlePreset?: string;
	readonly bubbleText?: string;
	readonly duration?: number;
}

export const ECONOMY_CUES: readonly EconomyVisualCue[] = [
	{ trigger: "task-completed", bubbleText: "+{xp}XP +{coin}C", duration: 2000 },
	{ trigger: "level-up", particlePreset: "firework", bubbleText: "Level {level}!", duration: 3000 },
	{ trigger: "trust-promoted", bubbleText: "Trust promoted!", duration: 2000 },
	{ trigger: "purchase", particlePreset: "sparkle", bubbleText: "Purchased!", duration: 1500 },
	{ trigger: "token-spend", duration: 500 },
	{ trigger: "low-tokens", bubbleText: "Running low on tokens...", duration: 3000 },
];

export function getCueForTrigger(trigger: string): EconomyVisualCue | undefined {
	return ECONOMY_CUES.find(c => c.trigger === trigger);
}

export function formatBubbleText(template: string, data: Record<string, string | number>): string {
	return template.replace(/\{(\w+)\}/g, (_, key) => String(data[key] ?? key));
}
