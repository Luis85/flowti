/**
 * Markdown content generators for entity documentation files.
 *
 * Covers: EventDoc, DomainDoc, ServiceDoc, CategoryDoc — entities that
 * take catalog entries as input and produce structured markdown with
 * YAML frontmatter.
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
