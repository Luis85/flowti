---
type: DecisionNote
adr: ADR-003
title: EventBridge as Sole Obsidian API Contact Point
status: Accepted
date: 2026-01-15
domain: infrastructure
category: Architecture
drivers:
  - Platform Isolation
  - Testability
  - Single Responsibility
tags:
  - decision
  - architecture
  - obsidian
---

# ADR-003: EventBridge as Sole Obsidian API Contact Point

## Status

**Accepted** — foundational decision.

## Context

The Obsidian API provides vault operations (create/read/update/delete files), workspace management, and metadata caching. If services call these APIs directly, they become untestable without the Obsidian runtime and tightly coupled to the platform.

### Alternatives Considered

1. **Direct Obsidian API calls from services** — simple but untestable, couples every service to the platform
2. **Thin wrapper per API surface** — e.g., `VaultClient`, `WorkspaceClient` — better but scatters platform knowledge
3. **Single EventBridge (chosen)** — all Obsidian API access through one class that translates between EventBus events and Obsidian callbacks

## Decision

**EventBridge** is the sole Obsidian API contact point for write operations. It:

- **Translates incoming events**: Listens for `file.create.request`, `frontmatter.update.request`, etc. and executes the corresponding Obsidian API calls
- **Translates outgoing callbacks**: Registers Obsidian vault/workspace event callbacks and emits EventBus events (`file.created`, `file.modified`, `workspace.leaf-changed`, etc.)
- **Uses request-response correlation**: File operations use branded `RequestId` for async matching (see [[ADR-007 Request-Response Correlation via Branded RequestId]])

### Two-Phase Registration

- **Phase 1** (`register()`): Request handlers registered immediately (services may need file I/O during init)
- **Phase 6** (`registerVaultListeners()`): Vault notification listeners deferred until after all services have loaded (see [[ADR-020 Deferred Vault Listener Registration]])

## Consequences

### Positive

- **Platform isolation**: Domain services never import from `obsidian` — they only know the EventBus
- **Testability**: Services are fully testable with a real EventBus and mock responses, no Obsidian runtime needed
- **Single point of change**: If the Obsidian API changes, only EventBridge needs updating

### Negative

- **EventBridge complexity**: At 613 LOC, it handles 9 request types, 7 vault callbacks, and 5 workspace/metadata callbacks
- **Performance indirection**: File operations go through emit → handler → API → response → emit instead of direct calls
- **Debugging indirection**: Following a file create from service through EventBridge requires tracing two events

## Related

- [[Backend Architecture]] — EventBridge component section
- [[ADR-001 EventBus as Communication Backbone]]
- [[ADR-007 Request-Response Correlation via Branded RequestId]]
- [[ADR-020 Deferred Vault Listener Registration]]
