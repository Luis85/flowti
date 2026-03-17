---
type: ArchitectureDecisionRecord
status: accepted
date: 2026-02-21
scope: signal
---

# ADR-034: HTTP Integration Patterns

## Context

The Signal domain introduces the plugin's first network calls. Obsidian provides `requestUrl()` as a built-in HTTP client that handles CORS, SSL certificates, and platform differences (desktop, mobile, embedded browser). We need to establish consistent patterns for authentication, error handling, timeouts, and security that all future adapters will follow.

## Decision

### 1. Use `requestUrl()` exclusively

Obsidian's `requestUrl()` (from the `obsidian` module) is the only HTTP mechanism. No external HTTP libraries (axios, node-fetch) are needed or allowed. This function:

- Bypasses CORS restrictions (critical for API calls from Electron)
- Handles SSL/TLS automatically
- Works across desktop, mobile, and embedded environments
- Returns `{ status, headers, text, json, arrayBuffer }`

### 2. PAT Authentication via Basic Auth Header

Azure DevOps PATs use HTTP Basic authentication with an empty username:

```typescript
const token = btoa(`:${config.pat}`);
const headers = {
    "Authorization": `Basic ${token}`,
    "Content-Type": "application/json",
};
```

### 3. Error Mapping

HTTP errors are mapped to typed, user-friendly messages. The raw error is never exposed to users or logs:

| HTTP Status | Mapped Error | Meaning |
|-------------|-------------|---------|
| 401 | "Invalid Personal Access Token" | PAT expired, revoked, or wrong |
| 403 | "Insufficient permissions — PAT needs Work Items (Read) scope" | PAT lacks required scope |
| 404 | "Project not found — check organization URL and project name" | Wrong org or project |
| 429 | "Rate limited — retry after {n} seconds" | Azure DevOps rate limit (800 req/5min) |
| 5xx | "Azure DevOps service error — try again later" | Server-side issue |
| Network error | "Connection failed — check your network and organization URL" | DNS, timeout, offline |

### 4. Timeout

Default timeout is 30 seconds per request (Obsidian's default). No custom timeout override needed for v1. If a request exceeds 30s, the `requestUrl()` promise rejects with a timeout error, caught and mapped to "Connection timeout".

### 5. Rate Limiting Awareness

If HTTP 429 is received, the adapter:
1. Extracts `Retry-After` header (seconds)
2. Emits a warning via `signal.sync.failed` with the retry delay
3. Does NOT auto-retry (user triggers retry manually)

Azure DevOps allows ~800 requests per 5 minutes for PAT auth. A sync of 200 work items uses ~3 requests (1 WIQL + 1-4 batch fetches), well within limits.

### 6. PAT Security

**PAT is NEVER:**
- Included in event payloads
- Written to log messages
- Included in error messages or SyncError objects
- Displayed in UI (masked as `•••`)

**PAT IS:**
- Stored in Obsidian's `data.json` (local, OS-level encryption via Electron)
- Only used inside `AzureDevOpsAdapter` to construct the auth header
- Passed via `SignalConfig` object (in-memory only during sync)

### 7. Request Pattern

```typescript
async function apiRequest(url: string, config: SignalConfig, body?: unknown): Promise<unknown> {
    const token = btoa(`:${config.pat}`);
    const response = await requestUrl({
        url,
        method: body ? "POST" : "GET",
        headers: {
            "Authorization": `Basic ${token}`,
            "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    return response.json;
}
```

## Consequences

- All HTTP communication goes through a single adapter layer — easy to mock for testing
- Tests never make real HTTP calls; `requestUrl` is stubbed in test setup
- Error messages are user-friendly and never leak credentials
- The pattern is reusable for future adapters (GitHub, Jira, RSS)

## Related

- [[Azure DevOps Integration PRD]] §8 Architecture
- [[PBI-SIG-002 Azure DevOps Adapter]] — first implementation of these patterns
