import { LineItem } from "src/orders";
import { MessageType, MessageAction } from "src/messages/types";

export type SimulationMessage = {
	id: string,
	type: MessageType,
	subject: string,
	priority: string,
	author: string,
	simNowMs: number,
	dayIndex: number,
	minuteOfDay: number,
	timestamp: number,
	body: string,
	read_at?: number,
	deleted_at?: number,
	spam_at?: number,
	is_spam?: boolean,
	lineItems?: LineItem[],
	possible_actions: MessageAction[],
	tags: string[],
}
