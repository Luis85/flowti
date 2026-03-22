export type PetUtilityRole = "scout" | "fetch" | "audit" | "echo" | "triage";

export interface PetUtility {
	readonly role: PetUtilityRole;
	utilityScore: number;
	lastAction?: string;
	bondedAgent?: string;
	bondStrength: number;
}

export const PET_ROLES: Record<string, PetUtilityRole> = {
	cat: "scout",
	dog: "fetch",
	owl: "audit",
	parrot: "echo",
	fox: "triage",
};

export function getRoleForPetType(petType: string): PetUtilityRole | undefined {
	// Extract base type from pet entity ID (e.g., "cat-hub" → "cat")
	const base = petType.split("-")[0];
	return PET_ROLES[base];
}

export function createPetUtility(petType: string): PetUtility | undefined {
	const role = getRoleForPetType(petType);
	if (!role) return undefined;
	return { role, utilityScore: 0, bondStrength: 0 };
}

export function recordUtilityAction(utility: PetUtility, action: string): PetUtility {
	return { ...utility, utilityScore: utility.utilityScore + 1, lastAction: action };
}

export function updateBond(utility: PetUtility, nearestAgent: string | null, deltaMs: number): PetUtility {
	if (!nearestAgent) return utility;
	const BOND_RATE = 0.001; // per ms of proximity
	if (utility.bondedAgent === nearestAgent) {
		const newStrength = Math.min(100, utility.bondStrength + deltaMs * BOND_RATE);
		return { ...utility, bondStrength: newStrength };
	}
	// New agent proximity — reset if stronger bond candidate
	if (utility.bondStrength < 10) {
		return { ...utility, bondedAgent: nearestAgent, bondStrength: Math.min(100, deltaMs * BOND_RATE) };
	}
	// Existing bond decays slowly
	return { ...utility, bondStrength: Math.max(0, utility.bondStrength - deltaMs * BOND_RATE * 0.1) };
}

export function getBondMoraleBonus(utility: PetUtility): number {
	if (!utility.bondedAgent || utility.bondStrength < 25) return 0;
	return 5; // +5 morale per cycle when bonded
}

export const ROLE_DESCRIPTIONS: Record<PetUtilityRole, string> = {
	scout: "Patrols vault, spots untagged notes",
	fetch: "Retrieves related notes for working agents",
	audit: "Watches for stale content",
	echo: "Re-surfaces past events as reminders",
	triage: "Prioritizes inbox by urgency",
};
