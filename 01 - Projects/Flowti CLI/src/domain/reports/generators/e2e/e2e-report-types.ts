/**
 * e2e-report-types.ts
 *
 * All interfaces and type definitions for E2E report generation.
 */

export interface VitestCase {
	name: string;
	status: string;
	durationMs: number;
	error: string | null;
	reconciledStatus?: string;
}

export interface VitestSuite {
	name: string;
	file: string;
	cases: VitestCase[];
	hookError: string | null;
	suiteHookFailed: boolean;
	passed: number;
	failed: number;
	skipped: number;
	reconciledPassed?: number;
	reconciledFailed?: number;
	reconciledSkipped?: number;
	reconciledDev?: number;
}

export interface VitestResults {
	totalPassed: number;
	totalFailed: number;
	totalSkipped: number;
	totalTests: number;
	totalDev?: number;
	durationMs: number;
	suites: VitestSuite[];
}

export interface ActionStatsReturn {
	total: number;
	screenshots: number;
	assertions: number;
	manual_checks: number;
	manual_passed: number;
	manual_failed: number;
	visual_inspections: number;
	notices: number;
	theme_changes: number;
	create_files: number;
	delete_files: number;
	open_files: number;
	close_leaves: number;
	tools: string[];
}

export interface JourneyEntry {
	dir: string;
	data: Record<string, unknown>;
}

export interface JourneyReportResult {
	title: string;
	status: string;
	content: string;
}

export interface StartupPerf {
	history: number[];
	sizeBytes: number;
}

export interface TraceSummary {
	totalEvents?: number;
	perfEvents?: number;
	uniqueTypes?: number;
	eventFrequency?: Record<string, number>;
}

export interface TraceData {
	summary?: TraceSummary;
	durationMs?: number;
	perfEvents?: PerfTraceEvent[];
}

export interface PerfTraceEvent {
	type: string;
	payload: string | Record<string, unknown>;
}

export interface CanvasNode {
	id: string;
	type: string;
	text?: string;
	file?: string;
	label?: string;
	styleAttributes?: Record<string, string>;
	x: number;
	y: number;
	width: number;
	height: number;
	color?: string;
	background?: string;
	backgroundStyle?: string;
}

export interface CanvasEdge {
	id: string;
	fromNode: string;
	fromSide: string;
	toNode: string;
	toSide: string;
}

export interface CanvasResult {
	metadata: {
		version: string;
		frontmatter: Record<string, unknown>;
		startNode: string;
	};
	nodes: CanvasNode[];
	edges: CanvasEdge[];
}

export interface StepAction {
	tool: string;
	id?: string;
	selector?: string;
	value?: string;
	style?: string;
	ms?: number;
	label?: string;
	hub?: string;
	tab?: string;
	type?: string;
	event?: string;
	viewType?: string;
	store?: string;
	message?: string;
	instruction?: string;
	prompt?: string;
	theme?: string;
	path?: string;
	duration?: number;
	description?: string;
}

export interface StepDefinition {
	id: string;
	guideSection: string;
	title: string;
	description?: string;
	expectedInput?: string;
	expectedOutput?: string;
	phase?: string;
	actions?: StepAction[];
	describeBlock?: string;
	itBlock?: string;
	uiContext?: {
		view?: string;
		viewName?: string;
		tab?: string;
		tabName?: string;
		components?: string[];
	};
	events?: string[];
	commands?: string[];
	queries?: string[];
	interactions?: string[];
	improvements?: Array<{
		title: string;
		description?: string;
		priority?: string;
	}>;
}

export interface ManualVerification {
	status: string;
	instruction: string;
	notes?: string;
}

export interface DomSnapshot {
	activeViewType: string;
	leafCount: number;
	hasModal: boolean;
	notices?: string[];
	visibleElements?: string[];
}

export interface RecentEvent {
	type: string;
	relativeMs: number;
}

export interface PluginState {
	loaded: boolean;
	serviceCount: number;
}

export interface ErrorContext {
	domSnapshot?: DomSnapshot;
	recentEvents?: RecentEvent[];
	consoleErrors?: string[];
	availableVariables?: string[];
	pluginState?: PluginState;
}

export interface StepResult {
	step: StepDefinition;
	status: string;
	durationMs: number;
	error?: string;
	errorContext?: ErrorContext;
	warnings?: string[];
	screenshotFiles?: string[];
	screenshotFile?: string;
	manualVerifications?: ManualVerification[];
}

export interface StartupService {
	service: string;
	durationMs: number;
}

export interface StartupTotal {
	durationMs: number;
	serviceCount: number;
}

export interface StorageOp {
	key: string;
	op: string;
	durationMs: number;
	sizeBytes: number;
}

export interface QueryOp {
	queryId: string;
	durationMs: number;
	sourceRows: number;
	resultRows: number;
}

export interface DispatchOp {
	eventType: string;
	handlerCount: number;
	durationMs: number;
}

export interface AlertOp {
	metric: string;
	value: number;
	threshold: number;
}

export interface DispatchAggregate {
	count: number;
	totalMs: number;
	maxMs: number;
}

export interface PerfEventBuckets {
	startupServices: StartupService[];
	startupTotal: StartupTotal | null;
	storageOps: StorageOp[];
	queries: QueryOp[];
	dispatches: DispatchOp[];
	alerts: AlertOp[];
}

export interface JourneyDataFields {
	journeySlug: string;
	journeyTitle: string;
	totalSteps: number;
	passedSteps: number;
	failedSteps: number;
	skippedSteps: number;
	devSteps: number;
	isDevStopped: boolean;
	durationMs: number;
	actionStats: ActionStatsReturn;
	journeyStatus: string;
}

export interface CanvasJourneyFields {
	canvasVars: Record<string, string>;
	journeySlug: string;
	journeyTitle: string;
	steps: StepResult[];
	passedSteps: number;
	failedSteps: number;
	skippedSteps: number;
	totalSteps: number;
	durationMs: number;
}

export interface ReconciledTotals {
	totalPassed: number;
	totalFailed: number;
	totalSkipped: number;
	totalDev: number;
	totalTests: number;
	overallStatus: string;
	totalDurationMs: number;
}
