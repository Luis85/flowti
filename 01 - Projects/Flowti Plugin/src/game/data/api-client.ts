import type { WorldState, WorldEntity } from "./types.js";

export interface ApiResult {
	readonly ok: boolean;
	readonly error?: string;
	readonly response?: string;
	readonly type?: string;
}

export async function fetchWorldState(baseUrl: string): Promise<WorldState | null> {
	try {
		const res = await fetch(`${baseUrl}/api/world-state`);
		if (!res.ok) return null;
		return await res.json() as WorldState;
	} catch {
		return null;
	}
}

export async function fetchAgent(baseUrl: string, name: string): Promise<WorldEntity | null> {
	try {
		const res = await fetch(`${baseUrl}/api/agent/${name}`);
		if (!res.ok) return null;
		return await res.json() as WorldEntity;
	} catch {
		return null;
	}
}

export async function sendMessage(
	baseUrl: string,
	agentName: string,
	message: string,
	context?: string,
): Promise<ApiResult> {
	try {
		console.log(`[api] sendMessage → ${agentName}: "${message.slice(0, 60)}"${context ? " [+context]" : ""}`);
		const res = await fetch(`${baseUrl}/api/agent/send`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ agentName, message, context }),
		});
		const result = await res.json() as ApiResult;
		console.log(`[api] sendMessage ← ${agentName}: ${result.ok ? "ok" : result.error}`);
		return result;
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		console.warn(`[api] sendMessage failed for ${agentName}:`, msg);
		return { ok: false, error: `Cannot reach server: ${msg}` };
	}
}

export async function assignTask(baseUrl: string, agentName: string, task: string): Promise<ApiResult> {
	try {
		console.log(`[api] assignTask → ${agentName}: "${task}"`);
		const res = await fetch(`${baseUrl}/api/agent/task`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ agentName, task }),
		});
		const result = await res.json() as ApiResult;
		console.log(`[api] assignTask ← ${agentName}: ${result.ok ? "ok" : result.error}`);
		return result;
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		console.warn(`[api] assignTask failed for ${agentName}:`, msg);
		return { ok: false, error: `Cannot reach server: ${msg}` };
	}
}

/** Pre-warm the LLM worker for an agent — spawns worker and caches conversation history. */
export async function wakeAgent(baseUrl: string, agentName: string): Promise<void> {
	try {
		console.log(`[api] wakeAgent → ${agentName}`);
		await fetch(`${baseUrl}/api/agent/wake`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ agentName }),
		});
		console.log(`[api] wakeAgent ← ${agentName}: ok`);
	} catch (err) {
		console.warn(`[api] wakeAgent failed for ${agentName}:`, err instanceof Error ? err.message : err);
	}
}

export async function grantPermission(
	baseUrl: string,
	agentName: string,
	tool: string,
	decision: string,
): Promise<ApiResult> {
	try {
		console.log(`[api] grantPermission → ${agentName}: ${tool}=${decision}`);
		const res = await fetch(`${baseUrl}/api/agent/permission`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ agentName, tool, decision }),
		});
		const result = await res.json() as ApiResult;
		console.log(`[api] grantPermission ← ${agentName}: ${result.ok ? "ok" : result.error}`);
		return result;
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		console.warn(`[api] grantPermission failed for ${agentName}:`, msg);
		return { ok: false, error: `Cannot reach server: ${msg}` };
	}
}
