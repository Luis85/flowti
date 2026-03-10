/**
 * e2e-events.ts — Domain event definitions for the E2E subsystem.
 *
 * These events are emitted by E2E domain functions and consumed by UI renderers.
 * Domain code never imports logger or UI — it emits typed events instead.
 */

export type E2EProgressLevel = "ok" | "fail" | "warn" | "info";

export interface E2EEventMap {
	"e2e.step.progress": { level: E2EProgressLevel; message: string };
	"e2e.prereq.result": { name: string; passed: boolean; detail?: string };
	"e2e.build.progress": { phase: string; message: string };
	"e2e.teardown.progress": { step: string; success: boolean };
	"e2e.session.info": { message: string };
}
