/**
 * e2e-report-perf.ts
 *
 * Performance and trace processing for E2E reports.
 */

import { disk } from "../../../../infrastructure/filesystem.js";
import { paths } from "../../../../infrastructure/paths.js";
import { Document } from "../../../../infrastructure/document.js";
import type {
	AlertOp, DispatchAggregate, DispatchOp, PerfEventBuckets,
	PerfTraceEvent, QueryOp, StartupPerf, StartupService,
	StartupTotal, StorageOp, TraceData, TraceSummary,
} from "./e2e-report-types.js";
import { formatBytes, formatDuration, percentile, round } from "./e2e-report-utils.js";

// ── I/O ─────────────────────────────────────────────────────────

/** Reads the latest Event Trace JSON from the dev traces directory. */
export function readLatestEventTrace(devTracesDir: string): TraceData | null {
	if (!disk.existsSync(devTracesDir)) return null;

	const files = disk.readdirSync(devTracesDir)
		.filter((f) => f.endsWith("-Event Trace.json") || f.endsWith("-event-trace.json"))
		.sort()
		.reverse();

	if (files.length === 0) return null;

	try {
		return JSON.parse(disk.readFileSync(paths.join(devTracesDir, files[0]), "utf-8")) as TraceData;
	} catch {
		return null;
	}
}

/** Reads startup history from plugin data.json. */
export function readStartupPerf(dataJsonCandidates: string[]): StartupPerf | null {
	for (const candidate of dataJsonCandidates) {
		if (disk.existsSync(candidate)) {
			try {
				const data = JSON.parse(disk.readFileSync(candidate, "utf-8")) as Record<string, unknown>;
				const sizeBytes = disk.statSync(candidate).size;
				const history = (data?.perfAggregator as Record<string, unknown> | undefined)?.startupHistory as number[] ?? [];
				return { history, sizeBytes };
			} catch { /* try next */ }
		}
	}
	return null;
}

// ── Performance Section Rendering ───────────────────────────────

/** Appends the Performance section to the document. */
export function buildPerfLines(startupPerf: StartupPerf | null, doc: InstanceType<typeof Document>): void {
	if (!startupPerf || startupPerf.history.length === 0) return;

	const { history, sizeBytes } = startupPerf;
	const sorted = [...history].sort((a, b) => a - b);
	const last = round(history[history.length - 1] ?? 0);
	const p50 = round(percentile(sorted, 0.5));
	const p95 = round(percentile(sorted, 0.95));
	const max = round(sorted[sorted.length - 1] ?? 0);

	doc.addSeparator().addBlank();
	doc.heading(2, "Performance").addBlank();
	doc.callout("tip", "Startup", [
		`Last: ${last}ms | p50: ${p50}ms | p95: ${p95}ms | Max: ${max}ms`,
		`Measurements: ${history.length} | data.json: ${formatBytes(sizeBytes)}`,
	]);
	doc.addBlank();
}

// ── Event Trace Section ─────────────────────────────────────────

function renderTopEventsTable(doc: InstanceType<typeof Document>, freq: Record<string, number> | undefined, limit: number): void {
	if (!freq || Object.keys(freq).length === 0) return;
	const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, limit);
	doc.heading(3, "Top Events").addBlank();
	doc.table(["Event", "Count"], sorted.map(([type, count]) => [`\`${type}\``, String(count)]));
	doc.addBlank();
}

function buildTraceSummaryText(summary: TraceSummary | undefined, durationMs: number): string {
	const totalEvents = summary?.totalEvents ?? 0;
	const perfEvents = summary?.perfEvents ?? 0;
	const uniqueTypes = summary?.uniqueTypes ?? 0;
	return `Events: ${totalEvents} | Perf: ${perfEvents} | Types: ${uniqueTypes} | Duration: ${formatDuration(durationMs)}`;
}

// ── Perf Event Classification ───────────────────────────────────

/** Safely parses a perf event payload to an object. */
export function parsePerfPayload(payload: string | Record<string, unknown>): Record<string, unknown> | null {
	try {
		return typeof payload === "string" ? JSON.parse(payload) as Record<string, unknown> : payload as Record<string, unknown>;
	} catch { return null; }
}

function classifyStartupService(p: Record<string, unknown>, buckets: PerfEventBuckets): void {
	if (p.service && p.durationMs !== undefined) {
		buckets.startupServices.push({ service: p.service as string, durationMs: p.durationMs as number });
	}
}

function classifyStartupTotal(p: Record<string, unknown>, buckets: PerfEventBuckets): void {
	if (p.durationMs !== undefined) {
		buckets.startupTotal = { durationMs: p.durationMs as number, serviceCount: (p.serviceCount as number) ?? 0 };
	}
}

function classifyStorageOp(type: string, p: Record<string, unknown>, buckets: PerfEventBuckets): void {
	if (p.key && p.durationMs !== undefined) {
		buckets.storageOps.push({ key: p.key as string, op: type === "perf.storage.loaded" ? "load" : "save", durationMs: p.durationMs as number, sizeBytes: (p.sizeBytes as number) ?? 0 });
	}
}

function classifyQuery(p: Record<string, unknown>, buckets: PerfEventBuckets): void {
	if (p.queryId && p.durationMs !== undefined) {
		buckets.queries.push({ queryId: p.queryId as string, durationMs: p.durationMs as number, sourceRows: (p.sourceRows as number) ?? 0, resultRows: (p.resultRows as number) ?? 0 });
	}
}

function classifyDispatch(p: Record<string, unknown>, buckets: PerfEventBuckets): void {
	if (p.eventType && p.durationMs !== undefined) {
		buckets.dispatches.push({ eventType: p.eventType as string, handlerCount: (p.handlerCount as number) ?? 0, durationMs: p.durationMs as number });
	}
}

function classifyAlert(p: Record<string, unknown>, buckets: PerfEventBuckets): void {
	if (p.metric) {
		buckets.alerts.push({ metric: p.metric as string, value: (p.value as number) ?? 0, threshold: (p.threshold as number) ?? 0 });
	}
}

type PerfClassifier = (p: Record<string, unknown>, buckets: PerfEventBuckets) => void;

const PERF_CLASSIFIER_MAP: Record<string, PerfClassifier> = {
	"perf.startup.service": classifyStartupService,
	"perf.startup.total": classifyStartupTotal,
	"perf.storage.loaded": (p, b) => classifyStorageOp("perf.storage.loaded", p, b),
	"perf.storage.saved": (p, b) => classifyStorageOp("perf.storage.saved", p, b),
	"perf.query.executed": classifyQuery,
	"perf.event.dispatched": classifyDispatch,
	"perf.alert": classifyAlert,
};

/** Classifies a single perf event into the appropriate bucket. */
export function classifyPerfEvent(e: PerfTraceEvent, buckets: PerfEventBuckets): void {
	const p = parsePerfPayload(e.payload);
	if (!p) return;
	const classifier = PERF_CLASSIFIER_MAP[e.type];
	if (classifier) classifier(p, buckets);
}

// ── Perf Rendering ──────────────────────────────────────────────

function renderPerfStartup(doc: InstanceType<typeof Document>, startupTotal: StartupTotal | null, startupServices: StartupService[]): void {
	if (!startupTotal && startupServices.length === 0) return;
	doc.heading(4, "Startup").addBlank();
	if (startupTotal) {
		doc.text(`Total startup: **${Math.round(startupTotal.durationMs)}ms** (${startupTotal.serviceCount} services)`);
		doc.addBlank();
	}
	if (startupServices.length > 0) {
		const sorted = [...startupServices].sort((a, b) => b.durationMs - a.durationMs);
		doc.table(["Service", "Duration"], sorted.map((s) => [s.service, `${Math.round(s.durationMs)}ms`]));
		doc.addBlank();
	}
}

function renderPerfStorage(doc: InstanceType<typeof Document>, storageOps: StorageOp[]): void {
	if (storageOps.length === 0) return;
	const LIMIT = 20;
	doc.heading(4, "Storage Operations").addBlank();
	const loadOps = storageOps.filter(o => o.op === "load");
	const saveOps = storageOps.filter(o => o.op === "save");
	doc.text(`Load: ${loadOps.length} ops (${Math.round(loadOps.reduce((s, o) => s + o.durationMs, 0))}ms) | Save: ${saveOps.length} ops (${Math.round(saveOps.reduce((s, o) => s + o.durationMs, 0))}ms)`);
	doc.addBlank();
	const sorted = [...storageOps].sort((a, b) => b.durationMs - a.durationMs);
	const rows: string[][] = sorted.slice(0, LIMIT).map((o) => {
		const size = o.sizeBytes > 1024 ? `${(o.sizeBytes / 1024).toFixed(1)}KB` : `${o.sizeBytes}B`;
		return [o.key, o.op, `${Math.round(o.durationMs)}ms`, size];
	});
	if (sorted.length > LIMIT) rows.push([`*...and ${sorted.length - LIMIT} more*`, "", "", ""]);
	doc.table(["Key", "Op", "Duration", "Size"], rows);
	doc.addBlank();
}

function renderPerfQueries(doc: InstanceType<typeof Document>, queries: QueryOp[]): void {
	if (queries.length === 0) return;
	doc.heading(4, "Query Execution").addBlank();
	const totalMs = Math.round(queries.reduce((s, q) => s + q.durationMs, 0));
	const maxQ = queries.reduce((m, q) => q.durationMs > m.durationMs ? q : m, queries[0]);
	doc.text(`Queries: ${queries.length} | Total: ${totalMs}ms | Avg: ${(totalMs / queries.length).toFixed(1)}ms | Slowest: ${maxQ.queryId} (${Math.round(maxQ.durationMs)}ms)`);
	doc.addBlank();
	const sorted = [...queries].sort((a, b) => b.durationMs - a.durationMs);
	doc.table(["Query", "Duration", "Source Rows", "Result Rows"], sorted.map((q) => [q.queryId, `${Math.round(q.durationMs)}ms`, String(q.sourceRows), String(q.resultRows)]));
	doc.addBlank();
}

function renderPerfDispatches(doc: InstanceType<typeof Document>, dispatches: DispatchOp[]): void {
	if (dispatches.length === 0) return;
	doc.heading(4, "Event Dispatch Timing").addBlank();
	const totalMs = dispatches.reduce((s, d) => s + d.durationMs, 0);
	const byType = new Map<string, DispatchAggregate>();
	for (const d of dispatches) {
		const existing = byType.get(d.eventType) ?? { count: 0, totalMs: 0, maxMs: 0 };
		existing.count++;
		existing.totalMs += d.durationMs;
		existing.maxMs = Math.max(existing.maxMs, d.durationMs);
		byType.set(d.eventType, existing);
	}
	doc.text(`Dispatches: ${dispatches.length} | Total: ${Math.round(totalMs)}ms | Avg: ${(totalMs / dispatches.length).toFixed(2)}ms`);
	doc.addBlank();
	const sorted = [...byType.entries()].sort((a, b) => b[1].totalMs - a[1].totalMs);
	doc.table(["Event", "Dispatches", "Total", "Avg", "Max"], sorted.map(([type, stats]) => {
		return [`\`${type}\``, String(stats.count), `${Math.round(stats.totalMs)}ms`, `${(stats.totalMs / stats.count).toFixed(2)}ms`, `${Math.round(stats.maxMs)}ms`];
	}));
	doc.addBlank();
}

function renderPerfAlerts(doc: InstanceType<typeof Document>, alerts: AlertOp[]): void {
	if (alerts.length === 0) return;
	doc.heading(4, "Performance Alerts").addBlank();
	doc.callout("warning", "Threshold Violations",
		alerts.map((a) => `- **${a.metric}**: ${Math.round(a.value)}ms (threshold: ${Math.round(a.threshold)}ms)`),
	);
	doc.addBlank();
}

/**
 * Builds detailed performance statistics from perf.* trace events.
 */
export function buildPerfEventStats(perfEvents: PerfTraceEvent[], doc: InstanceType<typeof Document>): void {
	if (!perfEvents || perfEvents.length === 0) return;

	const buckets: PerfEventBuckets = {
		startupServices: [], startupTotal: null, storageOps: [], queries: [], dispatches: [], alerts: [],
	};
	for (const e of perfEvents) classifyPerfEvent(e, buckets);

	doc.heading(3, "Event Performance Statistics").addBlank();
	doc.callout("info", "Metrics", [
		`Perf events: ${perfEvents.length} | Startup services: ${buckets.startupServices.length} | Storage ops: ${buckets.storageOps.length} | Queries: ${buckets.queries.length} | Dispatches: ${buckets.dispatches.length} | Alerts: ${buckets.alerts.length}`,
	]);
	doc.addBlank();

	renderPerfStartup(doc, buckets.startupTotal, buckets.startupServices);
	renderPerfStorage(doc, buckets.storageOps);
	renderPerfQueries(doc, buckets.queries);
	renderPerfDispatches(doc, buckets.dispatches);
	renderPerfAlerts(doc, buckets.alerts);
}

/** Appends the Event Trace section to the document. */
export function buildEventTraceLines(trace: TraceData | null, doc: InstanceType<typeof Document>): void {
	if (!trace) return;

	doc.addSeparator().addBlank();
	doc.heading(2, "Event Trace").addBlank();
	doc.callout("abstract", "Trace Summary", [buildTraceSummaryText(trace.summary, trace.durationMs ?? 0)]);
	doc.addBlank();

	renderTopEventsTable(doc, trace.summary?.eventFrequency, 15);
	buildPerfEventStats(trace.perfEvents ?? [], doc);

	doc.text("Full details: [[Event Trace]]");
	doc.addBlank();
}
