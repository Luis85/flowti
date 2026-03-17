---
type: Idea
stage: discovery
origin: inbox
domain: documentation
parent: "[[Self documenting Frontend PRD]]"
description: "Auto-generate the vault documentation folder from codebase using typedoc and vite JSON exports."
tags:
priority: 2 - high
rank:
---

# Auto-Generate Documentation from Codebase

TypeDoc generates JSON output from TypeScript source code, and Vite can export component metadata as JSON. Flowti could ingest these JSON exports and auto-generate vault documentation — one note per class/interface/component with cross-links to the Event Catalog. This creates a self-documenting frontend where code changes automatically update the vault's reference documentation.
