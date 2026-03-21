/**
 * needs-energy.ts — MDSL subtree for energy restoration.
 *
 * When energy is low, agent seeks a rest spot and waits until energy is ok.
 */

export const NEEDS_ENERGY_SUBTREE = `
root [NeedsEnergy] {
	sequence {
		condition [IsEnergyLow]
		action [SeekRestSpot]
		action [Rest]
	}
}
`.trim();
