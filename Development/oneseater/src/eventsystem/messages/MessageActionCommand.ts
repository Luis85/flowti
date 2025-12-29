import { MessageAction } from "src/messages/types";

export class MessageActionCommand {
  public type: "message:action";
  constructor(
    public messageId: string,
    public action: MessageAction,
    public source?: string
  ) {}
}
