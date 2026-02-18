---
type: Learning
id: L-17
source: "[[Development Lifecycle]]"
source_pbi: "[[PBI-002 Documentation Sessions]]"
source_increment: 8
domain: architecture
tags:
  - learning
  - obsidian
  - knowledge-graph
---

# L-17: Auto-linking artifacts builds the knowledge graph

When creating a canvas, automatically appending `![[canvas]]` to the session notes file creates a bidirectional link that Obsidian's graph view can traverse. Every auto-link the plugin creates compounds the vault's interconnectedness without manual effort from the user.

## Pattern

- When the plugin creates a file related to another file, auto-link them via wikilinks
- `![[file]]` for embeds, `[[file]]` for references
- This builds the vault's graph automatically — users get interconnectedness for free

## When to Apply

- Session notes → canvas file (embed)
- Event docs → related domain/service/flow docs (reference)
- Any file creation that has a natural parent document
