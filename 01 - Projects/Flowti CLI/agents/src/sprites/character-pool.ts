/**
 * character-pool.ts — Domain-based character sprite assignment.
 *
 * Maps agent domains to pools of Ninja Adventure character folder names.
 * Uses a deterministic name hash so the same agent always gets the same sprite.
 */

export const DOMAIN_POOLS: Record<string, readonly string[]> = {
	engineering: ["NinjaBlue", "NinjaGreen", "NinjaDark", "NinjaRed", "NinjaGray", "NinjaMageBlack"],
	design: ["Princess", "Woman", "Villager", "Villager2", "EggGirl", "Cavegirl"],
	product: ["Noble", "Inspector", "Master", "Sultan"],
	management: ["Samurai", "SamuraiBlue", "Knight", "KnightGold", "SamuraiRed"],
	quality: ["Monk", "Monk2", "Shaman"],
	analysis: ["SorcererBlack", "SorcererOrange", "NinjaMageOrange"],
	operations: ["RobotGrey", "RobotGreen", "RobotCamouflage"],
	marketing: ["Villager3", "Villager4", "Villager5", "OldMan", "Boy"],
	orchestration: ["GoldStatue", "RedGladiator", "GladiatorBlue"],
	fallback: ["Child", "Eskimo", "Flam", "Hunter", "ManGreen"],
};

const DOMAIN_ALIASES: Record<string, string> = {
	engineering: "engineering", qa: "engineering", devops: "engineering",
	development: "engineering", testing: "engineering",
	design: "design", ux: "design",
	product: "product",
	management: "management", delivery: "management", coordination: "management",
	quality: "quality",
	analysis: "analysis",
	operations: "operations",
	marketing: "marketing", sales: "marketing", support: "marketing",
	orchestration: "orchestration",
};

function nameHash(name: string): number {
	let hash = 0;
	for (let i = 0; i < name.length; i++) {
		hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
	}
	return Math.abs(hash);
}

export function resolveCharacter(agentName: string, domain: string): string {
	const poolKey = DOMAIN_ALIASES[domain.toLowerCase()] ?? "fallback";
	const pool = DOMAIN_POOLS[poolKey] ?? DOMAIN_POOLS["fallback"];
	const index = nameHash(agentName) % pool.length;
	return pool[index];
}
