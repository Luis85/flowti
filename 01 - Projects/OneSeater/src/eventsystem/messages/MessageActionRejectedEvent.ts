import { MessageAction } from "src/messages/types";

export class MessageActionRejectedEvent {
  constructor(
    public messageId: string,
    public action: MessageAction,
    public reason: string
  ) {}
}
