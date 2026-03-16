import type { WorldState, WorldEntity } from "./types.js";

interface ApiResult {
	readonly ok: boolean;
	readonly error?: string;
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

export async function sendMessage(baseUrl: string, agentName: string, message: string): Promise<ApiResult> {
	try {
		const res = await fetch(`${baseUrl}/api/agent/send`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ agentName, message }),
		});
		return await res.json() as ApiResult;
	} catch (err: unknown) {
		return { ok: false, error: err instanceof Error ? err.message : String(err) };
	}
}

export async function assignTask(baseUrl: string, agentName: string, task: string): Promise<ApiResult> {
	try {
		const res = await fetch(`${baseUrl}/api/agent/task`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ agentName, task }),
		});
		return await res.json() as ApiResult;
	} catch (err: unknown) {
		return { ok: false, error: err instanceof Error ? err.message : String(err) };
	}
}

export async function grantPermission(
	baseUrl: string,
	agentName: string,
	tool: string,
	decision: string,
): Promise<ApiResult> {
	try {
		const res = await fetch(`${baseUrl}/api/agent/permission`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ agentName, tool, decision }),
		});
		return await res.json() as ApiResult;
	} catch (err: unknown) {
		return { ok: false, error: err instanceof Error ? err.message : String(err) };
	}
}
