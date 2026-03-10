/**
 * report-events.ts — Domain event definitions for the report subsystem.
 *
 * These events are emitted by report generators and consumed by UI renderers.
 * Domain code never imports logger or UI — it emits typed events instead.
 */

export interface ReportEventMap {
	"report.progress": { generator: string; message: string };
	"report.warning": { generator: string; message: string };
	"report.written": { generator: string; outputPath: string };
}
