
export interface CharacterAttributes {
	strength: number;      // ST - Physical power
	dexterity: number;     // DX - Agility and coordination
	intelligence: number;  // IQ - Mental capacity
	health: number;        // HT - Endurance and vitality
}

export interface CharacterSkill {
	name: string;
	level: number;
	cost: number;
}

export interface CharacterTrait {
	name: string;
	description: string;
	cost: number;  // positive for advantages, negative for disadvantages
	type: 'advantage' | 'disadvantage';
}

export interface CharacterData {
	name: string;
	attributes: CharacterAttributes;
	skills: CharacterSkill[];
	traits: CharacterTrait[];
	totalPoints: number;
	spentPoints: number;
}
