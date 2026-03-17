import { MessageActionDef } from "./types";

export const MESSAGE_ACTION_DEFS: Record<string, MessageActionDef> = {
	delete: {
		action: "delete",
		label: "Delete",
		icon: "🗑️",
		placement: "left",
		btnClass: "mm-msg-btn--danger",
		destructive: true,
	},
	spam: {
		action: "spam",
		label: "Mark as Spam",
		icon: "⁉️",
		placement: "left",
		btnClass: "mm-msg-btn--ghost",
		destructive: true,
	},
	archive: {
		action: "archive",
		label: "Done",
		icon: "✓",
		placement: "right",
		btnClass: "mm-msg-btn--primary",
		destructive: true,
	},
	accept: {
		action: "accept",
		label: "Accept",
		placement: "right",
		btnClass: "mm-msg-btn--primary",
		destructive: true,
	},
	collect: {
		action: "collect",
		label: "Collect",
		icon: "💰",
		placement: "right",
		btnClass: "mm-msg-btn--primary",
		destructive: true,
	},
};
