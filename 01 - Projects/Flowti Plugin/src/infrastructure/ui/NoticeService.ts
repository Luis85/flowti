/**
 * Centralized notice service for Flowti.
 *
 * Wraps Obsidian's {@link Notice} class so that all notice creation
 * flows through a single point. Domain services and UI components
 * can either call methods directly or emit `notice.*` events.
 *
 * Also absorbs the throttle/batching logic previously in main.ts.
 */

import { Notice } from "obsidian";
import type { IEventBus } from "../events/types";
import type { IDisposable } from "../services/types";
import type { NoticePromptButton } from "./noticeEvents";

// ─────────────────────────────────────────────────────────────
// Options
// ─────────────────────────────────────────────────────────────

export interface NoticeServiceOptions {
	eventBus: IEventBus;
}

// ─────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────

/** Default duration for error notices (ms). */
const ERROR_DURATION_MS = 5000;

/** Throttle window for batched notices (ms). */
const THROTTLE_WINDOW_MS = 2000;

export class NoticeService implements IDisposable {
	private eventBus: IEventBus;
	private unsubscribes: (() => void)[] = [];
	private batches = new Map<string, { count: number; timer: ReturnType<typeof setTimeout> }>();

	constructor(options: NoticeServiceOptions) {
		this.eventBus = options.eventBus;
		this.wireEventSubscriptions();
	}

	// ── Public API ──────────────────────────────────────────

	/** Show a plain notice. */
	show(message: string, duration?: number): void {
		new Notice(message, duration);
	}

	/** Show a success notice (default duration). */
	success(message: string): void {
		new Notice(message);
	}

	/** Show an error notice (5 s by default). */
	error(message: string, duration?: number): void {
		new Notice(message, duration ?? ERROR_DURATION_MS);
	}

	/**
	 * Show an interactive notice with custom DOM content.
	 * Returns the Notice instance so callers can call `.hide()`.
	 */
	showInteractive(fragment: DocumentFragment, duration?: number): Notice {
		const notice = new Notice("", duration);
		notice.noticeEl.empty();
		notice.noticeEl.appendChild(fragment);
		return notice;
	}

	/**
	 * Throttled notice — batches rapid-fire messages under the same
	 * key into a single summary notice. Within the 2 s window, counts
	 * accumulate; when the timer fires a single Notice is shown.
	 */
	showThrottled(key: string, message: string): void {
		const existing = this.batches.get(key);
		if (existing) {
			existing.count++;
			return; // timer already running — it will flush
		}
		const batch = {
			count: 1,
			timer: setTimeout(() => {
				const b = this.batches.get(key);
				this.batches.delete(key);
				if (!b) return;
				if (b.count === 1) {
					new Notice(message);
				} else {
					new Notice(`${message} (+${b.count - 1} more)`);
				}
			}, THROTTLE_WINDOW_MS),
		};
		this.batches.set(key, batch);
	}

	/**
	 * Show a persistent prompt with configurable buttons.
	 * Returns a Promise that resolves with the clicked button's value.
	 */
	showPrompt(config: {
		title: string;
		message: string;
		buttons: NoticePromptButton[];
	}): Promise<string> {
		return new Promise<string>((resolve) => {
			const fragment = document.createDocumentFragment();
			const strong = document.createElement("strong");
			strong.textContent = config.title;
			fragment.appendChild(strong);
			const p = document.createElement("p");
			p.textContent = config.message;
			fragment.appendChild(p);
			const btnRow = document.createElement("div");
			btnRow.className = "ft-notice-prompt-buttons";
			for (const btn of config.buttons) {
				const el = document.createElement("button");
				el.textContent = btn.label;
				if (btn.cta) el.classList.add("mod-cta");
				if (btn.warning) el.classList.add("mod-warning");
				el.addEventListener("click", () => {
					notice.hide();
					void this.eventBus.emit("notice.prompt.responded", { value: btn.value });
					resolve(btn.value);
				});
				btnRow.appendChild(el);
			}
			fragment.appendChild(btnRow);
			const notice = this.showInteractive(fragment, 0);
		});
	}

	// ── IDisposable ─────────────────────────────────────────

	dispose(): void {
		for (const unsub of this.unsubscribes) unsub();
		this.unsubscribes = [];
		for (const [, batch] of this.batches) {
			clearTimeout(batch.timer);
		}
		this.batches.clear();
	}

	// ── Private ─────────────────────────────────────────────

	private wireEventSubscriptions(): void {
		this.unsubscribes.push(
			this.eventBus.on("notice.show", (event) => {
				this.show(event.payload.message, event.payload.duration);
			}),
		);

		this.unsubscribes.push(
			this.eventBus.on("notice.success", (event) => {
				this.success(event.payload.message);
			}),
		);

		this.unsubscribes.push(
			this.eventBus.on("notice.error", (event) => {
				this.error(event.payload.message, event.payload.duration);
			}),
		);

		this.unsubscribes.push(
			this.eventBus.on("notice.throttled", (event) => {
				this.showThrottled(event.payload.key, event.payload.message);
			}),
		);

		this.unsubscribes.push(
			this.eventBus.on("notice.prompt", (event) => {
				void this.showPrompt(event.payload);
			}),
		);
	}
}
