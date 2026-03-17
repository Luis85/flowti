import { Product } from "src/models/Product";

export class ProductUpdatedEvent {
	constructor(public product: Product) {}
}
