import { Product } from "src/models/Product";

export class ProductStore {
	private _products: Product[] = [];

	// ─────────────────────────────────────────────────────────────────────────
	// Basic Access
	// ─────────────────────────────────────────────────────────────────────────

	get length(): number {
		return this._products.length;
	}

	getAll(): Product[] {
		return [...this._products];
	}

	findById(id: string): Product | undefined {
		return this._products.find(p => p.id === id);
	}

	// Allows iteration: for (const product of store)
	[Symbol.iterator](): Iterator<Product> {
		return this._products[Symbol.iterator]();
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Mutations (called by event handlers/systems, not UI)
	// ─────────────────────────────────────────────────────────────────────────

	add(product: Product): void {
		this._products.push(product);
	}

	update(product: Product): boolean {
		const index = this._products.findIndex(p => p.id === product.id);
		if (index === -1) return false;
		this._products[index] = product;
		return true;
	}

	remove(id: string): boolean {
		const index = this._products.findIndex(p => p.id === id);
		if (index === -1) return false;
		this._products.splice(index, 1);
		return true;
	}

	setAll(products: Product[]): void {
		this._products = [...products];
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Queries
	// ─────────────────────────────────────────────────────────────────────────

	getSellableProducts(): Product[] {
		return this._products.filter(p => p.flags.sellable && p.isActive);
	}

	getAvailableServices(): Product[] {
		return this._products.filter(p => p.category === "service" && p.isActive);
	}

	calculateInventoryValue(): number {
		return this._products
			.filter(p => p.flags.stockable && p.currentStock)
			.reduce((sum, p) => sum + p.price * (p.currentStock || 0), 0);
	}
}
