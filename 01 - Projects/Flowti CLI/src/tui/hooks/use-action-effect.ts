/**
 * use-action-effect.ts — Effect state machine for TUI action handlers.
 *
 * Manages async effect lifecycle: idle → running → success|error → idle.
 * Success states auto-dismiss after a short delay.
 */

import { useState, useCallback, useRef } from "react";
import type { TuiActionResult } from "../registry/tui-handler-types.js";

type EffectState = "idle" | "running" | "success" | "error";
type EffectHandler = () => Promise<TuiActionResult>;

interface UseActionEffectResult {
	readonly state: EffectState;
	readonly message: string;
	readonly run: (handler: EffectHandler, label: string) => Promise<void>;
	readonly dismiss: () => void;
}

export function useActionEffect(): UseActionEffectResult {
	const [state, setState] = useState<EffectState>("idle");
	const [message, setMessage] = useState("");
	const cancelledRef = useRef(false);
	const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>();

	const dismiss = useCallback(() => {
		if (timerRef.current) clearTimeout(timerRef.current);
		setState("idle");
		setMessage("");
	}, []);

	const run = useCallback(async (handler: EffectHandler, label: string) => {
		if (state === "running") return;
		cancelledRef.current = false;
		setState("running");
		setMessage(label);

		try {
			const result = await handler();
			if (cancelledRef.current) return;

			if (result.kind === "error") {
				setState("error");
				setMessage(result.message);
			} else {
				setState("success");
				setMessage(result.message ?? "Done");
				timerRef.current = setTimeout(() => {
					setState("idle");
					setMessage("");
				}, 1500);
			}
		} catch (err) {
			if (cancelledRef.current) return;
			setState("error");
			setMessage(err instanceof Error ? err.message : String(err));
		}
	}, [state]);

	return { state, message, run, dismiss };
}
