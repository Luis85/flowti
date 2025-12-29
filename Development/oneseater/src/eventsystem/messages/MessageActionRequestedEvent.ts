import { MessageAction } from "src/messages/types";

export class MessageActionRequestedEvent {
  constructor(
    public messageId: string,
    public action: MessageAction,
    public source: "inbox" | "modal" | "finance" | "system" = "inbox"
  ) {}
}
