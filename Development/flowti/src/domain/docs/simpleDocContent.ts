/**
 * Markdown content generators for simple relational documentation files.
 *
 * Covers: SystemDoc, FlowDoc, ActorDoc, ProductDoc — templates that
 * take only a name and produce skeleton documents with empty frontmatter
 * arrays for user population.
 */

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
