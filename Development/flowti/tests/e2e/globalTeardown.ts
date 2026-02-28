/**
 * E2E Global Teardown — runs once after all E2E test files complete.
 *
 * Resets the plugin to a clean baseline:
 *   1. Collects the EventBus event trace and writes event-trace.md
 *   2. Resets the installer state (so isInstalled() returns false next run)
 *   3. Closes test-created views in the center pane (sidebars stay as-is)
 *   4. Disables the Flowti plugin (returns to vanilla vault state)
 *
 * Vault content (screenshots, journey results, installer folders) is NOT
 * deleted here — the report generator runs AFTER teardown and needs the
 * screenshots. Content cleanup happens in globalSetup at the start of
 * the next run via vault.reset().
 *
 * The E2E report is opened separately by the run-e2e wrapper script
 * after report generation.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { ObsidianCli } from "../../src/infrastructure/cli/ObsidianCli";
import { TestVault } from "./helpers/testVault";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.resolve(__dirname, "..", "..");
const PLUGIN_ID = "flowti-ibde";

/** Settle time (ms) between closing views and disabling the plugin. */
const VIEW_CLOSE_SETTLE_MS = 2000;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

interface TraceEntry {
	type: string;
	ts: number;
	payload: string;
}

interface PerfPayload {
	durationMs?: number;
	service?: string;
	serviceCount?: number;
	key?: string;
	sizeBytes?: number;
	queryId?: string;
	sourceRows?: number;
	resultRows?: number;
	eventType?: string;
	handlerCount?: number;
	metric?: string;
	value?: number;
	threshold?: number;
}

/**
 * Builds the Performance Summary section from perf.* trace entries.
 * Groups metrics by type (startup, storage, query, dispatch, alert)
 * and computes aggregate statistics.
 */
function buildPerfSummary(perfEntries: TraceEntry[]): string[] {
	if (perfEntries.length === 0) return [];

	const startupServices: { service: string; durationMs: number }[] = [];
	let startupTotal: { durationMs: number; serviceCount: number } | null = null;
	const storageOps: { key: string; op: string; durationMs: number; sizeBytes: number }[] = [];
	const queries: { queryId: string; durationMs: number; sourceRows: number; resultRows: number }[] = [];
	const dispatches: { eventType: string; handlerCount: number; durationMs: number }[] = [];
	const alerts: { metric: string; value: number; threshold: number }[] = [];

	for (const e of perfEntries) {
		let p: PerfPayload;
		try {
			p = JSON.parse(e.payload) as PerfPayload;
		} catch {
			continue;
		}

		switch (e.type) {
			case "perf.startup.service":
				if (p.service && p.durationMs !== undefined) {
					startupServices.push({ service: p.service, durationMs: p.durationMs });
				}
				break;
			case "perf.startup.total":
				if (p.durationMs !== undefined) {
					startupTotal = { durationMs: p.durationMs, serviceCount: p.serviceCount ?? 0 };
				}
				break;
			case "perf.storage.loaded":
			case "perf.storage.saved":
				if (p.key && p.durationMs !== undefined) {
					storageOps.push({
						key: p.key,
						op: e.type === "perf.storage.loaded" ? "load" : "save",
						durationMs: p.durationMs,
						sizeBytes: p.sizeBytes ?? 0,
					});
				}
				break;
			case "perf.query.executed":
				if (p.queryId && p.durationMs !== undefined) {
					queries.push({
						queryId: p.queryId,
						durationMs: p.durationMs,
						sourceRows: p.sourceRows ?? 0,
						resultRows: p.resultRows ?? 0,
					});
				}
				break;
			case "perf.event.dispatched":
				if (p.eventType && p.durationMs !== undefined) {
					dispatches.push({
						eventType: p.eventType,
						handlerCount: p.handlerCount ?? 0,
						durationMs: p.durationMs,
					});
				}
				break;
			case "perf.alert":
				if (p.metric) {
					alerts.push({
						metric: p.metric,
						value: p.value ?? 0,
						threshold: p.threshold ?? 0,
					});
				}
				break;
		}
	}

	const lines: string[] = [
		"## Performance Summary",
		"",
		`> [!info] Metrics`,
		`> Perf events: ${perfEntries.length} | Startup services: ${startupServices.length} | Storage ops: ${storageOps.length} | Queries: ${queries.length} | Dispatches: ${dispatches.length} | Alerts: ${alerts.length}`,
		"",
	];

	// Startup
	if (startupTotal || startupServices.length > 0) {
		lines.push("### Startup");
		lines.push("");
		if (startupTotal) {
			lines.push(`Total startup: **${startupTotal.durationMs}ms** (${startupTotal.serviceCount} services)`);
			lines.push("");
		}
		if (startupServices.length > 0) {
			const sorted = [...startupServices].sort((a, b) => b.durationMs - a.durationMs);
			lines.push("| Service | Duration |");
			lines.push("|---|---|");
			for (const s of sorted) {
				lines.push(`| ${s.service} | ${s.durationMs}ms |`);
			}
			lines.push("");
		}
	}

	// Storage
	if (storageOps.length > 0) {
		lines.push("### Storage Operations");
		lines.push("");
		const totalLoadMs = storageOps.filter(o => o.op === "load").reduce((s, o) => s + o.durationMs, 0);
		const totalSaveMs = storageOps.filter(o => o.op === "save").reduce((s, o) => s + o.durationMs, 0);
		lines.push(`Load: ${storageOps.filter(o => o.op === "load").length} ops (${totalLoadMs}ms) | Save: ${storageOps.filter(o => o.op === "save").length} ops (${totalSaveMs}ms)`);
		lines.push("");
		lines.push("| Key | Op | Duration | Size |");
		lines.push("|---|---|---|---|");
		const sorted = [...storageOps].sort((a, b) => b.durationMs - a.durationMs);
		for (const o of sorted) {
			const size = o.sizeBytes > 1024
				? `${(o.sizeBytes / 1024).toFixed(1)}KB`
				: `${o.sizeBytes}B`;
			lines.push(`| ${o.key} | ${o.op} | ${o.durationMs}ms | ${size} |`);
		}
		lines.push("");
	}

	// Queries
	if (queries.length > 0) {
		lines.push("### Query Execution");
		lines.push("");
		const totalMs = queries.reduce((s, q) => s + q.durationMs, 0);
		const avgMs = (totalMs / queries.length).toFixed(1);
		const maxQ = queries.reduce((m, q) => q.durationMs > m.durationMs ? q : m, queries[0]);
		lines.push(`Queries: ${queries.length} | Total: ${totalMs}ms | Avg: ${avgMs}ms | Slowest: ${maxQ.queryId} (${maxQ.durationMs}ms)`);
		lines.push("");
		lines.push("| Query | Duration | Source Rows | Result Rows |");
		lines.push("|---|---|---|---|");
		const sorted = [...queries].sort((a, b) => b.durationMs - a.durationMs);
		for (const q of sorted) {
			lines.push(`| ${q.queryId} | ${q.durationMs}ms | ${q.sourceRows} | ${q.resultRows} |`);
		}
		lines.push("");
	}

	// Event Dispatch
	if (dispatches.length > 0) {
		lines.push("### Event Dispatch Timing");
		lines.push("");
		const totalMs = dispatches.reduce((s, d) => s + d.durationMs, 0);
		const avgMs = (totalMs / dispatches.length).toFixed(2);
		// Aggregate by eventType
		const byType = new Map<string, { count: number; totalMs: number; maxMs: number }>();
		for (const d of dispatches) {
			const existing = byType.get(d.eventType) ?? { count: 0, totalMs: 0, maxMs: 0 };
			existing.count++;
			existing.totalMs += d.durationMs;
			existing.maxMs = Math.max(existing.maxMs, d.durationMs);
			byType.set(d.eventType, existing);
		}
		const sortedByTotal = [...byType.entries()].sort((a, b) => b[1].totalMs - a[1].totalMs);
		lines.push(`Dispatches: ${dispatches.length} | Total: ${totalMs.toFixed(1)}ms | Avg: ${avgMs}ms`);
		lines.push("");
		lines.push("| Event | Dispatches | Total | Avg | Max |");
		lines.push("|---|---|---|---|---|");
		for (const [type, stats] of sortedByTotal) {
			const avg = (stats.totalMs / stats.count).toFixed(2);
			lines.push(`| \`${type}\` | ${stats.count} | ${stats.totalMs.toFixed(1)}ms | ${avg}ms | ${stats.maxMs.toFixed(1)}ms |`);
		}
		lines.push("");
	}

	// Alerts
	if (alerts.length > 0) {
		lines.push("### Performance Alerts");
		lines.push("");
		lines.push("> [!warning] Threshold Violations");
		for (const a of alerts) {
			lines.push(`> - **${a.metric}**: ${a.value}ms (threshold: ${a.threshold}ms)`);
		}
		lines.push("");
	}

	return lines;
}

/**
 * Reads the collected event trace from the plugin instance, unsubscribes
 * the wildcard listener, and writes event-trace.md to both vaults.
 */
function collectEventTrace(cli: ObsidianCli, vault: TestVault): void {
	// Read the trace array from the plugin
	const result = cli.eval(
		`JSON.stringify(app.plugins.plugins['${PLUGIN_ID}']?._e2eEventTrace ?? [])`,
	);

	// Read the perf trace array
	const perfResult = cli.eval(
		`JSON.stringify(app.plugins.plugins['${PLUGIN_ID}']?._e2ePerfTrace ?? [])`,
	);

	let entries: TraceEntry[] = [];
	let perfEntries: TraceEntry[] = [];

	if (result.success && result.value && result.value !== "[]") {
		try {
			entries = JSON.parse(result.value) as TraceEntry[];
		} catch {
			console.warn("[e2e] Failed to parse event trace JSON.");
		}
	}

	if (perfResult.success && perfResult.value && perfResult.value !== "[]") {
		try {
			perfEntries = JSON.parse(perfResult.value) as TraceEntry[];
		} catch {
			console.warn("[e2e] Failed to parse perf trace JSON.");
		}
	}

	if (entries.length === 0 && perfEntries.length === 0) {
		console.log("[e2e] No event trace captured.");
		return;
	}

	// Unsubscribe the wildcard listener
	cli.eval([
		`const p = app.plugins.plugins['${PLUGIN_ID}'];`,
		"if (p && p._e2eTraceUnsub) { p._e2eTraceUnsub(); delete p._e2eTraceUnsub; }",
		"delete p._e2eEventTrace;",
		"delete p._e2ePerfTrace;",
	].join(" "));

	// Build the markdown report
	const now = new Date();
	const allEntries = [...entries, ...perfEntries];
	const firstTs = allEntries.length > 0 ? Math.min(...allEntries.map(e => e.ts)) : 0;
	const lastTs = allEntries.length > 0 ? Math.max(...allEntries.map(e => e.ts)) : 0;
	const durationMs = lastTs - firstTs;

	// Count events by type (domain events only — perf has its own section)
	const typeCounts = new Map<string, number>();
	for (const e of entries) {
		typeCounts.set(e.type, (typeCounts.get(e.type) ?? 0) + 1);
	}
	const sortedTypes = [...typeCounts.entries()].sort((a, b) => b[1] - a[1]);

	const lines: string[] = [
		"---",
		"type: EventTrace",
		`date: ${now.toISOString()}`,
		`total_events: ${entries.length}`,
		`perf_events: ${perfEntries.length}`,
		`unique_types: ${typeCounts.size}`,
		`duration_ms: ${durationMs}`,
		'e2e_report: "[[E2E Report]]"',
		"tags:",
		"  - report",
		"  - e2e",
		"  - trace",
		"---",
		"",
		"# Event Trace",
		"",
		"> [!info] Summary",
		`> Events: ${entries.length} | Perf: ${perfEntries.length} | Types: ${typeCounts.size} | Duration: ${(durationMs / 1000).toFixed(1)}s`,
		"",
	];

	// Performance Summary (before frequency/timeline for visibility)
	lines.push(...buildPerfSummary(perfEntries));

	lines.push(
		"## Event Frequency",
		"",
		"| Event | Count |",
		"|---|---|",
		...sortedTypes.map(([type, count]) => `| \`${type}\` | ${count} |`),
		"",
		"## Timeline",
		"",
		"| # | Time | Event | Payload |",
		"|---|---|---|---|",
	);

	for (let i = 0; i < entries.length; i++) {
		const e = entries[i];
		const relMs = e.ts - firstTs;
		const relSec = (relMs / 1000).toFixed(2);
		// Escape pipe characters in payload for table cells
		const payload = e.payload.replace(/\|/g, "\\|").replace(/\n/g, " ");
		lines.push(`| ${i + 1} | ${relSec}s | \`${e.type}\` | ${payload} |`);
	}

	lines.push("");
	const content = lines.join("\n");

	const safeTimestamp = now.toISOString().replace(/:/g, "-");

	// Write to test vault — stable name (overwrites previous run)
	const testVaultTracesDir = path.join(vault.vaultDir, "Traces");
	fs.mkdirSync(testVaultTracesDir, { recursive: true });
	const testVaultStable = path.join(testVaultTracesDir, "Event Trace.md");
	fs.writeFileSync(testVaultStable, content, "utf-8");
	console.log(`[e2e] Event trace written: ${testVaultStable} (${entries.length} events, ${perfEntries.length} perf)`);

	// Mirror to dev vault — stable name at traces root (current state)
	const devTracesDir = path.join(PLUGIN_ROOT, "docs", "reports", "e2e", "traces");
	fs.mkdirSync(devTracesDir, { recursive: true });
	const devStable = path.join(devTracesDir, "Event Trace.md");
	fs.writeFileSync(devStable, content, "utf-8");
	console.log(`[e2e] Event trace current: ${devStable}`);

	// Dev vault — timestamped archive
	const devArchive = path.join(devTracesDir, `${safeTimestamp}-Event Trace.md`);
	fs.writeFileSync(devArchive, content, "utf-8");
	console.log(`[e2e] Event trace archived: ${devArchive}`);

	// Write raw JSON trace to dev vault for programmatic consumption
	const jsonData = {
		date: now.toISOString(),
		durationMs,
		events: entries,
		perfEvents: perfEntries,
		summary: {
			totalEvents: entries.length,
			perfEvents: perfEntries.length,
			uniqueTypes: typeCounts.size,
			eventFrequency: Object.fromEntries(sortedTypes),
		},
	};
	const jsonPath = path.join(devTracesDir, `${safeTimestamp}-Event Trace.json`);
	fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2), "utf-8");
	console.log(`[e2e] Event trace JSON: ${jsonPath}`);
}

export async function teardown(): Promise<void> {
	const vault = new TestVault(PLUGIN_ROOT);
	const cli = new ObsidianCli({ vaultName: vault.vaultName, timeout: 15_000 });

	// Collect the EventBus trace before any teardown mutations.
	// Must happen while the plugin is still enabled and the trace listener active.
	cli.notice("Teardown: Collecting event trace...", 5000);
	collectEventTrace(cli, vault);

	// Only reset installer state when explicitly running the installer test.
	// Default: leave the installed state so the next run can skip the installer.
	if (process.env.E2E_RUN_INSTALLER === "true") {
		cli.notice("Teardown: Resetting installer state...", 5000);
		const dataJsonPath = path.join(
			vault.vaultDir, ".obsidian", "plugins", PLUGIN_ID, "data.json",
		);
		if (fs.existsSync(dataJsonPath)) {
			try {
				const data = JSON.parse(fs.readFileSync(dataJsonPath, "utf-8"));
				// TypedStorage key is "installer" (NOT "installerService")
				data.installer = { installed: false, completedSteps: {} };
				fs.writeFileSync(dataJsonPath, JSON.stringify(data), "utf-8");
				console.log("[e2e] Installer state reset via filesystem.");
			} catch {
				console.warn("[e2e] Failed to reset installer state in data.json.");
			}
		}
	} else {
		console.log("[e2e] Installer state preserved (skip mode).");
	}

	// Clear E2E gate flags stored on window (survive plugin reloads)
	cli.notice("Teardown: Cleaning up E2E state...", 5000);
	cli.eval("delete window._e2ePrerequisitesPassed; delete window._e2eInstallerDone;");

	// Close all center pane tabs using Obsidian workspace commands.
	// Each call closes the active tab; loop until no center pane tabs remain.
	cli.notice("Teardown: Closing views...", 5000);
	closeAllCenterPaneTabs(cli);

	// Wait for views to fully close before disabling the plugin,
	// otherwise tabs end up in an invalid state.
	await sleep(VIEW_CLOSE_SETTLE_MS);

	// Disable the plugin — return to clean baseline (no plugins active)
	cli.notice("Teardown: Disabling plugin...", 5000);
	cli.eval(`app.plugins.disablePlugin('${PLUGIN_ID}')`);

	// Dismiss teardown notices
	await sleep(1000);
	cli.eval("document.querySelectorAll('.notice').forEach(n => n.remove())");
}

/**
 * Closes all center pane tabs using the `workspace:close` Obsidian command.
 * Loops until no center pane leaves remain or progress stalls (Obsidian
 * always keeps at least one empty leaf — we stop when only empties remain).
 */
function closeAllCenterPaneTabs(cli: ObsidianCli): void {
	for (let i = 0; i < 20; i++) {
		const count = getCenterPaneLeafCount(cli);
		if (count === 0) break;

		try {
			cli.executeCommand("workspace:close");
		} catch {
			// No more tabs to close — command errored
			break;
		}

		// Check if we're still making progress
		const after = getCenterPaneLeafCount(cli);
		if (after >= count) break;
	}
}

/** Returns the number of non-empty leaves in the center pane. */
function getCenterPaneLeafCount(cli: ObsidianCli): number {
	const result = cli.eval(
		"(() => { let c = 0; app.workspace.iterateAllLeaves(l => { " +
		"if (l.getRoot() === app.workspace.rootSplit && l.view?.getViewType() !== 'empty') c++; " +
		"}); return c; })()",
	);
	return result.success ? Number(result.value) : 0;
}
