---
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
type: ProductRequirementsDocument
stage: idea
related_events: []
maturity: L0
---

# Feature: Tracking and Reporting

> Architecture reference: [[Tracking and Reporting]]

---

## 1. Problem Statement

Users managing products, projects, and domains in Obsidian have no built-in way to track progress over time or generate reports from their vault data. Understanding trends (documentation growth, event coverage improvements, feature completion) requires manual counting and spreadsheet exports.

- **Who is affected?** Product owners, project managers, and team leads who need visibility into vault activity and progress.
- **What breaks?** There is no historical view — the vault shows current state only, with no way to see how things have changed.
- **Why it matters:** Tracking and reporting turns a static knowledge vault into a dynamic project management tool, enabling data-driven decisions.

---

## 2. Outcome

- **User can** view dashboards showing key metrics over time, generate reports on vault health trends, and export summaries for stakeholders.
- **System can** collect periodic snapshots of vault metrics, store them as structured data, and render trend charts and summary tables.
- **Domain gains** a reporting layer that aggregates data from all Flowti domains (events, documentation, requirements, tests) into actionable insights.

---

## 3. Scope

### In Scope (vision)

- Metric collection: periodic snapshots of vault KPIs (entity counts, health scores, coverage percentages)
- Dashboard widgets: trend charts, sparklines, and summary tables
- Report generation: markdown-based reports with tables and inline metrics
- Configurable metrics: users choose which KPIs to track
- Export: CSV or markdown report export

### Out of Scope

- Real-time analytics or streaming dashboards
- External BI tool integration (Tableau, PowerBI)
- Custom metric formulas or calculated fields
- Alerting or notification based on metric thresholds
- Historical data migration from external sources

---

## 4. UX Entry Points

- **Hub dashboard**: Tracking widgets on User Hub or Product Hub dashboards
- **Command palette**: `flowti:generate-report`, `flowti:capture-snapshot`
- **Dedicated tab**: "Reports" tab in a Hub showing saved and generated reports

---

## 5. Functional Requirements

- [ ] Metric snapshot service captures configured KPIs on schedule or manual trigger
- [ ] Snapshots stored as structured data (JSON in vault or frontmatter notes)
- [ ] Dashboard widgets render trend charts for selected metrics
- [ ] Report template system generates markdown reports from snapshot data
- [ ] Time range selection: last 7/30/90 days or custom range
- [ ] Export report as markdown file or CSV
- [ ] Metric configuration: enable/disable specific KPIs to track

---

## 6. Data Model Impact

Potential entities:

```
MetricSnapshot
  timestamp: string
  metrics: Record<string, number>
    e.g., entityCount, healthScore, docCoverage,
          eventCoverage, requirementCount, testPassRate

ReportConfig
  name: string
  metrics: string[]
  timeRange: { start, end } | "last7d" | "last30d" | "last90d"
  format: "markdown" | "csv"

GeneratedReport (frontmatter)
  type: "ReportDoc"
  generatedAt: string
  configRef: string
  period: string
```

Snapshots stored in `docsRootPath/Metrics/` or a dedicated storage key.

---

## 7. Event Impact

### Produced (proposed)

- `tracking.snapshot.captured` — payload: `{ timestamp, metricCount }`
- `tracking.report.generated` — payload: `{ reportName, format, filePath }`

### Consumed

- Health check results (from HealthTab)
- Entity counts from catalog state
- Any domain metrics exposed via EventBus

---

## 8. UI Layout Impact

- Dashboard widgets: sparkline charts and KPI cards on Hub dashboards
- Reports tab: master list of generated reports + detail preview
- Snapshot trigger button in dashboard actions row

---

## 9. Adapter Impact

```
TrackingService (proposed)
├── captureSnapshot(): Promise<MetricSnapshot>
├── getSnapshots(timeRange): MetricSnapshot[]
├── getMetricTrend(metricKey, timeRange): DataPoint[]
├── generateReport(config): Promise<TFile>
└── getAvailableMetrics(): MetricDefinition[]
```

---

## 10. Non-Functional Requirements

- **Storage**: Snapshots are lightweight (~1KB each); 365 daily snapshots = ~365KB
- **Performance**: Snapshot capture completes in < 2 seconds
- **Idempotency**: Multiple captures on the same day update rather than duplicate
- **Privacy**: All data stays in the vault — no external transmission

---

## 11. Risks

| Risk | Mitigation |
|------|------------|
| Snapshot data growing unbounded | Retention policy: auto-archive snapshots older than configurable threshold |
| Chart rendering complexity in Obsidian | Use lightweight SVG charts (no heavy charting library) |
| Metric definitions changing over time | Snapshots store raw values; metric definitions versioned |
| User confusion about what metrics mean | Tooltips and documentation for each tracked KPI |

---

## 12. Acceptance Criteria

- [ ] Metric snapshot captures current vault KPIs
- [ ] Snapshots are persisted and retrievable by time range
- [ ] Dashboard widget shows a trend chart for at least one metric
- [ ] Report generation produces a readable markdown file
- [ ] User can configure which metrics to track
- [ ] CSV export of snapshot data works correctly

---

## 13. Definition of Done

- [ ] MetricSnapshot schema defined
- [ ] TrackingService with capture, query, and report generation
- [ ] Dashboard widgets rendering trend data
- [ ] Report template producing markdown output
- [ ] Snapshot storage and retrieval tested
- [ ] Unit tests cover service logic
- [ ] `npm run build` passes
