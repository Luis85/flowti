/**
 * needs-hunger.ts — MDSL subtree for hunger satisfaction.
 *
 * When hunger is low, agent seeks a food station and eats.
 */

export const NEEDS_HUNGER_SUBTREE = `
root [NeedsHunger] {
	sequence {
		condition [IsHungry]
		action [SeekFoodStation]
		action [Eat]
	}
}
`.trim();
