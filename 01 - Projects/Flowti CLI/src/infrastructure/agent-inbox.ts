import type { ProcessRunnerDeps } from "./agent-process-runner.js";
import { parseAgentResponse } from "../domain/agents/agent-conversation.js";

export function writeInboxNote(
	deps: ProcessRunnerDeps, vaultRoot: string, agentName: string,
	persona: string | undefined, task: string | undefined,
	responseText: string, thinkingText: string,
): void {
	const parsed = parseAgentResponse(responseText);
	const inboxDir = deps.paths.join(vaultRoot, "00 - Connectivity", "inbox");
	if (!deps.disk.existsSync(inboxDir)) deps.disk.mkdirSync(inboxDir, { recursive: true });
	const who = persona ?? agentName;
	const slug = `${who.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${deps.clock.ms()}`;
	const lines = [
		"---", `type: agent-note`, `from: ${agentName}`, `persona: ${who}`,
		`date: ${deps.clock.iso()}`,
	];
	if (task) lines.push(`task: ${task}`);
	lines.push(`status: ${parsed.status}`, "---", "", `# Note from ${who}`, "");
	if (task) lines.push(`**Task**: ${task}`, "");
	lines.push(parsed.message);
	if (thinkingText) {
		lines.push("", "---", "", "## Thinking", "", `> ${thinkingText.slice(0, 500)}${thinkingText.length > 500 ? "..." : ""}`);
	}
	lines.push("");
	deps.disk.writeFileSync(deps.paths.join(inboxDir, `${slug}.md`), lines.join("\n"), "utf-8");
}

export function writeSystemInboxNote(
	deps: ProcessRunnerDeps, vaultRoot: string, agentName: string, message: string,
): void {
	const inboxDir = deps.paths.join(vaultRoot, "00 - Connectivity", "inbox");
	if (!deps.disk.existsSync(inboxDir)) deps.disk.mkdirSync(inboxDir, { recursive: true });
	const slug = `system-${agentName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${deps.clock.ms()}`;
	const lines = [
		"---", `type: agent-note`, `from: system`, `persona: ${agentName}`,
		`date: ${deps.clock.iso()}`, `status: message`, "---", "",
		`# System Note — ${agentName}`, "", message, "",
	];
	deps.disk.writeFileSync(deps.paths.join(inboxDir, `${slug}.md`), lines.join("\n"), "utf-8");
}
