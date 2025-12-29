/**
 * Marketplace Events
 * 
 * Events for marketplace interactions
 */

import { MarketItem, Purchase } from "src/market/models/MarketTypes";


/**
 * Fired when a player attempts to purchase an item
 */
export class PurchaseRequestedEvent {
  static readonly type = "PurchaseRequestedEvent";
  
  constructor(
    public readonly item: MarketItem,
    public readonly quantity: number = 1
  ) {}
}

/**
 * Fired when a purchase is successfully completed
 */
export class PurchaseCompletedEvent {
  static readonly type = "PurchaseCompletedEvent";
  
  constructor(
    public readonly purchase: Purchase,
    public readonly item: MarketItem
  ) {}
}

/**
 * Fired when a purchase fails (insufficient funds, requirements not met, etc.)
 */
export class PurchaseFailedEvent {
  static readonly type = "PurchaseFailedEvent";
  
  constructor(
    public readonly item: MarketItem,
    public readonly reason: string
  ) {}
}

/**
 * Fired when the market inventory refreshes (restock, new items, etc.)
 */
export class MarketRefreshedEvent {
  static readonly type = "MarketRefreshedEvent";
  
  constructor(
    public readonly items: MarketItem[]
  ) {}
}

/**
 * Fired when player selects a category in the market UI
 */
export class MarketCategorySelectedEvent {
  static readonly type = "MarketCategorySelectedEvent";
  
  constructor(
    public readonly categoryId: string | null
  ) {}
}

/**
 * Fired when player selects an item to view details
 */
export class MarketItemSelectedEvent {
  static readonly type = "MarketItemSelectedEvent";
  
  constructor(
    public readonly item: MarketItem | null
  ) {}
}
