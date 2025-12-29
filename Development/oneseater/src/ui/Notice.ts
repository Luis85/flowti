import { Notice } from "obsidian";
import { checkActiveView } from "src/utils/helpers";
import { GAME_OFFICE_VIEW } from "./views/GameView";

export type NoticeVariant = "info" | "success" | "warning" | "error";

export type NoticeAction = {
	label: string;
	onClick: (notice: Notice) => void | Promise<void>;
};

export interface NoticeCardOptions {
	title: string;
	meta?: string;
	body?: string;

	/** Duration in ms. Use 0 for sticky. Defaults to 4000. */
	duration?: number;

	/** Only show when not in office view */
	onlyWhenNotInOffice?: boolean;

	/** Visual variant (affects icon + CSS classes). Defaults to "info". */
	variant?: NoticeVariant;

	/** Optional action button */
	action?: NoticeAction;

	/** Optional leading icon override (otherwise derived from variant) */
	icon?: string;
}

const VARIANT_ICON: Record<NoticeVariant, string> = {
	info: "ℹ️",
	success: "✅",
	warning: "⚠️",
	error: "❌",
};

function getVariantIcon(v: NoticeVariant, override?: string) {
	return override ?? VARIANT_ICON[v] ?? "ℹ️";
}

/**
 * Create a "card-like" Obsidian Notice.
 * Uses DOM fragment to avoid empty sticky notice artifacts.
 */
export function createNoticeCard(spec: NoticeCardOptions): Notice | undefined {
	const {
		title,
		meta,
		body,
		duration = 4000,
		onlyWhenNotInOffice = false,
		action,
		variant = "info",
		icon,
	} = spec;

	if (onlyWhenNotInOffice && checkActiveView() === GAME_OFFICE_VIEW) return;

	const fragment = document.createDocumentFragment();
	const root = fragment.appendChild(document.createElement("div"));

	root.className = `mm-notice mm-notice--${variant}`;
	root.style.display = "grid";
	root.style.gap = "6px";

	// Title row (icon + title)
	const titleRow = root.appendChild(document.createElement("div"));
	titleRow.className = "mm-notice-title-row";
	titleRow.style.display = "flex";
	titleRow.style.alignItems = "center";
	titleRow.style.gap = "6px";

	const iconEl = titleRow.appendChild(document.createElement("span"));
	iconEl.className = "mm-notice-icon";
	iconEl.textContent = getVariantIcon(variant, icon);

	const titleEl = titleRow.appendChild(document.createElement("div"));
	titleEl.className = "mm-notice-title";
	titleEl.textContent = title;
	titleEl.style.fontWeight = "700";
	titleEl.style.fontSize = "12px";

	if (meta) {
		const metaEl = root.appendChild(document.createElement("div"));
		metaEl.className = "mm-notice-meta";
		metaEl.textContent = meta;
		metaEl.style.opacity = "0.75";
		metaEl.style.fontSize = "11px";
	}

	if (body) {
		const bodyEl = root.appendChild(document.createElement("div"));
		bodyEl.className = "mm-notice-body";
		bodyEl.textContent = body;
		bodyEl.style.opacity = "0.85";
		bodyEl.style.fontSize = "11px";
	}
		let actionsRoot: HTMLDivElement | undefined;

	if (action) {
		actionsRoot = root.appendChild(document.createElement("div"));
		actionsRoot.className = "mm-notice-actions";
		actionsRoot.style.display = "flex";
		actionsRoot.style.gap = "8px";
		actionsRoot.style.justifyContent = "flex-end";

		const btn = actionsRoot.createEl("button", { text: action.label });
		btn.className = "mm-notice-btn";
		btn.style.border = "1px solid var(--background-modifier-border)";
		btn.style.borderRadius = "8px";
		btn.style.padding = "4px 8px";
		btn.style.background = "var(--background-secondary)";
		btn.style.cursor = "pointer";
		btn.style.fontSize = "12px";

		btn.addEventListener("click", async () => {
			try {
				await action.onClick(notice);
			} finally {
				notice.hide();
			}
		});
	}

	const notice = new Notice(fragment, duration);
	return notice;
}

// Convenience helpers (plain)
export function showNotice(message: string, duration = 4000): Notice {
	return new Notice(message, duration);
}

export function showSuccessNotice(message: string, duration = 3000): Notice {
	return createNoticeCard({ title: message, duration, variant: "success" }) ?? new Notice(`✅ ${message}`, duration);
}

export function showErrorNotice(message: string, duration = 5000): Notice {
	return createNoticeCard({ title: message, duration, variant: "error" }) ?? new Notice(`❌ ${message}`, duration);
}

export interface NotificationServiceOptions {
  /** Show order-related notifications */
  orders?: boolean;
  /** Show message-related notifications */
  messages?: boolean;
  /** Show task/XP notifications */
  tasks?: boolean;
  /** Show error notifications */
  errors?: boolean;
  /** Callback to open office view */
  onOpenOffice?: () => void;
  /** Callback to open order detail */
  onViewOrder?: (orderId: string) => void;
}
