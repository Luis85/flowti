/**
 * journey-execution.ts — MDSL subtree for journey task execution.
 *
 * Stub integration — slot reserved for when journeys are wired to the
 * SSE event contract. HasJourneyTask always returns false for now.
 */

export const JOURNEY_EXECUTION_SUBTREE = `
root [JourneyExecution] {
	sequence {
		condition [HasJourneyTask]
		action [ExecuteJourney]
	}
}
`.trim();
