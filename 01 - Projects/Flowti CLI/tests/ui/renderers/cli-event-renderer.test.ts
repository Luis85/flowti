import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "", BLUE: "", MAGENTA: "", WHITE: "", UNDERLINE: "",
}));

import { log } from "../../../src/infrastructure/logger.js";
import { createCliBus } from "../../../src/infrastructure/event-bus.js";
import { attachCliRenderer } from "../../../src/ui/renderers/cli-event-renderer.js";

const mockLog = log as ReturnType<typeof vi.fn>;
const output = () => mockLog.mock.calls.map((c: unknown[]) => c[0] ?? "").join("\n");

beforeEach(() => {
	vi.clearAllMocks();
});

describe("attachCliRenderer", () => {
	it("renders report.progress events", () => {
		const bus = createCliBus();
		attachCliRenderer(bus);
		bus.emit("report.progress", { generator: "test", message: "Generating test report..." });
		expect(output()).toContain("Generating test report...");
	});

	it("renders report.warning events", () => {
		const bus = createCliBus();
		attachCliRenderer(bus);
		bus.emit("report.warning", { generator: "test", message: "Missing data" });
		expect(output()).toContain("Missing data");
		expect(output()).toContain("⚠");
	});

	it("renders report.written events", () => {
		const bus = createCliBus();
		attachCliRenderer(bus);
		bus.emit("report.written", { generator: "test", outputPath: "/output/report.md" });
		expect(output()).toContain("✓");
		expect(output()).toContain("/output/report.md");
	});

	it("renders e2e.step.progress with ok level", () => {
		const bus = createCliBus();
		attachCliRenderer(bus);
		bus.emit("e2e.step.progress", { level: "ok", message: "Step passed" });
		expect(output()).toContain("✓");
		expect(output()).toContain("Step passed");
	});

	it("renders e2e.step.progress with fail level", () => {
		const bus = createCliBus();
		attachCliRenderer(bus);
		bus.emit("e2e.step.progress", { level: "fail", message: "Step failed" });
		expect(output()).toContain("✗");
		expect(output()).toContain("Step failed");
	});

	it("renders e2e.prereq.result with detail", () => {
		const bus = createCliBus();
		attachCliRenderer(bus);
		bus.emit("e2e.prereq.result", { name: "Vault exists", passed: true, detail: "/path/to/vault" });
		expect(output()).toContain("✓");
		expect(output()).toContain("Vault exists");
		expect(output()).toContain("/path/to/vault");
	});

	it("renders e2e.prereq.result without detail", () => {
		const bus = createCliBus();
		attachCliRenderer(bus);
		bus.emit("e2e.prereq.result", { name: "CLI responsive", passed: false });
		expect(output()).toContain("✗");
		expect(output()).toContain("CLI responsive");
	});

	it("renders e2e.build.progress events", () => {
		const bus = createCliBus();
		attachCliRenderer(bus);
		bus.emit("e2e.build.progress", { phase: "compile", message: "Building..." });
		expect(output()).toContain("[compile]");
		expect(output()).toContain("Building...");
	});

	it("renders e2e.teardown.progress events", () => {
		const bus = createCliBus();
		attachCliRenderer(bus);
		bus.emit("e2e.teardown.progress", { step: "Reset data.json", success: true });
		expect(output()).toContain("✓");
		expect(output()).toContain("Reset data.json");
	});

	it("renders e2e.session.info events", () => {
		const bus = createCliBus();
		attachCliRenderer(bus);
		bus.emit("e2e.session.info", { message: "Session started" });
		expect(output()).toContain("Session started");
	});

	it("renders cli.progress events", () => {
		const bus = createCliBus();
		attachCliRenderer(bus);
		bus.emit("cli.progress", { message: "Processing..." });
		expect(output()).toContain("Processing...");
	});

	it("renders cli.warn events", () => {
		const bus = createCliBus();
		attachCliRenderer(bus);
		bus.emit("cli.warn", { message: "Watch out!" });
		expect(output()).toContain("Watch out!");
	});

	it("returns a detach function that unsubscribes all handlers", () => {
		const bus = createCliBus();
		const detach = attachCliRenderer(bus);
		detach();
		bus.emit("report.progress", { generator: "test", message: "Should not appear" });
		expect(output()).not.toContain("Should not appear");
	});
});
