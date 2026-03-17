import { ActionSource } from "src/machines/inbox/types";
import { MessageAction } from "src/messages/types";
import { SimulationMessage } from "src/models/SimulationMessage";

export type InboxActionEvent = {
  type: "inbox:action";
  messageId: string;
  action: MessageAction;
  source: ActionSource;
};

export type InboxNewMessageEvent = {
  type: "inbox:message:new";
  message: SimulationMessage;
};

export type InboxSyncEvent = {
  type: "inbox:sync";
};

export type InboxResetEvent = {
  type: "inbox:reset";
};

export type InboxEvent = InboxActionEvent | InboxNewMessageEvent | InboxSyncEvent | InboxResetEvent;
