import { MESSAGE_ACTION_DEFS } from "./MessageActionDefinitions";
import { ActionGateResult, MessageAction, MessageActionDef } from "./types";

export function renderMessageActions(
	container: HTMLElement,
	possibleActions: MessageAction[] | undefined,
	onAction: (action: MessageAction) => void,
	opts?: {
		showUnknownActions?: boolean;
		fallbackActions?: MessageAction[];
		blacklistActions?: readonly MessageAction[] | Set<MessageAction>;
		gate?: (action: MessageAction) => ActionGateResult;
		enableTooltips?: boolean;
		getCostHint?: (
			action: MessageAction
		) =>
			| { energyCost: number; xpGain: number; timeCostMinutes: number }
			| undefined;
	}
) {
	container.empty();

	const left = container.createDiv({ cls: "mm-msg-actions-left" });
	const right = container.createDiv({ cls: "mm-msg-actions-right" });

	const blacklist = normalizeBlacklist(opts?.blacklistActions);

	const actions = dedupe([
		...(possibleActions ?? []),
		...(opts?.fallbackActions ?? []),
	]).filter((a) => !blacklist.has(a)) as MessageAction[];

	if (actions.length === 0) {
		right.createDiv({
			cls: "mm-msg-no-actions",
			text: "No actions available.",
		});
		return;
	}

	const known = actions.filter((a) => !!MESSAGE_ACTION_DEFS[a]);
	const unknown = actions.filter((a) => !MESSAGE_ACTION_DEFS[a]);

	for (const action of sortActions(known)) {
		const def = MESSAGE_ACTION_DEFS[action];
		const parent = def.placement === "left" ? left : right;

		const btn = parent.createEl("button", {
			cls: `mm-msg-btn ${def.btnClass}`,
			text: actionText(def),
		});

		// policy gating (disabled + tooltip)
		let gateRes: ActionGateResult | undefined;
		if (opts?.gate) {
			gateRes = opts.gate(action);
			if (!gateRes.ok) {
				btn.setAttr("disabled", "true");
				btn.addClass("is-disabled");
			}

			if (opts.enableTooltips) {
				const cost = opts.getCostHint?.(action);
				const costText = cost
					? `Cost: -${cost.energyCost}⚡, +${cost.xpGain}XP`
					: "";
				const reasonText =
					gateRes && !gateRes.ok ? `Blocked: ${gateRes.reason}` : "";
				const tip = [costText, reasonText].filter(Boolean).join(" • ");
				if (tip) btn.setAttr("title", tip);
			}
		}

		btn.addEventListener("click", () => {
			const resNow = opts?.gate?.(action);
			if (resNow && !resNow.ok) return;
			onAction(def.action);
		});
	}

	if (opts?.showUnknownActions) {
		for (const action of unknown) {
			const btn = right.createEl("button", {
				cls: "mm-msg-btn mm-msg-btn--ghost",
				text: String(action),
			});
			btn.addEventListener("click", () => onAction(action));
		}
	}
}

// deterministic rng
export function nextRng(seed: number): { seed: number; value: number } {
	// LCG: quick & good enough for gameplay
	const next = (seed * 1664525 + 1013904223) >>> 0;
	return { seed: next, value: next / 4294967296 };
}

export function shouldSpawn(
	simDtMs: number,
	ratePerHour: number,
	roll01: number
): boolean {
	const dtHours = simDtMs / 3_600_000;
	const p = 1 - Math.exp(-ratePerHour * dtHours);
	return roll01 < p;
}

export function mkId(
	dayIndex: number,
	minuteOfDay: number,
	seq: number
): string {
	return `msg-${dayIndex}-${minuteOfDay}-${seq}`;
}

/**
 * Helper to generate a random number from range
 */
export function randomFromRange(
	range: number | [number, number],
	rng: number
): number {
	if (typeof range === "number") return range;
	const [min, max] = range;
	return Math.floor(min + rng * (max - min + 1));
}

/**
 * Helper to pick random elements from array
 */
export function pickRandom<T>(
	array: T[],
	count: number,
	rng: () => number
): T[] {
	const shuffled = [...array].sort(() => rng() - 0.5);
	return shuffled.slice(0, Math.min(count, array.length));
}

/**
 * Helper for message actions
 */
function dedupe<T>(arr: T[]): T[] {
	return Array.from(new Set(arr));
}

function sortActions(actions: MessageAction[]): MessageAction[] {
	const order: MessageAction[] = [
		"accept",
		"collect",
		"archive",
		"spam",
		"delete",
	];

	const idx = (a: MessageAction) => {
		const i = order.indexOf(a);
		return i === -1 ? 999 : i;
	};

	return [...actions].sort((a, b) => idx(a) - idx(b));
}

function actionText(def: MessageActionDef): string {
	return def.icon ? `${def.icon} ${def.label}` : def.label;
}

function normalizeBlacklist(
	blacklist?: readonly MessageAction[] | Set<MessageAction>
): Set<MessageAction> {
	if (!blacklist) return new Set();
	return blacklist instanceof Set ? blacklist : new Set(blacklist);
}
