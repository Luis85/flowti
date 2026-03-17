// ============================================================================
// CHARACTER CREATION CONSTANTS
// ============================================================================

export const CHARACTER_CONSTANTS = {
    // Starting values
    STARTING_ATTRIBUTE_LEVEL: 8,
    STARTING_SKILL_LEVEL: 0,
    
    // Point budgets
    TOTAL_CHARACTER_POINTS: 40,
    ATTRIBUTE_BASE_COST: 10, // Cost per attribute point above base
    
    // Attribute ranges
    MIN_ATTRIBUTE: 8,
    MAX_ATTRIBUTE: 14,
    
    ATTRIBUTE_BASELINE: 10, // Cost calculation baseline
} as const;

// ============================================================================
// SKILL SYSTEM CONSTANTS
// ============================================================================

export enum SkillDifficulty {
    EASY = 'Easy',
    AVERAGE = 'Average',
    HARD = 'Hard',
    VERY_HARD = 'Very Hard'
}

export enum AttributeType {
    STRENGTH = 'strength',
    DEXTERITY = 'dexterity',
    INTELLIGENCE = 'intelligence',
    HEALTH = 'health'
}

// Skill costs based on difficulty
export const SKILL_COSTS = {
    [SkillDifficulty.EASY]: {
        level0: 1,    // Attribute-0
        level1: 2,    // Attribute+0 
        level2: 4,    // Attribute+1
        level3: 8,    // Attribute+2
    },
    [SkillDifficulty.AVERAGE]: {
        level0: 1,    // Attribute-1
        level1: 2,    // Attribute+0
        level2: 4,    // Attribute+1
        level3: 8,    // Attribute+2
    },
    [SkillDifficulty.HARD]: {
        level0: 2,    // Attribute-2
        level1: 4,    // Attribute-1
        level2: 8,    // Attribute+0
        level3: 12,   // Attribute+1
    },
    [SkillDifficulty.VERY_HARD]: {
        level0: 4,    // Attribute-3
        level1: 8,    // Attribute-2
        level2: 12,   // Attribute-1
        level3: 16,   // Attribute+0
    }
} as const;


export interface SkillDefinition {
    id: string;
    name: string;
    description: string;
    governingAttribute: AttributeType;
    difficulty: SkillDifficulty;
    category: SkillCategory;
    isStartingSkill: boolean;
}

export enum SkillCategory {
    TECHNICAL = 'Technical',
    MANAGEMENT = 'Management',
    COMMUNICATION = 'Communication',
    ANALYTICAL = 'Analytical'
}

export const AVAILABLE_SKILLS: Record<string, SkillDefinition> = {
    mechanic: {
        id: 'mechanic',
        name: 'Mechanic',
        description: 'Understanding and working with car mechanics',
        governingAttribute: AttributeType.DEXTERITY,
        difficulty: SkillDifficulty.AVERAGE,
        category: SkillCategory.TECHNICAL,
        isStartingSkill: true
    },
    engineer: {
        id: 'engineer',
        name: 'Engineer',
        description: 'Advanced engineering and aerodynamics knowledge',
        governingAttribute: AttributeType.INTELLIGENCE,
        difficulty: SkillDifficulty.HARD,
        category: SkillCategory.TECHNICAL,
        isStartingSkill: false
    },
    strategy: {
        id: 'strategy',
        name: 'Race Strategy',
        description: 'Planning race strategy and pit stops',
        governingAttribute: AttributeType.INTELLIGENCE,
        difficulty: SkillDifficulty.AVERAGE,
        category: SkillCategory.ANALYTICAL,
        isStartingSkill: false
    },
    negotiation: {
        id: 'negotiation',
        name: 'Negotiation',
        description: 'Negotiating contracts and deals',
        governingAttribute: AttributeType.INTELLIGENCE,
        difficulty: SkillDifficulty.AVERAGE,
        category: SkillCategory.COMMUNICATION,
        isStartingSkill: false
    },
    leadership: {
        id: 'leadership',
        name: 'Leadership',
        description: 'Leading and motivating teams',
        governingAttribute: AttributeType.INTELLIGENCE,
        difficulty: SkillDifficulty.HARD,
        category: SkillCategory.MANAGEMENT,
        isStartingSkill: false
    },
    budget: {
        id: 'budget',
        name: 'Budget Management',
        description: 'Managing finances and budgets',
        governingAttribute: AttributeType.INTELLIGENCE,
        difficulty: SkillDifficulty.AVERAGE,
        category: SkillCategory.MANAGEMENT,
        isStartingSkill: false
    },
    driver_coach: {
        id: 'driver_coach',
        name: 'Driver Coaching',
        description: 'Training and improving driver performance',
        governingAttribute: AttributeType.INTELLIGENCE,
        difficulty: SkillDifficulty.HARD,
        category: SkillCategory.COMMUNICATION,
        isStartingSkill: false
    },
    data_analysis: {
        id: 'data_analysis',
        name: 'Data Analysis',
        description: 'Analyzing telemetry and performance data',
        governingAttribute: AttributeType.INTELLIGENCE,
        difficulty: SkillDifficulty.HARD,
        category: SkillCategory.ANALYTICAL,
        isStartingSkill: false
    }
} as const;
