import { Product } from "src/models/Product";

export class ProductCreatedEvent {
	constructor(public product: Product) {}
}
