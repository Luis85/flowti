---
type: IncrementReview
cycle: 11
increment: 2
date: 2026-02-21
verdict: PASS
tasm_score: 33
tests_before: 2919
tests_after: 2950
suites: 115
---

# Cycle 11 Inc 2 Review — Azure DevOps Adapter

## A. Plan Adherence

All deliverables from PBI-SIG-002 delivered as scoped:

| Deliverable | Status | Notes |
|-------------|--------|-------|
| `AzureDevOpsAdapter.ts` | Done | Implements SignalAdapter interface (192 LOC) |
| PAT authentication | Done | Base64 Basic auth via `btoa(`:${pat}`)` |
| `testConnection()` | Done | GET project info API (7.1-preview.1) |
| `fetchItems()` | Done | WIQL POST → batch GET → field mapping |
| Type filtering | Done | WIQL WHERE clause with IN operator |
| Error mapping | Done | 401/403/404/429/5xx → typed user-friendly messages |
| Rate limit awareness | Done | 429 + Retry-After extraction |
| `requestUrl` stub | Done | Added to obsidian-stub.ts for test compilation |

## B. Implementation

### AzureDevOpsAdapter (192 LOC)

Structure:
```
AzureDevOpsAdapter
├── buildAuthHeaders(pat)       # PAT → Base64 Basic auth header
├── apiRequest(url, config, body?)  # Core HTTP helper using requestUrl()
├── testConnection(config)      # GET project info endpoint
└── fetchItems(config)          # WIQL POST → batch GET → mapWorkItem()

Module-level functions:
├── mapHttpError(status, headers)  # HTTP status → user-friendly error string
└── mapWorkItem(raw)               # Azure DevOps JSON → WorkItemMapping
```

Key design decisions:
- **Module-level pure functions** for `mapHttpError()` and `mapWorkItem()` — testable via public API, no internal state
- **Batch size 200** — Azure DevOps API limit for work item batch GET
- **WIQL IN clause** — only added when `itemTypeFilter` is non-empty
- **Error resilience** — WIQL failure returns empty items + single error; batch failure reports error per item ID
- **PAT isolation** — PAT only used inside `buildAuthHeaders()`, never in error paths

### Field mapping (Azure DevOps → WorkItemMapping)

```
System.Id                       → id
System.Rev                      → rev
System.WorkItemType             → type
System.Title                    → title
System.State                    → state
System.AssignedTo.displayName   → assignedTo (object extraction)
System.AreaPath                 → areaPath
System.IterationPath            → iterationPath
Microsoft.VSTS.Common.Priority  → priority (default 0)
System.Tags                     → tags (split by "; ")
_links.html.href                → url
System.Description              → description
System.CreatedDate              → createdDate
System.ChangedDate              → changedDate
```

### obsidian-stub.ts update (+20 LOC)

Added `RequestUrlParam`, `RequestUrlResponse` interfaces and `requestUrl()` stub function. The stub throws by default — tests override via `vi.mock` + `vi.hoisted()`.

## C. Testing

- **Tests before**: 2,919 (114 suites)
- **Tests after**: 2,950 (115 suites, +31 new, +1 suite)
- **New tests**: 31 in `tests/domain/signal/AzureDevOpsAdapter.test.ts`
  - 7 testConnection tests (success, 401, 403, 404, 429, 500, network failure)
  - 8 fetchItems tests (WIQL+batch, type filter, no filter, empty results, 200+ batch, field mapping, missing fields, WIQL failure, batch failure)
  - 4 field mapping tests (tag splitting, empty tags, assignedTo extraction, priority default)
  - 3 security tests (auth header format, PAT absent from errors, PAT absent from fetch errors)
  - 7 error mapping tests (5 status codes via `it.each`, Retry-After extraction, 429 without header)
  - 2 additional tests (project URL encoding, WIQL query failure with error reporting)

### Mock pattern

```typescript
const { mockRequestUrl } = vi.hoisted(() => ({ mockRequestUrl: vi.fn() }));
vi.mock("obsidian", async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, requestUrl: mockRequestUrl };
});
```

`vi.hoisted()` was required because `vi.mock` is hoisted above `const` declarations (temporal dead zone). This is the first use of `vi.mock("obsidian")` in the project — established pattern for future network-calling tests.

## D. Acceptance Criteria

- [x] `AzureDevOpsAdapter` implements `SignalAdapter` interface
- [x] PAT → Base64 Basic auth header
- [x] `testConnection()` validates org/project/PAT via project info API
- [x] `fetchItems()` retrieves work items via WIQL + batch GET
- [x] Type filtering via WIQL WHERE clause
- [x] HTTP errors mapped to typed, sanitized responses
- [x] Rate limit (429) with Retry-After awareness
- [x] PAT never in logs, events, or error messages
- [x] `npm test` green (2,950 passing, 0 failures)

## E. TASM Assessment

| Dimension | Score | Notes |
|-----------|-------|-------|
| A. Correctness | 5/5 | All API patterns match ADR-034, compile-time safety via interface implementation |
| B. Test Coverage | 5/5 | 31 tests covering all public methods, error paths, edge cases, security |
| C. Maintainability | 5/5 | Clean separation: pure functions for mapping/errors, adapter class for HTTP |
| D. Documentation | 5/5 | JSDoc on adapter, review document, ADR-034 already covers patterns |
| E. Standards | 5/5 | Follows SignalAdapter interface, ADR-034 HTTP patterns, vi.hoisted() pattern |
| F. Performance | 4/5 | Batch size 200 (optimal), sequential batches (parallel possible but adds complexity) |
| G. Scope Discipline | 4/5 | 192 LOC vs estimated 180 LOC — close match, slight growth from error handling depth |
| **Total** | **33/35** | |

## Verdict: PASS
