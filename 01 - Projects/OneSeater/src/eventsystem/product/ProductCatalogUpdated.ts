import { Product } from "src/models/Product";

export class ProductCatalogUpdatedEvent {
	constructor(public products: Product[]) {}
}
