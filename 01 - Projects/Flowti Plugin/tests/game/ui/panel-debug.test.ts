// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Lit mocks ─────────────────────────────────────────────────────────

vi.mock("lit", () => {
	class LitElement extends HTMLElement {
		static properties: Record<string, unknown> = {};
		static styles: unknown[] = [];
		connectedCallback() {}
		disconnectedCallback() {}
		requestUpdate() {}
	}
	return {
		LitElement,
		html: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
		css: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
		nothing: Symbol("nothing"),
	};
});

vi.mock("../../../src/components/flowti-element.js", () => {
	class FlowtiElement extends HTMLElement {
		static properties: Record<string, unknown> = {};
		static styles: unknown[] = [];
		connectedCallback() {}
		disconnectedCallback() {}
		requestUpdate() {}
		protected renderContent() { return null; }
	}
	if (!customElements.get("flowti-element")) {
		customElements.define("flowti-element", FlowtiElement);
	}
	return { FlowtiElement };
});

vi.mock("../../../src/game/ui/game-styles.js", () => ({
	resetStyles: {},
	colorStyles: {},
	fontStyles: {},
	scrollStyles: {},
	buttonStyles: {},
}));

import type { PanelDebug } from "../../../src/game/ui/panel-debug.js";

const importModule = async () => import("../../../src/game/ui/panel-debug.js");

describe("PanelDebug (ft-game-panel-debug)", () => {
	beforeEach(async () => {
		await importModule();
	});

	it("is defined as a custom element", () => {
		expect(customElements.get("ft-game-panel-debug")).toBeDefined();
	});

	it("can be constructed without error", () => {
		expect(() => document.createElement("ft-game-panel-debug")).not.toThrow();
	});

	it("declares agent as a property", async () => {
		const mod = await importModule();
		const props = mod.PanelDebug.properties as Record<string, unknown>;
		expect(props).toHaveProperty("agent");
	});
});

describe("PanelDebug event dispatching", () => {
	let el: PanelDebug;

	beforeEach(async () => {
		await importModule();
		el = document.createElement("ft-game-panel-debug") as unknown as PanelDebug;
		(el as unknown as Record<string, unknown>).agent = {
			name: "atlas",
			agentType: "ai",
			status: "idle" as const,
			level: 3,
			xp: 250,
			coin: 100,
			tokens: 5000,
		};
		document.body.appendChild(el);
	});

	it("dispatch emits CustomEvent with bubbles:true and composed:true", () => {
		const events: CustomEvent[] = [];
		document.addEventListener("debug-stat-adjust", (e) => { events.push(e as CustomEvent); }, { once: true });

		(el as unknown as Record<string, (t: string, d: Record<string, unknown>) => void>)["dispatch"]("debug-stat-adjust", { stat: "level", delta: 1 });

		expect(events).toHaveLength(1);
		expect(events[0].bubbles).toBe(true);
		expect(events[0].composed).toBe(true);
		expect(events[0].detail).toEqual({ stat: "level", delta: 1 });
	});

	it("handleStatAdj dispatches debug-stat-adjust with stat and delta", () => {
		const events: CustomEvent[] = [];
		el.addEventListener("debug-stat-adjust", (e) => { events.push(e as CustomEvent); });

		(el as unknown as Record<string, (s: string, d: number) => void>)["handleStatAdj"]("coin", 1);

		expect(events).toHaveLength(1);
		expect(events[0].detail).toEqual({ stat: "coin", delta: 1 });
	});

	it("handleStatAdj dispatches with negative delta for decrement", () => {
		const events: CustomEvent[] = [];
		el.addEventListener("debug-stat-adjust", (e) => { events.push(e as CustomEvent); });

		(el as unknown as Record<string, (s: string, d: number) => void>)["handleStatAdj"]("level", -1);

		expect(events[0].detail).toEqual({ stat: "level", delta: -1 });
	});

	it("handleStatSet dispatches debug-stat-set with parsed integer value", () => {
		const events: CustomEvent[] = [];
		el.addEventListener("debug-stat-set", (e) => { events.push(e as CustomEvent); });

		const mockInput = { value: "42" };
		(el as unknown as Record<string, (s: string, t: unknown) => void>)["handleStatSet"]("tokens", mockInput);

		expect(events).toHaveLength(1);
		expect(events[0].detail).toEqual({ stat: "tokens", value: 42 });
	});

	it("handleStatSet does not dispatch when value is NaN", () => {
		const events: CustomEvent[] = [];
		el.addEventListener("debug-stat-set", (e) => { events.push(e as CustomEvent); });

		const mockInput = { value: "not-a-number" };
		(el as unknown as Record<string, (s: string, t: unknown) => void>)["handleStatSet"]("level", mockInput);

		expect(events).toHaveLength(0);
	});

	it("handleNeedFill dispatches debug-need-set with value 100", () => {
		const events: CustomEvent[] = [];
		el.addEventListener("debug-need-set", (e) => { events.push(e as CustomEvent); });

		(el as unknown as Record<string, (n: string) => void>)["handleNeedFill"]("energy");

		expect(events).toHaveLength(1);
		expect(events[0].detail).toEqual({ need: "energy", value: 100 });
	});

	it("handleNeedDrain dispatches debug-need-set with value 0", () => {
		const events: CustomEvent[] = [];
		el.addEventListener("debug-need-set", (e) => { events.push(e as CustomEvent); });

		(el as unknown as Record<string, (n: string) => void>)["handleNeedDrain"]("morale");

		expect(events).toHaveLength(1);
		expect(events[0].detail).toEqual({ need: "morale", value: 0 });
	});

	it("handleNeedSet dispatches debug-need-set with parsed value", () => {
		const events: CustomEvent[] = [];
		el.addEventListener("debug-need-set", (e) => { events.push(e as CustomEvent); });

		const mockInput = { value: "75" };
		(el as unknown as Record<string, (n: string, t: unknown) => void>)["handleNeedSet"]("focus", mockInput);

		expect(events[0].detail).toEqual({ need: "focus", value: 75 });
	});

	it("handleNeedSet does not dispatch when value is NaN", () => {
		const events: CustomEvent[] = [];
		el.addEventListener("debug-need-set", (e) => { events.push(e as CustomEvent); });

		(el as unknown as Record<string, (n: string, t: unknown) => void>)["handleNeedSet"]("hunger", { value: "xyz" });

		expect(events).toHaveLength(0);
	});

	it("handleTrustMode dispatches debug-trust-mode with op and mode", () => {
		const events: CustomEvent[] = [];
		el.addEventListener("debug-trust-mode", (e) => { events.push(e as CustomEvent); });

		(el as unknown as Record<string, (o: string, m: string) => void>)["handleTrustMode"]("read-file", "AUTO");

		expect(events).toHaveLength(1);
		expect(events[0].detail).toEqual({ op: "read-file", mode: "AUTO" });
	});

	it("handleCheat dispatches debug-economy-cheat with action", () => {
		const events: CustomEvent[] = [];
		el.addEventListener("debug-economy-cheat", (e) => { events.push(e as CustomEvent); });

		(el as unknown as Record<string, (a: string) => void>)["handleCheat"]("add-coin-500");

		expect(events).toHaveLength(1);
		expect(events[0].detail).toEqual({ action: "add-coin-500" });
	});

	it("handleCheat dispatches level-up action", () => {
		const events: CustomEvent[] = [];
		el.addEventListener("debug-economy-cheat", (e) => { events.push(e as CustomEvent); });

		(el as unknown as Record<string, (a: string) => void>)["handleCheat"]("level-up");

		expect(events[0].detail).toEqual({ action: "level-up" });
	});
});
