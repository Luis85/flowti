import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/ui/renderers/storybook-renderers.js", () => ({
	renderStorybookAlreadyInstalled: vi.fn(),
	renderStorybookInstalling: vi.fn(),
	renderStorybookInstallFailed: vi.fn(),
	renderStorybookInstallSuccess: vi.fn(),
	renderStorybookNotInstalled: vi.fn(),
	renderStorybookAlreadyRunning: vi.fn(),
	renderStorybookStarting: vi.fn(),
	renderStorybookFailedToStart: vi.fn(),
	renderStorybookFailOutput: vi.fn(),
	renderStorybookTimeout: vi.fn(),
	renderStorybookReady: vi.fn(),
	renderStorybookStopped: vi.fn(),
	renderStorybookNotRunning: vi.fn(),
	renderStorybookView: vi.fn(),
	renderStorybookBrowserContext: vi.fn(),
	renderStorybookOpenedIn: vi.fn(),
	renderStorybookProgress: vi.fn(),
}));

import { createStorybookRenderer } from "../../../src/ui/renderers/storybook-renderer-impl.js";
import {
	renderStorybookAlreadyInstalled,
	renderStorybookInstalling,
	renderStorybookInstallFailed,
	renderStorybookInstallSuccess,
	renderStorybookNotInstalled,
	renderStorybookAlreadyRunning,
	renderStorybookStarting,
	renderStorybookFailedToStart,
	renderStorybookFailOutput,
	renderStorybookTimeout,
	renderStorybookReady,
	renderStorybookStopped,
	renderStorybookNotRunning,
	renderStorybookView,
	renderStorybookBrowserContext,
	renderStorybookOpenedIn,
	renderStorybookProgress,
} from "../../../src/ui/renderers/storybook-renderers.js";

const mockLog = vi.fn();

beforeEach(() => {
	vi.clearAllMocks();
});

describe("createStorybookRenderer", () => {
	it("returns an object with all StorybookRenderer methods", () => {
		const renderer = createStorybookRenderer(mockLog);
		const keys = Object.keys(renderer).sort();
		expect(keys).toEqual([
			"alreadyInstalled",
			"alreadyRunning",
			"browserContext",
			"failOutput",
			"failedToStart",
			"installFailed",
			"installSuccess",
			"installing",
			"notInstalled",
			"notRunning",
			"openedIn",
			"progress",
			"ready",
			"starting",
			"stopped",
			"timeout",
			"view",
		]);
	});

	describe("alreadyInstalled", () => {
		it("delegates to renderStorybookAlreadyInstalled with log and sbDir", () => {
			const renderer = createStorybookRenderer(mockLog);
			renderer.alreadyInstalled("/proj/.storybook");
			expect(renderStorybookAlreadyInstalled).toHaveBeenCalledWith("/proj/.storybook", mockLog);
		});
	});

	describe("installing", () => {
		it("delegates to renderStorybookInstalling with log and sbDir", () => {
			const renderer = createStorybookRenderer(mockLog);
			renderer.installing("/proj/.storybook");
			expect(renderStorybookInstalling).toHaveBeenCalledWith("/proj/.storybook", mockLog);
		});
	});

	describe("installFailed", () => {
		it("delegates to renderStorybookInstallFailed with log", () => {
			const renderer = createStorybookRenderer(mockLog);
			renderer.installFailed();
			expect(renderStorybookInstallFailed).toHaveBeenCalledWith(mockLog);
		});
	});

	describe("installSuccess", () => {
		it("delegates to renderStorybookInstallSuccess with log and sbDir", () => {
			const renderer = createStorybookRenderer(mockLog);
			renderer.installSuccess("/proj/.storybook");
			expect(renderStorybookInstallSuccess).toHaveBeenCalledWith("/proj/.storybook", mockLog);
		});
	});

	describe("notInstalled", () => {
		it("delegates to renderStorybookNotInstalled with log", () => {
			const renderer = createStorybookRenderer(mockLog);
			renderer.notInstalled();
			expect(renderStorybookNotInstalled).toHaveBeenCalledWith(mockLog);
		});
	});

	describe("alreadyRunning", () => {
		it("delegates to renderStorybookAlreadyRunning with log", () => {
			const renderer = createStorybookRenderer(mockLog);
			renderer.alreadyRunning();
			expect(renderStorybookAlreadyRunning).toHaveBeenCalledWith(mockLog);
		});
	});

	describe("starting", () => {
		it("delegates to renderStorybookStarting with log", () => {
			const renderer = createStorybookRenderer(mockLog);
			renderer.starting();
			expect(renderStorybookStarting).toHaveBeenCalledWith(mockLog);
		});
	});

	describe("failedToStart", () => {
		it("delegates to renderStorybookFailedToStart with log", () => {
			const renderer = createStorybookRenderer(mockLog);
			renderer.failedToStart();
			expect(renderStorybookFailedToStart).toHaveBeenCalledWith(mockLog);
		});
	});

	describe("failOutput", () => {
		it("delegates to renderStorybookFailOutput with log and lines", () => {
			const renderer = createStorybookRenderer(mockLog);
			const lines = ["Error: port in use", "Check config"];
			renderer.failOutput(lines);
			expect(renderStorybookFailOutput).toHaveBeenCalledWith(lines, mockLog);
		});

		it("passes empty lines array", () => {
			const renderer = createStorybookRenderer(mockLog);
			renderer.failOutput([]);
			expect(renderStorybookFailOutput).toHaveBeenCalledWith([], mockLog);
		});
	});

	describe("timeout", () => {
		it("delegates to renderStorybookTimeout with log", () => {
			const renderer = createStorybookRenderer(mockLog);
			renderer.timeout();
			expect(renderStorybookTimeout).toHaveBeenCalledWith(mockLog);
		});
	});

	describe("ready", () => {
		it("delegates to renderStorybookReady with log and url", () => {
			const renderer = createStorybookRenderer(mockLog);
			renderer.ready("http://localhost:6006");
			expect(renderStorybookReady).toHaveBeenCalledWith("http://localhost:6006", mockLog);
		});
	});

	describe("stopped", () => {
		it("delegates to renderStorybookStopped with log", () => {
			const renderer = createStorybookRenderer(mockLog);
			renderer.stopped();
			expect(renderStorybookStopped).toHaveBeenCalledWith(mockLog);
		});
	});

	describe("notRunning", () => {
		it("delegates to renderStorybookNotRunning with log", () => {
			const renderer = createStorybookRenderer(mockLog);
			renderer.notRunning();
			expect(renderStorybookNotRunning).toHaveBeenCalledWith(mockLog);
		});
	});

	describe("view", () => {
		it("delegates to renderStorybookView with log and url", () => {
			const renderer = createStorybookRenderer(mockLog);
			renderer.view("http://localhost:6006");
			expect(renderStorybookView).toHaveBeenCalledWith("http://localhost:6006", mockLog);
		});
	});

	describe("browserContext", () => {
		it("delegates to renderStorybookBrowserContext with log and message", () => {
			const renderer = createStorybookRenderer(mockLog);
			renderer.browserContext("Opening browser...");
			expect(renderStorybookBrowserContext).toHaveBeenCalledWith("Opening browser...", mockLog);
		});
	});

	describe("openedIn", () => {
		it("delegates to renderStorybookOpenedIn with log and target", () => {
			const renderer = createStorybookRenderer(mockLog);
			renderer.openedIn("Chrome");
			expect(renderStorybookOpenedIn).toHaveBeenCalledWith("Chrome", mockLog);
		});
	});

	describe("progress", () => {
		it("delegates to renderStorybookProgress with log and line", () => {
			const renderer = createStorybookRenderer(mockLog);
			renderer.progress("Compiling...");
			expect(renderStorybookProgress).toHaveBeenCalledWith("Compiling...", mockLog);
		});
	});

	describe("isolation", () => {
		it("each call to createStorybookRenderer returns an independent instance", () => {
			const log1 = vi.fn();
			const log2 = vi.fn();
			const r1 = createStorybookRenderer(log1);
			const r2 = createStorybookRenderer(log2);
			r1.starting();
			r2.starting();
			expect(renderStorybookStarting).toHaveBeenCalledWith(log1);
			expect(renderStorybookStarting).toHaveBeenCalledWith(log2);
			expect(renderStorybookStarting).toHaveBeenCalledTimes(2);
		});
	});
});
