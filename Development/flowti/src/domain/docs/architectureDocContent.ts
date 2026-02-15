/**
 * Markdown content generators for architecture documentation files.
 *
 * Covers: ArchitectureDoc (Arc42 + C4), ServiceBlueprintDoc — advanced
 * templates that include Mermaid diagrams and require safeId() for
 * generating valid diagram identifiers.
 */

import type { EventCatalogEntry } from "../../infrastructure/events/catalog";

/** Strip non-alphanumeric characters for use as mermaid node IDs. */
function safeId(s: string): string {
	return s.replace(/[^a-zA-Z0-9]/g, "");
}

// ─────────────────────────────────────────────────────────────
// Architecture documentation (Arc42 + C4)
// ─────────────────────────────────────────────────────────────

export function generateArchitectureDocContent(domain: string, events: EventCatalogEntry[]): string {
	const now = new Date().toISOString();
	const categories = [...new Set(events.map((e) => e.category))].sort();
	const services = [...new Set(events.map((e) => e.services))].sort();

	return `---
type: ArchitectureDoc
domain: "${domain}"
eventCount: ${events.length}
categories:
${categories.map((c) => `  - "${c}"`).join("\n")}
services:
${services.map((s) => `  - "${s}"`).join("\n")}
created: "${now}"
---

# ${domain} — Architecture

| Property        | Value                          |
| --------------- | ------------------------------ |
| **Event Count** | ${events.length}               |
| **Categories**  | ${categories.join(", ")}       |
| **Services**    | ${services.join(", ")}         |

## 1. Introduction & Goals

> Define the domain's purpose, key requirements, and quality goals.

### Requirements Overview

### Quality Goals

| Priority | Goal | Description |
| -------- | ---- | ----------- |
| 1        |      |             |
| 2        |      |             |
| 3        |      |             |

### Stakeholders

| Role | Expectations |
| ---- | ------------ |
|      |              |

## 2. Constraints

### Technical Constraints

### Organizational Constraints

### Conventions

## 3. Context & Scope (C4 — Context)

> Business context and external dependencies.

### Business Context

\`\`\`mermaid
graph LR
    ${safeId(domain)}[${domain}]
    User[User / Actor]

    User -->|interacts| ${safeId(domain)}
\`\`\`

### Technical Context

| External Entity | Interface | Description |
| --------------- | --------- | ----------- |
|                 |           |             |

## 4. Solution Strategy

> High-level decisions and approaches.

## 5. Building Block View (C4 — Container / Component)

> Static decomposition of the domain.

### Container View

\`\`\`mermaid
graph TB
    subgraph "${domain} Domain"
${services.map((s) => `        ${safeId(s)}[${s}]`).join("\n")}
    end
\`\`\`

### Component View

> Detail the internal components of each service.

## 6. Runtime View

> Behavior and interaction scenarios.

### Key Event Flows

${events.slice(0, 10).map((e) => `- \`${e.type}\` — ${e.description}`).join("\n")}

### Sequence Diagram

\`\`\`mermaid
sequenceDiagram
    participant User
    participant ${safeId(domain)} as ${domain}

    User->>${safeId(domain)}: trigger action
    ${safeId(domain)}-->>User: emit event
\`\`\`

## 7. Deployment View

> Infrastructure and deployment topology.

## 8. Cross-cutting Concepts

### Event-Driven Communication

### Error Handling

### Logging & Monitoring

## 9. Architecture Decisions

| ID | Decision | Status | Rationale |
| -- | -------- | ------ | --------- |
|    |          |        |           |

## 10. Quality Requirements

### Performance

### Security

### Maintainability

## 11. Risks & Technical Debt

| Risk / Debt | Impact | Mitigation |
| ----------- | ------ | ---------- |
|             |        |            |

## Events Reference

${events.map((e) => `- \`${e.type}\` — ${e.description}`).join("\n")}

`;
}

// ─────────────────────────────────────────────────────────────
// Service blueprint documentation
// ─────────────────────────────────────────────────────────────

export function generateServiceBlueprintContent(service: string, events: EventCatalogEntry[]): string {
	const now = new Date().toISOString();
	const domains = [...new Set(events.map((e) => e.domain))].sort();

	return `---
type: ServiceBlueprintDoc
service: "${service}"
eventCount: ${events.length}
domains:
${domains.map((d) => `  - "${d}"`).join("\n")}
created: "${now}"
---

# ${service} — Service Blueprint

| Property        | Value                    |
| --------------- | ------------------------ |
| **Event Count** | ${events.length}         |
| **Domains**     | ${domains.join(", ")}    |

## 1. Overview

### Purpose

> Define the purpose and business value of this service.

### Scope

> What is in scope and out of scope for this service?

### Service Owner

| Role          | Name | Contact |
| ------------- | ---- | ------- |
| Product Owner |      |         |
| Tech Lead     |      |         |

## 2. User Interactions

### Customer Actions

| Action | Description | Frequency |
| ------ | ----------- | --------- |
|        |             |           |

### Frontstage Interactions

| Touchpoint | Type              | Description |
| ---------- | ----------------- | ----------- |
|            | View / Modal / Command |        |

### User Journey

\`\`\`mermaid
journey
    title User Interaction with ${service}
    section Trigger
      User initiates action: 5: User
    section Process
      ${safeId(service)} handles request: 3: ${service}
    section Result
      User sees outcome: 5: User
\`\`\`

## 3. Technical Details

### Events

${events.map((e) => `- \`${e.type}\` (${e.direction}) — ${e.description}`).join("\n")}

### Dependencies

#### Upstream (this service depends on)

| Service | Dependency Type | Purpose |
| ------- | --------------- | ------- |
|         |                 |         |

#### Downstream (depends on this service)

| Service | Dependency Type | Purpose |
| ------- | --------------- | ------- |
|         |                 |         |

### Data Flows

\`\`\`mermaid
graph LR
    Input[Input]
    ${safeId(service)}[${service}]
    Output[Output]

    Input -->|consumes| ${safeId(service)}
    ${safeId(service)} -->|produces| Output
\`\`\`

### State Management

> Describe stateful behavior, persistence, or caching.

## 4. Operational Concerns

### Performance & SLAs

| Metric        | Target | Measurement |
| ------------- | ------ | ----------- |
| Response Time |        |             |
| Throughput    |        |             |
| Availability  |        |             |

### Failure Modes & Recovery

| Failure Mode | Impact | Recovery Strategy |
| ------------ | ------ | ----------------- |
|              |        |                   |

### Monitoring & Alerting

| Monitor   | Threshold | Alert Channel |
| --------- | --------- | ------------- |
|           |           |               |

### Scaling Considerations

> Horizontal / vertical scaling, bottlenecks, resource limits.

## 5. Architecture Notes

### Design Patterns

### Key Decisions

| Decision | Rationale | Trade-offs |
| -------- | --------- | ---------- |
|          |           |            |

### Technical Debt

| Debt Item | Impact | Plan |
| --------- | ------ | ---- |
|           |        |      |

## Events Reference

${events.map((e) => `- \`${e.type}\` (${e.direction}) — ${e.description}`).join("\n")}

`;
}
