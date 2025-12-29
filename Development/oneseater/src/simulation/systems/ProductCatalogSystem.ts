import { createSystem, ReadEvents, WriteEvents, WriteResource, Storage } from "sim-ecs";
import { ProductCatalogUpdatedEvent } from "src/eventsystem/product/ProductCatalogUpdated";
import { ProductCreatedEvent } from "src/eventsystem/product/ProductCreatedEvent";
import { ProductDeletedEvent } from "src/eventsystem/product/ProductDeletedEvent";
import { ProductUpdatedEvent } from "src/eventsystem/product/ProductUpdatedEvent";
import { Product } from "src/models/Product";
import { SimulationStore } from "../stores/SimulationStore";

export const ProductCatalogSystem = createSystem({
	productCreatedRead: ReadEvents(ProductCreatedEvent),
	productUpdatedRead: ReadEvents(ProductUpdatedEvent),
	productDeletedRead: ReadEvents(ProductDeletedEvent),
	productCatalogUpdatedWrite: WriteEvents(ProductCatalogUpdatedEvent),
	simStore: WriteResource(SimulationStore),
	systemState: Storage({ lastEvent: 0, dirty: false }),
})
	.withRunFunction(
		({
			productCreatedRead,
			productUpdatedRead,
			productDeletedRead,
			productCatalogUpdatedWrite,
			simStore,
			systemState,
		}) => {
			// Get current products from store
			let products: Product[] = simStore.products || [];
			let dirty = false;

			// Handle product creation
			for (const event of productCreatedRead.iter()) {
				products.push(event.product);
				dirty = true;
			}

			// Handle product updates
			for (const event of productUpdatedRead.iter()) {
				const index = products.findIndex((p) => p.id === event.product.id);
				if (index !== -1) {
					products[index] = { ...event.product };
					dirty = true;
				} else {
					console.warn(`ProductCatalogSystem: Product ${event.product.id} not found for update`);
				}
			}

			// Handle product deletion
			for (const event of productDeletedRead.iter()) {
				const initialLength = products.length;
				products = products.filter((p) => p.id !== event.product.id);
				
				if (products.length < initialLength) {
					dirty = true;
				} else {
					console.warn(`ProductCatalogSystem: Product ${event.product.id} not found for deletion`);
				}
			}

			// Only update store and publish if something changed
			if (dirty) {
				simStore.products = products;
				systemState.lastEvent = Date.now();
				systemState.dirty = true;

				// Publish update event to notify views
				void productCatalogUpdatedWrite.publish(
					new ProductCatalogUpdatedEvent(products)
				);
			}
		}
	)
	.build();
