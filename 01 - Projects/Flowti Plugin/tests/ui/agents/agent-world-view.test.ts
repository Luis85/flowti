// @vitest-environment happy-dom
import "../../mocks/obsidian-stub";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { VIEW_TYPE_AGENT_WORLD } from "../../../src/ui/agents/types";

/* ── Mock WorldBridge before importing the view ──────── */

const mockDispose = vi.fn();
const mockConnectServer = vi.fn().mockResolvedValue(undefined);
const mockPause = vi.fn();
const mockResume = vi.fn();

vi.mock("../../../src/infrastructure/agents/world-bridge", () => {
	class MockWorldBridge {
		dispose = mockDispose;
		connectServer = mockConnectServer;
		pause = mockPause;
		resume = mockResume;
		serverOnline = false;
		hasEventBusListeners = true;
		containerElement: HTMLElement;
		assetBasePath: string;

		constructor(config: { containerElement: HTMLElement }) {
			this.containerElement = config.containerElement;
			this.assetBasePath = "file:///test/.flowti/agents/";
		}
	}

	return { WorldBridge: MockWorldBridge };
});

import { AgentWorldView } from "../../../src/ui/agents/agent-world-view";
import type { AgentWorldViewDeps } from "../../../src/ui/agents/agent-world-view";

/* ── Test helpers ────────────────────────────────────── */

function createMockDeps(overrides?: {
	dashboardExists?: boolean;
	worldStateExists?: boolean;
	worldStateContent?: string;
	dashboardContent?: string;
}): AgentWorldViewDeps {
	const { dashboardExists = true, worldStateExists = false, worldStateContent = "{}", dashboardContent = "// game" } = overrides ?? {};

	return {
		app: {
			vault: {
				adapter: {
					exists: vi.fn(async (path: string) => {
						if (path.includes("world-state.json")) return worldStateExists;
						if (path.includes("dashboard.js")) return dashboardExists;
						return false;
					}),
					read: vi.fn(async (path: string) => {
						if (path.includes("world-state.json")) return worldStateContent;
						if (path.includes("dashboard.js")) return dashboardContent;
						return "";
					}),
				},
			},
		},
		eventBus: {
			emit: vi.fn(),
			emitCustom: vi.fn(),
			on: vi.fn(() => vi.fn()),
			once: vi.fn(() => vi.fn()),
			off: vi.fn(),
			clear: vi.fn(),
		},
		baseUrl: "http://localhost:3000",
	};
}

function createView(deps?: AgentWorldViewDeps): AgentWorldView {
	const d = deps ?? createMockDeps();
	const leaf = { parent: { children: [] as unknown[] }, getRoot: () => ({}) } as never;
	const view = new AgentWorldView(leaf, d);

	// Set up containerEl with Obsidian's expected structure
	const containerEl = document.createElement("div");
	containerEl.appendChild(document.createElement("div")); // header
	containerEl.appendChild(document.createElement("div")); // content
	(view as unknown as { containerEl: HTMLElement }).containerEl = containerEl;

	// Mock the app.vault.adapter on the view's inherited app property
	(view as unknown as { app: Record<string, unknown> }).app = {
		vault: {
			adapter: {
				...d.app.vault.adapter,
				basePath: "/test/vault",
			},
		},
	};

	return view;
}

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

/* ── Mock URL.createObjectURL / revokeObjectURL ──────── */

const revokeObjectURLSpy = vi.fn();
const createObjectURLSpy = vi.fn(() => "blob:test-url");

/* ── Tests ───────────────────────────────────────────── */

describe("AgentWorldView", () => {
	let originalIntersectionObserver: typeof IntersectionObserver;
	let originalCreateObjectURL: typeof URL.createObjectURL;
	let originalRevokeObjectURL: typeof URL.revokeObjectURL;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();

		// IntersectionObserver polyfill
		originalIntersectionObserver = globalThis.IntersectionObserver;
		(globalThis as Record<string, unknown>).IntersectionObserver = MockIntersectionObserver;

		// URL polyfills
		originalCreateObjectURL = URL.createObjectURL;
		originalRevokeObjectURL = URL.revokeObjectURL;
		URL.createObjectURL = createObjectURLSpy;
		URL.revokeObjectURL = revokeObjectURLSpy;

		// Clean window globals
		delete window.__flowtiWorldBridge;
		delete window.__flowtiEngine;
	});

	afterEach(() => {
		vi.useRealTimers();
		(globalThis as Record<string, unknown>).IntersectionObserver = originalIntersectionObserver;
		URL.createObjectURL = originalCreateObjectURL;
		URL.revokeObjectURL = originalRevokeObjectURL;
		delete window.__flowtiWorldBridge;
		delete window.__flowtiEngine;
	});

	describe("view metadata", () => {
		it("returns correct view type", () => {
			const view = createView();
			expect(view.getViewType()).toBe(VIEW_TYPE_AGENT_WORLD);
			expect(view.getViewType()).toBe("flowti-agent-world");
		});

		it("returns correct display text", () => {
			const view = createView();
			expect(view.getDisplayText()).toBe("Agent world");
		});

		it("returns correct icon", () => {
			const view = createView();
			expect(view.getIcon()).toBe("globe");
		});
	});

	describe("onOpen", () => {
		it("creates game container with id and tabindex", async () => {
			const view = createView();
			await view.onOpen();

			const container = view.contentEl.querySelector("#flowti-world") as HTMLElement;
			expect(container).toBeTruthy();
			expect(container.getAttribute("tabindex")).toBe("0");
			expect(container.classList.contains("ft-world-container")).toBe(true);
		});

		it("creates status bar with dot and label", async () => {
			const view = createView();
			await view.onOpen();

			const statusBar = view.contentEl.querySelector(".ft-world-status") as HTMLElement;
			expect(statusBar).toBeTruthy();

			const dot = statusBar.querySelector(".ft-world-status-dot") as HTMLElement;
			expect(dot).toBeTruthy();

			const statusLabel = statusBar.querySelector(".ft-world-status-label") as HTMLElement;
			expect(statusLabel).toBeTruthy();
		});

		it("shows error when dashboard.js does not exist", async () => {
			const deps = createMockDeps({ dashboardExists: false });
			const view = createView(deps);
			await view.onOpen();

			const missing = view.contentEl.querySelector(".ft-world-missing") as HTMLElement;
			expect(missing).toBeTruthy();
			expect(missing.textContent).toContain("Agent world not built");
		});

		it("does not set window.__flowtiWorldBridge when dashboard is missing", async () => {
			const deps = createMockDeps({ dashboardExists: false });
			const view = createView(deps);
			await view.onOpen();

			expect(window.__flowtiWorldBridge).toBeUndefined();
		});

		it("sets window.__flowtiWorldBridge when dashboard exists", async () => {
			const view = createView();
			await view.onOpen();

			expect(window.__flowtiWorldBridge).toBeDefined();
		});

		it("calls bridge.connectServer", async () => {
			const view = createView();
			await view.onOpen();

			expect(mockConnectServer).toHaveBeenCalledOnce();
		});

		it("reads world-state.json when it exists", async () => {
			const deps = createMockDeps({
				worldStateExists: true,
				worldStateContent: '{"agents":[]}',
			});
			const view = createView(deps);
			await view.onOpen();

			expect(deps.app.vault.adapter.read).toHaveBeenCalledWith(
				expect.stringContaining("world-state.json")
			);
		});

		it("creates a blob URL and script element", async () => {
			const view = createView();
			await view.onOpen();

			expect(createObjectURLSpy).toHaveBeenCalledOnce();
			const script = view.contentEl.querySelector("script") as HTMLScriptElement;
			expect(script).toBeTruthy();
			expect(script.src).toContain("blob:test-url");
		});

		it("injects Silkscreen font style", async () => {
			const view = createView();
			await view.onOpen();

			const link = view.contentEl.querySelector('link[rel="stylesheet"]') as HTMLLinkElement;
			expect(link).toBeTruthy();
			expect(link.href).toContain("Silkscreen");
		});
	});

	describe("onClose", () => {
		it("cleans up window globals", async () => {
			const view = createView();
			await view.onOpen();

			expect(window.__flowtiWorldBridge).toBeDefined();

			await view.onClose();

			expect(window.__flowtiWorldBridge).toBeUndefined();
			expect(window.__flowtiEngine).toBeUndefined();
		});

		it("disposes the bridge", async () => {
			const view = createView();
			await view.onOpen();

			await view.onClose();

			expect(mockDispose).toHaveBeenCalledOnce();
		});

		it("revokes the blob URL", async () => {
			const view = createView();
			await view.onOpen();

			await view.onClose();

			expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:test-url");
		});

		it("empties the content element", async () => {
			const view = createView();
			await view.onOpen();

			expect(view.contentEl.children.length).toBeGreaterThan(0);

			await view.onClose();

			expect(view.contentEl.children.length).toBe(0);
		});

		it("stops and disposes engine when present", async () => {
			const mockEngine = { stop: vi.fn(), dispose: vi.fn(), start: vi.fn().mockResolvedValue(undefined) };
			const view = createView();
			await view.onOpen();

			window.__flowtiEngine = mockEngine;

			await view.onClose();

			expect(mockEngine.stop).toHaveBeenCalledOnce();
			expect(mockEngine.dispose).toHaveBeenCalledOnce();
			expect(window.__flowtiEngine).toBeUndefined();
		});

		it("clears status interval", async () => {
			const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
			const view = createView();
			await view.onOpen();

			await view.onClose();

			expect(clearIntervalSpy).toHaveBeenCalled();
			clearIntervalSpy.mockRestore();
		});

		it("disconnects the IntersectionObserver", async () => {
			const view = createView();
			await view.onOpen();

			// Observer was created — get a reference via internal state
			const observer = (view as unknown as { observer: MockIntersectionObserver }).observer;
			expect(observer).toBeTruthy();

			await view.onClose();

			// After close, the observer should be disconnected (elements cleared)
			expect((view as unknown as { observer: MockIntersectionObserver | null }).observer).toBeNull();
		});
	});

	describe("status polling", () => {
		it("status interval is cleared on close", async () => {
			const view = createView();
			await view.onOpen();

			// Verify interval was set
			const intervalRef = (view as unknown as { statusInterval: ReturnType<typeof setInterval> | null }).statusInterval;
			expect(intervalRef).not.toBeNull();

			await view.onClose();

			const afterClose = (view as unknown as { statusInterval: ReturnType<typeof setInterval> | null }).statusInterval;
			expect(afterClose).toBeNull();
		});
	});
});
