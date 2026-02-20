---
type: ProductBacklogItem
domain: Signal
feature: "[[Azure DevOps Integration PRD]]"
stage: planned
priority: 2
cycle: "[[Cycle 11 - Azure DevOps Integration]]"
increment: 2
estimated_loc: 180
estimated_tests: 25
tags:
  - signal
  - azure-devops
  - adapter
  - pbi
---

# PBI-SIG-002: Azure DevOps Adapter

## Problem Statement

No mechanism exists to communicate with the Azure DevOps REST API. The SignalAdapter interface (from PBI-SIG-001) defines the contract, but a concrete implementation is needed to authenticate, query work items, and handle HTTP errors specific to Azure DevOps.

## Solution Approach

Implement `AzureDevOpsAdapter` in `src/domain/signal/adapters/` using Obsidian's `requestUrl()`. The adapter uses PAT authentication (Base64 Basic auth), WIQL queries to find work items, and batch GET to fetch details. HTTP errors are mapped to typed, user-friendly error responses. PAT is never logged or emitted.

## INVEST Assessment

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Independent | Partial | Depends on SignalAdapter interface from PBI-SIG-001 |
| Negotiable | Yes | Error mapping depth, rate limiting sophistication, type filter set |
| Valuable | Yes | Core capability — connects plugin to Azure DevOps |
| Estimable | Yes | ~180 LOC, ~25 tests, ~3 files |
| Small | Yes | Single increment, adapter only |
| Testable | Yes | All HTTP interactions mockable via `requestUrl` stub |

## Acceptance Criteria

- [ ] `AzureDevOpsAdapter` implements `SignalAdapter` interface
- [ ] Authenticates via PAT → Base64 Basic auth header (`:${pat}` → base64)
- [ ] `testConnection()` validates org/project/PAT via project info API
- [ ] `fetchItems()` retrieves work items via WIQL query + batch GET
- [ ] Work item type filtering works via WIQL WHERE clause (Bug, User Story, Task, Epic, Feature)
- [ ] HTTP errors mapped to typed responses: 401→"Invalid PAT", 404→"Project not found", 403→"Insufficient permissions", timeout→"Connection timeout"
- [ ] Rate limit (429) handled gracefully with Retry-After awareness
- [ ] PAT never appears in logs, event payloads, or error messages
- [ ] `npm test` green with ~25 mocked HTTP tests

## Test Intent

- Success paths: testConnection success, fetchItems with results, type filtering
- Error paths: invalid PAT (401), project not found (404), forbidden (403), timeout, rate limit (429)
- Security: verify PAT is absent from all error objects and log calls
- Edge cases: empty result set, large result set (pagination batch of 200)

## Documentation Intent

- Update Azure DevOps Integration PRD architecture section with validated API behavior
- Document Azure DevOps REST API version and endpoint patterns in adapter JSDoc

## Related

- [[PBI-SIG-001 Signal Domain Foundation]] — provides SignalAdapter interface
- [[PBI-SIG-003 Work Item Mapping and Note Creation]] — consumes adapter output
- [[Azure DevOps Integration PRD]] — parent PRD (§12)
