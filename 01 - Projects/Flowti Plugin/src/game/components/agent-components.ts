/**
 * agent-components.ts — ECS data components for agent actors.
 *
 * Pure data holders — no logic, no Excalibur dependency.
 * Attached to AgentActor as properties. The LocomotionSystem reads/writes
 * MovementComponent per frame. Presentation systems read IntentComponent.
 *
 * BlackboardManager.push() writes TO these components.
 * BlackboardManager.pull() reads FROM these components.
 */

// ── MovementComponent ────────────────────────────────────────────

export class MovementComponent {
	command: "none" | "walk-to" | "wander" = "none";
	target: { x: number; y: number } | null = null;
	arrived = false;
	speed = 40;
	movementStyle: "deliberate" | "brisk" | "darting" = "brisk";
}

// ── IntentComponent ──────────────────────────────────────────────

export class IntentComponent {
	intent = "idle";
	detail = "";
	idlePose = "idle";
	idlePoseTimer = 0;
}
