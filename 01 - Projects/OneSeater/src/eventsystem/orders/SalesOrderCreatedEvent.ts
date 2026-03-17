import { SalesOrder } from "src/models/SalesOrder";

export class SalesOrderCreatedEvent {
	constructor(public order: SalesOrder) {}
}
