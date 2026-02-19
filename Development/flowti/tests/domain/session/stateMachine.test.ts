/**
 * Session v2 State Machine Tests (ADR-031)
 *
 * Tests the `isValidTransition` pure function that enforces the
 * 6-state session lifecycle: prepared → running → paused → reviewing → completed → archived.
 */

import { describe, it, expect } from "vitest";
import { isValidTransition } from "../../../src/domain/session/helpers";
import type { SessionStatusV2 } from "../../../src/domain/session/types";

describe("isValidTransition (ADR-031)", () => {
	// ── Valid transitions ────────────────────────────────────

	it("prepared → running is valid (Start)", () => {
		expect(isValidTransition("prepared", "running")).toBe(true);
	});

	it("running → paused is valid (Pause)", () => {
		expect(isValidTransition("running", "paused")).toBe(true);
	});

	it("running → reviewing is valid (Timer expiry or manual complete)", () => {
		expect(isValidTransition("running", "reviewing")).toBe(true);
	});

	it("paused → running is valid (Resume)", () => {
		expect(isValidTransition("paused", "running")).toBe(true);
	});

	it("reviewing → completed is valid (Closure ritual submitted)", () => {
		expect(isValidTransition("reviewing", "completed")).toBe(true);
	});

	it("completed → archived is valid (Archive)", () => {
		expect(isValidTransition("completed", "archived")).toBe(true);
	});

	// ── Invalid transitions ─────────────────────────────────

	it("prepared → paused is invalid (cannot pause before starting)", () => {
		expect(isValidTransition("prepared", "paused")).toBe(false);
	});

	it("prepared → completed is invalid (cannot skip execution)", () => {
		expect(isValidTransition("prepared", "completed")).toBe(false);
	});

	it("prepared → reviewing is invalid (cannot review before running)", () => {
		expect(isValidTransition("prepared", "reviewing")).toBe(false);
	});

	it("running → completed is invalid (must go through reviewing)", () => {
		expect(isValidTransition("running", "completed")).toBe(false);
	});

	it("running → archived is invalid (cannot archive a running session)", () => {
		expect(isValidTransition("running", "archived")).toBe(false);
	});

	it("paused → completed is invalid (must resume and review first)", () => {
		expect(isValidTransition("paused", "completed")).toBe(false);
	});

	it("paused → reviewing is invalid (must resume first)", () => {
		expect(isValidTransition("paused", "reviewing")).toBe(false);
	});

	it("reviewing → running is invalid (cannot return to running from review)", () => {
		expect(isValidTransition("reviewing", "running")).toBe(false);
	});

	it("reviewing → paused is invalid (cannot pause during review)", () => {
		expect(isValidTransition("reviewing", "paused")).toBe(false);
	});

	it("completed → running is invalid (cannot restart a completed session)", () => {
		expect(isValidTransition("completed", "running")).toBe(false);
	});

	it("archived → running is invalid (no transitions from archived)", () => {
		expect(isValidTransition("archived", "running")).toBe(false);
	});

	it("archived has no valid transitions", () => {
		const targets: SessionStatusV2[] = ["prepared", "running", "paused", "reviewing", "completed", "archived"];
		for (const target of targets) {
			expect(isValidTransition("archived", target)).toBe(false);
		}
	});

	// ── Self-transitions ────────────────────────────────────

	it("no state can transition to itself", () => {
		const states: SessionStatusV2[] = ["prepared", "running", "paused", "reviewing", "completed", "archived"];
		for (const state of states) {
			expect(isValidTransition(state, state)).toBe(false);
		}
	});

	// ── Exhaustive valid transition count ────────────────────

	it("exactly 6 valid transitions exist in the state machine", () => {
		const states: SessionStatusV2[] = ["prepared", "running", "paused", "reviewing", "completed", "archived"];
		let validCount = 0;
		for (const from of states) {
			for (const to of states) {
				if (isValidTransition(from, to)) validCount++;
			}
		}
		expect(validCount).toBe(6);
	});
});
