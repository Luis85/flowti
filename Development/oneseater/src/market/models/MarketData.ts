/**
 * Initial Market Listings
 * 
 * Seed data for the marketplace. In production, this could be
 * loaded from a JSON file or generated procedurally.
 */

import { MarketItem } from "./MarketTypes";

export const INITIAL_MARKET_ITEMS: MarketItem[] = [
  // ═══════════════════════════════════════════════════════════════════════
  // EQUIPMENT
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: "eq-laptop-basic",
    name: "Basic Analysis Laptop",
    description: "A decent laptop for running basic telemetry analysis. Nothing fancy, but gets the job done.",
    category: "equipment",
    rarity: "common",
    icon: "💻",
    basePrice: 500,
    currentPrice: 500,
    effects: [
      { type: "task_speed", value: 5, description: "+5% task completion speed" }
    ],
    isAvailable: true,
    requirements: {},
    isConsumable: false,
    isStackable: false,
  },
  {
    id: "eq-laptop-pro",
    name: "Pro Analysis Workstation",
    description: "High-performance workstation with dedicated GPU for complex simulations and data processing.",
    category: "equipment",
    rarity: "rare",
    icon: "🖥️",
    basePrice: 2500,
    currentPrice: 2500,
    effects: [
      { type: "task_speed", value: 15, description: "+15% task completion speed" },
      { type: "data_access", value: 1, description: "Enables advanced telemetry analysis" }
    ],
    isAvailable: true,
    requirements: { minLevel: 5 },
    isConsumable: false,
    isStackable: false,
  },
  {
    id: "eq-monitor-ultrawide",
    name: "Ultrawide Racing Monitor",
    description: "49-inch curved display perfect for side-by-side data comparison.",
    category: "equipment",
    rarity: "uncommon",
    icon: "🖵",
    basePrice: 800,
    currentPrice: 800,
    effects: [
      { type: "xp_boost", value: 10, description: "+10% XP gain from analysis tasks" }
    ],
    isAvailable: true,
    requirements: {},
    isConsumable: false,
    isStackable: false,
  },
  {
    id: "eq-coffee-machine",
    name: "Espresso Machine Deluxe",
    description: "Because great analysis requires great coffee. Reduces energy drain during work.",
    category: "equipment",
    rarity: "common",
    icon: "☕",
    basePrice: 350,
    currentPrice: 350,
    effects: [
      { type: "energy_efficiency", value: 5, description: "-5% energy cost per task" }
    ],
    isAvailable: true,
    requirements: {},
    isConsumable: false,
    isStackable: false,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // STAFF
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: "staff-intern",
    name: "Data Analyst Intern",
    description: "Fresh from university, eager to learn. Handles basic data entry and report formatting.",
    category: "staff",
    rarity: "common",
    icon: "🧑‍💼",
    basePrice: 1000,
    currentPrice: 1000,
    effects: [
      { type: "capacity_increase", value: 1, description: "+1 concurrent order capacity" }
    ],
    isAvailable: true,
    stock: 3,
    requirements: {},
    isConsumable: false,
    isStackable: true,
    maxStack: 3,
  },
  {
    id: "staff-analyst",
    name: "Senior Performance Analyst",
    description: "5+ years experience in motorsport analytics. Can handle complex client requests.",
    category: "staff",
    rarity: "rare",
    icon: "👨‍💻",
    basePrice: 5000,
    currentPrice: 5000,
    effects: [
      { type: "capacity_increase", value: 2, description: "+2 concurrent order capacity" },
      { type: "income_boost", value: 10, description: "+10% income from consulting orders" }
    ],
    isAvailable: true,
    stock: 1,
    requirements: { minLevel: 8 },
    isConsumable: false,
    isStackable: true,
    maxStack: 2,
  },
  {
    id: "staff-strategist",
    name: "Race Strategy Consultant",
    description: "Former F1 team strategist. Unlocks premium strategy consulting services.",
    category: "staff",
    rarity: "epic",
    icon: "🎯",
    basePrice: 15000,
    currentPrice: 15000,
    effects: [
      { type: "unlock_feature", value: 1, description: "Unlocks 'Race Strategy' service tier" },
      { type: "income_boost", value: 25, description: "+25% income from strategy orders" }
    ],
    isAvailable: true,
    stock: 1,
    requirements: { minLevel: 15, requiredItems: ["staff-analyst"] },
    isConsumable: false,
    isStackable: false,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // DATA PACKAGES
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: "data-historical-2024",
    name: "2024 Season Data Pack",
    description: "Complete race data, results, and basic telemetry from the 2024 F1 season.",
    category: "data",
    rarity: "common",
    icon: "📁",
    basePrice: 200,
    currentPrice: 200,
    effects: [
      { type: "data_access", value: 2024, description: "Access to 2024 season data" }
    ],
    isAvailable: true,
    requirements: {},
    isConsumable: false,
    isStackable: false,
  },
  {
    id: "data-telemetry-basic",
    name: "Basic Telemetry Bundle",
    description: "Speed, throttle, and brake data from public sessions. Good for entry-level analysis.",
    category: "data",
    rarity: "uncommon",
    icon: "📈",
    basePrice: 750,
    currentPrice: 750,
    effects: [
      { type: "data_access", value: 1, description: "Basic telemetry visualization" },
      { type: "xp_boost", value: 5, description: "+5% XP from telemetry tasks" }
    ],
    isAvailable: true,
    requirements: {},
    isConsumable: false,
    isStackable: false,
  },
  {
    id: "data-telemetry-pro",
    name: "Pro Telemetry Suite",
    description: "Full car telemetry including tire temps, fuel load, ERS deployment. Industry standard.",
    category: "data",
    rarity: "rare",
    icon: "📊",
    basePrice: 3000,
    currentPrice: 3000,
    effects: [
      { type: "data_access", value: 2, description: "Advanced telemetry visualization" },
      { type: "unlock_feature", value: 1, description: "Unlocks 'Telemetry Analysis' service" },
      { type: "xp_boost", value: 15, description: "+15% XP from telemetry tasks" }
    ],
    isAvailable: true,
    requirements: { minLevel: 10, requiredItems: ["data-telemetry-basic"] },
    isConsumable: false,
    isStackable: false,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // UPGRADES
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: "upgrade-office-small",
    name: "Office Expansion (Small)",
    description: "Knock down a wall, add some desks. Room for more staff and equipment.",
    category: "upgrades",
    rarity: "uncommon",
    icon: "🏢",
    basePrice: 2000,
    currentPrice: 2000,
    effects: [
      { type: "capacity_increase", value: 2, description: "+2 equipment slots" },
      { type: "capacity_increase", value: 1, description: "+1 staff slot" }
    ],
    isAvailable: true,
    requirements: {},
    isConsumable: false,
    isStackable: false,
  },
  {
    id: "upgrade-reputation-boost",
    name: "Marketing Campaign",
    description: "Get your name out there. Attracts higher-value clients.",
    category: "upgrades",
    rarity: "common",
    icon: "📢",
    basePrice: 500,
    currentPrice: 500,
    effects: [
      { type: "income_boost", value: 10, duration: 1440 * 7, description: "+10% order value for 7 days" }
    ],
    isAvailable: true,
    stock: 5,
    requirements: {},
    isConsumable: true,
    isStackable: true,
    maxStack: 5,
  },
  {
    id: "upgrade-premium-tier",
    name: "Premium Service License",
    description: "Official certification allowing you to offer premium consulting packages.",
    category: "upgrades",
    rarity: "epic",
    icon: "⭐",
    basePrice: 10000,
    currentPrice: 10000,
    effects: [
      { type: "unlock_feature", value: 1, description: "Unlocks 'Premium Consulting' tier" },
      { type: "income_boost", value: 50, description: "+50% income from premium orders" }
    ],
    isAvailable: true,
    requirements: { minLevel: 20, minXp: 10000 },
    isConsumable: false,
    isStackable: false,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // TRAINING
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: "train-data-fundamentals",
    name: "Data Analysis Fundamentals",
    description: "Online course covering statistical methods for motorsport data. Takes 2 hours.",
    category: "training",
    rarity: "common",
    icon: "📖",
    basePrice: 150,
    currentPrice: 150,
    effects: [
      { type: "skill_training", value: 1, description: "Unlocks basic analysis techniques" },
      { type: "xp_boost", value: 100, description: "+100 XP on completion" }
    ],
    isAvailable: true,
    requirements: {},
    isConsumable: true,
    isStackable: false,
  },
  {
    id: "train-python-motorsport",
    name: "Python for Motorsport",
    description: "Learn to write scripts for automated data processing. Significantly speeds up work.",
    category: "training",
    rarity: "uncommon",
    icon: "🐍",
    basePrice: 400,
    currentPrice: 400,
    effects: [
      { type: "task_speed", value: 20, description: "+20% task speed after completion" },
      { type: "xp_boost", value: 250, description: "+250 XP on completion" }
    ],
    isAvailable: true,
    requirements: { requiredItems: ["train-data-fundamentals"] },
    isConsumable: true,
    isStackable: false,
  },
  {
    id: "train-aerodynamics",
    name: "Aerodynamics Masterclass",
    description: "Deep dive into F1 aerodynamics with a former team engineer. Opens new service options.",
    category: "training",
    rarity: "rare",
    icon: "🌬️",
    basePrice: 1500,
    currentPrice: 1500,
    effects: [
      { type: "unlock_feature", value: 1, description: "Unlocks 'Aero Analysis' service" },
      { type: "xp_boost", value: 500, description: "+500 XP on completion" }
    ],
    isAvailable: true,
    requirements: { minLevel: 12 },
    isConsumable: true,
    isStackable: false,
  },
  {
    id: "train-energy-drink",
    name: "Energy Drink (6-pack)",
    description: "Stay awake longer. Restores energy but has diminishing returns if overused.",
    category: "training",
    rarity: "common",
    icon: "🥤",
    basePrice: 25,
    currentPrice: 25,
    effects: [
      { type: "energy_efficiency", value: 20, duration: 120, description: "+20 energy restored" }
    ],
    isAvailable: true,
    stock: 10,
    restockTime: 1440,
    requirements: {},
    isConsumable: true,
    isStackable: true,
    maxStack: 10,
  },
];
