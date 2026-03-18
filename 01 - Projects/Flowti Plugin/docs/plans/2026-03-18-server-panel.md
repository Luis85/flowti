# Server Management Panel Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Server Management sidepanel with status, live activity feed, stats, and configuration — backed by new CLI server endpoints.

**Architecture:** CLI server gets `/api/server/*` routes. Plugin gets a dedicated ItemView with 5 Lit components (root + 4 sections). Activity feed reuses the existing SSE connection. Stats poll on 5s interval.

**Tech Stack:** CLI: Node.js HTTP server. Plugin: Lit 3.x, Obsidian ItemView, HTTP fetch, SSE.

**Spec:** `01 - Projects/Flowti Plugin/docs/specs/2026-03-18-server-panel-design.md`

---

## Chunk 1: CLI Server Endpoints + Plugin Domain

### Task 1: CLI — server stats and config endpoints

**Files:**
- Modify: `01 - Projects/Flowti CLI/src/domain/serve/static-server.ts`

Add 4 routes after existing project routes:

```typescript
// GET /api/server/stats
if (urlPath === "/api/server/stats" && req.method === "GET") {
	const agentCount = Object.values(ctx.worldState.getState().entities)
		.filter((e) => e.type === "agent").length;
	const startedAt = (ctx as unknown as { startedAt?: number }).startedAt ?? Date.now();
	// Scan storybook PID files
	const varDir = ctx.deps.paths.join(ctx.vaultRoot, ".flowti", "var");
	const sbProcesses: Array<{ project: string; pid: number; url: string }> = [];
	try {
		const files = ctx.deps.disk.readdirSync(varDir, { withFileTypes: true });
		for (const f of files) {
			if (f.name.startsWith("storybook-") && f.name.endsWith(".pid")) {
				try {
					const data = JSON.parse(ctx.deps.disk.readFileSync(
						ctx.deps.paths.join(varDir, f.name), "utf-8"
					)) as { project?: string; pid?: number; url?: string };
					if (data.pid) sbProcesses.push({ project: data.project ?? "", pid: data.pid, url: data.url ?? "" });
				} catch { /* corrupt */ }
			}
		}
	} catch { /* no var dir */ }
	json(200, {
		uptime: Math.floor((Date.now() - startedAt) / 1000),
		connections: ctx.sseClients.size,
		agentCount,
		storybookProcesses: sbProcesses,
	});
	return;
}

// GET /api/server/config
if (urlPath === "/api/server/config" && req.method === "GET") {
	const configPath = ctx.deps.paths.join(ctx.vaultRoot, ".flowti", "var", "server-config.json");
	let config = { port: 3000, logLevel: "info", autoConnect: true };
	if (ctx.deps.disk.existsSync(configPath)) {
		try { config = { ...config, ...JSON.parse(ctx.deps.disk.readFileSync(configPath, "utf-8")) }; }
		catch { /* corrupt */ }
	}
	json(200, config);
	return;
}

// POST /api/server/config
if (urlPath === "/api/server/config" && req.method === "POST") {
	const body = await parseJsonBody(req);
	const configPath = ctx.deps.paths.join(ctx.vaultRoot, ".flowti", "var", "server-config.json");
	const varDir = ctx.deps.paths.join(ctx.vaultRoot, ".flowti", "var");
	if (!ctx.deps.disk.existsSync(varDir)) ctx.deps.disk.mkdirSync(varDir, { recursive: true });
	ctx.deps.disk.writeFileSync(configPath, JSON.stringify(body, null, "\t"), "utf-8");
	json(200, { ok: true });
	return;
}

// POST /api/server/restart
if (urlPath === "/api/server/restart" && req.method === "POST") {
	json(200, { ok: true, message: "Restart signal received" });
	return;
}
```

Also add `startedAt: Date.now()` to the ServerContext when it's created in `dashboard-service.ts`.

- [ ] **Step 1:** Add routes to static-server.ts
- [ ] **Step 2:** Add `startedAt` to ServerContext + dashboard-service.ts
- [ ] **Step 3:** Type check + build CLI
- [ ] **Step 4:** Commit

---

### Task 2: Plugin domain types + HTTP service

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/domain/server/types.ts`
- Create: `01 - Projects/Flowti Plugin/src/infrastructure/server/http-server-service.ts`
- Test: `01 - Projects/Flowti Plugin/tests/domain/server/types.test.ts`
- Test: `01 - Projects/Flowti Plugin/tests/infrastructure/server/http-server-service.test.ts`

Domain types:
```typescript
export interface ServerStats {
	readonly uptime: number;
	readonly connections: number;
	readonly agentCount: number;
	readonly storybookProcesses: Array<{ project: string; pid: number; url: string }>;
}

export interface ServerConfig {
	port: number;
	logLevel: string;
	autoConnect: boolean;
}

export interface ActivityEntry {
	readonly id: string;
	readonly timestamp: string;
	readonly agentName: string;
	readonly actionType: string;
	readonly text: string;
	readonly expanded: boolean;
}
```

HTTP service:
```typescript
export class HttpServerService {
	async getStats(): Promise<ServerStats | null>
	async getConfig(): Promise<ServerConfig | null>
	async updateConfig(config: Partial<ServerConfig>): Promise<{ ok: boolean }>
	async restart(): Promise<{ ok: boolean }>
}
```

- [ ] TDD: write tests, implement, verify, commit

---

## Chunk 2: Lit Components (4 sections + root)

### Task 3: `flowti-server-status` component

Status dot, PID, port, uptime, Start/Stop/Restart/Visit buttons. Properties: `running`, `pid`, `port`, `uptime`, `url`. Events: `server-start`, `server-stop`, `server-restart`, `server-visit`.

- [ ] TDD cycle, commit

### Task 4: `flowti-activity-feed` component

Compact log list. Properties: `entries` (ActivityEntry[]), `paused`. Auto-scrolls unless paused. Click entry to toggle expanded. Events: `feed-pause`, `feed-resume`, `feed-clear`.

- [ ] TDD cycle, commit

### Task 5: `flowti-server-stats` component

4 stat cards. Properties: `stats` (ServerStats). Simple display-only.

- [ ] TDD cycle, commit

### Task 6: `flowti-server-config` component

Form with port input, log level dropdown, auto-connect toggle, Apply & Restart button. Properties: `config` (ServerConfig). Event: `config-apply` with updated values. Tracks dirty state.

- [ ] TDD cycle, commit

### Task 7: `flowti-server-panel` root component

Composes 4 children in collapsible sections. Properties mirror all child props. Side-effect imports all children.

- [ ] TDD cycle, commit

---

## Chunk 3: Handler, View, Bootstrap

### Task 8: Server handler

Mounts `<flowti-server-panel>`, bridges events to HTTP service. SSE listener populates activity feed. 5s poll for stats. Loads config on open.

- [ ] TDD cycle, commit

### Task 9: View + Bootstrap + main.ts wiring

- `src/ui/server/server-panel-view.ts` — ItemView shell
- `src/ui/server/types.ts` — VIEW_TYPE_SERVER_PANEL
- `src/bootstrap/server-setup.ts` — registers view + command + ribbon
- Wire into main.ts

- [ ] Create files, type check, build, commit

### Task 10: Quality gate

- [ ] Run all server tests
- [ ] Type check
- [ ] Build both CLI + Plugin
- [ ] Fix issues, commit

---

## Summary

| Task | What | Project |
|------|------|---------|
| 1 | Server stats/config CLI endpoints | CLI |
| 2 | Domain types + HTTP service | Plugin |
| 3 | Server status component | Plugin |
| 4 | Activity feed component | Plugin |
| 5 | Server stats component | Plugin |
| 6 | Server config component | Plugin |
| 7 | Root panel component | Plugin |
| 8 | Server handler | Plugin |
| 9 | View + Bootstrap + wiring | Plugin |
| 10 | Quality gate | Both |
