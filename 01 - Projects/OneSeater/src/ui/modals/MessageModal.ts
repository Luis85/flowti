import { App, Modal } from "obsidian";
import { ActionGateResult, MessageAction } from "src/messages/types";
import { NewMessageReceivedEvent } from "src/eventsystem/messages/NewMessageReceivedEvent";
import { getTypeIcon, getPriorityLabel } from "src/ui/helpers";
import { renderMessageActions } from "src/messages/utils";

/**
 * Modal to display a message in detail
 */
export class MessageModal extends Modal {
	private message: NewMessageReceivedEvent;
	private onAction?: (action: MessageAction) => void;
	private gateAction?: (action: MessageAction) => ActionGateResult;
	private getCostHint?: (
		action: MessageAction
	) =>
		| { energyCost: number; xpGain: number; timeCostMinutes: number }
		| undefined;

	constructor(
		app: App,
		message: NewMessageReceivedEvent,
		onAction?: (action: MessageAction) => void,
		opts?: {
			gateAction?: (action: MessageAction) => ActionGateResult;
			getCostHint?: (action: MessageAction) =>
				| {
						energyCost: number;
						xpGain: number;
						timeCostMinutes: number;
				}
				| undefined;
		}
	) {
		super(app);
		this.message = message;
		this.onAction = onAction;
		this.gateAction = opts?.gateAction;
		this.getCostHint = opts?.getCostHint;
	}

	onOpen() {
		const { contentEl, modalEl } = this;
		contentEl.empty();
		contentEl.addClass("mm-message-modal");
		modalEl.addClass("mm-message-modal-container");

		// Header
		const header = contentEl.createDiv({ cls: "mm-msg-header" });

		// Type icon
		const iconWrap = header.createDiv({ cls: "mm-msg-icon" });
		iconWrap.textContent = getTypeIcon(this.message.type);

		// Title & meta
		const titleBlock = header.createDiv({ cls: "mm-msg-title-block" });

		titleBlock.createDiv({
			cls: "mm-msg-subject",
			text: `${this.message.subject}`,
		});

		const meta = titleBlock.createDiv({ cls: "mm-msg-meta" });
		meta.createSpan({ text: `👤 ${this.message.author}` });

		meta.createSpan({
			cls: `mm-msg-priority is-${this.message.priority.toLowerCase()}`,
			text: `${getPriorityLabel(this.message.priority)} priority`,
		});

		meta.createSpan({ text: `📅 Day ${this.message.dayIndex}` });

		// Read status
		if (this.message.read_at) {
			meta.createSpan({ cls: "mm-msg-read-badge", text: "✓ Read" });
		}

		// Tags
		const tagsWrap = contentEl.createDiv({ cls: "mm-msg-tags" });
		tagsWrap.createSpan({
			cls: "mm-msg-tag",
			text: `#${this.message.type.toLowerCase()}`,
		});
		if (this.message.tags && this.message.tags.length > 0) {
			for (const tag of this.message.tags) {
				tagsWrap.createSpan({ cls: "mm-msg-tag", text: `#${tag}` });
			}
		}

		// Body
		const body = contentEl.createDiv({ cls: "mm-msg-body" });
		body.textContent = this.message.body || "No content.";

		// Actions
		const actions = contentEl.createDiv({ cls: "mm-msg-actions" });
		renderMessageActions(
			actions,
			this.message.possible_actions,
			(action) => {
				this.onAction?.(action);
				this.close();
			},
			{
				blacklistActions: ["read"],
				gate: this.gateAction,
				enableTooltips: true,
				getCostHint: this.getCostHint,
			}
		);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
