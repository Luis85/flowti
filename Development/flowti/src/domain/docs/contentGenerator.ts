/**
 * Markdown content generators for entity documentation files.
 *
 * Each generator produces a complete markdown document with YAML frontmatter
 * suitable for creation in the vault via FileSystemClient.
 */

import type { EventCatalogEntry } from "../../infrastructure/events/catalog";

// ─────────────────────────────────────────────────────────────
// Event documentation
// ─────────────────────────────────────────────────────────────

/**
 * Generates markdown content for an event documentation file.
 *
 * Includes YAML frontmatter with structured metadata and a body
 * with event details and space for user notes.
 */
export function generateEventDocContent(entry: EventCatalogEntry): string {
	const now = new Date().toISOString();
	return `---
type: EventDoc
event: "${entry.type}"
description: "${entry.description}"
category: "${entry.category}"
direction: "${entry.direction}"
domain: "${entry.domain}"
services: "${entry.services}"
stability: "${entry.stability}"
visibility: "${entry.visibility}"
created: "${now}"
---

# ${entry.type}

| Property       | Value                  |
| -------------- | ---------------------- |
| **Category**   | ${entry.category}      |
| **Domain**     | ${entry.domain}        |
| **Stability**  | ${entry.stability}     |
| **Visibility** | ${entry.visibility}    |
| **Direction**  | ${entry.direction}     |

## Description

${entry.description}

## When This Event Occurs

> Describe the situations that trigger this event in human terms.

## Why This Event Matters

> Explain what decision or reaction this event enables and why a user might care.

## Typical Use Cases

> List concrete, recognizable scenarios where this event is useful.

## Payload Overview

| Field | Type | Description |
| ----- | ---- | ----------- |
|       |      |             |

> Document the payload fields carried by this event.

## Subscription Guidance

> When should you subscribe to this event? When should you not?

## Related Events

> List preceding, derived, or follow-up events to build an event graph.

## Related Domains & Services

| Property     | Value              |
| ------------ | ------------------ |
| **Domain**   | ${entry.domain}    |
| **Services** | ${entry.services}  |

> Link to domain documentation, service descriptions, data models, or processes.

## Operational Notes

> Advanced notes: idempotency behavior, high-volume considerations, known edge cases.

`;
}

// ─────────────────────────────────────────────────────────────
// Domain documentation
// ─────────────────────────────────────────────────────────────

export function generateDomainDocContent(domain: string, events: EventCatalogEntry[]): string {
	const now = new Date().toISOString();
	const categories = [...new Set(events.map((e) => e.category))].sort();
	const services = [...new Set(events.map((e) => e.services))].sort();

	return `---
type: DomainDoc
domain: "${domain}"
eventCount: ${events.length}
categories:
${categories.map((c) => `  - "${c}"`).join("\n")}
services:
${services.map((s) => `  - "${s}"`).join("\n")}
created: "${now}"
---

# ${domain}

| Property        | Value                          |
| --------------- | ------------------------------ |
| **Event Count** | ${events.length}               |
| **Categories**  | ${categories.join(", ")}       |
| **Services**    | ${services.join(", ")}         |

## Overview

> Describe the purpose and responsibilities of this domain.

## Events

${events.map((e) => `- \`${e.type}\` — ${e.description}`).join("\n")}

## Architecture Notes

> Document key patterns, data flows, and design decisions for this domain.

`;
}

// ─────────────────────────────────────────────────────────────
// Architecture documentation (Arc42 + C4)
// ─────────────────────────────────────────────────────────────

export function generateArchitectureDocContent(domain: string, events: EventCatalogEntry[]): string {
	const now = new Date().toISOString();
	const categories = [...new Set(events.map((e) => e.category))].sort();
	const services = [...new Set(events.map((e) => e.services))].sort();
	const safeId = (s: string) => s.replace(/[^a-zA-Z0-9]/g, "");

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
// Service documentation
// ─────────────────────────────────────────────────────────────

export function generateServiceDocContent(service: string, events: EventCatalogEntry[]): string {
	const now = new Date().toISOString();
	const domains = [...new Set(events.map((e) => e.domain))].sort();

	return `---
type: ServiceDoc
service: "${service}"
eventCount: ${events.length}
domains:
${domains.map((d) => `  - "${d}"`).join("\n")}
created: "${now}"
---

# ${service}

| Property        | Value                    |
| --------------- | ------------------------ |
| **Event Count** | ${events.length}         |
| **Domains**     | ${domains.join(", ")}    |

## Overview

> Describe what this service does and its role in the system.

## Events

${events.map((e) => `- \`${e.type}\` — ${e.description}`).join("\n")}

## Dependencies

> List other services this service depends on or is depended upon by.

`;
}

// ─────────────────────────────────────────────────────────────
// Service blueprint documentation
// ─────────────────────────────────────────────────────────────

export function generateServiceBlueprintContent(service: string, events: EventCatalogEntry[]): string {
	const now = new Date().toISOString();
	const domains = [...new Set(events.map((e) => e.domain))].sort();
	const safeId = (s: string) => s.replace(/[^a-zA-Z0-9]/g, "");

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

// ─────────────────────────────────────────────────────────────
// Category documentation
// ─────────────────────────────────────────────────────────────

export function generateCategoryDocContent(category: string, events: EventCatalogEntry[]): string {
	const now = new Date().toISOString();
	const domains = [...new Set(events.map((e) => e.domain))].sort();
	const services = [...new Set(events.map((e) => e.services))].sort();

	return `---
type: CategoryDoc
category: "${category}"
eventCount: ${events.length}
domains:
${domains.map((d) => `  - "${d}"`).join("\n")}
services:
${services.map((s) => `  - "${s}"`).join("\n")}
created: "${now}"
---

# ${category}

| Property        | Value                          |
| --------------- | ------------------------------ |
| **Event Count** | ${events.length}               |
| **Domains**     | ${domains.join(", ")}          |
| **Services**    | ${services.join(", ")}         |

## Overview

> Describe what this category of events represents.

## Events

${events.map((e) => `- \`${e.type}\` — ${e.description}`).join("\n")}

`;
}

// ─────────────────────────────────────────────────────────────
// System documentation
// ─────────────────────────────────────────────────────────────

export function generateSystemDocContent(name: string): string {
	const now = new Date().toISOString();
	return `---
type: SystemDoc
system: "${name}"
description: ""
domains: []
services: []
created: "${now}"
---

# ${name}

| Property       | Value |
| -------------- | ----- |
| **Domains**    |       |
| **Services**   |       |

## Overview

> Describe what this system does and its role in the business.

## Domains

> List the domains this system encompasses.

## Services

> List the services that make up this system.

## Architecture Notes

> Document key patterns, data flows, and integration points.

`;
}

// ─────────────────────────────────────────────────────────────
// Flow documentation
// ─────────────────────────────────────────────────────────────

export function generateFlowDocContent(name: string): string {
	const now = new Date().toISOString();
	return `---
type: FlowDoc
flow: "${name}"
description: ""
events: []
domains: []
services: []
created: "${now}"
---

# ${name}

| Property       | Value |
| -------------- | ----- |
| **Events**     |       |
| **Domains**    |       |
| **Services**   |       |

## Overview

> Describe what this flow does and when it is triggered.

## Event Sequence

> Document the ordered sequence of events in this flow.

## Domains

> List the domains involved in this flow.

## Services

> List the services that participate in this flow.

## Architecture Notes

> Document key patterns, data flows, and integration points.

`;
}

// ─────────────────────────────────────────────────────────────
// Actor documentation
// ─────────────────────────────────────────────────────────────

export function generateActorDocContent(name: string): string {
	const now = new Date().toISOString();
	return `---
type: ActorDoc
actor: "${name}"
description: ""
events: []
domains: []
services: []
created: "${now}"
---

# ${name}

| Property       | Value |
| -------------- | ----- |
| **Events**     |       |
| **Domains**    |       |
| **Services**   |       |

## Overview

> Describe who this actor is and their role in the system.

## Goals & Needs

> What does this actor want to achieve? What problems do they face?

## Key Events

> List the events most relevant to this actor's workflows.

## Domains

> List the domains this actor interacts with.

## Services

> List the services this actor relies on.

## Notes

> Additional context, edge cases, or behavioral patterns.

`;
}

// ─────────────────────────────────────────────────────────────
// Product documentation
// ─────────────────────────────────────────────────────────────

export function generateProductDocContent(name: string): string {
	const now = new Date().toISOString();
	return `---
type: ProductDoc
product: "${name}"
description: ""
events: []
domains: []
services: []
created: "${now}"
---

# ${name}

| Property       | Value |
| -------------- | ----- |
| **Events**     |       |
| **Domains**    |       |
| **Services**   |       |

## Overview

> Describe what this product is and what it does.

## Key Events

> List the events most relevant to this product.

## Domains

> List the domains this product spans.

## Services

> List the services this product relies on.

## Notes

> Additional context, roadmap, or operational notes.

`;
}
