// @vitest-environment happy-dom
import "../mocks/obsidian-stub";
import { describe, it, expect, vi } from "vitest";
import { NewSessionModal } from "../../src/ui/modals";
import type { App } from "obsidian";

// ── Helpers ──────────────────────────────────────────────────

function createMockApp(): App {
	return {
		vault: { getFiles: () => [] },
		workspace: {},
	} as unknown as App;
}

const SESSION_TYPES = [
	{ type: "event-storming", label: "Event Storming", description: "" },
];

// ── Tests ────────────────────────────────────────────────────

describe("NewSessionModal", () => {
	describe("goals repeater", () => {
		it("should create goals repeater container in contentEl", () => {
			const app = createMockApp();
			const onSubmit = vi.fn();
			const modal = new NewSessionModal(app, {
				sessionTypes: SESSION_TYPES,
				onSubmit,
			});

			modal.onOpen();

			const container = modal.contentEl.querySelector(".ft-goals-repeater");
			expect(container).not.toBeNull();
		});

		it("should accept goals in prefill", () => {
			const app = createMockApp();
			const onSubmit = vi.fn();
			const modal = new NewSessionModal(app, {
				sessionTypes: SESSION_TYPES,
				prefill: {
					title: "Test",
					type: "event-storming",
					durationMinutes: 25,
					goals: ["Goal A", "Goal B"],
				},
				onSubmit,
			});

			// Verifies constructor accepts goals in prefill without error
			modal.onOpen();

			const container = modal.contentEl.querySelector(".ft-goals-repeater");
			expect(container).not.toBeNull();
		});

		it("should accept goals in template summary", () => {
			const app = createMockApp();
			const onSubmit = vi.fn();

			// Templates with goals should be accepted without type error
			const modal = new NewSessionModal(app, {
				sessionTypes: SESSION_TYPES,
				templates: [
					{ id: "t1", name: "Sprint Template", type: "event-storming", durationMinutes: 25, goals: ["Review events", "Update docs"] },
				],
				onSubmit,
			});

			modal.onOpen();
			expect(modal.contentEl.querySelector(".ft-goals-repeater")).not.toBeNull();
		});

		it("should include goals parameter in onSubmit signature", () => {
			const app = createMockApp();
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const onSubmit = vi.fn((_title: string, _type: string, _duration: number, _focusFile: string | null, _goals: string[]) => {});

			const modal = new NewSessionModal(app, {
				sessionTypes: SESSION_TYPES,
				onSubmit,
			});

			// Type check: onSubmit has 5 parameters including goals
			modal.onOpen();
			expect(onSubmit).not.toHaveBeenCalled(); // Not called until Create button clicked
		});
	});
});
