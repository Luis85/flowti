import { Product } from "src/models/Product";

export class ProductDeletedEvent {
	constructor(public product: Product) {}
}
