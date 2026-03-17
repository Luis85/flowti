/**
 * Marketplace Domain Models
 * 
 * Defines all types for the in-game marketplace where players
 * can purchase equipment, staff, data packages, and upgrades.
 */

// ═══════════════════════════════════════════════════════════════════════════
// Enums & Constants
// ═══════════════════════════════════════════════════════════════════════════

export type MarketCategoryId = 
  | "equipment" 
  | "staff" 
  | "data" 
  | "upgrades" 
  | "training";

export type ItemRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export type ItemEffectType = 
  | "xp_boost"           // Percentage XP gain boost
  | "energy_efficiency"  // Reduce energy cost per task
  | "task_speed"         // Complete tasks faster
  | "income_boost"       // Percentage income boost
  | "unlock_feature"     // Unlocks new game features
  | "capacity_increase"  // More orders, staff slots, etc.
  | "data_access"        // Access to specific F1 data
  | "skill_training";    // Improve specific skill

export type PurchaseStatus = "pending" | "completed" | "failed" | "refunded";

// ═══════════════════════════════════════════════════════════════════════════
// Core Interfaces
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Describes an effect that an item provides when owned/active
 */
export interface ItemEffect {
  type: ItemEffectType;
  value: number;           // e.g., 10 for 10% boost
  duration?: number;       // In game-minutes, undefined = permanent
  description: string;
}

/**
 * Requirements to purchase an item
 */
export interface PurchaseRequirements {
  minLevel?: number;
  minXp?: number;
  requiredItems?: string[];      // Item IDs that must be owned
  requiredUpgrades?: string[];   // Upgrade IDs that must be active
}

/**
 * A purchasable item in the marketplace
 */
export interface MarketItem {
  id: string;
  name: string;
  description: string;
  category: MarketCategoryId;
  rarity: ItemRarity;
  icon: string;                  // Emoji or icon identifier
  
  // Pricing
  basePrice: number;
  currentPrice: number;          // May fluctuate based on market conditions
  
  // Effects
  effects: ItemEffect[];
  
  // Availability
  isAvailable: boolean;
  stock?: number;                // undefined = unlimited
  restockTime?: number;          // Game-minutes until restock
  
  // Requirements
  requirements: PurchaseRequirements;
  
  // Metadata
  isConsumable: boolean;         // One-time use vs permanent
  isStackable: boolean;          // Can own multiple
  maxStack?: number;
}

/**
 * Category definition for marketplace navigation
 */
export interface MarketCategory {
  id: MarketCategoryId;
  name: string;
  icon: string;
  description: string;
  sortOrder: number;
}

/**
 * A completed or pending purchase
 */
export interface Purchase {
  id: string;
  itemId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  status: PurchaseStatus;
  purchasedAt: number;           // Game timestamp (minuteOfDay + dayIndex * 1440)
  completedAt?: number;
}

/**
 * Player's inventory entry
 */
export interface InventoryItem {
  itemId: string;
  quantity: number;
  acquiredAt: number;
  expiresAt?: number;            // For consumables with duration
  isActive: boolean;             // For toggleable items
}

/**
 * Market state snapshot for the ViewModel
 */
export interface MarketState {
  categories: MarketCategory[];
  listings: MarketItem[];
  playerBalance: number;
  playerInventory: InventoryItem[];
  selectedCategory: MarketCategoryId | null;
  selectedItem: MarketItem | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Default Categories
// ═══════════════════════════════════════════════════════════════════════════

export const MARKET_CATEGORIES: MarketCategory[] = [
  {
    id: "equipment",
    name: "Equipment",
    icon: "🔧",
    description: "Tools and hardware to improve your consulting business",
    sortOrder: 1,
  },
  {
    id: "staff",
    name: "Staff",
    icon: "👥",
    description: "Hire analysts, engineers, and specialists",
    sortOrder: 2,
  },
  {
    id: "data",
    name: "Data Packages",
    icon: "📊",
    description: "Historical F1 data and telemetry bundles",
    sortOrder: 3,
  },
  {
    id: "upgrades",
    name: "Upgrades",
    icon: "🏎️",
    description: "Improve your office and service offerings",
    sortOrder: 4,
  },
  {
    id: "training",
    name: "Training",
    icon: "📚",
    description: "Courses and certifications to boost your skills",
    sortOrder: 5,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Rarity Configuration
// ═══════════════════════════════════════════════════════════════════════════

export const RARITY_CONFIG: Record<ItemRarity, { color: string; priceMultiplier: number }> = {
  common: { color: "#9ca3af", priceMultiplier: 1.0 },
  uncommon: { color: "#22c55e", priceMultiplier: 1.5 },
  rare: { color: "#3b82f6", priceMultiplier: 2.5 },
  epic: { color: "#a855f7", priceMultiplier: 4.0 },
  legendary: { color: "#f59e0b", priceMultiplier: 8.0 },
};
