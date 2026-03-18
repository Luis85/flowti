// tests/components/agents/flowti-canvas-mode.test.ts
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { ConversationTurn } from "../../../src/domain/agents/types.js";
import type { FlowtiCanvasMode, CanvasData } from "../../../src/components/agents/flowti-canvas-mode.js";
import "../../../src/components/agents/flowti-canvas-mode.js";

function makeTurn(overrides: Partial<ConversationTurn> = {}): ConversationTurn {
	return {
		id: "t1",
		role: "user",
		content: "Hello",
		timestamp: "2026-03-18T00:00:00Z",
		mode: "canvas",
		...overrides,
	};
}

describe("flowti-canvas-mode", () => {
	let el: HTMLElement & Record<string, unknown>;

	beforeEach(() => {
		el = document.createElement("flowti-canvas-mode") as HTMLElement & Record<string, unknown>;
		document.body.appendChild(el);
	});

	afterEach(() => { el.remove(); });

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-canvas-mode")).toBeDefined();
	});

	it("renders canvas path and open button", async () => {
		el.canvasPath = ".flowti/canvas/agent-atlas-session-1.canvas";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		expect(shadow.querySelector(".canvas-path")?.textContent).toContain("agent-atlas");
		expect(shadow.querySelector("[data-action='open']")).not.toBeNull();
	});

	it("shows empty prompt when no turns", async () => {
		el.turns = [];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		expect(el.shadowRoot!.textContent).toContain("Send a message to start the canvas");
	});

	it("renders preview nodes from turns", async () => {
		el.turns = [
			makeTurn({ id: "t1", role: "user", content: "Hello" }),
			makeTurn({ id: "t2", role: "agent", agentName: "Atlas", persona: "Atlas", content: "Hi there" }),
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const nodes = el.shadowRoot!.querySelectorAll(".preview-node");
		expect(nodes.length).toBe(2);
		expect(nodes[0].classList.contains("preview-node--user")).toBe(true);
		expect(nodes[1].classList.contains("preview-node--agent")).toBe(true);
	});

	it("shows node count", async () => {
		el.turns = [makeTurn()];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const count = el.shadowRoot!.querySelector(".node-count");
		expect(count?.textContent).toContain("1 node");
	});

	it("pluralizes node count", async () => {
		el.turns = [
			makeTurn({ id: "t1" }),
			makeTurn({ id: "t2", role: "agent", content: "reply" }),
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const count = el.shadowRoot!.querySelector(".node-count");
		expect(count?.textContent).toContain("2 nodes");
	});

	it("dispatches canvas-open-requested on open button click", async () => {
		el.agentName = "Atlas";
		el.canvasPath = ".flowti/canvas/atlas-1.canvas";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		let detail: unknown = null;
		el.addEventListener("canvas-open-requested", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		const btn = el.shadowRoot!.querySelector("[data-action='open']") as HTMLElement;
		btn.click();
		expect(detail).toEqual({ agentName: "Atlas", canvasPath: ".flowti/canvas/atlas-1.canvas" });
	});

	it("dispatches canvas-node-added on export click", async () => {
		el.turns = [makeTurn({ id: "t1", role: "user", content: "Hello" })];
		el.canvasPath = ".flowti/canvas/test.canvas";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		let detail: unknown = null;
		el.addEventListener("canvas-node-added", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		const btn = el.shadowRoot!.querySelector("[data-action='export']") as HTMLElement;
		btn.click();
		const payload = detail as { canvasData: CanvasData; canvasPath: string };
		expect(payload.canvasPath).toBe(".flowti/canvas/test.canvas");
		expect(payload.canvasData.nodes.length).toBe(1);
	});

	it("builds canvas data with correct node structure", async () => {
		const turns: ConversationTurn[] = [
			makeTurn({ id: "t1", role: "user", content: "Hello" }),
			makeTurn({ id: "t2", role: "agent", agentName: "Atlas", persona: "Atlas", content: "Hi" }),
		];
		el.turns = turns;
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const data = (el as unknown as FlowtiCanvasMode).buildCanvasData();
		expect(data.nodes.length).toBe(2);
		expect(data.nodes[0].type).toBe("text");
		expect(data.nodes[0].id).toBe("t1");
		expect(data.nodes[0].color).toBe("4"); // user = blue
		expect(data.nodes[1].color).toBe("3"); // agent = green
		expect(data.nodes[0].width).toBe(300);
		expect(data.nodes[0].height).toBe(120);
	});

	it("builds canvas data with edges connecting sequential turns", async () => {
		el.turns = [
			makeTurn({ id: "t1", role: "user", content: "Hello" }),
			makeTurn({ id: "t2", role: "agent", content: "Hi" }),
			makeTurn({ id: "t3", role: "user", content: "What?" }),
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const data = (el as unknown as FlowtiCanvasMode).buildCanvasData();
		expect(data.edges.length).toBe(2);
		expect(data.edges[0].fromNode).toBe("t1");
		expect(data.edges[0].toNode).toBe("t2");
		expect(data.edges[0].fromSide).toBe("bottom");
		expect(data.edges[0].toSide).toBe("top");
		expect(data.edges[1].fromNode).toBe("t2");
		expect(data.edges[1].toNode).toBe("t3");
	});

	it("positions nodes vertically with correct spacing", async () => {
		el.turns = [
			makeTurn({ id: "t1" }),
			makeTurn({ id: "t2", content: "reply" }),
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const data = (el as unknown as FlowtiCanvasMode).buildCanvasData();
		expect(data.nodes[0].x).toBe(0);
		expect(data.nodes[0].y).toBe(0);
		expect(data.nodes[1].y).toBe(160);
	});

	it("builds empty canvas data when no turns", async () => {
		el.turns = [];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const data = (el as unknown as FlowtiCanvasMode).buildCanvasData();
		expect(data.nodes.length).toBe(0);
		expect(data.edges.length).toBe(0);
	});

	it("renders role labels in preview", async () => {
		el.turns = [
			makeTurn({ id: "t1", role: "user", content: "Hello" }),
			makeTurn({ id: "t2", role: "agent", persona: "Atlas", content: "Hi" }),
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const roles = el.shadowRoot!.querySelectorAll(".preview-node__role");
		expect(roles[0].textContent).toContain("You");
		expect(roles[1].textContent).toContain("Atlas");
	});

	it("does not show export button when no turns", async () => {
		el.turns = [];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		expect(el.shadowRoot!.querySelector("[data-action='export']")).toBeNull();
	});

	it("includes node text with role formatting in canvas data", async () => {
		el.turns = [
			makeTurn({ id: "t1", role: "user", content: "Hello world" }),
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const data = (el as unknown as FlowtiCanvasMode).buildCanvasData();
		expect(data.nodes[0].text).toContain("**You**");
		expect(data.nodes[0].text).toContain("Hello world");
	});
});
