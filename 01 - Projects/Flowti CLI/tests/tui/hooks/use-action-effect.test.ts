import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Text } from "ink";
import { useActionEffect } from "../../../src/tui/hooks/use-action-effect.js";

// Harness that exposes hook state via a mutable ref AND renders state to text
interface EffectRef {
	state: string;
	message: string;
	run: (handler: () => Promise<{ kind: "ok" | "error"; message?: string }>, label: string) => Promise<void>;
	dismiss: () => void;
}

function EffectHarness({ hookRef }: { hookRef: React.MutableRefObject<EffectRef | null> }): React.JSX.Element {
	const effect = useActionEffect();
	hookRef.current = effect;
	return React.createElement(Text, null, `${effect.state}:${effect.message}`);
}

function renderHarness() {
	const hookRef: React.MutableRefObject<EffectRef | null> = { current: null };
	const instance = render(React.createElement(EffectHarness, { hookRef }));
	return { ...instance, hook: () => hookRef.current! };
}

describe("useActionEffect", () => {
	it("starts in idle state", () => {
		const { hook, unmount } = renderHarness();
		expect(hook().state).toBe("idle");
		expect(hook().message).toBe("");
		unmount();
	});

	it("transitions to error on handler failure", async () => {
		const { hook, unmount, lastFrame } = renderHarness();
		const handler = async () => ({ kind: "error" as const, message: "Build failed" });
		await hook().run(handler, "Building...");
		// Wait for React re-render
		await new Promise((r) => setTimeout(r, 0));
		expect(hook().state).toBe("error");
		expect(hook().message).toBe("Build failed");
		expect(lastFrame()).toContain("error");
		expect(lastFrame()).toContain("Build failed");
		unmount();
	});

	it("transitions to success on handler ok result", async () => {
		vi.useFakeTimers();
		const { hook, unmount } = renderHarness();
		const handler = async () => ({ kind: "ok" as const, message: "Built" });
		await hook().run(handler, "Building...");
		// Wait for React re-render
		await vi.advanceTimersByTimeAsync(0);
		expect(hook().state).toBe("success");
		expect(hook().message).toBe("Built");
		vi.useRealTimers();
		unmount();
	});

	it("dismiss resets to idle", async () => {
		const { hook, unmount } = renderHarness();
		const handler = async () => ({ kind: "error" as const, message: "Fail" });
		await hook().run(handler, "Running...");
		await new Promise((r) => setTimeout(r, 0));
		expect(hook().state).toBe("error");
		hook().dismiss();
		await new Promise((r) => setTimeout(r, 0));
		expect(hook().state).toBe("idle");
		expect(hook().message).toBe("");
		unmount();
	});
});
