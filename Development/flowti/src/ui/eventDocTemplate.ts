import type { EventCatalogEntry } from "../infrastructure/events/catalog";

/**
 * Generates the vault-relative file path for an event documentation file.
 *
 * Uses a flat structure — event types are already dot-namespaced
 * (e.g. `plugin.loading`), so category subfolders would be redundant.
 *
 * @param basePath - Base path configured in settings
 * @param eventType - Event type string (e.g. "plugin.loading")
 * @returns Vault-relative path (e.g. "docs/events/plugin.loading.md")
 */
export function getEventDocPath(basePath: string, eventType: string): string {
	const normalizedBase = basePath.replace(/\/+$/, "");
	return `${normalizedBase}/${eventType}.md`;
}

/**
 * Generates markdown content for an event documentation file.
 *
 * Includes YAML frontmatter with structured metadata and a body
 * with event details and space for user notes.
 *
 * @param entry - Event catalog entry with metadata
 * @returns Complete markdown string with frontmatter
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
created: "${now}"
---

# ${entry.type}

${entry.description}

## Metadata

| Property      | Value                |
| ------------- | -------------------- |
| **Type**      | \`${entry.type}\`    |
| **Category**  | ${entry.category}    |
| **Direction** | ${entry.direction}   |
| **Domain**    | ${entry.domain}      |
| **Services**  | ${entry.services}     |

## Payload

> Document the payload fields for this event here.

## Notes

`;
}
