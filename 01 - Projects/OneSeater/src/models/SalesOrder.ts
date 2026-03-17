import { LineItem } from "src/orders";
import { SimulationMessage } from "./SimulationMessage";

export type OrderStatus =
	| "new"
	| "active"
	| "shipped"
	| "closed"
	| "paid"
	| "failed"
	| "cancelled";

export type SalesOrder = {
	id: string;
	type: string;
	status: OrderStatus;
	customer: string;
	customerPo: SimulationMessage;
	taker: string;
	shipToAddress: string;
	billToAddress: string;
	lineItems: LineItem[];
	createdAt: number;
	paidAt?: number;
	processedAt?: number; // Wenn new → active
	shippedAt?: number; // Wenn active → shipped
	closedAt?: number; // Wenn shipped → closed
	cancelledAt?: number; // Wenn → cancelled
	updatedAt?: number; // Letzte Änderung
	cancellationReason?: string;
};
