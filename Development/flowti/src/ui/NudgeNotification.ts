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
import type { NudgeConfig } from "../domain/nudge/types";
import type { IEventBus } from "../infrastructure/events/types";

const NOTICE_TIMEOUT_MS = 30_000;

/**
 * Builds the notification DOM fragment for a nudge.
 * Exposed for testing — the returned fragment contains Start/Dismiss buttons.
 */
export function buildNudgeNotificationFragment(
	config: NudgeConfig,
	eventBus: IEventBus,
	onHide: () => void,
): DocumentFragment {
	const fragment = document.createDocumentFragment();

	const wrapper = document.createElement("div");
	wrapper.style.cssText = "display:flex;flex-direction:column;gap:0.5rem;";
	fragment.appendChild(wrapper);

	// Header
	const header = document.createElement("div");
	header.style.fontWeight = "600";
	header.textContent = config.title;
	wrapper.appendChild(header);

	// Subtitle
	const sub = document.createElement("div");
	sub.style.cssText = "font-size:0.85em;opacity:0.7;";
	const dur = config.durationMinutes > 0 ? ` · ${config.durationMinutes} min` : "";
	sub.textContent = `${config.time}${dur}`;
	wrapper.appendChild(sub);

	// Buttons
	const btnRow = document.createElement("div");
	btnRow.style.cssText = "display:flex;gap:0.5rem;margin-top:0.25rem;";
	wrapper.appendChild(btnRow);

	const startBtn = document.createElement("button");
	startBtn.textContent = "Start";
	startBtn.style.cssText = "padding:4px 12px;cursor:pointer;";
	startBtn.classList.add("mod-cta");
	btnRow.appendChild(startBtn);

	const dismissBtn = document.createElement("button");
	dismissBtn.textContent = "Dismiss";
	dismissBtn.style.cssText = "padding:4px 12px;cursor:pointer;";
	btnRow.appendChild(dismissBtn);

	startBtn.addEventListener("click", () => {
		void eventBus.emit("session.create", {
			type: config.sessionType,
			title: config.title,
			durationMinutes: config.durationMinutes,
		});
		onHide();
	});

	dismissBtn.addEventListener("click", () => {
		void eventBus.emit("nudge.dismiss", { id: config.id });
		onHide();
	});

	return fragment;
}

export function showNudgeNotification(config: NudgeConfig, eventBus: IEventBus): void {
	const notice = new Notice("", NOTICE_TIMEOUT_MS);
	const fragment = buildNudgeNotificationFragment(config, eventBus, () => notice.hide());
	// Replace the default text content with our rich fragment
	notice.noticeEl.empty();
	notice.noticeEl.appendChild(fragment);
}
