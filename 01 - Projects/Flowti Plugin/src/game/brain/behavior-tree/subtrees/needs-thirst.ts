/**
 * needs-thirst.ts — MDSL subtree for thirst satisfaction.
 *
 * When thirst is low, agent seeks a drink station and drinks.
 */

export const NEEDS_THIRST_SUBTREE = `
root [NeedsThirst] {
	sequence {
		condition [IsThirsty]
		action [SeekDrinkStation]
		action [Drink]
	}
}
`.trim();
