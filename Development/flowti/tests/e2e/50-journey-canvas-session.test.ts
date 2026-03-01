/**
 * E2E Chapter 5: Canvas Session Journey
 *
 * Validates the complete canvas session lifecycle: ribbon click →
 * template picker → goal input → canvas created → session running →
 * pause → resume → complete → closure overlay → skip → completed.
 *
 * Depends on Chapter 2 (Installer) having completed — the installed
 * vault state (folders, seed content, user) is required.
 *
 * Run with: npm run test:e2e:canvas-session
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as path from "node:path";
import { ObsidianCli } from "../../src/infrastructure/cli/ObsidianCli";
import {
	createFixture,
	ensurePluginEnabled,
	ensureInstalled,
	PLUGIN_ID,
	getTraceLength,
	assertEventEmitted,
	startEventTrace,
} from "./helpers/fixtures";
import { JourneyRunner } from "./helpers/journey";
import { highlightElement, highlightButton } from "./helpers/highlight";
import type { TestFixture } from "./helpers/fixtures";

const JOURNEY_NAME = "Canvas Session";

describe("Chapter 5: Canvas Session", () => {
	let fixture: TestFixture;
	let runner: JourneyRunner;
	let cli: ObsidianCli;
	let resultsPath: string;

	beforeAll(async () => {
		fixture = createFixture(process.env.OBSIDIAN_VAULT);
		cli = fixture.cli;

		await ensurePluginEnabled(cli);
		ensureInstalled(cli, fixture.vault.vaultDir);
		startEventTrace(cli);

		const journeyDir = path.join(fixture.vault.vaultDir, "03 - Resources", "Tested Journeys", JOURNEY_NAME);
		const screenshotDir = path.join(journeyDir, "screenshots");
		resultsPath = path.join(journeyDir, `${JOURNEY_NAME}-results.json`);

		runner = new JourneyRunner(cli, {
			journeyName: JOURNEY_NAME,
			screenshotDir,
			settleMs: 1000,
			testSource: "tests/e2e/50-journey-canvas-session.test.ts",
		});

		runner.notifySuiteEnter();
	});

	afterAll(() => {
		if (runner) {
			runner.writeResults(resultsPath);
			runner.notifySuiteExit();
		}
		fixture?.cleanup();
	});

	it("5.1 — Start canvas session via command", async () => {
		const before = getTraceLength(cli);

		const result = await runner.runStep(
			{
				id: "01-start-canvas-session",
				title: "Start canvas session",
				guideSection: 1,
				description: "Triggers the canvas session flow via the command palette. The CanvasTemplatePickerModal should appear.",
				expectedInput: "Plugin enabled, no active canvas session",
				expectedOutput: "CanvasTemplatePickerModal is visible with template cards",
				uiContext: {
					components: ["CanvasTemplatePickerModal"],
				},
				events: ["ui.startCanvasSession"],
				commands: ["flowti:start-canvas-session"],
				interactions: ["command: Start canvas session"],
			},
			async () => {
				cli.executeCommand("flowti-ibde:flowti:start-canvas-session");
				// Wait for modal to appear
				await new Promise((resolve) => setTimeout(resolve, 500));

				// Verify modal is visible with template cards
				const check = cli.eval(
					"!!document.querySelector('.modal-container .ft-canvas-template-card')",
				);
				if (!check.success || check.value !== "true") {
					throw new Error("CanvasTemplatePickerModal not visible or no template cards found");
				}
				highlightElement(cli, ".modal-container .ft-canvas-template-card");
			},
			{ capture: "afterAction" },
		);

		expect(result.status).toBe("pass");
	});

	it("5.2 — Select template", async () => {
		const result = await runner.runStep(
			{
				id: "02-select-template",
				title: "Select a canvas template",
				guideSection: 2,
				description: "Clicks the first template card in the CanvasTemplatePickerModal. The InputModal for the session goal should appear.",
				expectedInput: "CanvasTemplatePickerModal is visible",
				expectedOutput: "InputModal appears with goal input field",
				uiContext: {
					components: ["CanvasTemplatePickerModal", "InputModal"],
				},
				interactions: ["click: Template card"],
			},
			async () => {
				// Click the first template card
				cli.eval(
					"document.querySelector('.modal-container .ft-canvas-template-card')?.click()",
				);
				// Wait for the template picker to close and InputModal to open
				await new Promise((resolve) => setTimeout(resolve, 500));

				// Verify InputModal appeared (has an input inside .setting-item)
				const check = cli.eval(
					"!!document.querySelector('.modal-container .setting-item input')",
				);
				if (!check.success || check.value !== "true") {
					throw new Error("InputModal not visible or no goal input field found");
				}
				highlightElement(cli, ".modal-container .setting-item input");
			},
			{ capture: "afterAction" },
		);

		expect(result.status).toBe("pass");
	});

	it("5.3 — Enter goal and start session", async () => {
		const before = getTraceLength(cli);

		const result = await runner.runStep(
			{
				id: "03-enter-goal",
				title: "Enter goal and start session",
				guideSection: 3,
				description: "Types a session goal into the InputModal and clicks Start. The canvas file should be created and a session started.",
				expectedInput: "InputModal with goal input is visible",
				expectedOutput: "Session started, canvas file created, modal closed",
				uiContext: {
					components: ["InputModal", "CanvasSessionService"],
				},
				events: ["session.create", "session.created", "canvas.session.started"],
				interactions: ["input: Session goal", "click: Start button"],
			},
			async () => {
				// Set goal text using execCommand('insertText') — this triggers
				// all native input events that Obsidian's TextComponent listens to,
				// ensuring the onChange callback fires and captures the value.
				cli.eval([
					"(() => {",
					"  const input = document.querySelector('.modal-container .setting-item input');",
					"  if (!input) return;",
					"  input.focus();",
					"  input.value = '';",
					"  document.execCommand('insertText', false, 'E2E canvas session test goal');",
					"})()",
				].join(" "));

				highlightButton(cli, ".modal-container .mod-cta");
				await new Promise((resolve) => setTimeout(resolve, 300));

				// Click Start button
				cli.eval(
					"document.querySelector('.modal-container .mod-cta')?.click()",
				);

				// Wait for session creation and canvas file generation
				await new Promise((resolve) => setTimeout(resolve, 1500));

				assertEventEmitted(cli, before, "canvas.session.started");
			},
		);

		expect(result.status).toBe("pass");
	});

	it("5.4 — Verify canvas file opened", async () => {
		const result = await runner.runStep(
			{
				id: "04-canvas-opened",
				title: "Verify canvas file opened",
				guideSection: 4,
				description: "Checks that the canvas file was created and is open in the workspace.",
				expectedInput: "Canvas session started, canvas file created",
				expectedOutput: "A canvas leaf is active in the workspace",
				uiContext: {
					components: ["Canvas"],
				},
			},
			() => {
				const check = cli.eval(
					"app.workspace.getLeavesOfType('canvas').length",
				);
				if (!check.success || Number(check.value) === 0) {
					throw new Error("No canvas leaf found in workspace");
				}
			},
		);

		expect(result.status).toBe("pass");
	});

	it("5.5 — Verify session created with correct type", async () => {
		const result = await runner.runStep(
			{
				id: "05-session-created",
				title: "Verify canvas session state",
				guideSection: 5,
				description: "Checks the plugin's SessionService to confirm an active canvas session exists with the correct type.",
				expectedInput: "Canvas session started",
				expectedOutput: "Active session has type 'canvas-session' and status 'running'",
				uiContext: {
					components: ["SessionService"],
				},
			},
			() => {
				const check = cli.eval([
					`(() => {`,
					`  const p = app.plugins.plugins['${PLUGIN_ID}'];`,
					`  if (!p || !p.sessionService) return 'no-plugin';`,
					`  const s = p.sessionService.getActiveSession();`,
					`  if (!s) return 'no-session';`,
					`  return JSON.stringify({ type: s.type, status: s.status });`,
					`})()`,
				].join(" "));

				if (!check.success) throw new Error("Failed to query session state");
				if (check.value === "no-plugin") throw new Error("Plugin not loaded");
				if (check.value === "no-session") throw new Error("No active session found");

				const session = JSON.parse(check.value) as { type: string; status: string };
				if (session.type !== "canvas-session") {
					throw new Error(`Expected type 'canvas-session', got '${session.type}'`);
				}
				if (session.status !== "running") {
					throw new Error(`Expected status 'running', got '${session.status}'`);
				}
			},
		);

		expect(result.status).toBe("pass");
	});

	it("5.6 — Pause session", async () => {
		const before = getTraceLength(cli);

		const result = await runner.runStep(
			{
				id: "06-pause-session",
				title: "Pause the canvas session",
				guideSection: 6,
				description: "Emits session.pause via the EventBus to pause the active canvas session.",
				expectedInput: "Active canvas session in 'running' status",
				expectedOutput: "Session status changes to 'paused'",
				uiContext: {
					components: ["SessionService", "SessionWorkspaceView"],
				},
				events: ["session.pause", "session.paused"],
				interactions: ["event: Pause session"],
			},
			async () => {
				// Get active session ID
				const idCheck = cli.eval([
					`(() => {`,
					`  const p = app.plugins.plugins['${PLUGIN_ID}'];`,
					`  const s = p?.sessionService?.getActiveSession();`,
					`  return s ? s.id : '';`,
					`})()`,
				].join(" "));

				if (!idCheck.success || !idCheck.value) {
					throw new Error("No active session to pause");
				}

				cli.eval([
					`(() => {`,
					`  const p = app.plugins.plugins['${PLUGIN_ID}'];`,
					`  p.eventBus.emit('session.pause', { sessionId: '${idCheck.value}' });`,
					`})()`,
				].join(" "));

				await new Promise((resolve) => setTimeout(resolve, 500));
				assertEventEmitted(cli, before, "session.paused");

				// Verify status
				const status = cli.eval([
					`(() => {`,
					`  const p = app.plugins.plugins['${PLUGIN_ID}'];`,
					`  const sessions = p.sessionService.state?.sessions ?? [];`,
					`  const s = sessions.find(s => s.id === '${idCheck.value}');`,
					`  return s ? s.status : 'not-found';`,
					`})()`,
				].join(" "));

				if (!status.success || status.value !== "paused") {
					throw new Error(`Expected 'paused', got '${status.value}'`);
				}
			},
		);

		expect(result.status).toBe("pass");
	});

	it("5.7 — Resume session", async () => {
		const before = getTraceLength(cli);

		const result = await runner.runStep(
			{
				id: "07-resume-session",
				title: "Resume the canvas session",
				guideSection: 7,
				description: "Emits session.resume via the EventBus to resume the paused canvas session. The canvas file should be re-focused.",
				expectedInput: "Canvas session in 'paused' status",
				expectedOutput: "Session status changes to 'running'",
				uiContext: {
					components: ["SessionService", "SessionWorkspaceView"],
				},
				events: ["session.resume", "session.resumed"],
				interactions: ["event: Resume session"],
			},
			async () => {
				// Get session ID from sessions array (not activeSessionId since it's paused)
				const idCheck = cli.eval([
					`(() => {`,
					`  const p = app.plugins.plugins['${PLUGIN_ID}'];`,
					`  const sessions = p.sessionService.state?.sessions ?? [];`,
					`  const s = sessions.find(s => s.type === 'canvas-session' && s.status === 'paused');`,
					`  return s ? s.id : '';`,
					`})()`,
				].join(" "));

				if (!idCheck.success || !idCheck.value) {
					throw new Error("No paused canvas session found");
				}

				cli.eval([
					`(() => {`,
					`  const p = app.plugins.plugins['${PLUGIN_ID}'];`,
					`  p.eventBus.emit('session.resume', { sessionId: '${idCheck.value}' });`,
					`})()`,
				].join(" "));

				await new Promise((resolve) => setTimeout(resolve, 500));
				assertEventEmitted(cli, before, "session.resumed");

				// Verify status
				const status = cli.eval([
					`(() => {`,
					`  const p = app.plugins.plugins['${PLUGIN_ID}'];`,
					`  const s = p.sessionService.getActiveSession();`,
					`  return s ? s.status : 'not-found';`,
					`})()`,
				].join(" "));

				if (!status.success || status.value !== "running") {
					throw new Error(`Expected 'running', got '${status.value}'`);
				}
			},
		);

		expect(result.status).toBe("pass");
	});

	it("5.8 — Complete session (enters reviewing)", async () => {
		const before = getTraceLength(cli);

		const result = await runner.runStep(
			{
				id: "08-complete-session",
				title: "Complete the canvas session",
				guideSection: 8,
				description: "Emits session.complete to finish the session. The session enters 'reviewing' status and the closure overlay appears in the sidebar.",
				expectedInput: "Canvas session in 'running' status",
				expectedOutput: "Session status is 'reviewing', closure overlay visible in sidebar",
				uiContext: {
					components: ["SessionService", "SessionWorkspaceView", "SessionClosureOverlay"],
				},
				events: ["session.complete", "session.closure.started"],
				interactions: ["event: Complete session"],
			},
			async () => {
				const idCheck = cli.eval([
					`(() => {`,
					`  const p = app.plugins.plugins['${PLUGIN_ID}'];`,
					`  const s = p.sessionService.getActiveSession();`,
					`  return s ? s.id : '';`,
					`})()`,
				].join(" "));

				if (!idCheck.success || !idCheck.value) {
					throw new Error("No active session to complete");
				}

				cli.eval([
					`(() => {`,
					`  const p = app.plugins.plugins['${PLUGIN_ID}'];`,
					`  p.eventBus.emit('session.complete', { sessionId: '${idCheck.value}' });`,
					`})()`,
				].join(" "));

				// Wait for closure overlay to render in sidebar
				await new Promise((resolve) => setTimeout(resolve, 1500));
				assertEventEmitted(cli, before, "session.closure.started");

				// Verify closure overlay is visible
				const overlay = cli.eval(
					"!!document.querySelector('.ft-closure-overlay')",
				);
				if (!overlay.success || overlay.value !== "true") {
					throw new Error("Closure overlay not visible in sidebar");
				}
				highlightButton(cli, ".ft-closure-skip");
			},
		);

		expect(result.status).toBe("pass");
	});

	it("5.9 — Skip closure and complete", async () => {
		const result = await runner.runStep(
			{
				id: "09-skip-closure",
				title: "Skip closure ritual",
				guideSection: 9,
				description: "Clicks the Skip button on the closure overlay to bypass the ritual. The session transitions from 'reviewing' to 'completed'.",
				expectedInput: "Session in 'reviewing' status, closure overlay visible",
				expectedOutput: "Session status is 'completed'",
				uiContext: {
					components: ["SessionClosureOverlay", "SessionWorkspaceView"],
				},
				events: ["session.completed"],
				interactions: ["click: Skip closure"],
			},
			async () => {
				// Click skip button
				cli.eval(
					"document.querySelector('.ft-closure-skip')?.click()",
				);

				await new Promise((resolve) => setTimeout(resolve, 1000));

				// Verify session is completed — check all sessions for the canvas-session type
				const status = cli.eval([
					`(() => {`,
					`  const p = app.plugins.plugins['${PLUGIN_ID}'];`,
					`  const sessions = p.sessionService.state?.sessions ?? [];`,
					`  const s = sessions.find(s => s.type === 'canvas-session');`,
					`  return s ? s.status : 'not-found';`,
					`})()`,
				].join(" "));

				if (!status.success || status.value !== "completed") {
					throw new Error(`Expected 'completed', got '${status.value}'`);
				}
			},
		);

		expect(result.status).toBe("pass");
	});
});
