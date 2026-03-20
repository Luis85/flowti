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

// ── Import triggers custom element registration ──────────────────────

import type { PanelTasks } from "../../../src/game/ui/panel-tasks.js";

// Lazy import so mocks are in place before module evaluation
const importModule = async () => import("../../../src/game/ui/panel-tasks.js");

describe("PanelTasks (ft-game-panel-tasks)", () => {
	beforeEach(async () => {
		await importModule();
	});

	it("is defined as a custom element", () => {
		expect(customElements.get("ft-game-panel-tasks")).toBeDefined();
	});

	it("can be constructed without error", () => {
		expect(() => document.createElement("ft-game-panel-tasks")).not.toThrow();
	});

	it("declares pendingTaskDef and inputValue as state properties", async () => {
		const mod = await importModule();
		const props = mod.PanelTasks.properties as Record<string, { state?: boolean }>;
		expect(props.pendingTaskDef).toEqual({ state: true });
		expect(props.inputValue).toEqual({ state: true });
	});

	it("does not declare legacy pendingTask property", async () => {
		const mod = await importModule();
		const props = mod.PanelTasks.properties as Record<string, unknown>;
		expect(props).not.toHaveProperty("pendingTask");
	});

	it("exports TaskEntry with failed status in union", async () => {
		// This is a compile-time check — if the type compiles, "failed" is valid
		const entry: import("../../../src/game/ui/panel-tasks.js").TaskEntry = {
			name: "test",
			status: "failed",
		};
		expect(entry.status).toBe("failed");
	});
});

describe("PanelTasks interaction logic", () => {
	let el: PanelTasks;
	let mockStore: {
		assignedTasks: Map<string, { name: string; status: string; assignedAt: number }[]>;
		assignTask: ReturnType<typeof vi.fn>;
		executeTask: ReturnType<typeof vi.fn>;
		addEventListener: ReturnType<typeof vi.fn>;
		removeEventListener: ReturnType<typeof vi.fn>;
	};

	beforeEach(async () => {
		await importModule();
		el = document.createElement("ft-game-panel-tasks") as unknown as PanelTasks;
		mockStore = {
			assignedTasks: new Map(),
			assignTask: vi.fn().mockResolvedValue({ ok: true }),
			executeTask: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		};
		(el as unknown as Record<string, unknown>).store = mockStore;
		(el as unknown as Record<string, unknown>).agent = {
			name: "atlas",
			agentType: "ai",
			status: "idle" as const,
			suggestedTasks: [
				{ name: "Review code", phases: ["ready"], input: { type: "text" as const, prompt: "Which file?" } },
				{ name: "Run tests", phases: [], tool: { command: "flowti test" } },
				{ name: "Simple task", phases: [] },
			],
		};
	});

	it("handleAssignClick opens input modal for tasks with input", () => {
		const task = { name: "Review code", phases: ["ready"], input: { type: "text" as const, prompt: "Which file?" } };
		// Access private method via bracket notation for testing
		(el as unknown as Record<string, (t: unknown) => void>)["handleAssignClick"](task);
		expect((el as unknown as Record<string, unknown>)["pendingTaskDef"]).toEqual(task);
		expect((el as unknown as Record<string, string>)["inputValue"]).toBe("");
	});

	it("handleAssignClick opens confirm dialog for AI agents without input", () => {
		const task = { name: "Simple task", phases: [] };
		(el as unknown as Record<string, (t: unknown) => void>)["handleAssignClick"](task);
		expect((el as unknown as Record<string, unknown>)["pendingTaskDef"]).toEqual(task);
	});

	it("handleAssignClick calls executeTask directly for non-AI agents without input", () => {
		(el as unknown as Record<string, unknown>).agent = {
			name: "bob",
			agentType: "human",
			status: "idle" as const,
		};
		const task = { name: "Simple task", phases: [] };
		(el as unknown as Record<string, (t: unknown) => void>)["handleAssignClick"](task);
		expect(mockStore.executeTask).toHaveBeenCalledWith("bob", task, undefined);
		expect((el as unknown as Record<string, unknown>)["pendingTaskDef"]).toBeNull();
	});

	it("handleConfirm calls executeTask with input for input tasks", () => {
		const task = { name: "Review code", phases: ["ready"], input: { type: "text" as const, prompt: "Which file?" } };
		(el as unknown as Record<string, unknown>)["pendingTaskDef"] = task;
		(el as unknown as Record<string, string>)["inputValue"] = "src/main.ts";
		(el as unknown as Record<string, () => void>)["handleConfirm"]();
		expect(mockStore.executeTask).toHaveBeenCalledWith("atlas", task, "src/main.ts");
		expect((el as unknown as Record<string, unknown>)["pendingTaskDef"]).toBeNull();
		expect((el as unknown as Record<string, string>)["inputValue"]).toBe("");
	});

	it("handleConfirm calls executeTask without input for non-input tasks", () => {
		const task = { name: "Simple task", phases: [] };
		(el as unknown as Record<string, unknown>)["pendingTaskDef"] = task;
		(el as unknown as Record<string, () => void>)["handleConfirm"]();
		expect(mockStore.executeTask).toHaveBeenCalledWith("atlas", task, undefined);
	});

	it("handleCancel clears pendingTaskDef and inputValue", () => {
		(el as unknown as Record<string, unknown>)["pendingTaskDef"] = { name: "test", phases: [] };
		(el as unknown as Record<string, string>)["inputValue"] = "something";
		(el as unknown as Record<string, () => void>)["handleCancel"]();
		expect((el as unknown as Record<string, unknown>)["pendingTaskDef"]).toBeNull();
		expect((el as unknown as Record<string, string>)["inputValue"]).toBe("");
	});

	it("falls back to assignTask when executeTask is not available", () => {
		delete (mockStore as Record<string, unknown>).executeTask;
		(el as unknown as Record<string, unknown>).agent = {
			name: "bob",
			agentType: "human",
			status: "idle" as const,
		};
		const task = { name: "Simple task", phases: [] };
		(el as unknown as Record<string, (t: unknown) => void>)["handleAssignClick"](task);
		expect(mockStore.assignTask).toHaveBeenCalledWith("bob", "Simple task");
	});
});
