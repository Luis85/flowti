import { describe, it, expect } from "vitest";
import { toEventName, isEventNameConverted } from "../../../src/domain/journeyBuilder/eventNameUtils";

describe("toEventName", () => {
	describe("Title Sentence conversion", () => {
		it("converts two-word title", () => {
			expect(toEventName("Session Started")).toBe("session.started");
		});

		it("converts three-word title", () => {
			expect(toEventName("Hub Tab Changed")).toBe("hub.tab.changed");
		});

		it("converts single word", () => {
			expect(toEventName("Started")).toBe("started");
		});

		it("lowercases mixed-case input", () => {
			expect(toEventName("STEP UPDATED")).toBe("step.updated");
		});

		it("collapses multiple spaces", () => {
			expect(toEventName("Hub   Tab   Changed")).toBe("hub.tab.changed");
		});

		it("trims leading and trailing whitespace", () => {
			expect(toEventName("  Session Started  ")).toBe("session.started");
		});

		it("preserves hyphens within words", () => {
			expect(toEventName("Journey-Builder Opened")).toBe("journey-builder.opened");
		});

		it("handles tab whitespace", () => {
			expect(toEventName("Session\tStarted")).toBe("session.started");
		});
	});

	describe("dot-notation passthrough", () => {
		it("passes through simple dot-notation", () => {
			expect(toEventName("session.started")).toBe("session.started");
		});

		it("passes through hyphenated dot-notation", () => {
			expect(toEventName("journey-builder.opened")).toBe("journey-builder.opened");
		});

		it("passes through multi-segment dot-notation", () => {
			expect(toEventName("hub.tab.changed")).toBe("hub.tab.changed");
		});

		it("lowercases dot-notation with uppercase chars", () => {
			expect(toEventName("Hub.Tab.Changed")).toBe("hub.tab.changed");
		});
	});

	describe("edge cases", () => {
		it("returns empty string for empty input", () => {
			expect(toEventName("")).toBe("");
		});

		it("returns empty string for whitespace-only input", () => {
			expect(toEventName("   ")).toBe("");
		});

		it("handles numbers in title", () => {
			expect(toEventName("Step 1 Created")).toBe("step.1.created");
		});
	});
});

describe("isEventNameConverted", () => {
	it("returns true when conversion changed the value", () => {
		expect(isEventNameConverted("Session Started", "session.started")).toBe(true);
	});

	it("returns false for dot-notation passthrough", () => {
		expect(isEventNameConverted("session.started", "session.started")).toBe(false);
	});

	it("returns false for empty input", () => {
		expect(isEventNameConverted("", "")).toBe(false);
	});

	it("returns true for uppercased dot-notation that got lowercased", () => {
		expect(isEventNameConverted("Hub.Tab.Changed", "hub.tab.changed")).toBe(true);
	});
});
