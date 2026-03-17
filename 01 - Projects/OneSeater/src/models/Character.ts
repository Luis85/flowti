import { AttributeType, SkillDifficulty } from "src/characters/types";

export interface CharacterAttributes {
    strength: number;
    dexterity: number;
    intelligence: number;
    health: number;
}

export interface CharacterSkill {
    id: string;
    name: string;
    pointsInvested: number;  // Points spent on this skill
    cost: number;            // Total cost
    governingAttribute: AttributeType;
    difficulty: SkillDifficulty;
}

export interface CharacterTrait {
    name: string;
    description: string;
    cost: number;
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

// Helper function to calculate effective skill level
export function calculateEffectiveSkillLevel(
    skill: CharacterSkill,
    attributeValue: number
): number {
    // Effective level = Governing Attribute + Points bonus
    // We'll use a simplified version for now where invested points translate to levels
    return attributeValue + skill.pointsInvested - 1;
}

// Helper function to calculate skill cost based on points invested
export function calculateSkillCost(
    pointsInvested: number,
    difficulty: SkillDifficulty
): number {
    if (pointsInvested === 0) return 0;
    
    // GURPS progressive costs
    switch (difficulty) {
        case SkillDifficulty.EASY:
            // 1, 2, 4, 8, 12, 16, 20...
            if (pointsInvested === 1) return 1;
            if (pointsInvested === 2) return 2;
            if (pointsInvested === 3) return 4;
            return 4 + (pointsInvested - 3) * 4;
            
        case SkillDifficulty.AVERAGE:
            // 1, 2, 4, 8, 12, 16, 20...
            if (pointsInvested === 1) return 1;
            if (pointsInvested === 2) return 2;
            if (pointsInvested === 3) return 4;
            return 4 + (pointsInvested - 3) * 4;
            
        case SkillDifficulty.HARD:
            // 2, 4, 8, 12, 16, 20...
            if (pointsInvested === 1) return 2;
            if (pointsInvested === 2) return 4;
            if (pointsInvested === 3) return 8;
            return 8 + (pointsInvested - 3) * 4;
            
        case SkillDifficulty.VERY_HARD:
            // 4, 8, 12, 16, 20...
            if (pointsInvested === 1) return 4;
            if (pointsInvested === 2) return 8;
            if (pointsInvested === 3) return 12;
            return 12 + (pointsInvested - 3) * 4;
            
        default:
            return pointsInvested * 2;
    }
}
