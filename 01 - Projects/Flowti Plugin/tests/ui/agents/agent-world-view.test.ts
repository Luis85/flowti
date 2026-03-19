// @vitest-environment happy-dom
import "../../mocks/obsidian-stub";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/game/engine.js", () => ({
	createAgentWorld: vi.fn(() => ({
		start: vi.fn().mockResolvedValue(undefined),
		pause: vi.fn(),
		resume: vi.fn(),
		dispose: vi.fn(),
	})),
}));

vi.mock("../../../src/game/config/cli-data-provider.js", () => ({
	createCliDataProvider: vi.fn(() => ({})),
}));

import { AgentWorldView } from "../../../src/ui/agents/agent-world-view.js";
import { createAgentWorld } from "../../../src/game/engine.js";

/* ── Mock IntersectionObserver ───────────────────────── */

class MockIntersectionObserver {
	callback: IntersectionObserverCallback;
	elements: Element[] = [];

	constructor(callback: IntersectionObserverCallback) {
		this.callback = callback;
	}

	observe(el: Element): void {
		this.elements.push(el);
	}

	disconnect(): void {
		this.elements = [];
	}

	unobserve(): void { /* noop */ }
}

/* ── Test helpers ────────────────────────────────────── */

function createMockLeaf(): never {
	return { parent: { children: [] as unknown[] }, getRoot: () => ({}) } as never;
}

function createMockDeps() {
	return {
		plugin: {
			manifest: { id: "flowti-ibde" },
		},
		eventBus: { on: vi.fn().mockReturnValue(() => {}) },
	} as never;
}

function createView(deps?: never): AgentWorldView {
	const d = deps ?? createMockDeps();
	const view = new AgentWorldView(createMockLeaf(), d);

	// Set up containerEl with Obsidian's expected structure
	const containerEl = document.createElement("div");
	containerEl.appendChild(document.createElement("div")); // header
	containerEl.appendChild(document.createElement("div")); // content
	(view as unknown as { containerEl: HTMLElement }).containerEl = containerEl;

	// Mock the app property on the view
	(view as unknown as { app: Record<string, unknown> }).app = {
		vault: {
			configDir: ".obsidian",
			adapter: {
				basePath: "/mock/vault",
				exists: vi.fn().mockResolvedValue(true),
				read: vi.fn().mockResolvedValue("{}"),
				getResourcePath: vi.fn((p: string) => `app://test/${p}`),
			},
		},
	};

	return view;
}

/* ── Tests ───────────────────────────────────────────── */

describe("AgentWorldView", () => {
	let originalIntersectionObserver: typeof IntersectionObserver;

	beforeEach(() => {
		vi.clearAllMocks();

		// IntersectionObserver polyfill
		originalIntersectionObserver = globalThis.IntersectionObserver;
		(globalThis as Record<string, unknown>).IntersectionObserver = MockIntersectionObserver;
	});

	beforeEach(() => {
		return () => {
			(globalThis as Record<string, unknown>).IntersectionObserver = originalIntersectionObserver;
		};
	});

	describe("view metadata", () => {
		it("returns correct view type", () => {
			const view = createView();
			expect(view.getViewType()).toBe("flowti-agent-world");
		});

		it("returns correct display text", () => {
			const view = createView();
			expect(view.getDisplayText()).toBe("Agent world");
		});

		it("returns globe icon", () => {
			const view = createView();
			expect(view.getIcon()).toBe("globe");
		});
	});

	describe("onOpen", () => {
		it("creates game container with correct id", async () => {
			const view = createView();
			await view.onOpen();

			const container = view.contentEl.querySelector("#flowti-world") as HTMLElement;
			expect(container).toBeTruthy();
			expect(container.classList.contains("ft-world-container")).toBe(true);
		});

		it("calls createAgentWorld", async () => {
			const view = createView();
			await view.onOpen();
			expect(createAgentWorld).toHaveBeenCalled();
		});

		it("calls start on the handle", async () => {
			const view = createView();
			await view.onOpen();

			const handle = (view as unknown as { handle: { start: ReturnType<typeof vi.fn> } }).handle;
			expect(handle.start).toHaveBeenCalled();
		});

		it("sets up IntersectionObserver", async () => {
			const view = createView();
			await view.onOpen();

			const observer = (view as unknown as { observer: MockIntersectionObserver }).observer;
			expect(observer).toBeTruthy();
			expect(observer.elements.length).toBe(1);
		});
	});

	describe("onClose", () => {
		it("calls dispose on the handle", async () => {
			const view = createView();
			await view.onOpen();

			const handle = (view as unknown as { handle: { dispose: ReturnType<typeof vi.fn> } }).handle;
			await view.onClose();
			expect(handle.dispose).toHaveBeenCalled();
		});

		it("nullifies the handle", async () => {
			const view = createView();
			await view.onOpen();

			await view.onClose();
			expect((view as unknown as { handle: unknown }).handle).toBeNull();
		});

		it("disconnects the IntersectionObserver", async () => {
			const view = createView();
			await view.onOpen();

			await view.onClose();
			expect((view as unknown as { observer: unknown }).observer).toBeNull();
		});

		it("empties the content element", async () => {
			const view = createView();
			await view.onOpen();

			expect(view.contentEl.children.length).toBeGreaterThan(0);

			await view.onClose();
			expect(view.contentEl.children.length).toBe(0);
		});
	});
});
