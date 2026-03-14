import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "", BLUE: "", MAGENTA: "", WHITE: "", UNDERLINE: "",
	printHeader: vi.fn(), printSection: vi.fn(), printDivider: vi.fn(),
}));

import { log } from "../../../src/infrastructure/logger.js";
import { printHeader } from "../../../src/infrastructure/ui.js";
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
} from "../../../src/ui/renderers/storybook-renderers.js";

const mockLog = log as ReturnType<typeof vi.fn>;
const mockPrintHeader = printHeader as ReturnType<typeof vi.fn>;
const output = () => mockLog.mock.calls.map((c: unknown[]) => c[0] ?? "").join("\n");

beforeEach(() => { mockLog.mockClear(); mockPrintHeader.mockClear(); });

describe("renderStorybookAlreadyInstalled", () => {
	it("renders directory path", () => {
		renderStorybookAlreadyInstalled(log, "/proj/.storybook");
		expect(output()).toContain("Storybook is already installed at:");
		expect(output()).toContain("/proj/.storybook");
	});
});

describe("renderStorybookInstalling", () => {
	it("renders installing message with directory", () => {
		renderStorybookInstalling(log, "/proj/.storybook");
		expect(output()).toContain("Installing Storybook into");
		expect(output()).toContain("/proj/.storybook");
	});
});

describe("renderStorybookInstallFailed", () => {
	it("renders failure message", () => {
		renderStorybookInstallFailed(log);
		expect(output()).toContain("Storybook installation failed.");
	});
});

describe("renderStorybookInstallSuccess", () => {
	it("renders success message with directory", () => {
		renderStorybookInstallSuccess(log, "/proj/.storybook");
		expect(output()).toContain("✓");
		expect(output()).toContain("Storybook installed at /proj/.storybook");
	});
});

describe("renderStorybookNotInstalled", () => {
	it("renders not installed warning", () => {
		renderStorybookNotInstalled(log);
		expect(output()).toContain("Storybook not installed.");
		expect(output()).toContain("Install Storybook");
	});
});

describe("renderStorybookAlreadyRunning", () => {
	it("renders already running warning", () => {
		renderStorybookAlreadyRunning(log);
		expect(output()).toContain("Storybook is already running.");
	});
});

describe("renderStorybookStarting", () => {
	it("renders starting message", () => {
		renderStorybookStarting(log);
		expect(output()).toContain("Starting Storybook...");
		expect(output()).toContain("▸");
	});
});

describe("renderStorybookFailedToStart", () => {
	it("renders failure with ✗", () => {
		renderStorybookFailedToStart(log);
		expect(output()).toContain("✗");
		expect(output()).toContain("Storybook failed to start.");
	});
});

describe("renderStorybookFailOutput", () => {
	it("renders output lines", () => {
		renderStorybookFailOutput(log, ["Error: port in use", "Check config"]);
		const out = output();
		expect(out).toContain("Output:");
		expect(out).toContain("Error: port in use");
		expect(out).toContain("Check config");
	});

	it("handles empty lines array", () => {
		renderStorybookFailOutput(log, []);
		expect(output()).toContain("Output:");
	});
});

describe("renderStorybookTimeout", () => {
	it("renders timeout warning", () => {
		renderStorybookTimeout(log);
		expect(output()).toContain("⚠");
		expect(output()).toContain("Timed out waiting for Storybook");
	});
});

describe("renderStorybookReady", () => {
	it("renders ready message with URL", () => {
		renderStorybookReady(log, "http://localhost:6006");
		expect(output()).toContain("✓");
		expect(output()).toContain("Storybook ready at");
		expect(output()).toContain("http://localhost:6006");
	});
});

describe("renderStorybookStopped", () => {
	it("renders stopped message", () => {
		renderStorybookStopped(log);
		expect(output()).toContain("✓");
		expect(output()).toContain("Storybook stopped.");
	});
});

describe("renderStorybookNotRunning", () => {
	it("renders not running message", () => {
		renderStorybookNotRunning(log);
		expect(output()).toContain("Storybook is not running.");
	});
});

describe("renderStorybookView", () => {
	it("renders header and URL", () => {
		renderStorybookView(log, "http://localhost:6006");
		expect(mockPrintHeader).toHaveBeenCalledWith("Storybook");
		expect(output()).toContain("Running at");
		expect(output()).toContain("http://localhost:6006");
		expect(output()).toContain("Press Enter to stop");
	});
});

describe("renderStorybookBrowserContext", () => {
	it("renders context message", () => {
		renderStorybookBrowserContext(log, "Opening browser...");
		expect(output()).toContain("Opening browser...");
	});
});

describe("renderStorybookOpenedIn", () => {
	it("renders target", () => {
		renderStorybookOpenedIn(log, "Chrome");
		expect(output()).toContain("▸");
		expect(output()).toContain("Opened in Chrome");
	});
});
