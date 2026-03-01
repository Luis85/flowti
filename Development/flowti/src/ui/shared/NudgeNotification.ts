/**
 * Nudge notification shown via Obsidian Notice.
 *
 * Displays the nudge title and two action buttons:
 * - "Start" emits `session.create` with the nudge's session type + duration
 * - "Dismiss" emits `nudge.dismiss` to silence the nudge for today
 *
 * The notice auto-dismisses after 30 seconds if no action is taken.
 */

import { Notice } from "obsidian";
import type { NudgeConfig } from "../../domain/nudge/types";
import type { IEventBus } from "../../infrastructure/events/types";

const NOTICE_TIMEOUT_MS = 30_000;

/**
 * Builds the notification DOM fragment for a nudge.
 * Exposed for testing — the returned fragment contains Start/Dismiss buttons.
 */
export function buildNudgeNotificationFragment(
	config: NudgeConfig,
	eventBus: IEventBus,
	onHide: () => void,
	inboxItemCount?: number,
): DocumentFragment {
	const fragment = document.createDocumentFragment();

	const wrapper = document.createElement("div");
	wrapper.classList.add("ft-nudge-wrapper");
	fragment.appendChild(wrapper);

	// Header
	const header = document.createElement("div");
	header.classList.add("ft-nudge-header");
	header.textContent = config.title;
	wrapper.appendChild(header);

	// Subtitle
	const sub = document.createElement("div");
	sub.classList.add("ft-nudge-subtitle");
	const dur = config.durationMinutes > 0 ? ` · ${config.durationMinutes} min` : "";
	const inboxSuffix = inboxItemCount != null ? ` · ${inboxItemCount} inbox items` : "";
	sub.textContent = `${config.time}${dur}${inboxSuffix}`;
	wrapper.appendChild(sub);

	// Buttons
	const btnRow = document.createElement("div");
	btnRow.classList.add("ft-nudge-btn-row");
	wrapper.appendChild(btnRow);

	const startBtn = document.createElement("button");
	startBtn.textContent = config.navigateTo ? "Open" : "Start";
	startBtn.classList.add("ft-nudge-btn", "mod-cta");
	btnRow.appendChild(startBtn);

	const dismissBtn = document.createElement("button");
	dismissBtn.textContent = "Dismiss";
	dismissBtn.classList.add("ft-nudge-btn");
	btnRow.appendChild(dismissBtn);

	startBtn.addEventListener("click", () => {
		if (config.navigateTo) {
			void eventBus.emit("hub.navigate", { hubId: "flowti-user-hub", tabId: config.navigateTo });
		} else {
			void eventBus.emit("session.create", {
				type: config.sessionType,
				title: config.title,
				durationMinutes: config.durationMinutes,
			});
		}
		void eventBus.emit("nudge.dismiss", { id: config.id });
		onHide();
	});

	dismissBtn.addEventListener("click", () => {
		void eventBus.emit("nudge.dismiss", { id: config.id });
		onHide();
	});

	return fragment;
}

export function showNudgeNotification(config: NudgeConfig, eventBus: IEventBus, inboxItemCount?: number): void {
	const notice = new Notice("", NOTICE_TIMEOUT_MS);
	const fragment = buildNudgeNotificationFragment(config, eventBus, () => notice.hide(), inboxItemCount);
	// Replace the default text content with our rich fragment
	notice.noticeEl.empty();
	notice.noticeEl.appendChild(fragment);
}
