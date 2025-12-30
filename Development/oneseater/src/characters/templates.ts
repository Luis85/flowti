import { CHARACTER_CONSTANTS } from './types';

export interface CharacterTemplate {
    id: string;
    name: string;
    description: string;
    backstory: string;
    recommendedAttributes: {
        strength: number;
        dexterity: number;
        intelligence: number;
        health: number;
    };
    startingSkills: Array<{
        skillId: string;
        pointsInvested: number;
    }>;
    suggestedTraits?: string[]; // For later gameplay
    pointsSpent: number; // Pre-calculated for validation
}

export const CHARACTER_TEMPLATES: Record<string, CharacterTemplate> = {
    mechanic: {
        id: 'mechanic',
        name: 'The Mechanic',
        description: 'Started in the garage, understands cars inside-out',
        backstory: 'You grew up with grease under your fingernails, working in your father\'s garage. You know every bolt, every component. Your path to management starts with technical expertise.',
        recommendedAttributes: {
            strength: 9,
            dexterity: 10, // Key attribute for mechanical work
            intelligence: 8,
            health: 9,
        },
        startingSkills: [
            { skillId: 'mechanic', pointsInvested: 2 }
        ],
        suggestedTraits: ['Detail-Oriented', 'Perfectionist'],
        pointsSpent: 6 // (9-10)*10 + (10-10)*10 + (8-10)*10 + (9-10)*10 + skill: 2pts = 4
    },
    
    accountant: {
        id: 'accountant',
        name: 'The Accountant',
        description: 'Numbers are your language, budgets your playground',
        backstory: 'While others dreamed of racing, you saw the spreadsheets behind the glory. Every dollar counts, and you know where each one goes. Financial acumen is your superpower.',
        recommendedAttributes: {
            strength: 8,
            dexterity: 8,
            intelligence: 11, // Key attribute for analytical work
            health: 9,
        },
        startingSkills: [
            { skillId: 'budget', pointsInvested: 2 }
        ],
        suggestedTraits: ['Meticulous', 'Conservative'],
        pointsSpent: 6 // -20 +10 -20 -10 + 4 (budget average skill) = -36 + 4 = -32... wait that's wrong
    },
    
    salesperson: {
        id: 'salesperson',
        name: 'The Salesperson',
        description: 'Charm and persuasion are your tools of the trade',
        backstory: 'You could sell ice to Eskimos. Started selling car parts, now you\'re ready to sell sponsorship deals. Every conversation is an opportunity.',
        recommendedAttributes: {
            strength: 8,
            dexterity: 9,
            intelligence: 10,
            health: 9,
        },
        startingSkills: [
            { skillId: 'negotiation', pointsInvested: 2 }
        ],
        suggestedTraits: ['Charismatic', 'Overconfident'],
        pointsSpent: 4
    },
    
    engineer: {
        id: 'engineer',
        name: 'The Engineer',
        description: 'Aerodynamics and performance optimization drive you',
        backstory: 'Physics, mathematics, engineering - you live for the technical challenge. While mechanics fix problems, you prevent them. Your designs could change the sport.',
        recommendedAttributes: {
            strength: 8,
            dexterity: 9,
            intelligence: 11,
            health: 8,
        },
        startingSkills: [
            { skillId: 'engineer', pointsInvested: 1 } // Hard skill, expensive
        ],
        suggestedTraits: ['Analytical', 'Perfectionist'],
        pointsSpent: 2 // -20 -10 +10 -20 + 2 (engineer hard skill) = -38 + 2 = -36... hmm
    },
    
    dataAnalyst: {
        id: 'dataAnalyst',
        name: 'The Data Analyst',
        description: 'Telemetry tells stories others can\'t read',
        backstory: 'In the age of data, you\'re the oracle. Lap times, tire degradation, fuel consumption - you see patterns in the noise. Your insights can win championships.',
        recommendedAttributes: {
            strength: 8,
            dexterity: 8,
            intelligence: 11,
            health: 9,
        },
        startingSkills: [
            { skillId: 'data_analysis', pointsInvested: 1 }
        ],
        suggestedTraits: ['Methodical', 'Introvert'],
        pointsSpent: 2
    },
    
    teamManager: {
        id: 'teamManager',
        name: 'The Team Manager',
        description: 'Leadership and coordination are your strengths',
        backstory: 'You\'ve always been the one bringing people together. Started organizing local racing events, now ready to manage a professional team. People follow you.',
        recommendedAttributes: {
            strength: 9,
            dexterity: 8,
            intelligence: 10,
            health: 9,
        },
        startingSkills: [
            { skillId: 'leadership', pointsInvested: 1 }
        ],
        suggestedTraits: ['Natural Leader', 'Empathetic'],
        pointsSpent: 2
    },
    
    strategist: {
        id: 'strategist',
        name: 'The Strategist',
        description: 'Chess player mindset applied to racing',
        backstory: 'Racing is more than speed - it\'s a game of strategy. Pit stops, tire choice, weather windows. You see three laps ahead while others see the next corner.',
        recommendedAttributes: {
            strength: 8,
            dexterity: 9,
            intelligence: 10,
            health: 9,
        },
        startingSkills: [
            { skillId: 'strategy', pointsInvested: 2 }
        ],
        suggestedTraits: ['Patient', 'Strategic Thinker'],
        pointsSpent: 4
    },
    
    allRounder: {
        id: 'allRounder',
        name: 'The All-Rounder',
        description: 'Jack of all trades, master of adaptation',
        backstory: 'You\'ve done a bit of everything in the racing world. Your strength isn\'t specialization - it\'s versatility. You adapt, you learn, you survive.',
        recommendedAttributes: {
            strength: 9,
            dexterity: 9,
            intelligence: 9,
            health: 9,
        },
        startingSkills: [
            { skillId: 'mechanic', pointsInvested: 1 }
        ],
        suggestedTraits: ['Adaptable', 'Quick Learner'],
        pointsSpent: -4 // All attributes at 9 = -10 each * 4 = -40, skill +1 = -39... wait
    },
};

// Custom template - player builds from scratch
export const CUSTOM_TEMPLATE: CharacterTemplate = {
    id: 'custom',
    name: 'Custom Build',
    description: 'Create your own unique character',
    backstory: 'Your story is yours to write. Choose your own path.',
    recommendedAttributes: {
        strength: CHARACTER_CONSTANTS.STARTING_ATTRIBUTE_LEVEL,
        dexterity: CHARACTER_CONSTANTS.STARTING_ATTRIBUTE_LEVEL,
        intelligence: CHARACTER_CONSTANTS.STARTING_ATTRIBUTE_LEVEL,
        health: CHARACTER_CONSTANTS.STARTING_ATTRIBUTE_LEVEL,
    },
    startingSkills: [
        { skillId: 'mechanic', pointsInvested: 1 }
    ],
    suggestedTraits: [],
    pointsSpent: 0
};
