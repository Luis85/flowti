import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../src/infrastructure/ui.js", () => ({
	RESET: "", DIM: "", CYAN: "",
}));

import { log } from "../../src/infrastructure/logger.js";
import {
	showSuggestions,
	afterScaffold,
	afterMakeComponent,
	afterPublish,
	afterReports,
} from "../../src/infrastructure/suggestions.js";

beforeEach(() => vi.clearAllMocks());

describe("showSuggestions", () => {
	it("does nothing for empty array", () => {
		showSuggestions([]);
		expect(log).not.toHaveBeenCalled();
	});

	it("shows Next: header and each suggestion", () => {
		showSuggestions([
			{ command: "npm install", description: "Install deps" },
			{ command: "npm test", description: "Run tests" },
		]);

		const calls = vi.mocked(log).mock.calls.map(([msg]) => String(msg ?? ""));
		expect(calls.some((m) => m.includes("Next:"))).toBe(true);
		expect(calls.some((m) => m.includes("npm install"))).toBe(true);
		expect(calls.some((m) => m.includes("npm test"))).toBe(true);
	});
});

describe("suggestion builders", () => {
	it("afterScaffold returns install and info commands", () => {
		const suggestions = afterScaffold("my-project");
		expect(suggestions.length).toBeGreaterThan(0);
		expect(suggestions.some((s) => s.command.includes("npm install"))).toBe(true);
		expect(suggestions.some((s) => s.command.includes("info"))).toBe(true);
	});

	it("afterMakeComponent returns health and info commands", () => {
		const suggestions = afterMakeComponent("UserProfile");
		expect(suggestions.length).toBeGreaterThan(0);
		expect(suggestions.some((s) => s.command.includes("health"))).toBe(true);
	});

	it("afterMakeComponent includes project flag when provided", () => {
		const suggestions = afterMakeComponent("UserProfile", "my-app");
		expect(suggestions.some((s) => s.command.includes("--project=my-app"))).toBe(true);
	});

	it("afterPublish returns health suggestion", () => {
		const suggestions = afterPublish();
		expect(suggestions.length).toBeGreaterThan(0);
		expect(suggestions.some((s) => s.command.includes("health"))).toBe(true);
	});

	it("afterReports returns health suggestion", () => {
		const suggestions = afterReports();
		expect(suggestions.length).toBeGreaterThan(0);
	});
});
