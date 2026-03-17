import { LineItem } from "src/orders";
import { MessageType, MessageAction } from "src/messages/types";

export class NewMessageReceivedEvent {
  constructor(
    public id: string,
    public type: MessageType,
    public subject: string,
    public priority: string,
    public author: string,
    public simNowMs: number,
    public dayIndex: number,
    public minuteOfDay: number,
    public timestamp: number,
    public body: string,
    public possible_actions: MessageAction[],
    public tags: string[] = [],
	public readonly lineItems?: LineItem[],
	public read_at?: number,
    public deleted_at?: number,
    public spam_at?: number,
    public is_spam?: boolean
  ) {}
}
