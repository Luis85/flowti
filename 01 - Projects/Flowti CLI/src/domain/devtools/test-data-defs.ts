/**
 * test-data-defs.ts — Reference data definitions for supply chain analytics test data.
 */

// ── Reference data (static) ─────────────────────────────

export interface Item {
	id: string;
	name: string;
	category: string;
	price: number;
	cost: number;
	supplier: string;
}

export interface Supplier {
	id: string;
	name: string;
	region: string;
	country: string;
}

export interface Customer {
	id: string;
	name: string;
	segment: string;
	region: string;
	credit: number;
}

export const ITEMS: Item[] = [
	{ id: "ITM-001", name: "Wireless Mouse",          category: "Electronics",      price: 29.99,  cost: 24.50, supplier: "SUP-A" },
	{ id: "ITM-002", name: "Mechanical Keyboard",      category: "Electronics",      price: 89.99,  cost: 72.00, supplier: "SUP-A" },
	{ id: "ITM-003", name: "USB-C Hub",                category: "Electronics",      price: 45.50,  cost: 36.00, supplier: "SUP-C" },
	{ id: "ITM-004", name: "Monitor Stand",            category: "Furniture",         price: 64.00,  cost: 48.00, supplier: "SUP-D" },
	{ id: "ITM-005", name: "Desk Lamp",                category: "Furniture",         price: 38.50,  cost: 29.00, supplier: "SUP-D" },
	{ id: "ITM-006", name: "Notebook A5",              category: "Office Supplies",   price: 4.99,   cost: 3.20,  supplier: "SUP-B" },
	{ id: "ITM-007", name: "Ballpoint Pen (50pk)",     category: "Office Supplies",   price: 12.50,  cost: 8.50,  supplier: "SUP-B" },
	{ id: "ITM-008", name: "Whiteboard Markers (12pk)",category: "Office Supplies",   price: 8.99,   cost: 6.00,  supplier: "SUP-B" },
	{ id: "ITM-009", name: "Standing Desk Mat",        category: "Furniture",         price: 49.99,  cost: 38.00, supplier: "SUP-D" },
	{ id: "ITM-010", name: "Webcam HD",                category: "Electronics",      price: 59.00,  cost: 47.00, supplier: "SUP-A" },
	{ id: "ITM-011", name: "Cable Management Kit",     category: "Electronics",      price: 15.99,  cost: 11.00, supplier: "SUP-E" },
	{ id: "ITM-012", name: "Filing Cabinet",           category: "Furniture",         price: 124.00, cost: 95.00, supplier: "SUP-D" },
];

export const SUPPLIERS: Supplier[] = [
	{ id: "SUP-A", name: "TechDirect Inc.",           region: "East Coast",  country: "USA" },
	{ id: "SUP-B", name: "OfficePro Supply",          region: "Midwest",     country: "USA" },
	{ id: "SUP-C", name: "GlobalTech Distribution",   region: "West Coast",  country: "USA" },
	{ id: "SUP-D", name: "WorkSpace Solutions",       region: "Southeast",   country: "USA" },
	{ id: "SUP-E", name: "Digital Wholesale Corp.",    region: "Northeast",   country: "USA" },
];

export const CUSTOMERS: Customer[] = [
	{ id: "CUST-001", name: "Acme Corp",          segment: "Enterprise",  region: "Northeast",  credit: 50000 },
	{ id: "CUST-002", name: "Beta Industries",    segment: "Mid-Market",  region: "Southeast",  credit: 25000 },
	{ id: "CUST-003", name: "Cascade Solutions",  segment: "SMB",         region: "West Coast", credit: 10000 },
	{ id: "CUST-004", name: "Delta Group",        segment: "Enterprise",  region: "Midwest",    credit: 75000 },
	{ id: "CUST-005", name: "Echo Partners",      segment: "Mid-Market",  region: "Northeast",  credit: 30000 },
	{ id: "CUST-006", name: "Frontier Labs",      segment: "SMB",         region: "West Coast", credit: 12000 },
	{ id: "CUST-007", name: "GlobalEdge Inc.",    segment: "Enterprise",  region: "East Coast", credit: 60000 },
	{ id: "CUST-008", name: "Horizon Systems",    segment: "Mid-Market",  region: "Southeast",  credit: 20000 },
	{ id: "CUST-009", name: "Infinity Tech",      segment: "SMB",         region: "Midwest",    credit: 8000 },
	{ id: "CUST-010", name: "Jupiter Dynamics",   segment: "Enterprise",  region: "Northeast",  credit: 90000 },
];

export const CATEGORIES: string[] = ["Electronics", "Furniture", "Office Supplies"];

/** Quantity profiles per item (for realistic volumes). */
export function qtyRange(item: Item): [number, number] {
	switch (item.id) {
		case "ITM-006": return [100, 700];   // cheap office supply, high volume
		case "ITM-007": case "ITM-008": return [50, 350];
		case "ITM-011": return [40, 250];
		case "ITM-012": return [3, 25];       // expensive, low volume
		default: return [15, 160];
	}
}

/** Seasonal multiplier per month (1-indexed). Summer ramp, holiday peak, Jan dip. */
export function seasonal(month: number): number {
	return [0, 0.90, 0.95, 1.00, 1.05, 1.08, 1.10, 1.14, 1.17, 1.12, 1.05, 1.20, 1.28][month];
}
