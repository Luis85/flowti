/**
 * CanvasSessionService — orchestrates canvas session lifecycle.
 *
 * Flow: select template → set goal → create session → create canvas → open sidebar.
 * Delegates to CanvasTemplateService for canvas creation, SessionService (via events)
 * for session lifecycle, and CanvasSessionMonitor for state tracking.
 */
import type { IEventBus } from "../../../infrastructure/events/types";
import type { IFileSystemClient } from "../../../infrastructure/filesystem/types";
import type { CanvasTemplate } from "../templates/types";
import type { CanvasSessionPhase } from "./types";
import { CanvasSessionMonitor } from "./CanvasSessionMonitor";
import { getCanvasTemplate } from "../templates/canvasTemplates";

export interface CanvasSessionServiceDeps {
	eventBus: IEventBus;
	fileSystem: IFileSystemClient;
	sessionFolder: string;
}

export interface StartCanvasSessionInput {
	/** The canvas template to use. */
	templateId: string;
	/** User-defined session goal. */
	goal: string;
	/** Session duration in minutes (0 = no timer). */
	durationMinutes: number;
}

export interface StartCanvasSessionResult {
	sessionId: string;
	canvasPath: string;
}

export class CanvasSessionService {
	private readonly eventBus: IEventBus;
	private readonly fileSystem: IFileSystemClient;
	private readonly sessionFolder: string;
	readonly monitor: CanvasSessionMonitor;

	constructor(deps: CanvasSessionServiceDeps) {
		this.eventBus = deps.eventBus;
		this.fileSystem = deps.fileSystem;
		this.sessionFolder = deps.sessionFolder;
		this.monitor = new CanvasSessionMonitor();
	}

	/**
	 * Starts a canvas session end-to-end:
	 * 1. Validate template
	 * 2. Create session (via event)
	 * 3. Generate canvas from template
	 * 4. Link canvas to session
	 * 5. Start the monitor
	 */
	async startSession(input: StartCanvasSessionInput): Promise<StartCanvasSessionResult> {
		const template = getCanvasTemplate(input.templateId);
		if (!template) {
			throw new Error(`Unknown canvas template: ${input.templateId}`);
		}

		// 1. Create session via event request/response
		const sessionId = await this.createSessionViaEvent(
			`Canvas: ${template.name}`,
			input.durationMinutes,
			input.goal,
		);

		// 2. Generate canvas from template
		const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, "");
		const safeName = template.name.replace(/[^a-zA-Z0-9 -]/g, "").trim();
		const safeGoal = input.goal.replace(/[^a-zA-Z0-9 -]/g, "").trim();
		const nameParts = [datePrefix, safeName];
		if (safeGoal) nameParts.push(safeGoal);
		const canvasPath = `${this.sessionFolder}/${nameParts.join(" - ")}.canvas`;

		const canvasData = template.generate();
		const json = JSON.stringify(canvasData, null, "\t");
		await this.fileSystem.createFile(canvasPath, json, { createFolders: true });

		// 3. Link canvas to session
		void this.eventBus.emit("session.canvasFile.set", {
			sessionId,
			path: canvasPath,
		});

		// 4. Start the monitor
		const phases = this.extractPhases(template, canvasData);
		this.monitor.start({
			sessionId,
			goal: input.goal,
			templateId: template.id,
			templateName: template.name,
			canvasPath,
			phases,
		});

		// 5. Start the session timer
		void this.eventBus.emit("session.start", { sessionId });

		// 6. Emit canvas session events
		void this.eventBus.emit("canvas.session.started", {
			sessionId,
			canvasPath,
			goal: input.goal,
		});
		void this.eventBus.emit("canvas.template.created", {
			templateId: template.id,
			templateName: template.name,
			canvasPath,
		});

		return { sessionId, canvasPath };
	}

	/** Completes the active canvas session. Returns the summary or null. */
	async completeSession(): Promise<string | null> {
		const snapshot = this.monitor.complete();
		if (!snapshot) return null;

		// Emit completion event
		void this.eventBus.emit("canvas.session.completed", {
			sessionId: snapshot.sessionId,
			canvasPath: snapshot.canvasPath,
			nodesAdded: snapshot.stats.nodesAdded,
			edgesAdded: snapshot.stats.edgesAdded,
		});

		// Complete the linked session
		void this.eventBus.emit("session.complete", { sessionId: snapshot.sessionId });

		// Generate summary
		return generateCanvasSessionSummary(snapshot);
	}

	/** Returns the monitor for the sidebar. */
	getMonitor(): CanvasSessionMonitor {
		return this.monitor;
	}

	dispose(): void {
		this.monitor.dispose();
	}

	private createSessionViaEvent(title: string, durationMinutes: number, goal: string): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			const timeout = setTimeout(() => {
				unsub();
				reject(new Error("Timeout waiting for session.created"));
			}, 5000);

			const unsub = this.eventBus.on("session.created", (e) => {
				clearTimeout(timeout);
				unsub();
				const payload = e.payload as { session: { id: string } };
				resolve(payload.session.id);
			});

			void this.eventBus.emit("session.create", {
				type: "canvas-session" as const,
				title,
				durationMinutes,
				goals: goal ? [goal] : undefined,
			});
		});
	}

	private extractPhases(
		template: CanvasTemplate,
		canvasData: { nodes: Array<{ type: string; id: string } & Record<string, unknown>> },
	): CanvasSessionPhase[] {
		// Extract groups from canvas data as phases
		return canvasData.nodes
			.filter((n) => n.type === "group")
			.map((n) => ({
				id: n.id,
				label: (n as unknown as { label: string }).label || "Phase",
				visited: false,
			}));
	}
}

// ── Summary generation (pure function) ─────────────────────────────

import type { CanvasSessionState } from "./types";

export function generateCanvasSessionSummary(state: CanvasSessionState): string {
	const lines: string[] = [];

	lines.push("---");
	lines.push("type: CanvasSessionSummary");
	lines.push(`session: "${state.sessionId}"`);
	lines.push(`template: "${state.templateName ?? "None"}"`);
	lines.push(`goal: "${escapeFrontmatter(state.goal)}"`);
	lines.push(`canvas: "[[${state.canvasPath.replace(/\.canvas$/, "")}]]"`);
	lines.push("---");
	lines.push("");
	lines.push(`# Canvas session summary`);
	lines.push("");
	lines.push("## Goal");
	lines.push("");
	lines.push(state.goal || "(no goal set)");
	lines.push("");
	lines.push("## Stats");
	lines.push("");
	lines.push(`| Metric | Value |`);
	lines.push(`|--------|-------|`);
	lines.push(`| Nodes added | ${state.stats.nodesAdded} |`);
	lines.push(`| Nodes modified | ${state.stats.nodesModified} |`);
	lines.push(`| Edges added | ${state.stats.edgesAdded} |`);
	lines.push("");

	if (state.phases.length > 0) {
		lines.push("## Phases");
		lines.push("");
		for (const phase of state.phases) {
			const marker = phase.visited ? "x" : " ";
			lines.push(`- [${marker}] ${phase.label}`);
		}
		lines.push("");
	}

	if (state.activities.length > 0) {
		lines.push("## Activity log");
		lines.push("");
		// Show last 20 activities (oldest first for reading order)
		const recent = state.activities.slice(0, 20).reverse();
		for (const a of recent) {
			const time = new Date(a.timestamp);
			const ts = `${time.getHours().toString().padStart(2, "0")}:${time.getMinutes().toString().padStart(2, "0")}`;
			lines.push(`- ${ts} — ${a.detail}`);
		}
		lines.push("");
	}

	return lines.join("\n");
}

function escapeFrontmatter(s: string): string {
	return s.replace(/"/g, '\\"');
}
