/**
 * webapp-provider.ts — Environment provider for web application projects.
 *
 * Adds tools for testing web applications: dev server lifecycle,
 * HTTP assertions, and bundle verification.
 */

import type { EnvironmentProvider } from "../journey-environment.js";
import type { ToolExecutor } from "../journey-tools.js";
import { resolveString } from "../journey-tools.js";

/**
 * Tool: http-check — verify an HTTP endpoint responds.
 * Action: { tool: "http-check", url: "http://localhost:3000", expectedStatus?: 200 }
 */
const toolHttpCheck: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const url = resolveString(action, "url", opts.variables ?? {});
	const expectedStatus = (action.expectedStatus as number) ?? 200;
	if (!url) return { tool: "http-check", success: false, error: "No url specified", durationMs: deps.clock.ms() - start };

	try {
		// Use curl as a portable HTTP client
		const result = deps.exec(`curl -s -o /dev/null -w "%{http_code}" "${url}"`, {
			cwd: opts.cwd,
			timeout: opts.commandTimeout ?? 10000,
			env: opts.env,
		});
		const statusCode = parseInt(result.stdout.trim(), 10);
		const success = statusCode === expectedStatus;
		return {
			tool: "http-check",
			success,
			output: `HTTP ${statusCode}`,
			error: success ? undefined : `Expected ${expectedStatus}, got ${statusCode}`,
			durationMs: deps.clock.ms() - start,
		};
	} catch (e) {
		return { tool: "http-check", success: false, error: String(e), durationMs: deps.clock.ms() - start };
	}
};

/**
 * Tool: dev-server — start/stop a dev server.
 * Action: { tool: "dev-server", op: "start", command: "npm run dev", port: 3000, waitMs?: 3000 }
 * Action: { tool: "dev-server", op: "stop" }
 *
 * Note: start is fire-and-forget (background process via shell).
 * Stop attempts to kill the process on the port.
 */
const toolDevServer: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const op = action.op as string;
	const variables = opts.variables ?? {};

	switch (op) {
		case "start": {
			const cmd = resolveString(action, "command", variables) || "npm run dev";
			const port = action.port as number ?? 3000;
			try {
				// Fire-and-forget: start server in background
				deps.exec(`${cmd} &`, { cwd: opts.cwd, timeout: 2000, env: opts.env });
			} catch {
				// Expected: background process doesn't return cleanly
			}
			deps.log(`[webapp] Dev server starting on port ${port}...`);
			return { tool: "dev-server", success: true, output: `Started on port ${port}`, durationMs: deps.clock.ms() - start };
		}
		case "stop": {
			const port = action.port as number ?? 3000;
			try {
				// Platform-specific kill by port
				deps.exec(`npx kill-port ${port}`, { cwd: opts.cwd, timeout: 5000 });
			} catch {
				// Best effort
			}
			return { tool: "dev-server", success: true, output: `Stopped port ${port}`, durationMs: deps.clock.ms() - start };
		}
		default:
			return { tool: "dev-server", success: false, error: `Unknown dev-server op: ${op}`, durationMs: deps.clock.ms() - start };
	}
};

/**
 * Tool: bundle-check — verify build output exists and check size.
 * Action: { tool: "bundle-check", path: "dist/index.js", maxSizeKb?: 500 }
 */
const toolBundleCheck: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const path = resolveString(action, "path", opts.variables ?? {});
	const maxSizeKb = action.maxSizeKb as number;

	if (!path) return { tool: "bundle-check", success: false, error: "No path specified", durationMs: deps.clock.ms() - start };
	if (!deps.exists(path)) return { tool: "bundle-check", success: false, error: `Bundle not found: ${path}`, durationMs: deps.clock.ms() - start };

	try {
		const content = deps.readFile(path);
		const sizeKb = Math.round(content.length / 1024);
		const underLimit = !maxSizeKb || sizeKb <= maxSizeKb;
		return {
			tool: "bundle-check",
			success: underLimit,
			output: `${sizeKb} KB${maxSizeKb ? ` (limit: ${maxSizeKb} KB)` : ""}`,
			error: underLimit ? undefined : `Bundle too large: ${sizeKb} KB > ${maxSizeKb} KB`,
			durationMs: deps.clock.ms() - start,
		};
	} catch (e) {
		return { tool: "bundle-check", success: false, error: String(e), durationMs: deps.clock.ms() - start };
	}
};

export function createWebappProvider(): EnvironmentProvider {
	return {
		target: "webapp",
		label: "Web Application",
		capabilities: ["command", "filesystem", "http-check", "dev-server", "bundle-check"],
		tools: {
			"http-check": toolHttpCheck,
			"dev-server": toolDevServer,
			"bundle-check": toolBundleCheck,
		},
	};
}
