
import { MessageTemplate } from "src/messages/types";
import { defaultTimeOfDayFactor } from "src/simulation/utils";

/**
 * Customer Purchase Order Message Catalog
 * 
 * Templates with various ordering patterns:
 * - Known products only (customer orders from catalog)
 * - Unknown products only (customer asks for things we don't have)
 * - Mixed (some known, some unknown)
 * - No line items (just description - needs manual processing)
 */
export const CUSTOMER_PURCHASE_ORDER_CATALOG: MessageTemplate[] = [
	// ═══════════════════════════════════════════════════════════════
	// KNOWN PRODUCTS - Orders from actual catalog
	// ═══════════════════════════════════════════════════════════════

	{
		id: "po-known-bulk-01",
		type: "CustomerPurchaseOrder",
		subject: "Bulk order for corporate event",
		body: "Hi! We're organizing a corporate event and would like to order some of your products. Please confirm availability and pricing.",
		author: "Sarah Chen (TechCorp Events)",
		priority: "1 - High",
		possible_actions: ["read", "delete", "accept", "decline", "spam"],
		weight: 1.5,
		tags: ["sales", "order", "bulk"],
		soft: {
			timeOfDayFactor: (m) => defaultTimeOfDayFactor(m) * 1.2,
			weekendFactor: (w) => (w ? 0.3 : 1.0), // Business orders mostly weekdays
		},
		lineItemsStrategy: {
			type: "known_products",
			count: [2, 4], // 2-4 different products
			quantityRange: [10, 50], // Bulk quantities
		},
	},

	{
		id: "po-known-single-01",
		type: "CustomerPurchaseOrder",
		subject: "Quick question about your service",
		body: "Hey, I'm interested in working with you. Do you have availability next week? How much would it cost?",
		author: "Mike Rodriguez",
		priority: "2 - Medium",
		possible_actions: ["read", "delete", "accept", "decline", "spam"],
		weight: 2.0,
		tags: ["sales", "order", "service"],
		soft: {
			timeOfDayFactor: (m) => (m < 360 ? 0.2 : m < 1020 ? 1.0 : 0.6),
			weekendFactor: (w) => (w ? 0.7 : 1.0),
		},
		lineItemsStrategy: {
			type: "known_products",
			count: 1, // Single product/service
			quantityRange: [1, 3],
		},
	},

	{
		id: "po-known-casual-01",
		type: "CustomerPurchaseOrder",
		subject: "Yo, want to buy stuff",
		body: "Yo! Saw your products online, looking pretty sweet. Can I order some? Let me know the total. Thanks!",
		author: "Alex (Customer)",
		priority: "2 - Medium",
		possible_actions: ["read", "delete", "accept", "decline", "spam"],
		weight: 1.8,
		tags: ["sales", "order", "casual"],
		soft: {
			timeOfDayFactor: (m) => (m < 360 ? 0.1 : m < 540 ? 0.5 : 1.0),
			weekendFactor: (w) => (w ? 1.2 : 0.8), // Casual customers more active on weekends
		},
		lineItemsStrategy: {
			type: "known_products",
			count: [1, 3],
			quantityRange: [1, 5],
		},
	},

	{
		id: "po-known-urgent-01",
		type: "CustomerPurchaseOrder",
		subject: "URGENT: Need delivery ASAP!!!",
		body: "Hi, we URGENTLY need these items delivered. Can you ship TODAY? Budget is not an issue if you can rush this. Please confirm immediately!",
		author: "Jennifer Park (Urgent Delivery Co)",
		priority: "0 - Urgent",
		possible_actions: ["read", "delete", "accept", "decline", "spam"],
		weight: 0.5, // Rare
		tags: ["sales", "order", "urgent", "premium"],
		soft: {
			timeOfDayFactor: (m) => 1.0, // Can happen anytime
			weekendFactor: (w) => (w ? 0.4 : 1.0),
		},
		lineItemsStrategy: {
			type: "known_products",
			count: [1, 2],
			quantityRange: [5, 20],
		},
	},

	// ═══════════════════════════════════════════════════════════════
	// UNKNOWN PRODUCTS - Customer wants things we don't offer
	// ═══════════════════════════════════════════════════════════════

	{
		id: "po-unknown-custom-01",
		type: "CustomerPurchaseOrder",
		subject: "Custom merchandise inquiry",
		body: "Hello, I'm looking for custom team jerseys and branded water bottles. Do you offer these? If not, can you source them? We need about 100 units.",
		author: "David Kim (Sports League)",
		priority: "2 - Medium",
		possible_actions: ["read", "delete", "decline", "respond", "spam"],
		weight: 1.0,
		tags: ["sales", "inquiry", "custom"],
		soft: {
			timeOfDayFactor: (m) => defaultTimeOfDayFactor(m),
			weekendFactor: (w) => (w ? 0.5 : 1.0),
		},
		lineItemsStrategy: {
			type: "unknown_products",
			products: [
				{ name: "Custom Team Jerseys", quantity: [50, 100], estimatedPrice: 45 },
				{ name: "Branded Water Bottles", quantity: [100, 200], estimatedPrice: 8 },
			],
		},
	},

	{
		id: "po-unknown-wishful-01",
		type: "CustomerPurchaseOrder",
		subject: "Do you have premium packages?",
		body: "Hi! I saw your services and they look great. Do you also offer VIP packages with priority support and dedicated account management? That's what I'm looking for.",
		author: "Emily Watson",
		priority: "2 - Medium",
		possible_actions: ["read", "delete", "decline", "respond", "spam"],
		weight: 0.8,
		tags: ["sales", "inquiry", "premium"],
		soft: {
			timeOfDayFactor: (m) => defaultTimeOfDayFactor(m),
			weekendFactor: (w) => (w ? 0.6 : 1.0),
		},
		lineItemsStrategy: {
			type: "unknown_products",
			products: [
				{ name: "VIP Package with Priority Support", quantity: 1, estimatedPrice: 500 },
			],
		},
	},

	// ═══════════════════════════════════════════════════════════════
	// MIXED - Some known, some unknown
	// ═══════════════════════════════════════════════════════════════

	{
		id: "po-mixed-expansion-01",
		type: "CustomerPurchaseOrder",
		subject: "Expanding our partnership",
		body: "Hey, we've been happy customers and want to expand our order. We'd like the usual items PLUS some additional custom merchandise. Can you help?",
		author: "Robert Johnson (Returning Customer)",
		priority: "1 - High",
		possible_actions: ["read", "delete", "accept", "decline", "respond", "spam"],
		weight: 1.2,
		tags: ["sales", "order", "returning-customer", "expansion"],
		soft: {
			timeOfDayFactor: (m) => defaultTimeOfDayFactor(m) * 1.1,
			weekendFactor: (w) => (w ? 0.4 : 1.0),
		},
		lineItemsStrategy: {
			type: "mixed",
			knownCount: 2, // 2 products from catalog
			unknownProducts: [
				{ name: "Custom Branded Merchandise", quantity: [20, 50], estimatedPrice: 15 },
			],
		},
	},

	{
		id: "po-mixed-bundle-01",
		type: "CustomerPurchaseOrder",
		subject: "Bundle deal inquiry",
		body: "Looking to order your services but also need some add-ons. Can you package everything together at a discount?",
		author: "Lisa Anderson",
		priority: "2 - Medium",
		possible_actions: ["read", "delete", "accept", "decline", "respond", "spam"],
		weight: 1.0,
		tags: ["sales", "order", "bundle", "discount"],
		soft: {
			timeOfDayFactor: (m) => defaultTimeOfDayFactor(m),
			weekendFactor: (w) => (w ? 0.8 : 1.0),
		},
		lineItemsStrategy: {
			type: "mixed",
			knownCount: 1,
			unknownProducts: [
				{ name: "Rush Delivery Service", quantity: 1, estimatedPrice: 50 },
				{ name: "Extended Warranty", quantity: 1, estimatedPrice: 100 },
			],
		},
	},

	// ═══════════════════════════════════════════════════════════════
	// NO LINE ITEMS - Just descriptions (needs manual processing)
	// ═══════════════════════════════════════════════════════════════

	{
		id: "po-vague-01",
		type: "CustomerPurchaseOrder",
		subject: "Interested in your offerings",
		body: "Hi there! I've been following your work and I'm interested in what you offer. Could you send me a quote for a comprehensive package? My budget is flexible. Looking forward to hearing from you!",
		author: "Chris Taylor",
		priority: "3 - Low",
		possible_actions: ["read", "delete", "respond", "decline", "spam"],
		weight: 0.8,
		tags: ["sales", "inquiry", "vague"],
		soft: {
			timeOfDayFactor: (m) => defaultTimeOfDayFactor(m),
			weekendFactor: (w) => (w ? 1.0 : 1.0),
		},
		lineItemsStrategy: {
			type: "none", // No specific items mentioned
		},
	},

	{
		id: "po-consultation-01",
		type: "CustomerPurchaseOrder",
		subject: "Partnership opportunity",
		body: "Good day! We're exploring potential partnerships and your company seems like a great fit. Could we schedule a call to discuss how we might work together? We have a significant budget allocated for Q1.",
		author: "Patricia Miller (Business Development)",
		priority: "1 - High",
		possible_actions: ["read", "delete", "respond", "decline", "spam"],
		weight: 0.6,
		tags: ["sales", "inquiry", "partnership", "high-value"],
		soft: {
			timeOfDayFactor: (m) => (m < 360 ? 0.1 : m < 1020 ? 1.0 : 0.3), // Business hours
			weekendFactor: (w) => (w ? 0.2 : 1.0),
		},
		lineItemsStrategy: {
			type: "none",
		},
	},

	{
		id: "po-confused-01",
		type: "CustomerPurchaseOrder",
		subject: "Question about pricing",
		body: "Hey, your website is a bit confusing. How much does everything cost? Do you have a price list I can look at? Also, do you ship internationally?",
		author: "Random Customer",
		priority: "3 - Low",
		possible_actions: ["read", "delete", "respond", "spam", "decline", "spam"],
		weight: 1.5,
		tags: ["sales", "inquiry", "support"],
		soft: {
			timeOfDayFactor: (m) => 1.0, // Anytime
			weekendFactor: (w) => (w ? 1.0 : 1.0),
		},
		lineItemsStrategy: {
			type: "none",
		},
	},

	// ═══════════════════════════════════════════════════════════════
	// SPAM / LOW QUALITY
	// ═══════════════════════════════════════════════════════════════

	{
		id: "po-spam-01",
		type: "CustomerPurchaseOrder",
		subject: "CLICK HERE FOR AMAZING DEALS!!!",
		body: "Dear Valued Customer, We have AMAZING offers just for YOU! Click here to claim your FREE gift! Limited time only! ACT NOW!!!",
		author: "Definitely.Not.Spam@totallylegal.biz",
		priority: "3 - Low",
		possible_actions: ["read", "delete", "spam", "decline", "spam"],
		weight: 0.5,
		tags: ["spam"],
		soft: {
			timeOfDayFactor: (m) => 1.0,
			weekendFactor: (w) => 1.0,
		},
		lineItemsStrategy: {
			type: "none",
		},
	},

	{
		id: "po-typo-01",
		type: "CustomerPurchaseOrder",
		subject: "need stuf plz",
		body: "yo can i get ur stuff? how much? need it fast lol. hmu",
		author: "Customer",
		priority: "3 - Low",
		possible_actions: ["read", "delete", "respond", "spam", "decline"],
		weight: 1.0,
		tags: ["sales", "low-quality"],
		soft: {
			timeOfDayFactor: (m) => (m < 360 ? 0.5 : 1.0),
			weekendFactor: (w) => (w ? 1.5 : 0.8), // More common on weekends
		},
		lineItemsStrategy: {
			type: "known_products",
			count: 1,
			quantityRange: [1, 2],
		},
	},
];

/**
 * Get total weight of all templates
 */
export function getTotalWeight(): number {
	return CUSTOMER_PURCHASE_ORDER_CATALOG.reduce((sum, t) => sum + t.weight, 0);
}

/**
 * Get template statistics
 */
export function getTemplateStats() {
	return {
		total: CUSTOMER_PURCHASE_ORDER_CATALOG.length,
		knownProducts: CUSTOMER_PURCHASE_ORDER_CATALOG.filter(
			(t) => t.lineItemsStrategy?.type === "known_products"
		).length,
		unknownProducts: CUSTOMER_PURCHASE_ORDER_CATALOG.filter(
			(t) => t.lineItemsStrategy?.type === "unknown_products"
		).length,
		mixed: CUSTOMER_PURCHASE_ORDER_CATALOG.filter(
			(t) => t.lineItemsStrategy?.type === "mixed"
		).length,
		noLineItems: CUSTOMER_PURCHASE_ORDER_CATALOG.filter(
			(t) => t.lineItemsStrategy?.type === "none" || !t.lineItemsStrategy
		).length,
		totalWeight: getTotalWeight(),
	};
}
